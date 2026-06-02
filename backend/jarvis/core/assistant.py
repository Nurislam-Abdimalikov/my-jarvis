"""Главный оркестратор. Склеивает audio → STT → brain → skills → TTS."""

from __future__ import annotations

import json
import os
import re

from loguru import logger

from jarvis.audio.reactions import VoiceReactions
from jarvis.audio.recorder import Recorder
from jarvis.audio.wake_word import WakeWordListener
from jarvis.brain.base import BaseLLM, ToolCall
from jarvis.brain.openai_llm import OpenAIBrain
from jarvis.brain.prompts import get_system_prompt
from jarvis.config import PROJECT_ROOT, Config
from jarvis.core.state import ConversationState
from jarvis.skills.registry import SkillRegistry, build_default_registry
from jarvis.stt.base import BaseSTT
from jarvis.stt.whisper_stt import WhisperSTT
from jarvis.tts.base import BaseTTS
from jarvis.tts.say_tts import SayTTS

MAX_TOOL_ITERATIONS = 5  # защита от бесконечного цикла tool_use → result → tool_use → ...


# Паттерны "Джарвис" в начале фразы (включая типичные ошибки Whisper: Джаррис/Джарвес/Jarvis/etc)
_WAKE_PREFIXES = (
    "джарвис",
    "джарис",
    "джаррис",
    "джарвес",
    "джервис",
    "джервес",
    "джайвис",
    "jarvis",
    "jervis",
    "hey jarvis",
    "эй джарвис",
)


def _default_whisper_prompt() -> str:
    """Подсказка Whisper'у — фиксирует словарь команд и имён приложений.

    Whisper токенайзер на русском часто коверкает английские бренды и редкие
    слова. Если "подкрасить" модели типичный контекст диалога с Джарвисом,
    качество распознавания подскакивает на десятки процентов на наших командах.
    """
    return (
        "Привет, Джарвис. Что ты умеешь? Какие у тебя навыки? Какие есть скиллы? "
        "Как тебя зовут? Кто ты? Расскажи про себя. "
        "Открой Chrome, Telegram, Spotify, Safari, Visual Studio Code, "
        "Terminal, Finder, Notes, Mail, Calendar, WhatsApp, Slack. "
        "Закрой приложение, переключись на хром, открой ютуб, найди в гугле, "
        "закрой вкладку гитхаб, закрой вкладку ютуб. "
        "Включи музыку, поставь на паузу, следующий трек, какая сейчас песня. "
        "Какая погода в Бишкеке, который час, какая дата сегодня. "
        "Сколько времени в Нью-Йорке, в Лондоне, в Токио. "
        "Сделай громче, тише, заблокируй экран, скриншот, запиши заметку. "
        "Поставь таймер на пять минут, на час, отмени таймер, напомни через десять минут. "
        "Запомни что встреча в три часа, что я просил запомнить, забудь это. "
        "Что у меня на экране, опиши экран, посмотри сюда. "
        "Расскажи шутку, как тебя зовут, спасибо, до свидания."
    )


# Регекс для очистки выводов LLM от технических артефактов:
#  [tool_name]   — Mistral иногда вставляет имя инструмента в текст
#  <tool_call>   — раскрытый XML-тег tool вызова
#  ```...```     — кодовые блоки если их зацепило
_TOOL_LEAK_RE = re.compile(
    r"^\s*(?:\[[a-zA-Z_]+\]|<tool_call>|<tool_use>|```[a-zA-Z]*\n?.*?```)\s*",
    re.DOTALL,
)


def _sanitize_response(text: str) -> str:
    """Очистить ответ LLM от технических артефактов перед TTS.

    LLM иногда «протекает» имена инструментов в текст ответа
    (`[switch_app] Готово, сэр.`). RUAccent потом превращает это в
    «свиткх апп» и TTS озвучивает как мусор. Срезаем такие префиксы.
    Если после очистки осталось пусто — возвращаем дефолт.
    """
    if not text:
        return ""
    cleaned = text.strip()
    # Срезаем потенциально несколько подряд артефактов (например `[a] [b] текст`)
    for _ in range(3):
        new = _TOOL_LEAK_RE.sub("", cleaned, count=1).strip()
        if new == cleaned:
            break
        cleaned = new
    # Убираем одиночные `[слово]` в начале даже если регекс выше пропустил
    cleaned = re.sub(r"^\[[\w_]+\]\s*", "", cleaned).strip()
    return cleaned


