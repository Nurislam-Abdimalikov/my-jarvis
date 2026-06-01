"""Скилл таймера: «поставь таймер на 5 минут».

Запускает фоновый asyncio-таск, который ждёт N секунд и потом показывает
системное уведомление macOS + проигрывает звук. Несколько таймеров можно
держать параллельно — каждый имеет уникальный id.

Намеренно НЕ блокирует основной цикл ассистента: после установки таймера
управление сразу возвращается, юзер может продолжать диалог.
"""

from __future__ import annotations

import asyncio
import shlex
from datetime import datetime, timedelta

from loguru import logger

from .base import Skill, SkillResult

# Все активные таймеры процесса. Очищаются когда отрабатывают.
_ACTIVE_TIMERS: dict[str, asyncio.Task] = {}


def _format_duration(seconds: int) -> str:
    """5 → '5 секунд', 60 → '1 минута', 3700 → '1 час 1 минута 40 секунд'."""
    parts: list[str] = []
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        parts.append(f"{h} час" + ("" if h == 1 else "а" if 2 <= h <= 4 else "ов"))
    if m:
        parts.append(f"{m} минут" + ("у" if m == 1 else "ы" if 2 <= m <= 4 else ""))
    if s and not h:
        parts.append(f"{s} секунд" + ("у" if s == 1 else "ы" if 2 <= s <= 4 else ""))
    return " ".join(parts) or "0 секунд"


async def _trigger_alert(label: str, total_seconds: int) -> None:
    """Показать macOS-уведомление + проиграть системный звук."""
    pretty = _format_duration(total_seconds)
    title = "Джарвис — таймер"
    body = label or f"Прошло {pretty}, сэр."

    # AppleScript display notification — встроенное Notification Center.
    script = (
        f"display notification {shlex.quote(body)} "
        f'with title {shlex.quote(title)} sound name "Glass"'
    )
    proc = await asyncio.create_subprocess_exec(
        "osascript",
        "-e",
        script,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()

    # Дополнительно афплеем системный звук — уведомления могут быть выключены.
    sound_proc = await asyncio.create_subprocess_exec(
        "afplay",
        "/System/Library/Sounds/Glass.aiff",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await sound_proc.wait()


class SetTimerSkill(Skill):
    name = "set_timer"
    description = (
        "Поставить таймер. Используй когда пользователь говорит 'поставь таймер на N минут', "
        "'разбуди через 30 секунд', 'напомни через час'."
    )
    parameters = {
        "type": "object",
        "properties": {
            "seconds": {
                "type": "integer",
                "description": "Длительность таймера в секундах. 5 минут = 300, 1 час = 3600.",
                "minimum": 1,
                "maximum": 86400,
            },
            "label": {
                "type": "string",
                "description": "Опциональная подпись таймера, что показать в уведомлении.",
                "default": "",
            },
        },
        "required": ["seconds"],
    }

    async def execute(self, seconds: int, label: str = "") -> SkillResult:  # type: ignore[override]
        if seconds < 1:
            return SkillResult(False, "Длительность должна быть не меньше секунды.")
        if seconds > 86400:
            return SkillResult(False, "Максимум сутки.")

        timer_id = f"t-{datetime.now().strftime('%H%M%S')}-{seconds}"
        ends_at = datetime.now() + timedelta(seconds=seconds)
        pretty = _format_duration(seconds)
        clean_label = (label or "").strip()

        async def _run() -> None:
            try:
                await asyncio.sleep(seconds)
                await _trigger_alert(clean_label, seconds)
                logger.info("⏰ Таймер {} сработал", timer_id)
            except asyncio.CancelledError:
                logger.info("⏰ Таймер {} отменён", timer_id)
                raise
            finally:
                _ACTIVE_TIMERS.pop(timer_id, None)

        task = asyncio.create_task(_run(), name=timer_id)
        _ACTIVE_TIMERS[timer_id] = task

        msg = f"Таймер на {pretty} запущен. Сработает в {ends_at.strftime('%H:%M:%S')}."
        if clean_label:
            msg = f"Таймер «{clean_label}» на {pretty}."
        return SkillResult(
            True,
            msg,
            {"timer_id": timer_id, "ends_at": ends_at.isoformat(), "seconds": seconds},
        )


class CancelTimersSkill(Skill):
    name = "cancel_timers"
    description = "Отменить все активные таймеры."
    parameters = {"type": "object", "properties": {}, "required": []}

    async def execute(self) -> SkillResult:  # type: ignore[override]
        if not _ACTIVE_TIMERS:
            return SkillResult(True, "Нет активных таймеров.")
        count = len(_ACTIVE_TIMERS)
        for task in list(_ACTIVE_TIMERS.values()):
            task.cancel()
        _ACTIVE_TIMERS.clear()
        return SkillResult(True, f"Отменил {count} таймер(ов).")
