# 🤖 Jarvis — Personal Voice Assistant for macOS

> *"Sometimes you gotta run before you can walk."* — Tony Stark

Голосовой ассистент для macOS со звучанием реального актёра, озвучивавшего
Джарвиса. Слушает в фоне, откликается на «Джарвис», отвечает голосом твоего
референса (XTTS-v2 voice cloning), управляет Mac, помнит что ты просил
запомнить.

**Платформа:** macOS, Apple Silicon (M1–M4 рекомендуется)
**Язык:** Python 3.11+
**Лицензия:** MIT (личный проект)

---

## ✨ Что умеет

- 🎙️ **Wake word** — три модели одновременно (`hey_jarvis`, `alexa`, `hey_mycroft`),
  скользящее окно сглаживает дрожь произношения; альтернатива — глобальный
  hotkey `⌘+⇧+J`.
- 🗣️ **STT** — `faster-whisper small` локально, beam-search 5, обогащённый
  prompt с типичными командами (Бишкек, Хром, скиллы, навыки и т.д.).
- 🧠 **LLM brain** — Mistral / AIHubMix / Gemini через OpenAI-совместимый клиент,
  function calling, persona Джарвиса в системном промпте (краткие, ироничные
  ответы в стиле британского дворецкого).
- 🔊 **TTS** — XTTS-v2 voice cloning по `actor_master.wav` на MPS (~3-5 сек/фраза),
  стриминг по предложениям, кэш на диск, нормализация чисел и единиц
  (`22°C` → «двадцать два градуса», `18:45` → «восемнадцать сорок пять»).
- � **Реакции голосом актёра** — на wake word, приветствие, прощание играют
  готовые клипы из `assets/sounds/voices/jarvis-remaster/`.
- 🎯 **33 скилла** (всё нативно, без облака):
  - **Приложения:** open / close / switch app
  - **Браузер:** web search, open url, YouTube, Wikipedia, **закрытие вкладок Chrome**
  - **Информация:** время, дата, погода (Open-Meteo, без ключа), **мировые часы**
  - **Система:** громкость, яркость, lock screen, скриншот
  - **Музыка:** play/pause/next/prev, current song (Spotify/Music)
  - **Заметки и буфер:** create note, copy/read clipboard
  - **Файлы:** open path, Spotlight search
  - **Vision:** анализ экрана через multimodal LLM
  - **Таймеры:** set/cancel, нативные macOS-уведомления + звук
  - **Long-term memory:** remember / recall / forget (SQLite)
- 🔒 **Privacy-first** — STT локально, в облако уходит только текст команды
  для LLM.
- 🔐 **Security:** `.env` под `chmod 600`, pre-commit + gitleaks, CI с lint
  и secret-scan, recovery playbook в [`docs/SECURITY.md`](docs/SECURITY.md).

---

## 🗂️ Структура

```
jarvis/
├── README.md                        ← ты здесь
├── docs/
│   ├── SETUP.md                     ← полная установка
│   ├── SECURITY.md                  ← что делать если ключ утёк
│   └── ROADMAP.md                   ← план разработки по фазам
├── src/jarvis/
│   ├── main.py                      ← CLI entry point
│   ├── config.py                    ← pydantic-схемы конфига
│   ├── core/
│   │   ├── assistant.py             ← главный async-цикл
│   │   ├── state.py                 ← история диалога
│   │   └── logger.py                ← loguru wiring
│   ├── audio/
│   │   ├── recorder.py              ← push-to-talk через sounddevice
│   │   ├── wake_word.py             ← openWakeWord + max-of-N окно
│   │   ├── hotkey.py                ← глобальный hotkey ⌘+⇧+J
│   │   └── reactions.py             ← клипы голоса актёра
│   ├── stt/
│   │   ├── base.py
│   │   └── whisper_stt.py           ← faster-whisper
│   ├── tts/
│   │   ├── base.py
│   │   ├── say_tts.py               ← macOS `say` (фолбэк)
│   │   ├── xtts_tts.py              ← XTTS-v2 voice cloning
│   │   └── _text_normalize.py       ← числа, единицы, эмодзи → speech-ready
│   ├── brain/
│   │   ├── base.py
│   │   ├── openai_llm.py            ← OpenAI-совместимый клиент
│   │   └── prompts.py               ← persona Джарвиса
│   └── skills/                      ← 33 скилла
├── config/
│   ├── config.yaml                  ← основные настройки
│   └── skills.yaml                  ← включение/выключение скиллов
├── assets/sounds/voices/
│   ├── jarvis-clean/                ← референс для XTTS-v2
│   └── jarvis-remaster/             ← клипы реакций (Priler/jarvis pack)
├── tests/                           ← unit + integration
├── scripts/
│   ├── setup.sh                     ← установка системных зависимостей
│   └── check_env.sh                 ← диагностика окружения
└── pyproject.toml
```

