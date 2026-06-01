# 📋 Tasks Backlog — Jarvis

Доска задач и планов по развитию голосового ассистента Jarvis.

---

## 📋 TODO
- [ ] `feat/custom-wakeword` — Train a custom "djarvis" openWakeWord model on the author's voice (~50 samples).
- [ ] `feat/imessage-telegram` — Send messages via iMessage and Telegram URL scheme.
- [ ] `feat/calendar-write` — Create Calendar.app events (read already works).
- [ ] `feat/tray-autostart` — Menu-bar tray icon + LaunchAgent auto-start on login.
- [ ] `feat/ollama-local-llm` — Local LLM via Ollama for fully offline operation.
- [ ] `feat/interrupt` — Barge-in / "Stop, Jarvis" to cancel playback.

---

## 🚧 IN PROGRESS
- [ ] `feature/theme-switcher` — Добавление переключателя тем (Space Dark, Cyberpunk, Emerald) в интерфейс десктопного дашборда.

---

## ✅ DONE
- [x] `chore/monorepo-consolidate` — 2026-06-02 — Consolidation of Electron + Next.js (Tailwind CSS v4) into `frontend/`, Python tests to `backend/` and repository cleanup.
- [x] `feat/voice-loop` — 2026-05 — Core async voice loop: record → STT → LLM → TTS (`core/assistant.py`).
- [x] `feat/wakeword` — 2026-05 — openWakeWord with 3 parallel models + sliding max-of-N window (`audio/wake_word.py`).
- [x] `feat/hotkey` — 2026-05 — Global `⌘+⇧+J` push-to-talk hotkey fallback (`audio/hotkey.py`).
- [x] `feat/whisper-stt` — 2026-05 — Local faster-whisper STT with enriched initial prompt (`stt/whisper_stt.py`).
- [x] `feat/xtts-tts` — 2026-05 — XTTS-v2 voice cloning on MPS with sentence streaming + disk cache (`tts/xtts_tts.py`).
- [x] `feat/text-normalize` — 2026-05 — Number/unit/time normalization for speech-ready TTS (`tts/_text_normalize.py`).
- [x] `feat/llm-brain` — 2026-05 — OpenAI-compatible brain (Mistral / AIHubMix / Gemini) with function calling (`brain/openai_llm.py`).
- [x] `feat/skills-core` — 2026-05 — 33 native skills: apps, browser, system, music, notes, clipboard, files, info, timers.
- [x] `feat/vision` — 2026-05 — Screen analysis through a multimodal LLM (`skills/vision.py`).
- [x] `feat/memory` — 2026-05 — Long-term memory remember/recall/forget on SQLite (`skills/memory.py`).
- [x] `feat/reactions` — 2026-05 — Actor voice clips on wake / greet / goodbye (`audio/reactions.py`).
- [x] `chore/security-hardening` — 2026-05 — `.env` chmod 600, pre-commit + gitleaks, CI lint and secret-scan.
- [x] `chore/audit-cleanup` — 2026-05 — Removed dead code (vad stub, unused configs) and stale docs.

---

## 💤 BACKLOG
- [ ] `feat/home-assistant` — Интеграция с умным домом для управления освещением и устройствами.
- [ ] `feat/voice-id` — Распознавание голоса владельца для ограничения доступа к системным командам.
- [ ] `feat/llm-plugins` — Поддержка динамической загрузки сторонних плагинов/навыков из сети.
