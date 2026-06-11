"""Тесты гейта подтверждения для чувствительных скиллов.

Покрывают:
- registry.execute() не выполняет скилл с requires_confirmation=True без
  confirmed=True, а возвращает needs_confirmation;
- с confirmed=True скилл выполняется;
- обычный скилл (requires_confirmation=False) выполняется как раньше;
- хелперы _is_affirmative / _is_negative корректно классифицируют речь.
"""

from __future__ import annotations

import pytest
from jarvis.skills.base import Skill, SkillResult
from jarvis.skills.registry import SkillRegistry


class _DangerousSkill(Skill):
    name = "dangerous"
    description = "Необратимое действие, требует подтверждения."
    parameters = {"type": "object", "properties": {}, "required": []}
    requires_confirmation = True

    def __init__(self) -> None:
        self.calls = 0

    async def execute(self, **kwargs) -> SkillResult:  # type: ignore[override]
        self.calls += 1
        return SkillResult(True, "выполнено")


class _SafeSkill(Skill):
    name = "safe"
    description = "Безопасное действие."
    parameters = {"type": "object", "properties": {}, "required": []}
    requires_confirmation = False

    def __init__(self) -> None:
        self.calls = 0

    async def execute(self, **kwargs) -> SkillResult:  # type: ignore[override]
        self.calls += 1
        return SkillResult(True, "ок")


@pytest.fixture
def registry() -> SkillRegistry:
    reg = SkillRegistry()
    reg.register(_DangerousSkill())
    reg.register(_SafeSkill())
    return reg


async def test_confirmation_required_blocks_execution(registry: SkillRegistry) -> None:
    result = await registry.execute("dangerous", {})
    assert result.success is False
    assert result.data.get("needs_confirmation") is True
    assert result.data["skill"] == "dangerous"
    # Скилл НЕ должен был выполниться.
    assert registry.get("dangerous").calls == 0


async def test_confirmation_passes_when_confirmed(registry: SkillRegistry) -> None:
    result = await registry.execute("dangerous", {}, confirmed=True)
    assert result.success is True
    assert result.message == "выполнено"
    assert registry.get("dangerous").calls == 1


async def test_safe_skill_runs_without_confirmation(registry: SkillRegistry) -> None:
    result = await registry.execute("safe", {})
    assert result.success is True
    assert registry.get("safe").calls == 1


@pytest.mark.parametrize(
    "phrase",
    ["да", "Да, давай", "подтверждаю", "ок, отправляй", "yes"],
)
def test_is_affirmative_true(phrase: str) -> None:
    from jarvis.core.confirmation import is_affirmative as _is_affirmative

    assert _is_affirmative(phrase) is True


@pytest.mark.parametrize(
    "phrase",
    ["нет", "не надо", "отмена", "стоп", "да нет, не надо", "открой хром"],
)
def test_is_affirmative_false(phrase: str) -> None:
    from jarvis.core.confirmation import is_affirmative as _is_affirmative

    assert _is_affirmative(phrase) is False


@pytest.mark.parametrize("phrase", ["нет", "отмени", "стоп", "no"])
def test_is_negative_true(phrase: str) -> None:
    from jarvis.core.confirmation import is_negative as _is_negative

    assert _is_negative(phrase) is True
