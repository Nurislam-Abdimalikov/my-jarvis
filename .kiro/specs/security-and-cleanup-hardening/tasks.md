# Implementation Plan: Security and Cleanup Hardening

## Overview

План разбит на четыре области:

- **Область A (задачи 1.x) — Защита секретов:** локальные права, pre-commit, gitleaks-конфиги, CI secret-scan, Recovery Playbook, диагностический скрипт.
- **Область B (задачи 2.x) — Синхронизация документации:** `README.md` и `docs/SETUP.md` приводятся в соответствие с актуальным `.env.example` и кодом.
- **Область C (задачи 3.x) — Процесс и CI:** `requirements-ci.txt`, базовый CI-workflow и unit-тесты на загрузку конфига и импорт brain-модуля.
- **Область D (задачи 4.x) — Финальная проверка:** локальная установка хуков, прогон тестов, smoke-проверка через `check_env.sh`.

## Execution Order

1. Сначала область **A** (создаёт инфраструктуру, на которую ссылаются все остальные шаги). 1.9 зависит от 1.8.
2. После завершения A — параллельно области **B** и **C**. Внутри B задачи, редактирующие один файл, идут последовательно (2.1→2.2→2.3 для `README.md`, 2.4→2.5→2.6→2.7 для `docs/SETUP.md`).
3. Область **D** запускается последней — она проверяет, что всё, созданное в A/B/C, реально работает на чистом окружении.

Out of Scope этой итерации (см. design.md → Out of Scope): Lock-файл, Git LFS, переписывание истории, гигиена логов, рефакторинг `ARCHITECTURE.md` / `SKILLS.md`. Property-based тесты в этой итерации не применяются (см. design.md → Testing Strategy).

## Tasks

