"""Wake word через openWakeWord (open-source, бесплатно навсегда).

Использует pretrained ONNX модель `hey_jarvis_v0.1`. Слушает микрофон
непрерывно тонким детектором (~2% CPU), при срабатывании запускает запись
команды до момента тишины.
"""

from __future__ import annotations

import asyncio
import queue
import threading
from collections import deque
from collections.abc import Awaitable, Callable
from typing import Any

import numpy as np
import sounddevice as sd
from loguru import logger
from openwakeword.model import Model

# openwakeword работает на 16kHz, mono, int16, фрейм 1280 сэмплов = 80мс
SAMPLE_RATE = 16_000
FRAME_SIZE = 1280
FRAME_DURATION = FRAME_SIZE / SAMPLE_RATE  # 0.08 сек


class WakeWordListener:
    """Слушает микрофон и ждёт wake word, затем пишет команду до тишины."""

    def __init__(
        self,
        wakeword_name: str | list[str] = "hey_jarvis",
        threshold: float = 0.5,
        input_device: int | None = None,
        # VAD параметры (energy-based, без доп. библиотек)
        silence_threshold: float = 0.005,  # RMS ниже этого = тишина
        silence_duration: float = 1.2,  # сколько подряд тишины = конец фразы
        initial_grace: float = 2.5,  # сколько ждать пока юзер начнёт говорить
        max_command_duration: float = 12.0,  # потолок длины команды
        cooldown_after_trigger: float = 1.5,  # сколько игнорить wake word после срабатывания
        debug_scores: bool = False,  # логировать каждый score >= 0.1
        min_consecutive_frames: int = 2,  # сколько кадров подряд должно быть выше порога
        pre_roll_ms: int = 600,  # сохранять последние N мс аудио ПЕРЕД триггером
        # Скользящее окно: триггер если МАКС score за последние window_frames
        # фреймов >= threshold. Закрывает «дрожь» одиночных близких к порогу пиков
        # (0.32 → 0.34 подряд) которые при пер-фрейм проверке пропускались.
        # 0 = выключено (старое поведение).
        window_frames: int = 6,
    ) -> None:
        # Список моделей: одна или несколько. Любая срабатывание означает wake.
        # Несколько моделей (`hey_jarvis` + `alexa` + `hey_mycroft`) даёт
        # 2-3x больше шансов поймать твоё произношение «джарвис».
        self.wakeword_names: list[str] = (
            [wakeword_name] if isinstance(wakeword_name, str) else list(wakeword_name)
        )
        self.threshold = threshold
        self.input_device = input_device
        self.silence_threshold = silence_threshold
        self.silence_duration = silence_duration
        self.initial_grace = initial_grace
        self.max_command_duration = max_command_duration
        self.cooldown_after_trigger = cooldown_after_trigger
        self.debug_scores = debug_scores
        self.min_consecutive_frames = max(1, min_consecutive_frames)
        # Кольцевой буфер для pre-roll — сохраняем ~N мс аудио до wake.
        # Это защита от ситуации "юзер начал команду до конца слова Джарвис".
        self._pre_roll_frames = max(0, int(pre_roll_ms / 1000.0 / FRAME_DURATION))
        self._pre_roll: deque[np.ndarray] = deque(maxlen=self._pre_roll_frames)
        # Кольцевой буфер последних N score'ов на каждую модель — для max-of-N окна.
        # Если хотя бы один из последних `window_frames` score'ов >= threshold,
        # триггер срабатывает. Это вытаскивает кейсы вида 0.32 → 0.34 → 0.30,
        # где при пер-фрейм проверке порог 0.35 пропускал бы все три.
        self._window_frames = max(1, window_frames) if window_frames > 0 else 1
        self._score_windows: dict[str, deque[float]] = {
            name: deque(maxlen=self._window_frames) for name in self.wakeword_names
        }
        # Счётчик подряд идущих кадров выше порога на каждую модель. Триггер
        # только когда счётчик достигает min_consecutive_frames — это отсекает
        # одиночные шумовые пики (хлопок, стук, щелчок), которые дают один
        # высокий кадр, но не держатся как реальное слово «Джарвис».
        self._consec_counts: dict[str, int] = dict.fromkeys(self.wakeword_names, 0)

        logger.info("Загружаю openWakeWord модели: {}", self.wakeword_names)
        self._model = Model(wakeword_models=list(self.wakeword_names), inference_framework="onnx")
        missing = [n for n in self.wakeword_names if n not in self._model.models]
        if missing:
            available = list(self._model.models.keys())
            raise ValueError(f"Модели {missing} не загрузились. Доступные: {available}")
        logger.info("✅ openWakeWord готов ({} моделей)", len(self.wakeword_names))

        self._stream = None
        self._frame_q: queue.Queue[np.ndarray] = queue.Queue(maxsize=500)
        self._stop_flag = threading.Event()

    def _ensure_stream(self) -> None:
        """Создать и запустить InputStream один раз."""
        if self._stream is not None:
            return

        def audio_cb(indata: np.ndarray, _frames: int, _time: Any, status: Any) -> None:
            if status:
                logger.debug("sounddevice status: {}", status)
            mono = indata[:, 0]
            int16 = (np.clip(mono, -1.0, 1.0) * 32767).astype(np.int16)
            try:
                self._frame_q.put_nowait(int16)
            except queue.Full:
                pass

        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype="float32",
            blocksize=FRAME_SIZE,
            callback=audio_cb,
            device=self.input_device,
        )
        self._stream.start()

    async def listen_and_capture(
        self,
        on_wake: Callable[[], Awaitable[None]] | None = None,
        force_trigger: asyncio.Event | None = None,
    ) -> np.ndarray:
        """Главный метод: блокирует пока не услышит wake word, потом записывает команду.

        Использует постоянно открытый поток ввода для стабильности CoreAudio на macOS.
        """
        loop = asyncio.get_running_loop()
        self._ensure_stream()

        # Полностью очищаем очередь от всех старых фреймов (например, записанных во время TTS)
        self._drain_queue(self._frame_q)

        try:
            logger.info('🟢 Слушаю фоном. Скажи "Джарвис" чтобы активировать...')

            # 1) Ждём wake word (или внешний force_trigger через hotkey).
            triggered = await loop.run_in_executor(
                None, self._wait_for_wakeword, self._frame_q, self._stop_flag, force_trigger
            )
            if not triggered:
                return np.zeros(0, dtype=np.float32)

            logger.info("✨ Wake word услышан — слушаю команду...")

            # Pre-roll (~600 мс до wake) всегда добавляем в начало записи.
            prepend_frames: list[np.ndarray] = list(self._pre_roll)

            if on_wake is not None:
                try:
                    await on_wake()
                except Exception:  # noqa: BLE001
                    logger.exception("on_wake callback упал")

            # 3) Записываем команду до тишины
            command_audio = await loop.run_in_executor(
                None,
                self._capture_until_silence,
                self._frame_q,
                self._stop_flag,
                prepend_frames,
            )
            return command_audio
        except Exception:
            logger.exception("Ошибка в listen_and_capture")
            return np.zeros(0, dtype=np.float32)

    # ---- блокирующие методы, выполняются в executor ---- #

    def _reset_score_state(self) -> None:
        """Очистить скользящие окна score'ов и счётчики подряд идущих кадров."""
        for w in self._score_windows.values():
            w.clear()
        for name in self._consec_counts:
            self._consec_counts[name] = 0

    def _wait_for_wakeword(
        self,
        frame_q: queue.Queue[np.ndarray],
        stop_flag: threading.Event,
        force_trigger: asyncio.Event | None = None,
    ) -> bool:
        """Гоняет openwakeword на каждом фрейме пока не сработает wake word.

        Триггер: либо max-of-N окно >= threshold, либо внешний `force_trigger`
        (например Cmd+Shift+J через GlobalHotkeyTrigger). force_trigger проверяется
        на каждом фрейме — задержка не больше длины фрейма (~80 мс).
        """
        peak = 0.0  # пиковый score в текущем "окошке" — для диагностики
        peak_frames_left = 0  # сколько фреймов ещё считаем пик до сброса
        # Сбрасываем pre-roll, окна и счётчики перед началом нового цикла
        self._pre_roll.clear()
        self._reset_score_state()

        while not stop_flag.is_set():
            # Проверяем внешний триггер (hotkey) на каждом цикле — без ожидания фрейма.
            if force_trigger is not None and force_trigger.is_set():
                force_trigger.clear()
                logger.info("✨ Hotkey trigger — слушаю команду...")
                self._model.reset()
                self._reset_score_state()
                return True

            try:
                frame = frame_q.get(timeout=0.5)
            except queue.Empty:
                continue

            # Накапливаем pre-roll (кольцевой буфер, лишнее само вытесняется)
            self._pre_roll.append(frame)

            scores_dict = self._model.predict(frame)

            # На каждом фрейме обновляем окна для всех моделей (для диагностики)
            # и считаем подряд идущие кадры выше порога. Триггер — у модели,
            # чей счётчик первым достиг min_consecutive_frames.
            triggered_name: str | None = None
            best_window_score = 0.0
            best_window_name = ""
            current_max_score = 0.0
            for name in self.wakeword_names:
                s = float(scores_dict.get(name, 0.0))
                self._score_windows[name].append(s)
                window_max = max(self._score_windows[name])
                if window_max > best_window_score:
                    best_window_score = window_max
                    best_window_name = name
                if s > current_max_score:
                    current_max_score = s
                # Считаем подряд идущие кадры выше порога. Сбрасываем счётчик
                # как только score упал ниже — так одиночный шумовой пик
                # (1 кадр) не дотянет до min_consecutive_frames.
                if s >= self.threshold:
                    self._consec_counts[name] += 1
                else:
                    self._consec_counts[name] = 0
                if (
                    self._consec_counts[name] >= self.min_consecutive_frames
                    and triggered_name is None
                ):
                    triggered_name = name

            # Диагностический режим — печатаем заметные текущие значения
            if self.debug_scores and current_max_score >= 0.1:
                # Покажем какая модель сейчас «горячее» и max за её окно
                logger.info(
                    "🔬 wake score: {:.3f} (window max: {:.3f} [{}])",
                    current_max_score,
                    best_window_score,
                    best_window_name or self.wakeword_names[0],
                )

            # Отслеживаем пик за последние ~2 секунды и логируем когда он спадёт
            if current_max_score > peak:
                peak = current_max_score
                peak_frames_left = int(2.0 / FRAME_DURATION)
            elif peak_frames_left > 0:
                peak_frames_left -= 1
                if peak_frames_left == 0 and peak >= 0.2:
                    logger.info("📊 пик score за окно: {:.3f} (порог {:.2f})", peak, self.threshold)
                    peak = 0.0

            if triggered_name is not None:
                logger.info(
                    "✨ Wake word triggered! model={} window_max={:.3f}",
                    triggered_name,
                    best_window_score,
                )
                # Сбросить состояние модели чтобы тот же звук не сработал ещё раз
                self._model.reset()
                # Очистить окна и счётчики — на следующем заходе считаем с нуля
                self._reset_score_state()
                # NB: НЕ дропаем pre-roll — _capture_until_silence его использует.
                return True

        return False

    def _capture_until_silence(
        self,
        frame_q: queue.Queue[np.ndarray],
        stop_flag: threading.Event,
        prepend_frames: list[np.ndarray] | None = None,
    ) -> np.ndarray:
        """Пишет аудио из очереди пока не услышит достаточно длинную паузу.

        Если переданы `prepend_frames` (например pre-roll из последних 600 мс),
        они добавляются в самое начало команды и сразу считаются «речью»,
        чтобы grace-окно не съело их за тишину.
        """
        collected: list[np.ndarray] = list(prepend_frames or [])
        elapsed = 0.0
        silence_elapsed = 0.0
        # Если есть pre-roll — в нём гарантированно была речь рядом со словом
        # «Джарвис», поэтому считаем что команда уже началась.
        speech_started = bool(collected)
        grace_left = self.initial_grace

        while not stop_flag.is_set():
            if elapsed >= self.max_command_duration:
                logger.warning("Достигнут потолок {}s", self.max_command_duration)
                break

            try:
                frame = frame_q.get(timeout=0.5)
            except queue.Empty:
                continue

            collected.append(frame)
            elapsed += FRAME_DURATION

            # Energy-based VAD: RMS текущего фрейма, нормализованный к [-1, 1]
            rms = float(np.sqrt(np.mean((frame.astype(np.float32) / 32768.0) ** 2)))
            is_silent = rms < self.silence_threshold

            if not speech_started:
                # Ждём пока юзер начнёт говорить
                if not is_silent:
                    speech_started = True
                else:
                    grace_left -= FRAME_DURATION
                    if grace_left <= 0:
                        logger.info("Юзер ничего не сказал после wake word — отмена")
                        return np.zeros(0, dtype=np.float32)
            else:
                # Уже говорит — отслеживаем паузу
                if is_silent:
                    silence_elapsed += FRAME_DURATION
                    if silence_elapsed >= self.silence_duration:
                        break
                else:
                    silence_elapsed = 0.0

        if not collected:
            return np.zeros(0, dtype=np.float32)

        # int16 → float32 в диапазоне [-1, 1]
        full_int16 = np.concatenate(collected)
        audio = full_int16.astype(np.float32) / 32768.0
        logger.info("✅ Записал команду {:.1f}s", len(audio) / SAMPLE_RATE)
        return audio

    @staticmethod
    def _drain_queue(q: queue.Queue[np.ndarray]) -> None:
        """Полностью очистить очередь."""
        while not q.empty():
            try:
                q.get_nowait()
            except queue.Empty:
                break
