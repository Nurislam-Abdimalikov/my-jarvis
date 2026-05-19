"""One-shot XTTS-v2 smoke check.

Грузит модель XTTS-v2 (первый раз ~1.8 GB), синтезирует одну короткую фразу
голосом из actor_master.wav и сообщает время. Используется только для ручной
проверки скорости/качества — НЕ запускается ни в CI, ни автоматически.
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from jarvis.tts.xtts_tts import XttsTTS

REF = Path(__file__).resolve().parents[1] / "assets/sounds/voices/jarvis-clean/actor_master.wav"
OUT = Path(__file__).resolve().parents[1] / "logs" / "xtts_smoke.wav"


async def main() -> None:
    print(f"ref: {REF}, exists={REF.exists()}")
    tts = XttsTTS(ref_file=REF, language="ru", device="auto", cache_enabled=False)

    print("Loading model (first time downloads ~1.8 GB)...")
    t0 = time.time()
    tts._ensure_loaded()
    print(f"Model loaded in {time.time() - t0:.1f}s")

    text = "В Бишкеке двадцать два градуса, сэр."
    OUT.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    tts._synthesize_to_file(text, str(OUT))
    print(f"Synth one phrase in {time.time() - t0:.1f}s -> {OUT}")
    print("Play it: afplay", OUT)


asyncio.run(main())