---

## 🚀 Быстрый старт

```bash
# 1. Системные зависимости (Homebrew, portaudio, ffmpeg)
./scripts/setup.sh

# 2. Python окружение
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. .env с API-ключом (нужен ОДИН на выбор)
cp .env.example .env
# открой .env и заполни:
#   AIHUBMIX_API_KEY=...     # бесплатный free-tier (gpt-5.5-free)
#   MISTRAL_API_KEY=...      # рекомендуется — глобально, free-tier стабилен
#   GOOGLE_API_KEY=...       # Gemini, недоступен в РУ/KG без VPN

# 4. Pre-commit хуки (один раз)
pip install pre-commit
pre-commit install

# 5. Проверка окружения
bash scripts/check_env.sh

# 6. Запуск
python -m jarvis
```

При первом запуске:
- XTTS-v2 (~1.8 ГБ) скачается в `~/Library/Application Support/tts/` — разово.
- Whisper-small (~500 МБ) — в `~/.cache/huggingface/`.
- Старт после прогрева: ~30 секунд.

Подробная установка: [`docs/SETUP.md`](docs/SETUP.md).

---

## 📖 Правила использования

### Активация

Три способа активировать Джарвиса, любой работает:

1. **Голосом:** скажи «Джарвис …» — три модели работают параллельно
   (`hey_jarvis`, `alexa`, `hey_mycroft`); скользящее окно ловит даже если
   произношение нечёткое.
2. **Hotkey:** `⌘+⇧+J` (Cmd+Shift+J) — нажал, говори команду до тишины.
   Требует **System Settings → Privacy & Security → Accessibility**:
   добавь Terminal/iTerm/VSCode откуда запускаешь.
3. **Push-to-talk:** только если в `config.yaml` стоит `wake_word.enabled: false` —
   зажми пробел пока говоришь.

### Что говорить

Естественный язык, как с человеком. Несколько живых примеров:

| Скилл | Скажи | Что произойдёт |
| --- | --- | --- |
| Открыть приложение | «Джарвис, открой Хром» | Запустит Google Chrome |
| Закрыть приложение | «Джарвис, закрой Телеграм» | Закроет Telegram |
| Переключиться | «Джарвис, переключись на VSCode» | Активирует окно VSCode |
| Закрыть вкладку | «Джарвис, закрой вкладку Гитхаб» | Найдёт по URL/title и закроет |
| Поиск Google | «Джарвис, найди в гугле квантовую запутанность» | Откроет результаты |
| YouTube | «Джарвис, найди на ютубе обзор iPhone» | Откроет YouTube-поиск |
| Погода | «Джарвис, какая погода в Бишкеке» | Open-Meteo + voice ответ |
| Время | «Джарвис, который час» | Скажет время |
| Время в городе | «Джарвис, сколько времени в Нью-Йорке» | По IANA timezone |
| Громкость | «Джарвис, сделай громкость на 50%» | macOS audio |
| Яркость | «Джарвис, поставь яркость на 80» | Требует `brew install brightness` |
| Скриншот | «Джарвис, сделай скриншот» | Сохранит на Desktop |
| Анализ экрана | «Джарвис, что у меня на экране» | Vision-LLM опишет |
| Таймер | «Джарвис, поставь таймер на 5 минут» | Notification + звук |
| Запомнить | «Джарвис, запомни что встреча в три часа» | Сохранит в SQLite |
| Вспомнить | «Джарвис, что я просил запомнить» | Достанет последние записи |
| Музыка | «Джарвис, поставь музыку» | Spotify/Music play |
| Заметка | «Джарвис, запиши заметку купить молоко» | Откроет Notes.app |
| Блокировка | «Джарвис, заблокируй экран» | ⌘+⌃+Q |

