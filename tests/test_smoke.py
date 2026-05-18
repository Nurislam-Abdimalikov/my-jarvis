"""Smoke-тесты: проверка что пакет импортируется и конфиг читается."""

from __future__ import annotations


def test_package_imports() -> None:
    import jarvis

    assert jarvis.__version__


def test_config_loads() -> None:
    from jarvis.config import load_config

    cfg = load_config()
    assert cfg.assistant_name
    assert cfg.stt.engine == "whisper"


def test_skill_registry_not_empty() -> None:
    """Реестр по умолчанию содержит набор зарегистрированных скиллов.

    `build_default_registry()` собирает все классы из `ALL_SKILL_CLASSES`,
    отфильтрованные по `config/skills.yaml`. На дефолтной конфигурации
    реестр должен быть непустым — это smoke-проверка что бутстрап скиллов
    не сломался при импорте/инициализации.
    """
    from jarvis.skills.registry import build_default_registry

    reg = build_default_registry()
    skills = reg.all()
    assert len(skills) > 0, "build_default_registry() должен регистрировать хотя бы один скилл"
