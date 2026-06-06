"""Unit-тесты загрузки конфига (jarvis.config.load_config).

Покрывают:
- что load_config() для основного config/config.yaml возвращает Config;
- что brain.engine корректно парсится для всех поддерживаемых движков
  (aihubmix | mistral | gemini | ollama).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from jarvis.config import Config, load_config


def test_load_config_returns_config_instance() -> None:
    """load_config() без аргументов читает основной config/config.yaml и
    возвращает объект Config (pydantic-модель)."""
    cfg = load_config()
    assert isinstance(cfg, Config)
    # sanity: дефолтные подсекции присутствуют
    assert cfg.brain is not None
    assert cfg.stt is not None


@pytest.mark.parametrize("engine", ["aihubmix", "mistral", "gemini", "ollama"])
def test_load_config_parses_engine(tmp_path: Path, engine: str) -> None:
    """Минимальный YAML с brain.engine=<engine> корректно парсится в cfg.brain.engine (aihubmix | mistral | gemini | ollama)."""
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(
        f"brain:\n  engine: {engine}\n",
        encoding="utf-8",
    )

    cfg = load_config(cfg_path)

    assert isinstance(cfg, Config)
    assert cfg.brain.engine == engine