### Конфиг

Что обычно меняют в `config/config.yaml`:

- **`brain.engine`** — `mistral` (рекомендуется) | `aihubmix` | `gemini`.
- **`stt.model`** — `small` (быстро) или `medium` (точнее, +1 ГБ, +1.5 сек/фраза).
  Бери `medium` если часто слышишь галлюцинации Whisper на редких словах.
- **`wake_word.threshold`** — `0.30` сейчас. Выше = меньше ложных срабатываний,
  но строже к произношению. Ниже = чаще ловит, но иногда на постороннем звуке.
- **`tts.engine`** — `xtts` (голос Джарвиса) или `say` (mac native, быстро,
  но другой голос).
- **`reactions.enabled`** — клипы актёра на wake/greet/goodbye.

Скиллы вкл/выкл: `config/skills.yaml`. Просто `enabled: false` рядом со скиллом —
LLM перестанет его видеть.

### Что делать когда…

- **Wake-word не ловится:**
  - проверь логи (`debug_scores: true` уже стоит) — смотри scores ≥ 0.3;
  - используй `⌘+⇧+J`;
  - снизь `wake_word.threshold` до `0.25`.
- **STT путает слова** (например «навыки» → «виновки»):
  - переключи `stt.model` с `small` на `medium`;
  - добавь слово в `stt.initial_prompt` (или сразу в дефолт в `assistant.py`).
- **TTS медленный на длинных ответах:**
  - стриминг уже стоит — первое предложение играет пока остальные синтезируются;
  - persona в `prompts.py` уже жёстко требует ≤15 слов; если LLM расходится —
    ужесточи правило.
- **Ключ утёк / подозрение:** [`docs/SECURITY.md`](docs/SECURITY.md) — пошаговый
  recovery playbook.

---

## 🧠 Стек

| Слой | Технология | Где живёт |
| --- | --- | --- |
| Wake word | [openWakeWord](https://github.com/dscripka/openWakeWord) | `audio/wake_word.py` |
| STT | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | `stt/whisper_stt.py` |
| LLM | OpenAI-compatible (Mistral / AIHubMix / Gemini) | `brain/openai_llm.py` |
| TTS | [Coqui XTTS-v2](https://github.com/coqui-ai/TTS) + macOS `say` | `tts/xtts_tts.py`, `tts/say_tts.py` |
| Vision | OpenAI-compatible vision (gpt-4o-mini / gpt-5.5-free) | `skills/vision.py` |
| Реакции | Готовые клипы (Priler/jarvis remaster pack) | `audio/reactions.py` |
| macOS-glue | AppleScript + screencapture + afplay | `skills/_macos.py` |

---

## 🛣️ Дорожная карта

См. [`docs/ROADMAP.md`](docs/ROADMAP.md). Что планируется:

- Кастомная wake-word модель «djarvis» под голос автора (~50 записей + train).
- Интеграция с iMessage, Telegram, Calendar.
- Tray icon + auto-start при логине (LaunchAgent).
- Локальный LLM через Ollama для полной офлайн-работы.

---

## 📜 Лицензия

MIT — для личного использования.

## 👤 Автор

Nurislam Abdimalikov, Кыргызстан.
