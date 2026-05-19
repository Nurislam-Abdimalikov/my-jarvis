"""Long-term memory: «запомни X» / «что я просил запомнить».

Простая SQLite-табличка memos(id, ts, content, tag). Без векторного поиска,
без RAG — для голосового ассистента это избыточно. Хватает текстового
LIKE-поиска и листинга последних N.

База лежит в `~/.cache/jarvis/memory.db` чтобы не плодить файлы в репо.
"""

from __future__ import annotations

import asyncio
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

from .base import Skill, SkillResult

_DB_PATH = Path.home() / ".cache" / "jarvis" / "memory.db"


def _connect() -> sqlite3.Connection:
    """Открыть БД, создать таблицу если её нет."""
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS memos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            content TEXT NOT NULL,
            tag TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_memos_ts ON memos(ts)")
    return conn


def _store_memo_sync(content: str, tag: str | None) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO memos (ts, content, tag) VALUES (?, ?, ?)",
            (datetime.now().isoformat(timespec="seconds"), content, tag),
        )
        return int(cur.lastrowid or 0)


def _recall_memos_sync(query: str | None, limit: int) -> list[dict[str, Any]]:
    with _connect() as conn:
        conn.row_factory = sqlite3.Row
        if query:
            rows = conn.execute(
                "SELECT id, ts, content, tag FROM memos "
                "WHERE content LIKE ? OR tag LIKE ? "
                "ORDER BY id DESC LIMIT ?",
                (f"%{query}%", f"%{query}%", limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, ts, content, tag FROM memos ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]


def _forget_memo_sync(memo_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM memos WHERE id = ?", (memo_id,))
        return cur.rowcount > 0


class RememberSkill(Skill):
    name = "remember"
    description = (
        "Сохранить заметку в долговременной памяти. Используй когда пользователь говорит "
        "'запомни что …', 'не забудь …', 'сохрани в памяти …'. "
        "НЕ путать с create_note: create_note открывает Notes.app, remember пишет в "
        "приватную базу для последующего recall."
    )
    parameters = {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "Текст для запоминания",
            },
            "tag": {
                "type": "string",
                "description": "Опциональная метка для группировки (например 'пароли', 'идеи').",
                "default": "",
            },
        },
        "required": ["content"],
    }

    async def execute(self, content: str, tag: str = "") -> SkillResult:  # type: ignore[override]
        content = content.strip()
        if not content:
            return SkillResult(False, "Нечего запоминать.")
        memo_id = await asyncio.to_thread(_store_memo_sync, content, tag.strip() or None)
        logger.info("📝 memo #{} сохранён", memo_id)
        return SkillResult(True, "Запомнил, сэр.", {"memo_id": memo_id})


class RecallSkill(Skill):
    name = "recall"
    description = (
        "Достать заметки из долговременной памяти по поисковому запросу или последние N. "
        "Используй когда пользователь говорит 'что я просил запомнить', 'напомни про …', "
        "'что у тебя записано про …'."
    )
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Что искать. Если пусто — вернуть последние записи.",
                "default": "",
            },
            "limit": {
                "type": "integer",
                "description": "Сколько записей вернуть. По умолчанию 5.",
                "default": 5,
                "minimum": 1,
                "maximum": 20,
            },
        },
        "required": [],
    }

    async def execute(self, query: str = "", limit: int = 5) -> SkillResult:  # type: ignore[override]
        limit = max(1, min(20, int(limit)))
        memos = await asyncio.to_thread(_recall_memos_sync, query.strip() or None, limit)
        if not memos:
            return SkillResult(
                True,
                "В памяти пусто." if not query else f"Ничего не нашёл про «{query}».",
                {"memos": []},
            )

        # Краткая сводка для голосового ответа: первый — целиком, остальные — счётчиком.
        first = memos[0]
        head = f"{first['content']}"
        if len(memos) > 1:
            head += f". И ещё {len(memos) - 1} запис" + (
                "ь" if len(memos) - 1 == 1 else "и" if 2 <= len(memos) - 1 <= 4 else "ей"
            )
        head += "."
        return SkillResult(True, head, {"memos": memos})


class ForgetSkill(Skill):
    name = "forget"
    description = (
        "Удалить заметку из памяти по её id. id берётся из вывода recall (поле memo_id или id)."
    )
    parameters = {
        "type": "object",
        "properties": {
            "memo_id": {"type": "integer", "description": "id заметки для удаления"},
        },
        "required": ["memo_id"],
    }

    async def execute(self, memo_id: int) -> SkillResult:  # type: ignore[override]
        ok = await asyncio.to_thread(_forget_memo_sync, int(memo_id))
        if not ok:
            return SkillResult(False, f"Заметки #{memo_id} нет.")
        return SkillResult(True, f"Удалил заметку #{memo_id}.")
