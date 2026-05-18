# Requirements Document

## Introduction

Этот спек описывает требования к укреплению безопасности секретов и устранению технических недостатков существующего проекта Jarvis (голосовой ассистент на Python 3.11+, macOS). Аудит показал, что хотя в данный момент `.env` физически не утёк в публичный репозиторий `https://github.com/Nurislam-React-Developer/my-jarvis`, защита держится на единственной линии обороны (`.gitignore`). Цель спека — внедрить defense-in-depth для секретов, синхронизировать документацию с реальным кодом, добавить базовый CI с lint/test/secret-scan, обеспечить воспроизводимость зависимостей через lock-файл, разгрузить репозиторий от больших audio-ассетов и задокументировать процедуру ротации ключей при компрометации.

Изменения функциональности голосового ассистента, рефакторинг бизнес-логики (skills/brain/tts) и замена LLM-провайдеров в этот спек **не входят**.

## Glossary

- **Repository**: Git-репозиторий проекта Jarvis на GitHub (`Nurislam-React-Developer/my-jarvis`).
- **Env_File**: Локальный файл `.env` в корне репозитория, содержащий значения API-ключей и других секретов.
- **Env_Example**: Файл `.env.example` в корне репозитория — публичный шаблон без значений секретов, source of truth по списку переменных окружения.
- **Secret**: Значение API-ключа (`AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`) или другая чувствительная информация.
- **Pre_Commit_Framework**: Фреймворк `pre-commit` (https://pre-commit.com), управляющий локальными git hooks.
- **Secret_Scanner**: Инструмент статического анализа на наличие секретов в файлах и git-истории. В этом спеке — `gitleaks`.
- **Linter**: Статический анализатор кода Python — `ruff`, уже сконфигурированный в `pyproject.toml`.
- **Test_Suite**: Набор автоматических тестов проекта, запускаемый через `pytest`.
- **CI_Pipeline**: GitHub Actions workflow, запускающийся на push и pull request.
- **Lock_File**: Файл, фиксирующий точные версии всех прямых и транзитивных зависимостей (например, `requirements.lock`, `uv.lock` или `poetry.lock`).
- **Documentation**: Набор markdown-файлов в репозитории — `README.md`, `docs/SETUP.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/SKILLS.md`.
- **Audio_Assets**: Бинарные аудио-файлы в `assets/sounds/voices/jarvis-remaster/*.mp3` и `assets/sounds/voices/jarvis-clean/*.wav`.
- **Rotation_Procedure**: Задокументированная пошаговая инструкция по ротации скомпрометированного API-ключа.
- **Entry_Point**: Точка входа `jarvis = "jarvis.main:cli"`, объявленная в `pyproject.toml`.
- **Log_File**: Файл `logs/jarvis.log`, в который пишет `loguru`.
- **Developer**: Разработчик, работающий с локальным клоном репозитория.
- **Reviewer**: Человек или GitHub-бот, проверяющий pull request.

## Requirements

### Requirement 1: Локальная защита Env_File от утечки

**User Story:** Как Developer, я хочу чтобы значения секретов в Env_File были защищены не только `.gitignore`, но и правами файловой системы и pre-commit хуком, так чтобы случайный коммит или чтение другим пользователем системы стали невозможны.

#### Acceptance Criteria

1. THE Repository SHALL содержать в `.gitignore` строки `.env` и `.env.*` с исключением `!.env.example` (защита от случайного `git add .env`).
2. WHEN Developer выполняет `scripts/setup.sh` или эквивалентную команду установки, THE setup-скрипт SHALL устанавливать права `600` на файл `.env`, если он существует.
3. WHEN Developer пытается выполнить `git commit`, который добавляет файл, соответствующий шаблону `.env`, `.env.*`, `*.pem`, `*.key`, или содержащий значения, похожие на API-ключи, THE Pre_Commit_Framework SHALL прерывать коммит с ненулевым exit-кодом.
4. THE Repository SHALL содержать файл `.pre-commit-config.yaml` в корне, объявляющий хук `gitleaks` (или эквивалентный Secret_Scanner) в качестве `repo` записи.
5. THE Repository SHALL содержать в `docs/SETUP.md` инструкцию по разовой установке pre-commit хуков командой `pre-commit install`.

### Requirement 2: Сканирование секретов в CI_Pipeline

**User Story:** Как владелец Repository, я хочу чтобы каждый push и pull request автоматически сканировался на наличие секретов, так чтобы локальный обход pre-commit (`git commit --no-verify`) не приводил к утечке.

#### Acceptance Criteria

1. THE Repository SHALL содержать GitHub Actions workflow в `.github/workflows/ci.yml` (или с эквивалентным именем).
2. WHEN на ветку Repository происходит `push` или открывается `pull_request`, THE CI_Pipeline SHALL запускать job сканирования секретов с использованием `gitleaks`.
3. WHEN Secret_Scanner находит хотя бы один секрет в diff или в полной истории коммитов, проверяемых workflow, THE CI_Pipeline SHALL завершать job с ненулевым exit-кодом и блокировать merge.
4. THE Repository SHALL содержать конфигурационный файл Secret_Scanner (например, `.gitleaks.toml`) с правилами для актуальных ключей проекта: `AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`.
5. WHERE документационный файл содержит явно помеченный пример ключа (например, `sk-ant-...EXAMPLE` или `sk-ant-xxxxxxxx`), THE Secret_Scanner SHALL поддерживать механизм игнорирования через allowlist в конфигурации.

### Requirement 3: Документированная Rotation_Procedure

**User Story:** Как Developer, я хочу иметь чёткую пошаговую инструкцию по ротации API-ключей при подозрении на компрометацию, так чтобы я мог быстро отозвать старый ключ и выпустить новый, не теряя времени на поиск процедуры.

#### Acceptance Criteria

1. THE Repository SHALL содержать раздел «Rotation Procedure» (или файл `docs/SECURITY.md`) с инструкцией по ротации каждого из ключей: `AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`.
2. THE Rotation_Procedure SHALL содержать для каждого провайдера прямую ссылку на страницу управления ключами (например, `https://console.mistral.ai/api-keys/`).
3. THE Rotation_Procedure SHALL содержать упорядоченный список шагов: (а) отозвать старый ключ в дашборде провайдера, (б) выпустить новый ключ, (в) обновить `.env`, (г) перезапустить ассистента.
4. WHERE подозревается, что секрет попал в git-историю Repository, THE Rotation_Procedure SHALL содержать дополнительные шаги по немедленной ротации ключа и инструкцию по очистке истории через `git filter-repo` или `BFG Repo-Cleaner`.

### Requirement 4: Синхронизация Documentation с реальным кодом

**User Story:** Как Developer, который читает документацию проекта в первый раз, я хочу чтобы названия переменных окружения, имена движков и пакеты в Documentation совпадали с фактическим кодом и `.env.example`, так чтобы я не создал `.env` с устаревшими ключами вроде `ANTHROPIC_API_KEY`.

#### Acceptance Criteria

1. THE Documentation SHALL ссылаться только на переменные окружения, перечисленные в `.env.example`: `AIHUBMIX_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
2. THE Documentation SHALL не содержать упоминаний устаревших ключей `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PICOVOICE_ACCESS_KEY` нигде, кроме раздела changelog или явного описания миграции.
3. THE Documentation SHALL описывать wake-word движок как `openwakeword` и не упоминать `pvporcupine` или `Picovoice` как активную зависимость.
4. THE Documentation SHALL описывать LLM-провайдеров как `aihubmix | mistral | gemini` (соответствие `BrainConfig.engine` в `src/jarvis/config.py`) и не упоминать `anthropic` или `claude.py` как активные модули.
5. WHEN README.md описывает структуру каталогов проекта, THE README.md SHALL отражать фактические каталоги под `src/jarvis/` (`audio`, `brain`, `core`, `skills`, `stt`, `tts`).
6. WHERE Documentation содержит пример значения секрета для иллюстрации (например, в `docs/ARCHITECTURE.md`), THE Documentation SHALL использовать явный плейсхолдер вида `sk-...EXAMPLE` или `<your-key-here>`, не похожий на реальный ключ.

### Requirement 5: Базовый CI_Pipeline с lint и тестами

**User Story:** Как Reviewer, я хочу чтобы при каждом pull request автоматически прогонялся Linter и Test_Suite, так чтобы я не сливал в основную ветку код, нарушающий стиль или ломающий тесты.

#### Acceptance Criteria

1. WHEN на Repository происходит `push` или `pull_request`, THE CI_Pipeline SHALL запускать job, выполняющий `ruff check` против всего пакета `src/jarvis`.
2. WHEN на Repository происходит `push` или `pull_request`, THE CI_Pipeline SHALL запускать job, выполняющий `pytest` против каталога `tests/`.
3. THE CI_Pipeline SHALL запускать lint и тесты на Python 3.11 в окружении `ubuntu-latest` (минимум; macOS-job опционально).
4. IF Linter возвращает ненулевой exit-код, THEN THE CI_Pipeline SHALL помечать workflow как failed.
5. IF Test_Suite возвращает ненулевой exit-код, THEN THE CI_Pipeline SHALL помечать workflow как failed.
6. THE Repository SHALL содержать в `.pre-commit-config.yaml` хук `ruff` (lint и format), запускающийся локально перед коммитом.

### Requirement 6: Минимальное покрытие тестами критичной логики

**User Story:** Как Developer, я хочу иметь автоматические тесты на загрузку конфига и базовые контракты ключевых модулей, так чтобы изменения в `config.py` или схемах Pydantic не ломали приложение незаметно.

#### Acceptance Criteria

1. THE Test_Suite SHALL содержать тест, проверяющий что `jarvis.config.load_config()` возвращает экземпляр `Config` при отсутствии `config/config.yaml` (использует дефолты).
2. THE Test_Suite SHALL содержать тест, проверяющий что `jarvis.config.load_config()` корректно парсит валидный YAML с указанием `brain.engine` равным каждому из `aihubmix`, `mistral`, `gemini`.
3. THE Test_Suite SHALL содержать тест, проверяющий что Entry_Point `jarvis.main:cli` импортируется без ошибок (smoke-проверка, без запуска `asyncio.run`).
4. IF Entry_Point `jarvis.main:cli` отсутствует или не вызывается, THEN THE Test_Suite SHALL завершаться с ненулевым exit-кодом.

### Requirement 7: Воспроизводимость зависимостей через Lock_File

**User Story:** Как Developer, который клонирует репозиторий на новой машине, я хочу получить ровно те же версии всех прямых и транзитивных зависимостей, которые работали у автора, так чтобы установка была детерминированной.

#### Acceptance Criteria

1. THE Repository SHALL содержать Lock_File с зафиксированными версиями всех прямых и транзитивных зависимостей (`requirements.lock`, `uv.lock` или `poetry.lock`).
2. THE Repository SHALL содержать инструкцию в `docs/SETUP.md`, описывающую команду установки из Lock_File (например, `pip install -r requirements.lock` или `uv sync`).
3. WHEN Developer обновляет прямую зависимость в `requirements.txt` (или `pyproject.toml`), THE Documentation SHALL описывать команду регенерации Lock_File.
4. THE CI_Pipeline SHALL устанавливать зависимости из Lock_File перед запуском lint и тестов.

### Requirement 8: Разгрузка Repository от больших Audio_Assets

**User Story:** Как Developer, я хочу чтобы клонирование Repository не тянуло десятки мегабайт аудио-файлов, так чтобы первичная установка была быстрой и `git log` оставался лёгким.

#### Acceptance Criteria

1. THE Repository SHALL не хранить файлы из `assets/sounds/voices/jarvis-remaster/` и `assets/sounds/voices/jarvis-clean/` как обычные git-блобы в новых коммитах.
2. THE Repository SHALL хранить указанные Audio_Assets либо через Git LFS (с соответствующим `.gitattributes`), либо отсутствовать в git с инструкцией по скачиванию из внешнего источника.
3. WHERE выбран Git LFS, THE Repository SHALL содержать `.gitattributes` с правилами `*.mp3 filter=lfs diff=lfs merge=lfs -text` и `*.wav filter=lfs diff=lfs merge=lfs -text` для соответствующих каталогов.
4. WHERE Audio_Assets вынесены из репозитория, THE `docs/SETUP.md` SHALL содержать инструкцию по их получению (URL архива или скрипт скачивания).
5. WHEN Audio_Assets отсутствуют локально, THE приложение Jarvis SHALL запускаться без падения и логировать предупреждение об отсутствии reactions-пака (поведение уже зависит от `reactions.enabled` в config; этот пункт фиксирует требование совместимости).

### Requirement 9: Гигиена Log_File

**User Story:** Как пользователь Jarvis, я хочу чтобы локальный Log_File не содержал полные тела LLM-запросов и ответов, так чтобы случайный шеринг логов с другим разработчиком не приводил к утечке промптов или личной информации.

#### Acceptance Criteria

1. THE Test_Suite SHALL содержать тест, проверяющий что после прогона базового сценария обработки команды Log_File не содержит подстрок, соответствующих типичным API-ключам (regex `sk-[A-Za-z0-9_\-]{20,}` и аналоги).
2. WHEN модуль `brain` логирует факт LLM-запроса, THE модуль SHALL логировать только метаданные (engine, длина prompt в токенах/символах, длина ответа), но не сам текст prompt и ответа на уровне `INFO`.
3. WHERE Developer хочет видеть полные тела запросов для отладки, THE логирование тел SHALL быть доступно только при `logging.level=DEBUG` (или эквивалентном явном переключателе).
4. THE Documentation SHALL содержать пометку о том, что `logs/jarvis.log` может содержать фрагменты пользовательских запросов и должен относиться к категории чувствительных файлов (не шарить публично).

### Requirement 10: Verifiable Entry_Point

**User Story:** Как Developer, который установил пакет через `pip install -e .`, я хочу чтобы команда `jarvis` была доступна в PATH и запускала ассистента, так чтобы entry-point из `pyproject.toml` соответствовал реальному коду.

#### Acceptance Criteria

1. THE модуль `src/jarvis/main.py` SHALL экспортировать функцию `cli` без аргументов.
2. WHEN Developer выполняет `pip install -e .` с последующим вызовом `jarvis --help` (или `jarvis`) в окружении без `.env`, THE команда SHALL завершаться корректно (с ненулевым exit-кодом, если ключи обязательны, но без ImportError или AttributeError).
3. THE Test_Suite SHALL проверять, что атрибут `cli` существует в модуле `jarvis.main` и является вызываемым (`callable`).
