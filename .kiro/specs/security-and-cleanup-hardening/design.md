# Design Document

## Overview

Дизайн описывает конкретные технические решения для укрепления безопасности секретов и устранения технических недостатков проекта Jarvis в рамках первой итерации. Фокус — defense-in-depth для `.env` и API-ключей через многоуровневую защиту (`.gitignore` → права файла → pre-commit hook → CI secret-scan), синхронизация документации с фактическим кодом, минимальный CI-pipeline (lint + tests + secret-scan) и базовое покрытие тестами загрузки конфигурации. Опциональные требования (Lock-файл, Git LFS) вынесены в Out of Scope и будут реализованы в отдельной итерации.

## Architecture

### Четыре эшелона защиты секретов

Защита `.env` и API-ключей строится как четыре независимых барьера. Если пробит один — остальные продолжают работать.

**Эшелон 1 — `.gitignore`.** Уже существует и корректен (`.env`, `.env.*`, `!.env.example`). Защищает от `git add .env` и `git add .` Это пассивная защита: не сработает, если разработчик использует `git add -f`.

**Эшелон 2 — права файловой системы.** `chmod 600 .env` после создания файла. Делается в `scripts/setup.sh`. Защищает от чтения другими пользователями macOS и от случайного включения файла во внешние бэкапы/синки, которые уважают POSIX-права.

**Эшелон 3 — Pre-commit hook (`gitleaks` + проверка имён файлов).** Локальный sanity-чек до того, как объект попадёт в git-объекты. Реагирует на содержимое diff-а: ловит как явные значения ключей, так и попытку закоммитить файл с именем `.env`, `*.pem`, `*.key`. Защищает от человеческой ошибки и от `git commit -m`, выполненного в спешке.

**Эшелон 4 — CI secret-scan (`gitleaks-action`).** Серверная проверка push/PR с `fetch-depth: 0`, чтобы сканировать всю историю целиком. Защищает от обхода локального хука через `git commit --no-verify` и от форкнутых веток, где локальные хуки не активированы. Падение workflow блокирует merge.

### CI-pipeline

Два независимых workflow-файла: `ci.yml` (lint + tests, должен быть быстрым, ~30 сек) и `secret-scan.yml` (gitleaks по полной истории). Разделение нужно, потому что secret-scan требует `fetch-depth: 0` (медленно для больших историй) и логически независим от lint/tests.

## Technology Decisions

| Задача | Инструмент | Обоснование |
|---|---|---|
| Сканер секретов (локально и в CI) | `gitleaks` (`gitleaks/gitleaks` mirror для pre-commit, `gitleaks/gitleaks-action` для GH Actions) | Zero-config из коробки, написан на Go (быстрый), allowlist через `.gitleaksignore` или regex в `.gitleaks.toml`. В отличие от `detect-secrets` не требует Python-baseline, который надо переcommit-ить при каждой ложноположительной находке. |
| Pre-commit framework | `pre-commit` (pip-пакет) | Де-факто стандарт для Python-проектов, единый YAML-конфиг для всех хуков, автообновление через `pre-commit autoupdate`. |
| Базовые file-hooks | `pre-commit/pre-commit-hooks` (`trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-added-large-files=500KB`) | Стандартный набор для гигиены файлов и защиты от случайного коммита больших аудио-блобов. |
| Lint + format | `astral-sh/ruff-pre-commit` (`ruff` + `ruff-format`) | Уже сконфигурирован в `pyproject.toml`, запускается тем же бинарём что и в CI — нет рассинхрона версий. |
| CI runner | GitHub Actions, `ubuntu-latest`, Python 3.11 | Бесплатно для public repo, Python 3.11 совпадает с `requires-python` в `pyproject.toml`. macOS-runner избыточно дорог и не нужен для lint/tests, не зависящих от audio I/O. |
| Test runner | `pytest` + `pytest-asyncio` | Уже в `requirements.txt`, конфиг есть в `pyproject.toml` (`asyncio_mode = "auto"`). |
| Логи в `setup.sh` | bash + `chmod 600` | Минимум зависимостей. |

## Components and Interfaces

### Создаваемые файлы

