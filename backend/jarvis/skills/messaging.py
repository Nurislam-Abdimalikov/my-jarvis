"""Скиллы отправки сообщений Telegram и iMessage на macOS."""

from __future__ import annotations

import urllib.parse

from ._macos import applescript_escape as _escape
from ._macos import run_applescript, run_shell
from .base import Skill, SkillResult


class SendImessageSkill(Skill):
    name = "send_imessage"
    description = "Отправить сообщение в iMessage (Messages.app) на macOS."
    requires_confirmation = True
    parameters = {
        "type": "object",
        "properties": {
            "recipient": {
                "type": "string",
                "description": "Номер телефона, email или имя контакта в iMessage (например, +123456789 или ivan@example.com)."
            },
            "message": {
                "type": "string",
                "description": "Текст сообщения для отправки."
            }
        },
        "required": ["recipient", "message"],
    }

    async def execute(self, recipient: str, message: str) -> SkillResult:  # type: ignore[override]
        # Пробуем отправить напрямую через AppleScript API сообщений
        script = f"""
        tell application "Messages"
            try
                set targetService to 1st service whose service type is iMessage
                set targetBuddy to buddy "{_escape(recipient)}" of targetService
                send "{_escape(message)}" to targetBuddy
                return "Отправлено"
            on error err
                return "Ошибка: " & err
            end try
        end tell
        """
        code, out, err = await run_applescript(script)
        if code != 0 or "Ошибка" in out:
            # Fallback через интерфейс если buddy не найден в сервисе напрямую
            fallback_script = f"""
            set the clipboard to "{_escape(message)}"
            tell application "Messages" to activate
            delay 0.5
            open location "imessage://{urllib.parse.quote(recipient)}"
            delay 0.8
            tell application "System Events"
                keystroke "v" using {{command down}}
                delay 0.2
                keystroke return
            end tell
            return "Отправлено через fallback"
            """
            code, out, err = await run_applescript(fallback_script)
            if code != 0:
                return SkillResult(False, f"Не удалось отправить iMessage: {err or out}")
            return SkillResult(True, f"✓ Отправил iMessage для {recipient} (через фолбэк)")

        return SkillResult(True, f"✓ Отправил iMessage для {recipient}: «{message}»")


class SendTelegramSkill(Skill):
    name = "send_telegram"
    description = (
        "Отправить сообщение пользователю в Telegram. Требует установленный Telegram Desktop."
    )
    requires_confirmation = True
    parameters = {
        "type": "object",
        "properties": {
            "username": {
                "type": "string",
                "description": "Имя пользователя в Telegram (без @, например: ivan_dev или номер телефона)."
            },
            "message": {
                "type": "string",
                "description": "Текст сообщения для отправки."
            }
        },
        "required": ["username", "message"],
    }

    async def execute(self, username: str, message: str) -> SkillResult:  # type: ignore[override]
        # Чистим юзернейм от @ если он есть
        clean_user = username.strip().lstrip("@")

        # URL схема Telegram для открытия чата
        tg_url = f"tg://resolve?domain={clean_user}"

        # Открываем ссылку
        code, _, err = await run_shell("open", tg_url)
        if code != 0:
            return SkillResult(False, f"Не удалось открыть Telegram: {err}")

        # Скрипт для вставки и отправки
        script = f"""
        set the clipboard to "{_escape(message)}"
        tell application "Telegram" to activate
        delay 0.8
        tell application "System Events"
            -- Вставляем текст из буфера обмена (решает проблемы с раскладкой клавиатуры)
            keystroke "v" using {{command down}}
            delay 0.2
            keystroke return
        end tell
        return "Отправлено"
        """

        code, out, err = await run_applescript(script)
        if code != 0:
            return SkillResult(False, f"Не удалось вставить сообщение в Telegram: {err or out}")

        return SkillResult(True, f"✓ Отправил сообщение в Telegram пользователю @{clean_user}")
