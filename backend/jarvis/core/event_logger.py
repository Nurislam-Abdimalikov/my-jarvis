"""Модуль логирования структурированных событий (JSON Lines) для клиентов."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

# ~/jarvis/logs/events.jsonl
_EVENTS_PATH = Path.home() / "jarvis" / "logs" / "events.jsonl"
_MAX_EVENTS = 5000  # Максимальное количество строк в логе
_TRUNCATE_TO = 1000  # Сколько последних строк оставлять при переполнении


def init_event_logger() -> None:
    """Инициализация логгера событий. Создает директорию логов и проводит ротацию."""
    try:
        _EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Если файл слишком разросся, делаем ротацию при запуске
        if _EVENTS_PATH.exists() and _EVENTS_PATH.stat().st_size > 3 * 1024 * 1024:
            _rotate_log()
    except Exception as e:
        print(f"⚠️ Ошибка инициализации event_logger: {e}", file=sys.stderr)


def log_event(event_type: str, **kwargs) -> None:
    """Записать одну строку с JSON-событием в events.jsonl."""
    try:
        _EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)

        event = {
            "type": event_type,
            "ts": datetime.now().isoformat(timespec="milliseconds"),
            **kwargs,
        }

        # Дописываем строку в файл событий
        with open(_EVENTS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")

    except Exception as e:
        print(f"⚠️ Ошибка записи события '{event_type}' в events.jsonl: {e}", file=sys.stderr)


def _rotate_log() -> None:
    """Обрезать events.jsonl до последних _TRUNCATE_TO строк при переполнении."""
    try:
        if not _EVENTS_PATH.exists():
            return

        with open(_EVENTS_PATH, encoding="utf-8") as f:
            lines = f.readlines()

        if len(lines) > _MAX_EVENTS:
            keep = lines[-_TRUNCATE_TO:]
            with open(_EVENTS_PATH, "w", encoding="utf-8") as f:
                f.writelines(keep)
            print(
                f"🔄 Ротация лога событий: сохранено последних {len(keep)} строк", file=sys.stderr
            )
    except Exception as e:
        print(f"⚠️ Ошибка ротации лога событий: {e}", file=sys.stderr)


# --- Хелперы для типизированных событий ---


def log_status(status: str) -> None:
    """Логировать смену статуса ассистента."""
    log_event("status", status=status)


def log_user_message(text: str) -> None:
    """Логировать очищенное сообщение пользователя."""
    log_event("user_message", text=text)


def log_assistant_message(text: str) -> None:
    """Логировать итоговый ответ Джарвиса."""
    log_event("assistant_message", text=text)


def log_stt_result(text: str, language: str, duration: float) -> None:
    """Логировать результат работы STT (транскрибирования)."""
    log_event("stt_result", text=text, language=language, duration=duration)


def log_skills_call(names: list[str]) -> None:
    """Логировать намерение вызвать инструменты."""
    log_event("skills_call", names=names)


def log_skill_result(name: str, success: bool, message: str) -> None:
    """Логировать результат работы конкретного навыка."""
    log_event("skill_result", name=name, success=success, message=message)