**`.pre-commit-config.yaml`** — корневой конфиг pre-commit, объявляет три репозитория хуков:
- `https://github.com/pre-commit/pre-commit-hooks` rev `v4.6.0` — хуки `trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-added-large-files` с аргументом `--maxkb=500`.
- `https://github.com/astral-sh/ruff-pre-commit` rev `v0.6.9` — хуки `ruff` (с `--fix`) и `ruff-format`.
- `https://github.com/gitleaks/gitleaks` rev `v8.18.4` — хук `gitleaks` (запускается на staged-файлах).

**`.gitleaks.toml`** — конфиг сканера. Расширяет дефолтные правила гитликса кастомными regex-правилами с `id` именами `aihubmix-key`, `mistral-key`, `google-api-key`, `elevenlabs-key`. Содержит `[allowlist]` секцию с regex-исключениями для документационных плейсхолдеров (см. раздел «Allowlist для gitleaks»).

**`.gitleaksignore`** — список fingerprint-ов конкретных false-positive находок (используется только если allowlist по regex не подходит, обычно остаётся пустым).

**`.github/workflows/ci.yml`** — workflow на `push` и `pull_request` с одним job-ом `lint-and-test`:
- `actions/checkout@v4`
- `actions/setup-python@v5` с `python-version: "3.11"` и `cache: pip`
- `pip install -r requirements-ci.txt`
- `ruff check src/jarvis tests`
- `ruff format --check src/jarvis tests`
- `pytest -q`

**`.github/workflows/secret-scan.yml`** — workflow на `push` и `pull_request`:
- `actions/checkout@v4` с `fetch-depth: 0` (полная история нужна для скана всех коммитов).
- `gitleaks/gitleaks-action@v2` с переменной окружения `GITLEAKS_CONFIG: ./.gitleaks.toml`.

**`requirements-ci.txt`** — минимальный набор для CI без macOS-зависимостей (см. «Стратегия CI»):
```
pyyaml>=6.0.1
pydantic>=2.8
python-dotenv>=1.0.1
loguru>=0.7.2
httpx>=0.27
numpy>=1.26,<2.0
openai>=1.50.0
ruff>=0.6.9
pytest>=8.3
pytest-asyncio>=0.23
```

**`scripts/check_env.sh`** — диагностический скрипт. Проверяет:
1. наличие `.env` (если нет — печатает `❌ .env not found, run scripts/setup.sh`);
2. права `.env`: `stat -f "%Lp" .env` должно вернуть `600` (на macOS) — иначе предупреждение `⚠️  .env permissions are <X>, expected 600 (run: chmod 600 .env)`;
3. наличие `.pre-commit-config.yaml` — иначе предупреждение;
4. установлен ли git-хук: проверка существования `.git/hooks/pre-commit` и наличия в нём строки `pre-commit` (признак установки через `pre-commit install`); иначе предупреждение `⚠️  pre-commit hook not installed, run: pre-commit install`;
5. печатает summary `✅ Environment OK` если все проверки прошли, иначе `❌ <N> issue(s) found` и завершается с exit-кодом 1.

**`docs/SECURITY.md`** — Recovery Playbook. Содержит:
- Раздел «Если ключ утёк локально (но не в git)» — `chmod 600 .env`, ротация в дашбордах провайдеров с прямыми ссылками: AIHubMix `https://aihubmix.com/`, Mistral `https://console.mistral.ai/api-keys/`, Google AI Studio `https://aistudio.google.com/apikey`, ElevenLabs `https://elevenlabs.io/app/settings/api-keys`.
- Раздел «Если ключ попал в git-историю» — пошагово: (1) немедленно отозвать ключ, (2) выпустить новый, (3) обновить `.env`, (4) перезапустить ассистента, (5) очистить историю через `git filter-repo --replace-text` (с примером команды), (6) `git push --force-with-lease`, (7) уведомить co-maintainer-ов.
- Раздел «Чувствительные файлы» — пометка о том, что `logs/jarvis.log` может содержать фрагменты пользовательских запросов.

**`tests/test_config.py`** — тесты загрузки конфигурации:
- `test_load_config_returns_config_instance()` — `load_config()` отрабатывает без падения и возвращает объект ожидаемого типа.
- `test_load_config_parses_yaml(tmp_path, monkeypatch)` — записывает временный YAML, передаёт путь, проверяет что `brain.engine` корректно парсится для `aihubmix`, `mistral`, `gemini` (параметризованный тест).

