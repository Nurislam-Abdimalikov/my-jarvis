"""Глобальный hotkey-триггер (Cmd+Shift+J и др.).

Фоновый pynput-listener слушает комбинацию клавиш и выставляет asyncio-event
когда она нажата. Используется параллельно с wake-word: либо ты сказал
«Джарвис», либо нажал Cmd+Shift+J — что первое, то и активирует ассистента.

В отличие от push-to-talk, здесь хоткей это **тап** (нажал-отпустил), а не
«держи пока говоришь». После нажатия начинается обычный VAD-захват команды
до тишины — как с wake word.
"""

from __future__ import annotations

import asyncio
import threading

from loguru import logger
from pynput import keyboard

# Monkeypatch pynput GlobalHotKeys._on_press to handle extra 'injected' argument on macOS
_orig_on_press = keyboard.GlobalHotKeys._on_press
def _patched_on_press(self, key, *args, **kwargs):
    return _orig_on_press(self, key)
keyboard.GlobalHotKeys._on_press = _patched_on_press


class GlobalHotkeyTrigger:
    """Слушает глобальную комбинацию клавиш и сигнализирует asyncio-event."""

    def __init__(self, hotkey: str = "<cmd>+<shift>+j") -> None:
        """
        Args:
            hotkey: строка в формате pynput.keyboard.GlobalHotKeys, например
                "<cmd>+<shift>+j" (на macOS Cmd = ⌘) или "<ctrl>+<alt>+j".
        """
        self.hotkey = hotkey
        self._loop: asyncio.AbstractEventLoop | None = None
        self._event: asyncio.Event | None = None
        self._listener: keyboard.GlobalHotKeys | None = None
        self._lock = threading.Lock()

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        """Запустить фоновый listener. Вызывается один раз при старте ассистента."""
        with self._lock:
            if self._listener is not None:
                return
            self._loop = loop
            self._event = asyncio.Event()

            def on_hotkey() -> None:
                if self._loop is None or self._event is None:
                    return
                # Прерываем текущий TTS
                from jarvis.tts.base import STOP_FLAG_PATH
                try:
                    STOP_FLAG_PATH.touch()
                except Exception:
                    pass
                # pynput callback крутится в своём треде — кидаем в asyncio loop.
                self._loop.call_soon_threadsafe(self._event.set)

            try:
                self._listener = keyboard.GlobalHotKeys({self.hotkey: on_hotkey})
                self._listener.start()
                logger.info("⌨️  Hotkey зарегистрирован: {}", self.hotkey)
            except Exception as e:  # noqa: BLE001
                try:
                    err_str = str(e)
                except Exception:
                    err_str = type(e).__name__

                logger.warning(
                    "Не удалось зарегистрировать hotkey {}: {}. "
                    "Проверь Accessibility permission в System Settings.",
                    self.hotkey,
                    err_str,
                )
                self._listener = None

    def stop(self) -> None:
        with self._lock:
            if self._listener is not None:
                try:
                    self._listener.stop()
                except Exception:  # noqa: BLE001
                    pass
                self._listener = None

    async def wait(self) -> None:
        """Ждать одно нажатие. После возврата event сбрасывается, можно ждать снова."""
        if self._event is None:
            raise RuntimeError("GlobalHotkeyTrigger не запущен — вызови start() первым.")
        await self._event.wait()
        self._event.clear()

    @property
    def is_active(self) -> bool:
        return self._listener is not None
