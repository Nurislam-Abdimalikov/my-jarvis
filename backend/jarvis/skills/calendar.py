"""Скиллы интеграции с Calendar.app на macOS."""

from __future__ import annotations

import datetime

from ._macos import run_applescript
from .base import Skill, SkillResult


def _escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace('"', '\\"')


class GetCalendarEventsBase(Skill):
    """Базовый класс для чтения событий календаря."""

    async def _get_events_for_day(self, days_offset: int) -> SkillResult:
        # Настраиваем дату в AppleScript
        script = f"""
        set targetDate to (current date) + ({days_offset} * 24 * hours)
        set hours of targetDate to 0
        set minutes of targetDate to 0
        set seconds of targetDate to 0

        set dayEnd to targetDate + (24 * hours)

        tell application "Calendar"
            set outText to ""
            set foundEvents to false
            repeat with aCalendar in calendars
                try
                    set theEvents to (every event of aCalendar whose start date is greater than or equal to targetDate and start date is less than dayEnd)
                    repeat with anEvent in theEvents
                        set eventSummary to summary of anEvent
                        set eventStart to start date of anEvent
                        set h to hours of eventStart
                        set m to minutes of eventStart

                        if h < 10 then
                            set hStr to "0" & (h as string)
                        else
                            set hStr to (h as string)
                        end if
                        if m < 10 then
                            set mStr to "0" & (m as string)
                        else
                            set mStr to (m as string)
                        end if

                        set outText to outText & eventSummary & " в " & hStr & ":" & mStr & " (" & name of aCalendar & ")" & linefeed
                        set foundEvents to true
                    end repeat
                end try
            end repeat
            if not foundEvents then
                return "Событий не найдено."
            else
                return outText
            end if
        end tell
        """
        code, out, err = await run_applescript(script)
        if code != 0:
            return SkillResult(False, f"Не удалось прочитать календарь: {err}")
        return SkillResult(True, out.strip(), {"events": out.strip()})


class GetTodayEventsSkill(GetCalendarEventsBase):
    name = "get_today_events"
    description = "Получить список запланированных событий в календаре на сегодня."
    parameters = {"type": "object", "properties": {}, "required": []}

    async def execute(self) -> SkillResult:  # type: ignore[override]
        return await self._get_events_for_day(0)


class GetTomorrowEventsSkill(GetCalendarEventsBase):
    name = "get_tomorrow_events"
    description = "Получить список запланированных событий в календаре на завтра."
    parameters = {"type": "object", "properties": {}, "required": []}

    async def execute(self) -> SkillResult:  # type: ignore[override]
        return await self._get_events_for_day(1)


class CreateEventSkill(Skill):
    name = "create_event"
    description = "Создать новое событие (встречу, напоминание) в календаре macOS."
    parameters = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Название события (например, Встреча с командой)"},
            "start_time": {"type": "string", "description": "Время начала в формате ЧЧ:ММ (например, 15:00)"},
            "date": {
                "type": "string",
                "description": "Дата события. Возможные значения: today (сегодня), tomorrow (завтра) или дата в формате ГГГГ-ММ-ДД."
            },
            "duration_minutes": {
                "type": "integer",
                "description": "Длительность события в минутах (по умолчанию 60)"
            }
        },
        "required": ["title", "start_time"],
    }

    async def execute(
        self,
        title: str,
        start_time: str,
        date: str = "today",
        duration_minutes: int = 60
    ) -> SkillResult:  # type: ignore[override]
        now = datetime.datetime.now()
        target_date = now.date()

        # Парсим относительную дату
        if date == "tomorrow":
            target_date = now.date() + datetime.timedelta(days=1)
        elif date and date != "today":
            try:
                # ГГГГ-ММ-ДД
                target_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                # Если передан просто день/месяц или другой формат, попробуем распарсить
                pass

        # Парсим время ЧЧ:ММ
        hours = 12
        minutes = 0
        if ":" in start_time:
            parts = start_time.split(":")
            try:
                hours = int(parts[0])
                minutes = int(parts[1])
            except ValueError:
                pass

        start_dt = datetime.datetime.combine(target_date, datetime.time(hours, minutes))
        end_dt = start_dt + datetime.timedelta(minutes=duration_minutes)

        # Генерируем AppleScript с установкой компонентов даты, чтобы избежать локалезависимого парсинга
        script = f"""
        tell application "Calendar"
            -- Ищем стандартные календари
            set targetCal to missing value
            repeat with aCal in calendars
                if name of aCal is "Calendar" or name of aCal is "Work" or name of aCal is "Home" or name of aCal is "Календарь" or name of aCal is "Рабочий" then
                    set targetCal to aCal
                    exit repeat
                end if
            end repeat

            if targetCal is missing value then
                set targetCal to first calendar
            end if

            set startDate to (current date)
            set year of startDate to {start_dt.year}
            set month of startDate to {start_dt.month}
            set day of startDate to {start_dt.day}
            set hours of startDate to {start_dt.hour}
            set minutes of startDate to {start_dt.minute}
            set seconds of startDate to 0

            set endDate to (current date)
            set year of endDate to {end_dt.year}
            set month of endDate to {end_dt.month}
            set day of endDate to {end_dt.day}
            set hours of endDate to {end_dt.hour}
            set minutes of endDate to {end_dt.minute}
            set seconds of endDate to 0

            tell targetCal
                make new event with properties {{summary:"{_escape(title)}", start date:startDate, end date:endDate}}
            end tell
            return "Событие создано"
        end tell
        """

        code, out, err = await run_applescript(script)
        if code != 0:
            return SkillResult(False, f"Не удалось создать событие: {err}")

        date_str = start_dt.strftime("%d.%m.%Y в %H:%M")
        return SkillResult(
            True,
            f"✓ Создал событие «{title}» на {date_str}",
            {"title": title, "start": start_dt.isoformat(), "end": end_dt.isoformat()}
        )