**`tests/test_brain_imports.py`** — smoke-импорт:
- `test_import_openai_llm_without_env()` — `monkeypatch.delenv` убирает все API-ключи, затем `import jarvis.brain.openai_llm` не должен падать (ImportError/AttributeError на этапе импорта недопустим).

### Изменяемые файлы

**`scripts/setup.sh`** — изменения:
- После блока создания/копирования `.env` добавляется `chmod 600 .env` (выполняется и при создании, и при существовании файла — идемпотентно).
- Текущая логика «если `.env` уже существует — пропустить» сохраняется (не падать на повторном запуске).
- В конце скрипта добавляется напоминание: `echo "💡 Установи pre-commit хуки: pip install pre-commit && pre-commit install"`.

**`README.md`** — изменения (см. «План рефакторинга документации»).

**`docs/SETUP.md`** — изменения (см. «План рефакторинга документации»).

### Не изменяемые файлы

**`.env.example`** — текущий файл уже корректен (только актуальные ключи, есть прямые ссылки на дашборды), не трогаем.

**`tests/test_smoke.py`** — существующий smoke-тест не трогаем.

**`.gitignore`** — текущие правила (`.env`, `.env.*`, `!.env.example`) корректны, изменений не требуется.

## Data Models

### `.gitleaks.toml` — структура конфига

Минимальный валидный TOML с расширением дефолтного набора правил:

```toml
title = "Jarvis gitleaks config"

[extend]
useDefault = true

[[rules]]
id = "aihubmix-key"
description = "AIHubMix API key"
regex = '''sk-[A-Za-z0-9]{32,}'''
keywords = ["aihubmix", "AIHUBMIX_API_KEY"]

[[rules]]
id = "mistral-key"
description = "Mistral API key"
regex = '''[A-Za-z0-9]{32}'''
keywords = ["mistral", "MISTRAL_API_KEY"]

[[rules]]
id = "google-api-key"
description = "Google API key"
regex = '''AIza[0-9A-Za-z\-_]{35}'''
keywords = ["google", "GOOGLE_API_KEY"]

[[rules]]
id = "elevenlabs-key"
description = "ElevenLabs API key"
regex = '''sk_[A-Za-z0-9]{32,}'''
keywords = ["elevenlabs", "ELEVENLABS_API_KEY"]

[allowlist]
description = "Documentation placeholders and example values"
regexes = [
  '''sk-EXAMPLE[A-Za-z0-9\-]*''',
  '''sk-\.\.\.EXAMPLE''',
  '''<your-[a-z\-]+-key>''',
  '''<your-key-here>''',
  '''xxxxxxxx+''',
]
paths = [
  '''\.env\.example$''',
  '''docs/.*\.md$''',
  '''README\.md$''',
]
```

Ключевые решения:
- `useDefault = true` — берём дефолтные правила гитликса (AWS, Slack, GitHub tokens и т.д.) бесплатно.
- Кастомные правила покрывают четыре актуальных провайдера. Регекс для Mistral намеренно широкий (`[A-Za-z0-9]{32}`) и опирается на keyword `MISTRAL_API_KEY` рядом, чтобы не давать массу ложных срабатываний на любые 32-символьные строки.
- `allowlist.paths` исключает `.env.example` и всю документацию из проверки — там законны плейсхолдеры. `allowlist.regexes` дополнительно ловит явные плейсхолдеры даже если они окажутся в исходном коде.

### `.pre-commit-config.yaml` — структура

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ["--maxkb=500"]

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: ["--fix"]
      - id: ruff-format

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

## CI Strategy

### Проблема macOS-зависимостей

`requirements.txt` содержит зависимости, которые невозможно или бессмысленно ставить на `ubuntu-latest`:
- `pyobjc-core`, `pyobjc-framework-Cocoa` — биндинги к macOS Objective-C runtime, ставится только на macOS.
- `sounddevice` — требует системную `portaudio`, которой нет в дефолтном ubuntu-runner-е без `apt-get install`.
- `openwakeword`, `onnxruntime`, `faster-whisper`, `elevenlabs`, `pynput`, `scipy`, `scikit-learn`, `soundfile` — тяжёлые ML/audio пакеты, не нужны для lint и базовых unit-тестов конфига.

