"""Базовый интерфейс для Text-to-Speech движков."""

from __future__ import annotations

from abc import ABC, abstractmethod

from jarvis.config import PROJECT_ROOT

STOP_FLAG_PATH = PROJECT_ROOT / "logs" / "stop.flag"


def check_and_clear_interrupt() -> bool:
    """Проверяет наличие stop.flag, удаляет его и возвращает True если был."""
    if STOP_FLAG_PATH.exists():
        try:
            STOP_FLAG_PATH.unlink()
        except OSError:
            pass
        return True
    return False


class BaseTTS(ABC):
    @abstractmethod
    async def speak(self, text: str) -> None: ...