- [x] 1. Область A — Защита секретов

  - [x] 1.1 [A1] Поставить chmod 600 на текущий локальный .env
    - Проверить текущие права: `stat -f "%Lp" .env`.
    - Выполнить `chmod 600 .env`.
    - Повторно проверить права и убедиться, что результат — `600`.
    - Expected outcome: вывод `stat -f "%Lp" .env` = `600`.
    - _Requirements: 1.2_
    - _Design: Architecture → Эшелон 2 — права файловой системы_

  - [x] 1.2 [A2] Обновить scripts/setup.sh: chmod 600 .env и напоминание про pre-commit
    - После блока создания/копирования `.env` добавить вызов `chmod 600 .env` (идемпотентно — выполнять и при создании, и при существовании файла).
    - В конце скрипта добавить `echo "💡 Установи pre-commit хуки: pip install pre-commit && pre-commit install"`.
    - Сохранить идемпотентность повторного запуска.
    - Expected outcome: `bash scripts/setup.sh` на машине с уже существующим `.env` выставляет `600` и печатает напоминание про pre-commit.
    - _Requirements: 1.2, 1.5_
    - _Design: Components and Interfaces → Изменяемые файлы → scripts/setup.sh_

  - [x] 1.3 [A3] Создать .gitleaks.toml
    - Создать файл в корне репозитория согласно структуре из design.md (раздел Data Models).
    - Включить `useDefault = true`, четыре кастомных правила (`aihubmix-key`, `mistral-key`, `google-api-key`, `elevenlabs-key`) и блок `[allowlist]` с regex-исключениями для плейсхолдеров и paths-исключениями для `.env.example`, `docs/*.md`, `README.md`.
    - Expected outcome: `.gitleaks.toml` валиден как TOML и содержит все 4 кастомных правила + allowlist.
    - _Requirements: 2.4, 2.5_
    - _Design: Data Models → .gitleaks.toml + Allowlist для gitleaks_

  - [x] 1.4 [A4] Создать .gitleaksignore
    - Создать пустой файл с комментарием-инструкцией: пояснить формат записи `<file>:<rule-id>:<line>:<commit>` и правило (использовать только когда regex-allowlist не подходит).
    - Expected outcome: файл существует, содержит комментарий-инструкцию, не содержит fingerprint-ов.
    - _Requirements: 2.5_
    - _Design: Allowlist для gitleaks (последний абзац)_

  - [x] 1.5 [A5] Создать .pre-commit-config.yaml
    - Создать файл в корне согласно структуре из design.md (раздел Data Models).
    - Три репозитория хуков: `pre-commit/pre-commit-hooks v4.6.0` (`trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-added-large-files --maxkb=500`), `astral-sh/ruff-pre-commit v0.6.9` (`ruff --fix`, `ruff-format`), `gitleaks/gitleaks v8.18.4` (`gitleaks`).
    - Expected outcome: `.pre-commit-config.yaml` валиден как YAML и содержит все три репо с указанными хуками.
    - _Requirements: 1.3, 1.4, 5.6_
    - _Design: Data Models → .pre-commit-config.yaml_

  - [x] 1.6 [A6] Создать .github/workflows/secret-scan.yml
    - Workflow на `push` и `pull_request`.
    - Шаги: `actions/checkout@v4` с `fetch-depth: 0`, затем `gitleaks/gitleaks-action@v2` с `env: GITLEAKS_CONFIG: ./.gitleaks.toml`.
    - Expected outcome: файл валиден как YAML, GitHub распознаёт его как workflow.
    - _Requirements: 2.1, 2.2, 2.3_
    - _Design: Components and Interfaces → .github/workflows/secret-scan.yml_

  - [x] 1.7 [A7] Создать docs/SECURITY.md с Recovery Playbook
    - Раздел «Если ключ утёк локально (но не в git)»: `chmod 600 .env`, ротация в дашбордах с прямыми ссылками (AIHubMix, Mistral, Google AI Studio, ElevenLabs).
    - Раздел «Если ключ попал в git-историю»: упорядоченные шаги (отозвать → выпустить → обновить `.env` → перезапустить → `git filter-repo --replace-text` с примером команды → `git push --force-with-lease` → уведомить co-maintainer-ов).
    - Раздел «Чувствительные файлы»: пометка про `logs/jarvis.log`.
    - Expected outcome: документ содержит все 4 раздела (3 ротации + sensitive files), каждый ключ снабжён прямой ссылкой на дашборд.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.4_
    - _Design: Components and Interfaces → docs/SECURITY.md_

  - [x] 1.8 [A8] Создать scripts/check_env.sh
    - Реализовать 4 проверки согласно design.md: наличие `.env`, права `600` на `.env` (через `stat -f "%Lp"`), наличие `.pre-commit-config.yaml`, установка git-хука (`.git/hooks/pre-commit` содержит строку `pre-commit`).
    - Печатать `✅` / `⚠️` / `❌` для каждой проверки и итоговое summary.
    - Возвращать exit code 0 если все проверки прошли, иначе 1.
    - Expected outcome: на корректно настроенной машине `bash scripts/check_env.sh` печатает `✅ Environment OK` и завершается с кодом 0; на машине без `.env` печатает `❌ .env not found` и завершается с кодом 1.
    - _Requirements: 1.2, 1.4, 1.5_
    - _Design: Components and Interfaces → scripts/check_env.sh_

  - [x] 1.9 [A9] Сделать scripts/check_env.sh исполняемым
    - Выполнить `chmod +x scripts/check_env.sh`.
    - Зафиксировать исполняемый бит в git (`git update-index --chmod=+x scripts/check_env.sh` если уже под версионным контролем).
    - Expected outcome: `ls -l scripts/check_env.sh` показывает `x` для владельца; `bash scripts/check_env.sh` и `./scripts/check_env.sh` отрабатывают одинаково.
    - _Requirements: 1.5_
    - _Design: Components and Interfaces → scripts/check_env.sh_

