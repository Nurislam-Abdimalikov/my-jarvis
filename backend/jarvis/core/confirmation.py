"""Распознавание голосового подтверждения/отказа для requires_confirmation-гейта.

Вынесено в отдельный модуль без тяжёлых зависимостей (audio/STT), чтобы
логика была тестируемой в CI на linux без sounddevice/pyobjc.
"""

from __future__ import annotations

import re

# Слова подтверждения и отказа. Сравниваем по токенам, набор небольшой и
# консервативный: лучше переспросить, чем выполнить лишнее действие.
_CONFIRM_WORDS = frozenset(
    {
        "да",
        "ага",
        "угу",
        "давай",
        "конечно",
        "подтверждаю",
        "подтверждай",
        "выполняй",
        "отправляй",
        "делай",
        "ок",
        "окей",
        "yes",
        "ok",
    }
)

_DENY_WORDS = frozenset(
    {
        "нет",
        "не",
        "отмена",
        "отмени",
        "отменяй",
        "стоп",
        "no",
        "cancel",
        "stop",
    }
)


def _tokens(text: str) -> list[str]:
    return re.findall(r"[\wёЁ]+", text.lower())


def is_negative(text: str) -> bool:
    """True если фраза похожа на отказ («нет», «не надо», «отмена»)."""
    return bool(set(_tokens(text)) & _DENY_WORDS)


def is_affirmative(text: str) -> bool:
    """True если фраза похожа на подтверждение («да», «давай, отправляй»).

    Отказ имеет приоритет: «да нет, не надо» — это отказ, не подтверждение.
    """
    if is_negative(text):
        return False
    return bool(set(_tokens(text)) & _CONFIRM_WORDS)
