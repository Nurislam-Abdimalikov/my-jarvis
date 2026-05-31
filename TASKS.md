# ✅ Tasks

Working backlog for Jarvis. Each task: checkbox, branch, date, short description.
Phased product roadmap lives in [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## 📋 TODO

- [ ] `feat/custom-wakeword` — _planned_ — Train a custom "djarvis" openWakeWord model on the author's voice (~50 samples).
- [ ] `feat/imessage-telegram` — _planned_ — Send messages via iMessage and Telegram URL scheme.
- [ ] `feat/calendar-write` — _planned_ — Create Calendar.app events (read already works).
- [ ] `feat/tray-autostart` — _planned_ — Menu-bar tray icon + LaunchAgent auto-start on login.
- [ ] `feat/ollama-local-llm` — _planned_ — Local LLM via Ollama for fully offline operation.
- [ ] `feat/interrupt` — _planned_ — Barge-in / "Stop, Jarvis" to cancel playback.

---

## 🚧 IN PROGRESS

- [ ] `chore/dx-tooling` — 2026-05-31 — Developer experience: Makefile, colored `check_env.sh`, CONTRIBUTING guide.

---

## ✅ DONE

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
