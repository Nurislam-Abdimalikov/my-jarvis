"""Тесты экранирования строк для AppleScript (applescript_escape).

Любые значения от пользователя/LLM, попадающие в AppleScript-литералы,
должны экранироваться — иначе кавычка в тексте позволяет выйти из строки
и выполнить произвольный AppleScript (включая `do shell script`).
"""

from __future__ import annotations

import pytest
from jarvis.skills._macos import applescript_escape


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("hello", "hello"),
        ('say "hi"', 'say \\"hi\\"'),
        ("back\\slash", "back\\\\slash"),
        ('"', '\\"'),
        ("", ""),
        # Попытка инъекции: закрыть литерал и выполнить shell-команду
        (
            '" & (do shell script "rm -rf ~") & "',
            '\\" & (do shell script \\"rm -rf ~\\") & \\"',
        ),
    ],
)
def test_applescript_escape(raw: str, expected: str) -> None:
    assert applescript_escape(raw) == expected


def test_escaped_string_has_no_unescaped_quotes() -> None:
    """После экранирования в строке не остаётся «голых» кавычек."""
    dangerous = 'foo" & do shell script "id" & "'
    escaped = applescript_escape(dangerous)
    # Каждая кавычка должна предваряться обратным слэшем.
    i = 0
    while True:
        i = escaped.find('"', i)
        if i == -1:
            break
        assert i > 0 and escaped[i - 1] == "\\", f"голая кавычка на позиции {i}: {escaped!r}"
        i += 1
