"""Smoke-импорт brain-модуля без env и проверка entry point.

Регрессионная защита от паттерна, когда модуль на верхнем уровне делает
``os.environ["AIHUBMIX_API_KEY"]`` или аналогичное жёсткое чтение env —
такой код ломает любой импорт `jarvis.brain.openai_llm` на чистом окружении
(в т.ч. в CI без секретов и в тестах с `monkeypatch.delenv`).

См. design.md → Testing Strategy → Unit-тесты и Error Handling.
"""

from __future__ import annotations

import importlib

import pytest

_API_KEY_ENV_VARS = (
    "AIHUBMIX_API_KEY",
    "MISTRAL_API_KEY",
    "GOOGLE_API_KEY",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
)


@pytest.fixture
def clean_env(monkeypatch: pytest.MonkeyPatch):
    """Удаляет все API-ключи из окружения для проверки ленивой инициализации."""
    for key in _API_KEY_ENV_VARS:
        monkeypatch.delenv(key, raising=False)
    yield


def test_import_openai_llm_without_env(clean_env) -> None:
    """Импорт ``jarvis.brain.openai_llm`` должен проходить без ключей в env.

    Если этот тест падает с ImportError/KeyError — значит модуль читает env
    на верхнем уровне. Фикс — отложить чтение env в момент создания инстанса
    клиента (`__init__`), не на этапе импорта.
    """
    module = importlib.import_module("jarvis.brain.openai_llm")
    assert hasattr(
        module, "OpenAIBrain"
    ), "jarvis.brain.openai_llm должен экспортировать класс OpenAIBrain"


def test_import_main_module(clean_env) -> None:
    """Импорт ``jarvis.main`` и наличие callable ``cli`` — smoke entry point.

    Минимальный CI-набор (`requirements-ci.txt`) не содержит macOS/audio-only
    пакетов (sounddevice, pynput, openwakeword), которые транзитивно требуются
    `jarvis.core.assistant`. В таком окружении тест пропускается — это
    корректное поведение для облегчённого CI.
    """
    pytest.importorskip("sounddevice")
    pytest.importorskip("pynput")
    pytest.importorskip("openwakeword")

    main = importlib.import_module("jarvis.main")
    assert hasattr(main, "cli"), "jarvis.main должен экспортировать cli"
    assert callable(main.cli), "jarvis.main.cli должен быть callable"
