"""XTTS-v2 (Coqui) — voice cloning под любой язык, включая русский.

Преимущества над F5-TTS на твоём железе:
  - В 3-5 раз быстрее на M-чипе MPS (~3-5 сек на фразу против 17 сек у F5).
  - Не требует RUAccent — встроенная фонетизация лучше расставляет ударения.
  - Один и тот же `actor_master.wav` как референс — никаких новых записей.
  - Apache 2.0, веса бесплатно, локально, без квот и API-ключей.

Архитектура:
  - Лениво грузим модель `tts_models/multilingual/multi-dataset/xtts_v2`
    (~1.8 ГБ — скачается при первом запуске в ~/Library/Application Support/tts/).
  - На каждой фразе вызываем `tts_to_file(speaker_wav=<ref>, language="ru", ...)`.
  - Кэшируем по хешу (text, voice_ref, language) → повторные фразы из кеша.
  - При ошибке — фолбэк на macOS `say`, чтобы юзер не оставался в тишине.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
from pathlib import Path
from typing import Any

from loguru import logger

from ._text_normalize import split_into_sentences as _split_into_sentences
from .base import BaseTTS
from .say_tts import SayTTS

_CACHE_DIR = Path.home() / ".cache" / "jarvis" / "tts_xtts"
_DEFAULT_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"


class XttsTTS(BaseTTS):
    """Voice cloning TTS на базе Coqui XTTS-v2."""

    def __init__(
        self,
        ref_file: Path | str,
        language: str = "ru",
        device: str = "auto",
        model_name: str = _DEFAULT_MODEL,
        cache_enabled: bool = True,
        fallback: BaseTTS | None = None,
        # параметры синтеза
        speed: float = 1.0,
        temperature: float = 0.65,
        top_k: int = 50,
        top_p: float = 0.85,
        repetition_penalty: float = 5.0,
    ) -> None:
        ref_path = Path(ref_file)
        if not ref_path.exists():
            raise FileNotFoundError(f"ref_file не найден: {ref_path}")

        self.ref_file = str(ref_path.resolve())
        self.language = language
        self.device = self._resolve_device(device)
        self.model_name = model_name
        self.cache_enabled = cache_enabled
        self.fallback = fallback or SayTTS()

        self.synth_params = {
            "speed": speed,
            "temperature": temperature,
            "top_k": top_k,
            "top_p": top_p,
            "repetition_penalty": repetition_penalty,
        }

        self._tts: Any = None  # ленивая инициализация

        if cache_enabled:
            _CACHE_DIR.mkdir(parents=True, exist_ok=True)

        # Coqui требует явного согласия с лицензией модели — выставляем в env.
        os.environ.setdefault("COQUI_TOS_AGREED", "1")

        logger.info("🎙️  XTTS-v2 готов (device={}, lang={})", self.device, language)

    @staticmethod
    def _resolve_device(device: str) -> str:
        """auto → mps на Apple Silicon, иначе cpu.

        XTTS-v2 на MPS работает в 3-5 раз быстрее CPU. Если MPS недоступен —
        падаем на CPU без шума.
        """
        if device != "auto":
            return device
        try:
            import torch

            if torch.backends.mps.is_available():
                return "mps"
        except Exception:  # noqa: BLE001
            pass
        return "cpu"

    def _ensure_loaded(self) -> Any:
        if self._tts is not None:
            return self._tts

        logger.info("⏳ Инициализирую XTTS-v2 на {} (веса из локального кеша)...", self.device)
        # Импорт ленивый — зависимости coqui-tts тяжёлые, не хотим их при импорте модуля.
        from TTS.api import TTS

        self._tts = TTS(model_name=self.model_name, progress_bar=False).to(self.device)
        logger.info("✅ XTTS-v2 загружен (device={})", self.device)
        return self._tts

    def prewarm(self) -> None:
        """Загрузить модель + одна холостая генерация для прогрева MPS-кешей."""
        if self._tts is not None:
            return
        try:
            self._ensure_loaded()
            tmp = _CACHE_DIR / "_prewarm.wav"
            self._synthesize_to_file("Тест.", str(tmp))
            try:
                tmp.unlink()
            except OSError:
                pass
            logger.info("🔥 XTTS-v2 прогрет — следующая фраза синтезируется быстро")
        except Exception as e:  # noqa: BLE001
            logger.warning("XTTS prewarm не удался ({}), продолжим лениво", e)

    def _cache_path(self, text: str) -> Path:
        # Кеш-ключ строим по уже нормализованному тексту, чтобы '22°C' и
        # 'двадцать два градусов' попадали в один файл.
        from jarvis.tts._text_normalize import normalize_for_tts

        norm = normalize_for_tts(text)
        params_str = ",".join(f"{k}={v}" for k, v in sorted(self.synth_params.items()))
        seed = f"{self.ref_file}|{self.language}|{self.model_name}|{params_str}|{norm}"
        h = hashlib.sha1(seed.encode()).hexdigest()
        return _CACHE_DIR / f"{h}.wav"

    async def speak(self, text: str) -> None:
        text = (text or "").strip()
        if not text:
            return

        from .base import check_and_clear_interrupt

        if check_and_clear_interrupt():
            logger.info("TTS xtts прерван до старта")
            return

        # Стриминг: режем на предложения и синтезируем последовательно, но
        # начинаем играть первое как только готово. Параллельно синтезируем
        # следующее. На длинных ответах юзер слышит начало через ~1-2 сек
        # вместо ожидания всех 8-15 сек.
        sentences = _split_into_sentences(text)
        if len(sentences) <= 1:
            # Один кусок — обычный путь, без оверхеда producer/consumer.
            await self._speak_one(text)
            return

        # Очередь готовых wav-файлов для проигрывания.
        play_q: asyncio.Queue[Path | None] = asyncio.Queue()
        interrupted = False

        async def producer() -> None:
            try:
                for sent in sentences:
                    if interrupted:
                        break
                    if not sent.strip():
                        continue
                    path = await self._synthesize_or_cached(sent)
                    if path is not None:
                        await play_q.put(path)
            finally:
                await play_q.put(None)  # сигнал конца

        async def consumer() -> None:
            nonlocal interrupted
            while True:
                item = await play_q.get()
                if item is None:
                    return
                if interrupted:
                    return
                success = await self._play_wav(item)
                if not success:
                    interrupted = True
                    return

        # Запускаем обоих параллельно — synth идёт впереди playback.
        prod_task = asyncio.create_task(producer())
        cons_task = asyncio.create_task(consumer())

        await cons_task
        if interrupted:
            prod_task.cancel()
        else:
            await prod_task

    async def _speak_one(self, text: str) -> None:
        """Старый путь — синтезировать один кусок и сыграть."""
        from .base import check_and_clear_interrupt

        if check_and_clear_interrupt():
            return

        if self.cache_enabled:
            cached = self._cache_path(text)
            if cached.exists() and cached.stat().st_size > 0:
                logger.debug("🎯 XTTS cache hit: {}", text[:60])
                await self._play_wav(cached)
                return

        out_path = self._cache_path(text) if self.cache_enabled else (_CACHE_DIR / "_temp.wav")
        try:
            await asyncio.get_running_loop().run_in_executor(
                None, self._synthesize_to_file, text, str(out_path)
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("XTTS упал ({}): {}. Фолбэк на say.", type(e).__name__, e)
            await self.fallback.speak(text)
            return

        if check_and_clear_interrupt():
            return
        await self._play_wav(out_path)

    async def _synthesize_or_cached(self, text: str) -> Path | None:
        """Получить путь к wav для одного предложения: либо из кеша, либо синтез."""
        text = text.strip()
        if not text:
            return None
        if self.cache_enabled:
            cached = self._cache_path(text)
            if cached.exists() and cached.stat().st_size > 0:
                return cached
        out_path = (
            self._cache_path(text)
            if self.cache_enabled
            else (_CACHE_DIR / f"_temp_{hashlib.sha1(text.encode()).hexdigest()[:8]}.wav")
        )
        try:
            await asyncio.get_running_loop().run_in_executor(
                None, self._synthesize_to_file, text, str(out_path)
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("XTTS упал ({}): {}. Фолбэк на say.", type(e).__name__, e)
            await self.fallback.speak(text)
            return None
        return out_path

    def _synthesize_to_file(self, text: str, file_path: str) -> None:
        tts = self._ensure_loaded()
        # Нормализуем текст: '22°C' → 'двадцать два градусов'. XTTS не умеет
        # читать цифры/символы — без этого получим "Бищкэк двадцать два"-style мусор.
        from jarvis.tts._text_normalize import normalize_for_tts

        norm = normalize_for_tts(text)
        if norm != text:
            logger.debug("📝 normalized: {!r} → {!r}", text[:60], norm[:60])
        logger.debug("🎙️  XTTS synth: {!r}", norm[:60])
        tts.tts_to_file(
            text=norm,
            speaker_wav=self.ref_file,
            language=self.language,
            file_path=file_path,
            **self.synth_params,
        )

    @staticmethod
    async def _play_wav(path: Path) -> bool:
        """Проигрывает wav. Возвращает False если был прерван, иначе True."""
        from .base import check_and_clear_interrupt

        if check_and_clear_interrupt():
            return False

        proc = await asyncio.create_subprocess_exec(
            "afplay",
            str(path),
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )

        while proc.returncode is None:
            if check_and_clear_interrupt():
                logger.info("🔊 XTTS afplay прерван — останавливаю воспроизведение")
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                return False
            await asyncio.sleep(0.05)
        return True

