# ⚙️ Setup — Полная установка Jarvis

Гайд для свежей машины macOS Apple Silicon (M1/M2/M3/M4).

---

## 0. Требования

- macOS 13+ (Ventura или новее)
- Apple Silicon (M-чип) — на Intel тоже работает, но Whisper будет медленнее
- ~5 ГБ свободного места (Whisper модели)
- Микрофон и колонки/наушники

---

## 1. Системные зависимости

### Homebrew (если ещё нет)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Пакеты

```bash
brew install python@3.11 portaudio ffmpeg
```

- `python@3.11` — стабильная версия для всех зависимостей
- `portaudio` — нужен для `sounddevice` (запись с микрофона)
- `ffmpeg` — нужен Whisper-у для декодирования аудио

Или одной командой:

```bash
./scripts/setup.sh
```

---

## 2. Python окружение

```bash
cd ~/jarvis
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

Первый запуск faster-whisper скачает модель `small` (~500 МБ) в `~/.cache/huggingface/`.

---

## 3. Разрешения macOS

Mac попросит разрешения когда Jarvis впервые попытается:

| Что               | Где разрешить                                                       |
| ----------------- | ------------------------------------------------------------------- |
| Микрофон          | System Settings → Privacy & Security → Microphone                   |
| Accessibility     | System Settings → Privacy & Security → Accessibility (для AppleScript) |
| Automation        | System Settings → Privacy & Security → Automation                   |
| Full Disk Access  | (опционально, для чтения почты/календаря)                           |

> Совет: добавь Terminal (или iTerm/VSCode откуда запускаешь) во все эти разделы заранее.

---

## 4. API ключи

Заполни `.env` (`cp .env.example .env`). Достаточно ОДНОГО LLM-ключа в зависимости от значения `brain.engine` в `config/config.yaml`.

### LLM brain (обязательный — выбери один движок)

#### AIHubMix (рекомендуется по умолчанию)
- OpenAI-совместимый агрегатор, есть бесплатные модели (gpt-5.5-free).
- Регистрация и ключ: https://aihubmix.com/
- Положить в `.env` как `AIHUBMIX_API_KEY=...`
- В `config.yaml`: `brain.engine: aihubmix`
- Дополнительно: vision-скилл `analyze_screen` тоже использует этот ключ.

#### Mistral La Plateforme
- Free tier работает глобально, поддерживает tool calling.
- Регистрация: https://console.mistral.ai/api-keys/
- В `.env`: `MISTRAL_API_KEY=...`
- В `config.yaml`: `brain.engine: mistral`

#### Google Gemini (через AI Studio)
- ⚠️ Недоступен напрямую в РУ/KG без VPN.
- Регистрация: https://aistudio.google.com/apikey
- В `.env`: `GOOGLE_API_KEY=...`
- В `config.yaml`: `brain.engine: gemini`

### TTS (опционально)

#### ElevenLabs (премиум-голос)
- Используется только если `tts.engine: elevenlabs` в `config.yaml`. По умолчанию работает встроенный macOS `say`.
- Регистрация: https://elevenlabs.io/
- В разделе Profile → API Key → положить в `.env` как `ELEVENLABS_API_KEY=...`
- Выбрать понравившийся голос → его Voice ID → в `.env` как `ELEVENLABS_VOICE_ID=...`

> 📘 Что делать если ключ утёк: см. [`docs/SECURITY.md`](./SECURITY.md).

После заполнения:
```bash
chmod 600 .env  # права только для владельца
```

---

## 5. Pre-commit хуки

Локальный страж от попадания секретов в коммит. Запускается автоматически перед каждым `git commit`.

### Установка (один раз после клона)

```bash
pip install pre-commit
pre-commit install
```

### Что делает

- `gitleaks` — сканер секретов: ловит API-ключи (AIHubMix, Mistral, Google, ElevenLabs и др.) до того, как они попадут в коммит.
- `ruff` + `ruff-format` — линтер и форматтер Python (та же конфигурация, что в CI).
- Базовая гигиена: `trailing-whitespace`, `end-of-file-fixer`, `check-yaml`, `check-added-large-files` (>500 КБ).

### Прогнать на всём репо

```bash
pre-commit run --all-files
```

### Обновить версии хуков

```bash
pre-commit autoupdate
```

> Если pre-commit заблокировал коммит из-за «секрета», который на самом деле плейсхолдер — переименуй значение под формат, поддерживаемый allowlist в `.gitleaks.toml` (`<your-key-here>`, `sk-EXAMPLE-...`). Если совсем тупик — добавь fingerprint в `.gitleaksignore`.

---

## 6. Проверка окружения

Единая команда диагностики:

```bash
bash scripts/check_env.sh
```

Скрипт проверяет:

1. ✅ `.env` существует
2. ✅ Права на `.env` равны `600` (читает только владелец)
3. ✅ `.pre-commit-config.yaml` присутствует
4. ✅ Pre-commit hook установлен (`.git/hooks/pre-commit`)

Если всё ОК — `✅ Environment OK` и exit 0. Иначе — `❌ N issue(s) found` и exit 1, плюс конкретные предупреждения, что починить.

Эту команду полезно запускать:
- сразу после клонирования репозитория;
- после каждого `chmod` или правки `.env`;
- если pre-commit вдруг перестал срабатывать перед коммитами.

---

## 7. Конфиг

`config/config.yaml` — основные настройки. Дефолты подобраны разумно, можно не трогать на старте.

Что менять:
- `language: ru` или `en`
- `tts.engine: say` (бесплатно) или `elevenlabs` (премиум)
- `stt.model: small` — баланс качества/скорости. На M3 `medium` тоже летает.
- `brain.engine: aihubmix | mistral | gemini` — выбор LLM-движка (см. секцию 4 про API-ключи).

---

## 8. Запуск

```bash
source .venv/bin/activate
python -m jarvis
```

В версии v0.1 — push-to-talk: нажми и держи пробел чтобы говорить.
В версии v0.2+ — скажи "Джарвис ..." и он отреагирует.

---

## 9. Траблшутинг

### `OSError: PortAudio library not found`
```bash
brew install portaudio
pip install --force-reinstall sounddevice
```

### `RuntimeError: cannot find ffmpeg`
```bash
brew install ffmpeg
```

### Whisper медленный
- Используй модель `small` или `tiny` вместо `medium/large`
- Проверь что `device: auto` в конфиге (на M-чипе использует MPS/Metal через CTranslate2)

### Микрофон не слышно
- System Settings → Privacy → Microphone → разрешить терминалу
- Проверь дефолтный input в System Settings → Sound

### `say: command not found`
Маловероятно на macOS, но: переустанови Command Line Tools `xcode-select --install`.

### AppleScript: `not authorized to send Apple events`
System Settings → Privacy & Security → Automation → разреши терминалу управлять нужным приложением.

---

## 10. Обновление

```bash
git pull
source .venv/bin/activate
pip install -r requirements.txt --upgrade
```

---

## 11. Удаление

```bash
rm -rf ~/jarvis ~/.cache/huggingface/hub/models--Systran--faster-whisper-*
```