### Рассмотренные варианты

**Вариант A — отдельный `requirements-ci.txt`** (рекомендуется). Минимальный набор: `pyyaml`, `pydantic`, `python-dotenv`, `loguru`, `httpx`, `numpy`, `openai`, `ruff`, `pytest`, `pytest-asyncio`. CI ставится за ~10–15 секунд, прогон `ruff check` + базовых тестов укладывается в 30 сек. Минус — два файла зависимостей, но они служат разным целям и расхождение допустимо: `requirements.txt` для разработки на macOS со всем стеком, `requirements-ci.txt` только для проверок, не требующих audio/macOS-runtime.

**Вариант B — `pip install -r requirements.txt` с try/except.** Установить всё, но обернуть `pip install` в bash-trap или использовать `pip install --ignore-installed --no-deps` и т.п. Хрупкий подход: если pip падает на одной строке, он не продолжает с остальными. Можно через цикл по строкам файла, но тогда ломается порядок и транзитивные зависимости.

### Принятое решение

Вариант A: создаём `requirements-ci.txt`. Тесты, которые пишем в этой итерации (`test_config.py`, `test_brain_imports.py`), импортируют только `jarvis.config` и `jarvis.brain.openai_llm` — оба используют ровно те зависимости, что в минимальном CI-наборе. Тесты, требующие audio/wake-word/STT, в этой итерации не пишутся; когда они появятся — будем расширять `requirements-ci.txt` точечно или добавлять отдельный macOS-job.

## Allowlist для gitleaks

Ложные срабатывания могут возникать в трёх местах:

1. **Документация** (`README.md`, `docs/*.md`) — примеры вида `sk-...EXAMPLE`, `sk-EXAMPLE-not-a-real-key`, `<your-key-here>`. Решение: блок `[allowlist] paths` в `.gitleaks.toml` исключает всю папку `docs/` и `README.md`. Дополнительно `allowlist.regexes` ловит сами плейсхолдеры, если они появятся в исходниках.

2. **`.env.example`** — содержит имена переменных без значений, плюс может содержать комментарий с примером формата. Решение: `paths = ['''\.env\.example$''']` в allowlist.

3. **Тестовые фикстуры** — если в тесте появится строка типа `"sk-fake-test-key-12345"`, gitleaks может среагировать. Решение: использовать в тестах строго формат `<placeholder>` или `EXAMPLE_*`, что ловится `allowlist.regexes`. Если этого мало — добавить fingerprint в `.gitleaksignore` (формат: `<file>:<rule-id>:<line>:<commit>`).

**Правило**: если gitleaks нашёл секрет, который реально является плейсхолдером, первый ход — переименовать значение под существующий regex в allowlist (`sk-EXAMPLE...`, `<your-key>`). Только если это невозможно (например, регекс конкретного формата ключа провайдера случайно совпал с реальной не-секретной строкой) — добавлять в `.gitleaksignore`.

## Documentation Refactoring Plan

### `README.md` — изменения

Переписываем три секции:

**Секция «Установка / Quick Start»**:
- Заменяем упоминания `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PICOVOICE_ACCESS_KEY` на актуальный набор: `AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
- Добавляем шаг `pip install pre-commit && pre-commit install` после `pip install -e .`.
- Добавляем шаг `bash scripts/check_env.sh` для проверки настройки.

**Секция «Команды»**:
- Указываем единственный канонический способ запуска: `python -m jarvis` (или `jarvis` после `pip install -e .`).
- Убираем устаревшие альтернативы.

**Секция «Технологии»** (или таблица стека):
- Wake word: `openwakeword` (не `Picovoice`).
- LLM-движки: `aihubmix | mistral | gemini` (не `anthropic`).
- TTS: `elevenlabs` (опционально), системный TTS macOS как фолбэк.
- Структура каталогов под `src/jarvis/`: перечисляем фактические `audio`, `brain`, `core`, `skills`, `stt`, `tts`.

### `docs/SETUP.md` — изменения

- Секция «API-ключи»: только актуальные четыре, с прямыми ссылками на дашборды.
- Новая секция «Pre-commit хуки»: команды `pip install pre-commit`, `pre-commit install`, `pre-commit run --all-files`.
- Новая секция «Проверка окружения»: команда `bash scripts/check_env.sh`.
- Удаляем все упоминания `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (кроме случая, если прямо в тексте описывается миграция — тогда пометить как «устарело»), `PICOVOICE_ACCESS_KEY`.
- В разделе «Запуск» — единый канонический способ.

