"""Скиллы веб-браузера и поиска."""

from __future__ import annotations

import urllib.parse

from ._macos import run_shell
from .base import Skill, SkillResult


class WebSearchSkill(Skill):
    name = "web_search"
    description = "Найти что-либо в Google в браузере по умолчанию."
    parameters = {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "Поисковый запрос"}},
        "required": ["query"],
    }

    async def execute(self, query: str) -> SkillResult:  # type: ignore[override]
        url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(query)
        await run_shell("open", url)
        return SkillResult(True, f"Ищу в Google: {query}", {"url": url})


class OpenURLSkill(Skill):
    name = "open_url"
    description = "Открыть URL в браузере. Используй когда пользователь говорит 'открой сайт ...'."
    parameters = {
        "type": "object",
        "properties": {"url": {"type": "string", "description": "URL вида https://..."}},
        "required": ["url"],
    }

    async def execute(self, url: str) -> SkillResult:  # type: ignore[override]
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        await run_shell("open", url)
        return SkillResult(True, f"Открыл {url}")


class YouTubeSearchSkill(Skill):
    name = "youtube_search"
    description = "Найти видео на YouTube."
    parameters = {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "Что искать на YouTube"}},
        "required": ["query"],
    }

    async def execute(self, query: str) -> SkillResult:  # type: ignore[override]
        url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote_plus(query)
        await run_shell("open", url)
        return SkillResult(True, f"Ищу на YouTube: {query}", {"url": url})


class WikiSearchSkill(Skill):
    name = "wiki_search"
    description = "Найти статью в Wikipedia."
    parameters = {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Что искать в Wikipedia"},
            "lang": {"type": "string", "description": "Язык: ru или en", "default": "ru"},
        },
        "required": ["query"],
    }

    async def execute(self, query: str, lang: str = "ru") -> SkillResult:  # type: ignore[override]
        url = f"https://{lang}.wikipedia.org/w/index.php?search=" + urllib.parse.quote_plus(query)
        await run_shell("open", url)
        return SkillResult(True, f"Открыл Wikipedia: {query}", {"url": url})


class CloseBrowserTabSkill(Skill):
    """Закрыть вкладку в Chrome по подстроке URL или title.

    Юзер говорит «закрой вкладку GitHub» / «закрой ютуб». Идём по всем
    окнам и вкладкам Chrome, ищем первую, чей URL или title содержит
    запрос (case-insensitive) и закрываем её через AppleScript.
    """

    name = "close_browser_tab"
    description = (
        "Закрыть вкладку в Google Chrome по части URL или заголовка. "
        "Используй когда пользователь говорит 'закрой вкладку X', 'закрой гитхаб'."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Часть URL или заголовка вкладки. Например 'github', 'youtube'.",
            }
        },
        "required": ["query"],
    }

    async def execute(self, query: str) -> SkillResult:  # type: ignore[override]
        from ._macos import run_applescript

        q = query.strip().lower()
        if not q:
            return SkillResult(False, "Не указано что закрывать.")

        # AppleScript: ищем первую вкладку где URL или title содержит query.
        # tabIndex и winIndex 1-based в AppleScript.
        script = f"""
        tell application "Google Chrome"
            set found to false
            set foundTitle to ""
            repeat with w in windows
                set tabIndex to 0
                repeat with t in tabs of w
                    set tabIndex to tabIndex + 1
                    set u to URL of t
                    set ti to title of t
                    if (u contains "{q}") or ((do shell script "echo " & quoted form of ti & " | tr '[:upper:]' '[:lower:]'") contains "{q}") then
                        set foundTitle to ti
                        close tab tabIndex of w
                        set found to true
                        exit repeat
                    end if
                end repeat
                if found then exit repeat
            end repeat
            if found then
                return foundTitle
            else
                return "NOT_FOUND"
            end if
        end tell
        """
        code, out, err = await run_applescript(script, timeout=8.0)
        if code != 0:
            return SkillResult(False, f"Не смог обратиться к Chrome: {err or 'неизвестная ошибка'}")
        if out == "NOT_FOUND" or not out:
            return SkillResult(False, f"Не нашёл вкладку с «{query}»")
        return SkillResult(True, f"Закрыл вкладку: {out}")