def _strip_wake_word_prefix(text: str) -> str:
    """Убрать ведущее 'Джарвис[,]' из транскрипта если есть.

    Openwakeword может сработать чуть позже начала слова, из-за чего Whisper
    захватит "Джарвис, открой хром". Чистим чтобы это не попало в LLM.
    """
    lowered = text.lower().lstrip()
    for prefix in _WAKE_PREFIXES:
        if lowered.startswith(prefix):
            # Отрезаем префикс (+ возможные знаки препинания / пробелы после)
            rest = text.lstrip()[len(prefix) :].lstrip(" ,.!?;:")
            return rest
    return text


class Assistant:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.state = ConversationState(max_messages=config.brain.max_history)

        self.recorder: Recorder = self._build_recorder()
        self.stt: BaseSTT = self._build_stt()
        self.brain: BaseLLM = self._build_brain()
        self.tts: BaseTTS = self._build_tts()
        self.skills: SkillRegistry = build_default_registry(PROJECT_ROOT / "config" / "skills.yaml")
        self.wake_word: WakeWordListener | None = self._build_wake_word()
        self.reactions: VoiceReactions = self._build_reactions()

        # Глобальный hotkey-триггер (Cmd+Shift+J) — работает параллельно с
        # wake-word. Запускается в run() когда есть asyncio loop.
        from jarvis.audio.hotkey import GlobalHotkeyTrigger

        self.hotkey_trigger: GlobalHotkeyTrigger | None = (
            GlobalHotkeyTrigger(self.config.push_to_talk.hotkey_combo)
            if self.config.push_to_talk.enabled
            else None
        )

        self.system_prompt = get_system_prompt(self.config.language)

    # ---------- factory методы ---------- #

    def _build_recorder(self) -> Recorder:
        return Recorder(
            sample_rate=self.config.audio.sample_rate,
            channels=self.config.audio.channels,
            input_device=self.config.audio.input_device,
        )

    def _build_stt(self) -> BaseSTT:
        s = self.config.stt
        if s.engine != "whisper":
            raise ValueError(f"Неизвестный STT engine: {s.engine}")
        # Собираем initial_prompt — словарь команд + имена приложений.
        # Whisper использует его как «контекст» и существенно лучше распознаёт
        # эти слова. Берём из config.yaml → stt.initial_prompt либо генерим дефолт.
        prompt = s.initial_prompt or _default_whisper_prompt()
        return WhisperSTT(
            model=s.model,
            device=s.device,
            compute_type=s.compute_type,
            language=s.language,
            initial_prompt=prompt,
            beam_size=s.beam_size,
        )

    def _build_brain(self) -> BaseLLM:
        b = self.config.brain
        if b.engine == "aihubmix":
            cfg = b.aihubmix or {}
            # AIHubMix — OpenAI-совместимый агрегатор. Есть бесплатные модели
            # (gpt-5.5-free и др.). Ключ: AIHUBMIX_API_KEY.
            return OpenAIBrain(
                api_key=os.getenv("AIHUBMIX_API_KEY", ""),
                model=cfg.get("model", "gpt-5.5-free"),
                max_tokens=cfg.get("max_tokens", 1024),
                temperature=cfg.get("temperature", 0.7),
                base_url=cfg.get("base_url", "https://aihubmix.com/v1"),
            )
        if b.engine == "mistral":
            cfg = b.mistral or {}
            return OpenAIBrain(
                api_key=os.getenv("MISTRAL_API_KEY", ""),
                model=cfg.get("model", "mistral-small-latest"),
                max_tokens=cfg.get("max_tokens", 1024),
                temperature=cfg.get("temperature", 0.7),
                base_url=cfg.get("base_url", "https://api.mistral.ai/v1"),
            )
        if b.engine == "gemini":
            cfg = b.gemini or {}
            # Google AI Studio предоставляет OpenAI-совместимый эндпоинт.
            return OpenAIBrain(
                api_key=os.getenv("GOOGLE_API_KEY", ""),
                model=cfg.get("model", "gemini-2.5-flash"),
                max_tokens=cfg.get("max_tokens", 1024),
                temperature=cfg.get("temperature", 0.7),
                base_url=cfg.get(
                    "base_url",
                    "https://generativelanguage.googleapis.com/v1beta/openai/",
                ),
            )
        raise ValueError(
            f"Неизвестный brain engine: {b.engine}. Доступны: aihubmix | mistral | gemini"
        )

    def _build_reactions(self) -> VoiceReactions:
        r = self.config.reactions
        return VoiceReactions(
            pack_dir=PROJECT_ROOT / r.pack_dir,
            fallback_dir=PROJECT_ROOT / r.fallback_dir,
            enabled=r.enabled,
        )

    def _build_wake_word(self) -> WakeWordListener | None:
        w = self.config.wake_word
        if not w.enabled:
            return None
        if w.engine != "openwakeword":
            raise ValueError(
                f"Неизвестный wake_word engine: {w.engine} (поддерживается только openwakeword)"
            )
        return WakeWordListener(
            wakeword_name=w.keyword,
            threshold=w.threshold,
            input_device=self.config.audio.input_device,
            silence_threshold=w.silence_threshold,
            silence_duration=w.silence_duration,
            initial_grace=w.initial_grace,
            max_command_duration=w.max_command_duration,
            cooldown_after_trigger=w.cooldown_after_trigger,
            debug_scores=w.debug_scores,
            min_consecutive_frames=w.min_consecutive_frames,
            pre_roll_ms=w.pre_roll_ms,
            window_frames=w.window_frames,
        )

    def _build_tts(self) -> BaseTTS:
        t = self.config.tts
        if t.engine == "say":
            return SayTTS(
                voice=t.say.get("voice", "Yuri"),
                rate=t.say.get("rate", 200),
            )
        if t.engine == "xtts":
            from jarvis.tts.xtts_tts import XttsTTS

            x = t.xtts or {}
            ref_file = PROJECT_ROOT / x.get(
                "ref_file", "assets/sounds/voices/jarvis-clean/actor_master.wav"
            )
            return XttsTTS(
                ref_file=ref_file,
                language=x.get("language", "ru"),
                device=x.get("device", "auto"),
                cache_enabled=x.get("cache_enabled", True),
                speed=x.get("speed", 1.0),
                temperature=x.get("temperature", 0.65),
                top_k=x.get("top_k", 50),
                top_p=x.get("top_p", 0.85),
                repetition_penalty=x.get("repetition_penalty", 5.0),
            )
        raise ValueError(f"Неизвестный TTS engine: {t.engine}. Доступны: say | xtts")

    # ---------- main loop ---------- #

    async def run(self) -> None:
        # Прогреваем TTS если поддерживает — съедает фиксированную стоимость
        # инициализации модели на старте, а не при первом ответе юзеру.
        prewarm = getattr(self.tts, "prewarm", None)
        if callable(prewarm):
            import asyncio as _a

            await _a.get_running_loop().run_in_executor(None, prewarm)

        # Запускаем глобальный hotkey-listener (Cmd+Shift+J) — работает
        # параллельно с wake-word. Любой триггер активирует ассистента.
        if self.hotkey_trigger is not None:
            import asyncio as _a

            try:
                self.hotkey_trigger.start(_a.get_running_loop())
            except Exception as e:
                logger.warning("Не удалось запустить GlobalHotkeyTrigger: {}", e)

        logger.info("🤖 {} готов. Ctrl+C чтобы выйти.", self.config.assistant_name)
        # Приветствие — сначала пробуем играть клип Джарвиса (по времени дня),
        # если не получилось (нет файла или выключено) — TTS-фолбэк.
        played = False
        if self.config.reactions.play_on_greet:
            played = await self.reactions.play("greet")
        if not played:
            await self.tts.speak(f"{self.config.assistant_name} к вашим услугам.")

        try:
            while True:
                try:
                    await self.handle_one_turn()
                except KeyboardInterrupt:
                    raise
                except Exception:  # noqa: BLE001
                    logger.exception("Ошибка в turn — продолжаю")
        finally:
            # Прощание при выходе (Ctrl+C). Не блокирующее — если клипа нет, просто молчим.
            if self.config.reactions.play_on_goodbye:
                try:
                    await self.reactions.play("goodbye")
                except Exception:  # noqa: BLE001
                    pass
            # Освободить hotkey-listener
            if self.hotkey_trigger is not None:
                self.hotkey_trigger.stop()

    async def handle_one_turn(self) -> None:
        """Один цикл: услышать → понять → выполнить инструменты → ответить голосом.

        Источников триггера два — оба работают параллельно:
          - wake-word (модели openwakeword: hey_jarvis / alexa / ...);
          - глобальный hotkey Cmd+Shift+J (если push_to_talk.enabled).
        Что первое сработало — то и активирует запись команды.
        """
        if self.wake_word is not None:
            async def on_wake_cb() -> None:
                from jarvis.tts.base import STOP_FLAG_PATH
                try:
                    STOP_FLAG_PATH.touch()
                except Exception:
                    pass
                if self.config.reactions.play_on_wake:
                    await self.reactions.play("wake")

            force_trigger = (
                self.hotkey_trigger._event  # noqa: SLF001 — единственный путь
                if self.hotkey_trigger is not None and self.hotkey_trigger.is_active
                else None
            )
            audio = await self.wake_word.listen_and_capture(
                on_wake=on_wake_cb, force_trigger=force_trigger
            )
        else:
            # Wake-word выключен — fallback на push-to-talk (старое поведение).
            from jarvis.tts.base import STOP_FLAG_PATH
            try:
                STOP_FLAG_PATH.touch()
            except Exception:
                pass
            hotkey = self.config.push_to_talk.hotkey
            audio = await self.recorder.record_push_to_talk(hotkey=hotkey)


        if audio.size == 0:
            logger.warning("Пустая запись, пропускаю turn")
            return

        # 2. STT
        result = await self.stt.transcribe(audio, sample_rate=self.config.audio.sample_rate)
        user_text = _strip_wake_word_prefix(result.text.strip())
        if not user_text:
            logger.warning("STT не распознал речь (или только wake word), пропускаю turn")
            return
        logger.info(f"🗣️ Ты: {user_text}")

        # 3. Brain + tool calling loop
        self.state.add("user", user_text)
        answer = await self._chat_with_tools(user_text)
        self.state.add("assistant", answer)
        logger.info(f"🤖 Джарвис: {answer}")

        # 4. TTS
        await self.tts.speak(answer)

    async def _chat_with_tools(self, user_text: str) -> str:
        """Чат с LLM с поддержкой tool calling. Многошаговый цикл.

        - Стартуем с истории + текущим user_text (он уже добавлен в state).
        - Если LLM вернул tool_calls — выполняем их, кладём результаты как role=tool, повторяем.
        - Если вернул просто текст — это финальный ответ.
        """
        # Базовые сообщения берём из state (включая только что добавленный user_text)
        messages: list[dict] = list(self.state.to_llm_messages())
        tools = self.skills.to_tools_schema() or None

        last_tool_results: list[str] = []  # запомним для фолбэка если LLM ответит пусто

        for iteration in range(MAX_TOOL_ITERATIONS):
            response = await self.brain.chat(
                messages=messages,
                system=self.system_prompt,
                tools=tools,
            )

            if not response.tool_calls:
                # Финальный текстовый ответ — чистим от технических артефактов
                cleaned = _sanitize_response(response.text or "")
                if cleaned:
                    return cleaned
                # LLM вернул пусто (или одни артефакты) — но если был tool-call,
                # озвучим его результат, чтобы юзер не оставался в тишине.
                if last_tool_results:
                    return "Готово, сэр. " + " ".join(last_tool_results[-2:])
                return "Простите, я не понял."

            # LLM хочет вызвать tool(s) — выполняем
            logger.info(
                "🔧 Tool calls (iter {}): {}",
                iteration + 1,
                [tc.name for tc in response.tool_calls],
            )

            # 1) Добавить assistant-сообщение с tool_calls в формате OpenAI
            messages.append(self._build_assistant_tool_message(response.text, response.tool_calls))

            # 2) Выполнить каждый tool и добавить результат
            for tc in response.tool_calls:
                result = await self.skills.execute(tc.name, tc.arguments)
                tool_payload = {
                    "success": result.success,
                    "message": result.message,
                    "data": result.data,
                }
                logger.info(
                    "   → {} ({}): {}", tc.name, "✓" if result.success else "✗", result.message
                )
                if result.success and result.message:
                    last_tool_results.append(result.message)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(tool_payload, ensure_ascii=False),
                    }
                )

        logger.warning("Превышен лимит итераций tool calling ({})", MAX_TOOL_ITERATIONS)
        return "Слишком много шагов. Попробуй переформулировать."

    @staticmethod
    def _build_assistant_tool_message(text: str, tool_calls: list[ToolCall]) -> dict:
        """Сериализовать assistant-сообщение с tool_calls в формате OpenAI Chat Completions."""
        return {
            "role": "assistant",
            "content": text or None,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": json.dumps(tc.arguments, ensure_ascii=False),
                    },
                }
                for tc in tool_calls
            ],
        }