### Принципы рефакторинга

- Source of truth по списку переменных окружения — `.env.example`. Любая документация, упоминающая переменные, должна сверяться с ним.
- Source of truth по LLM-движкам — `BrainConfig.engine` в `src/jarvis/config.py` (`aihubmix | mistral | gemini`).
- Source of truth по структуре каталогов — фактическое содержимое `src/jarvis/`.

## Error Handling

### Ложное срабатывание gitleaks локально

Разработчик видит: `✗ gitleaks: leaked secret found in <file>:<line>`. Алгоритм:
1. Проверить, действительно ли это секрет. Если да — удалить значение, заменить на плейсхолдер, повторить commit.
2. Если плейсхолдер — переименовать в формат, покрытый `allowlist.regexes` (`sk-EXAMPLE-...`, `<your-key-here>`).
3. Если ни то ни другое — добавить fingerprint в `.gitleaksignore`. Команда для получения fingerprint: `gitleaks detect --report-format json | jq '.[0].Fingerprint'`.

### Pre-commit упал на чужой машине

`docs/SETUP.md` описывает: `pre-commit run --all-files` для прогона на всём репо, `pre-commit autoupdate` для обновления версий хуков. `pre-commit clean` сбрасывает кэш если хук завис на старой версии.

### CI workflow упал на secret-scan, но в коде секрета нет

Скорее всего, секрет в git-истории старого коммита (gitleaks-action с `fetch-depth: 0` сканирует всё). Recovery — через `docs/SECURITY.md`: ротация ключа + `git filter-repo --replace-text`.

### `scripts/setup.sh` запущен повторно

Текущая логика уже идемпотентна: `if [ ! -f ".env" ]` пропускает копирование. После изменений `chmod 600 .env` будет выполняться при каждом запуске — это безопасно (POSIX `chmod` идемпотентен).

### Тест `test_brain_imports.py` падает с `ImportError`

Признак того, что `jarvis.brain.openai_llm` на верхнем уровне модуля делает `os.environ["AIHUBMIX_API_KEY"]` или аналогичное жёсткое чтение env. Фикс — отложить чтение env в момент создания инстанса клиента (`__init__`), не на этапе импорта. Тест служит регрессионной защитой от такого паттерна.

## Testing Strategy

### Применимость property-based testing

Property-based testing **не применяется** в этой итерации. Обоснование: фича — это инфраструктурная конфигурация (CI workflows, pre-commit конфиг, gitleaks правила), shell-скрипты и переписывание документации. Здесь нет функций с явным `input → output`-контрактом, на которых имеет смысл проверять универсальные свойства типа round-trip или idempotence. Тесты загрузки конфига в этой итерации — это example-based unit-тесты с конкретными YAML-фикстурами. Согласно классификации workflow-а это INTEGRATION/EXAMPLE, а не PROPERTY. Если в будущей итерации появится логика валидации/трансформации конфигов с большим input space — стоит вернуться к PBT.

### Unit-тесты

**`tests/test_config.py`**:
- `test_load_config_returns_config_instance()` — вызов `load_config()` без аргументов возвращает объект ожидаемого типа без падения.
- `test_load_config_parses_engine[aihubmix]`, `[mistral]`, `[gemini]` — параметризованный тест: записывает в `tmp_path` минимальный YAML с указанным `brain.engine`, передаёт путь в `load_config`, проверяет что `cfg.brain.engine == expected`.

**`tests/test_brain_imports.py`**:
- `test_import_openai_llm_without_env(monkeypatch)` — `monkeypatch.delenv` для всех известных API-key переменных, затем `importlib.import_module("jarvis.brain.openai_llm")`. Тест зелёный, если импорт прошёл без `ImportError`/`KeyError`.

**`tests/test_smoke.py`** — существует, не трогаем.

### CI-проверки (acceptance tests на уровне workflow)