- [x] 2. Область B — Синхронизация документации

  - [x] 2.1 [B1] README.md: актуализировать секцию «API ключи»
    - Удалить упоминания `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PICOVOICE_ACCESS_KEY`.
    - Перечислить актуальные пять переменных: `AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
    - Expected outcome: `grep -E "ANTHROPIC|OPENAI_API_KEY|PICOVOICE" README.md` ничего не находит; присутствуют все пять актуальных переменных.
    - _Requirements: 4.1, 4.2_
    - _Design: Documentation Refactoring Plan → README.md → секция «Установка / Quick Start»_

  - [x] 2.2 [B2] README.md: исправить таблицу/секцию «Технологии»
    - Wake word: `openwakeword` (убрать `Picovoice` / `pvporcupine`).
    - LLM-движки: `aihubmix | mistral | gemini` (убрать `anthropic` / `claude.py`).
    - TTS: `elevenlabs` (опционально) + системный TTS macOS как фолбэк.
    - Структура каталогов под `src/jarvis/`: `audio`, `brain`, `core`, `skills`, `stt`, `tts`.
    - Expected outcome: таблица технологий и описание стека сверены с фактическим кодом; `grep -Ei "picovoice|pvporcupine|anthropic|claude" README.md` ничего не находит.
    - _Requirements: 4.3, 4.4, 4.5_
    - _Design: Documentation Refactoring Plan → README.md → секция «Технологии»_

  - [x] 2.3 [B3] README.md: добавить шаги pre-commit и check_env.sh в Quick Start
    - После `pip install -e .` добавить шаг `pip install pre-commit && pre-commit install`.
    - Добавить шаг `bash scripts/check_env.sh` для проверки настройки.
    - Указать единый канонический способ запуска: `python -m jarvis` (или `jarvis` после `pip install -e .`).
    - Expected outcome: новый разработчик, следуя Quick Start строго сверху вниз, получает рабочее окружение с активными pre-commit хуками.
    - _Requirements: 1.5_
    - _Design: Documentation Refactoring Plan → README.md → секции «Установка / Quick Start» и «Команды»_

  - [x] 2.4 [B4] docs/SETUP.md: переписать секцию API-ключей
    - Оставить только актуальные четыре ключа (`AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`) + `ELEVENLABS_VOICE_ID`.
    - Каждому ключу прямая ссылка на дашборд (AIHubMix, Mistral, Google AI Studio, ElevenLabs — те же ссылки, что в `docs/SECURITY.md`).
    - Expected outcome: секция содержит ровно 4 ключа + voice id, каждому соответствует прямая ссылка на provider dashboard.
    - _Requirements: 4.1, 4.2_
    - _Design: Documentation Refactoring Plan → docs/SETUP.md → секция «API-ключи»_

  - [x] 2.5 [B5] docs/SETUP.md: добавить секцию «Pre-commit хуки»
    - Команды: `pip install pre-commit`, `pre-commit install`, `pre-commit run --all-files`, упомянуть `pre-commit autoupdate`.
    - Краткое объяснение, что хук блокирует коммит секретов локально.
    - Expected outcome: новый раздел присутствует, содержит все три обязательные команды.
    - _Requirements: 1.5, 5.6_
    - _Design: Documentation Refactoring Plan → docs/SETUP.md → новая секция «Pre-commit хуки»_

  - [x] 2.6 [B6] docs/SETUP.md: добавить секцию «Проверка окружения»
    - Команда: `bash scripts/check_env.sh`.
    - Описание ожидаемого вывода (`✅ Environment OK`) и реакции на типичные предупреждения.
    - Expected outcome: новый раздел отсылает к `scripts/check_env.sh` как к единой точке диагностики.
    - _Requirements: 1.5_
    - _Design: Documentation Refactoring Plan → docs/SETUP.md → новая секция «Проверка окружения»_

  - [x] 2.7 [B7] docs/SETUP.md: убрать устаревшие упоминания и зафиксировать команду запуска
    - Удалить любые упоминания `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PICOVOICE_ACCESS_KEY` (если упоминания нужны в контексте миграции — пометить как «устарело»).
    - Привести команду запуска к единому варианту `python -m jarvis`.
    - Expected outcome: `grep -E "ANTHROPIC|OPENAI_API_KEY|PICOVOICE" docs/SETUP.md` ничего не находит; в разделе «Запуск» — только `python -m jarvis`.
    - _Requirements: 4.2, 10.2_
    - _Design: Documentation Refactoring Plan → docs/SETUP.md → принципы рефакторинга_

- [x] 3. Область C — Процесс и CI

  - [x] 3.1 [C1] Создать requirements-ci.txt
    - Минимальный набор зависимостей согласно design.md (Components and Interfaces → requirements-ci.txt): `pyyaml>=6.0.1`, `pydantic>=2.8`, `python-dotenv>=1.0.1`, `loguru>=0.7.2`, `httpx>=0.27`, `numpy>=1.26,<2.0`, `openai>=1.50.0`, `ruff>=0.6.9`, `pytest>=8.3`, `pytest-asyncio>=0.23`.
    - Expected outcome: файл создан, `pip install -r requirements-ci.txt` отрабатывает на чистом ubuntu/macOS-окружении за ~10–15 секунд без ошибок.
    - _Requirements: 5.3_
    - _Design: Components and Interfaces → requirements-ci.txt + CI Strategy → принятое решение (Вариант A)_

  - [x] 3.2 [C2] Создать .github/workflows/ci.yml
    - Workflow на `push` и `pull_request`, единственный job `lint-and-test` на `ubuntu-latest`.
    - Шаги: `actions/checkout@v4`, `actions/setup-python@v5` (`python-version: "3.11"`, `cache: pip`), `pip install -r requirements-ci.txt`, `ruff check src/jarvis tests`, `ruff format --check src/jarvis tests`, `pytest -q`.
    - Любой ненулевой exit code → workflow failed.
    - Expected outcome: файл валиден как YAML, GitHub Actions отображает его как `CI` workflow с тремя последовательными проверками.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
    - _Design: Components and Interfaces → .github/workflows/ci.yml + CI Strategy_

  - [x] 3.3 [C3] Создать tests/test_config.py
    - `test_load_config_returns_config_instance()` — `load_config()` возвращает объект ожидаемого типа без падения.
    - Параметризованный `test_load_config_parses_engine` для значений `aihubmix`, `mistral`, `gemini`: записать минимальный YAML в `tmp_path`, передать путь в `load_config`, проверить `cfg.brain.engine == expected`.
    - Expected outcome: `pytest -q tests/test_config.py` зелёный, оба теста (включая 3 параметризации) выполнены.
    - _Requirements: 6.1, 6.2_
    - _Design: Testing Strategy → Unit-тесты → tests/test_config.py_

  - [x] 3.4 [C4] Создать tests/test_brain_imports.py
    - `test_import_openai_llm_without_env(monkeypatch)` — `monkeypatch.delenv` для всех известных API-key переменных (`AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`), затем `importlib.import_module("jarvis.brain.openai_llm")`.
    - Тест проходит, если импорт не падает с `ImportError`/`KeyError`.
    - Дополнительно проверить, что `jarvis.main.cli` импортируется и является `callable` (smoke-проверка entry point).
    - Expected outcome: `pytest -q tests/test_brain_imports.py` зелёный.
    - _Requirements: 6.3, 6.4, 10.3_
    - _Design: Testing Strategy → Unit-тесты → tests/test_brain_imports.py + Error Handling → последний абзац_

- [x] 4. Область D — Финальная проверка

  - [x] 4.1 [D1] Локально установить и прогнать pre-commit на всём репо
    - Выполнить `pip install pre-commit && pre-commit install`.
    - Прогнать `pre-commit run --all-files`.
    - Зафиксировать любые автоисправления от `ruff-format` отдельным коммитом «chore: ruff format».
    - Expected outcome: повторный `pre-commit run --all-files` зелёный (все хуки `Passed`).
    - _Requirements: 1.4, 5.6_
    - _Design: Testing Strategy → Ручная проверка → пункты 1–3_

  - [x] 4.2 [D2] Прогнать scripts/check_env.sh
    - Выполнить `bash scripts/check_env.sh` на текущем окружении.
    - Убедиться, что все четыре проверки = `✅` и итог `✅ Environment OK`.
    - Если какая-то проверка падает — починить причину (это означает, что задачи 1.1/1.5/1.8/4.1 выполнены не до конца).
    - Expected outcome: exit code 0, summary `✅ Environment OK`.
    - _Requirements: 1.2, 1.4, 1.5_
    - _Design: Testing Strategy → Ручная проверка → пункты 4–5_

  - [x] 4.3 [D3] Прогнать pytest -q локально
    - Выполнить `pytest -q` из корня.
    - Все тесты, включая `tests/test_smoke.py`, `tests/test_config.py`, `tests/test_brain_imports.py`, должны быть зелёными.
    - Expected outcome: exit code 0, в выводе нет `FAILED`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 10.3_
    - _Design: Testing Strategy → CI-проверки_

  - [x] 4.4 [D4] Сверить .gitignore с актуальными требованиями
    - Проверить, что `.env`, `.env.*`, `!.env.example` присутствуют (Req 1.1).
    - Проверить, что `.ruff_cache/` исключён (если уже есть — no-op; если нет — добавить).
    - Expected outcome: `.gitignore` соответствует требованию 1.1; `.ruff_cache/` не попадает в `git status` после прогона ruff.
    - _Requirements: 1.1_
    - _Design: Components and Interfaces → Не изменяемые файлы → .gitignore_

  - [ ]* 4.5 [D5] Запушить изменения в новую ветку и проверить, что workflow зелёные
    - Создать новую ветку (например, `chore/security-hardening`).
    - Запушить с `git push -u origin <branch>`.
    - **НЕ** пушить в `main` без явного подтверждения от пользователя (safety-sensitive).
    - Открыть pull request и убедиться, что оба workflow (`ci.yml`, `secret-scan.yml`) проходят зелёным.
    - Expected outcome: PR с зелёным CI и зелёным secret-scan; `gitleaks-action` не нашёл утечек в полной истории.
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2_
    - _Design: Architecture → Эшелон 4 — CI secret-scan_

## Notes

- Задачи с постфиксом `*` опциональны; 4.5 помечена так как требует `git push` и затрагивает удалённый репозиторий.
- Каждая задача leaf-уровня и должна выполняться за один обмен с агентом (5–15 минут работы).
- Property-based тесты в этой итерации не вводятся (см. design.md → Testing Strategy → Применимость property-based testing).
- Out of Scope (см. design.md): Lock-файл, Git LFS, переписывание истории, гигиена логов, рефакторинг ARCHITECTURE.md / SKILLS.md.
- Внутри областей B и D задачи, редактирующие один и тот же файл (`README.md` или `docs/SETUP.md`), идут последовательно, чтобы избежать конфликтов.
- Префикс в квадратных скобках (например, `[A1]`, `[B3]`) — мнемоника области, чтобы упростить навигацию по плану.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8"] },
    { "id": 1, "tasks": ["1.9", "2.1", "2.4", "3.1", "3.2", "3.3", "3.4"] },
    { "id": 2, "tasks": ["2.2", "2.5"] },
    { "id": 3, "tasks": ["2.3", "2.6"] },
    { "id": 4, "tasks": ["2.7"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["4.3"] },
    { "id": 8, "tasks": ["4.4"] },
    { "id": 9, "tasks": ["4.5"] }
  ]
}
```
