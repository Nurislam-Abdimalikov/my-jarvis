# 🤖 Jarvis — Нативный macOS-клиент (SwiftUI)

Нативный menubar-клиент для голосового ассистента Jarvis. Читает `~/jarvis/logs/jarvis.log` через FSEvents и отображает диалог в режиме реального времени.

## Требования

- macOS 14 (Sonoma)+
- Xcode 15+
- Backend запущен: `make run` в корне репозитория

## Структура

```
macos/
├── Jarvis.xcodeproj/         # Xcode-проект
└── Jarvis/
    ├── JarvisApp.swift       # @main, MenuBarExtra
    ├── Models/
    │   ├── LogEntry.swift        # Парсинг строк loguru-лога
    │   ├── AssistantStatus.swift # Статусы: listening/recording/processing/speaking/idle
    │   └── ChatMessage.swift     # Структурированное сообщение чата
    ├── Services/
    │   ├── LogWatcher.swift      # FSEvents (DispatchSource) за jarvis.log
    │   ├── LogParser.swift       # Лог → [ChatMessage] (зеркалит chatUtils.js)
    │   └── TTSController.swift   # Создаёт stop.flag для остановки TTS
    └── Views/
        └── MenuBarView.swift     # MenuBarExtra popup с чатом и статусом
```

## Сборка

1. Откройте `Jarvis.xcodeproj` в Xcode
2. Выберите схему `Jarvis` и таргет `My Mac`
3. `⌘R` — запуск

## Принцип работы

| Канал | Что читает |
|-------|-----------|
| `~/jarvis/logs/jarvis.log` | Диалог, статус, навыки |
| `~/jarvis/logs/stop.flag` | **Запись** (остановка TTS) |

Клиент **не** использует HTTP/WebSocket — только файловая система.

## Чат

Чат — **read-only зеркало** голосового диалога. Команды подаются **только голосом** через wake word («Джарвис») или хоткей `⌘⇧J`.