- `ruff check src/jarvis tests` — exit code 0.
- `ruff format --check src/jarvis tests` — exit code 0.
- `pytest -q` — exit code 0.
- `gitleaks-action` на полной истории — exit code 0.

### Ручная проверка (smoke acceptance)

Чек-лист после внедрения, выполняется один раз вручную:
1. `pre-commit install` устанавливает хук без ошибок.
2. Попытка `git commit` файла `secret.txt` с содержимым `AIHUBMIX_API_KEY=sk-EXAMPLE-realistic-looking-key-1234567890` — pre-commit падает с ненулевым кодом.
3. Попытка `git commit` файла, содержащего `sk-EXAMPLE-not-real` — pre-commit пропускает (allowlist работает).
4. `bash scripts/check_env.sh` на чистой клон-копии без `.env` печатает `❌ .env not found` и завершается с exit-кодом 1.
5. `bash scripts/check_env.sh` после `cp .env.example .env && chmod 600 .env && pre-commit install` печатает `✅ Environment OK`.

## Risks and Mitigations

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Gitleaks regex для Mistral слишком широкий → ложные срабатывания на любые 32-символьные строки. | Средняя | Средняя (раздражение разработчика, обходы хука). | Связка regex + keyword (`mistral`/`MISTRAL_API_KEY` рядом). Если всё равно много false-positive — сужаем regex или переходим на entropy-based детектор гитликса. |
| `requirements-ci.txt` рассинхронизируется с `requirements.txt` (новая зависимость добавлена в основной файл, но не в CI). | Высокая | Низкая (CI-тест упадёт с `ModuleNotFoundError`, проблема видна сразу). | В `docs/SETUP.md` явная пометка: при добавлении зависимости в `requirements.txt` оценить, нужна ли она в CI, и обновить `requirements-ci.txt`. Долгосрочно — миграция на lock-файл (Out of Scope этой итерации). |
| `pre-commit install` не выполнен разработчиком, локальный хук неактивен. | Высокая | Средняя (CI всё равно поймает). | `scripts/check_env.sh` явно проверяет наличие хука и предупреждает. CI-эшелон ловит то, что просочилось мимо. |
| Pin-версии хуков в `.pre-commit-config.yaml` устаревают. | Средняя | Низкая. | Документируем команду `pre-commit autoupdate` в `docs/SETUP.md`. |
| `git filter-repo` ломает форки и локальные клоны других разработчиков при очистке истории. | Средняя | Высокая (всем форкам нужен ребейз). | `docs/SECURITY.md` явно предупреждает: переписывание истории — last resort после ротации ключа. Ключевой совет: ротация ключа всегда первична, очистка истории — косметика. |
| `chmod 600 .env` не работает на Windows (если кто-то форкнет под WSL некорректно). | Низкая | Низкая. | Скрипт macOS-only, README явно указывает поддерживаемую ОС (macOS). |

## Out of Scope

Следующие требования из `requirements.md` **намеренно не покрываются** этой итерацией дизайна и должны быть реализованы отдельным спеком:

- **Requirement 7 (Lock-файл)** — выбор между `requirements.lock` (pip-compile), `uv.lock` или `poetry.lock` требует отдельного решения по инструментарию управления зависимостями. До тех пор используем компромисс через `requirements-ci.txt` (см. CI Strategy).
- **Requirement 8 (Git LFS / вынос Audio_Assets)** — требует решения о хранилище (LFS-квота GitHub против внешнего S3/CDN), миграции существующих бинарников и переписывания истории. Это самостоятельная задача с собственными рисками и тестами.
- **Переписывание git-истории для удаления Audio_Assets из старых коммитов** — отдельная операция, проводится одновременно с миграцией на LFS либо вообще не проводится (история остаётся, новые коммиты идут через LFS).
- **Requirement 9 (Гигиена логов)** — обновление логирования в `jarvis.brain.*` чтобы не писать тела prompts/responses на уровне INFO. Требует анализа текущего кода `brain/openai_llm.py` и небольшого рефакторинга, выходит за рамки security/CI-инфраструктурной итерации.
- **Глубокий рефакторинг `docs/ARCHITECTURE.md` и `docs/SKILLS.md`** — в этой итерации синхронизируем только `README.md` и `docs/SETUP.md` (точки входа для нового разработчика). Остальные документы — следующая итерация.
