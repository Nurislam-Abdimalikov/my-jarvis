"""TTS через macOS встроенный `say`."""

from __future__ import annotations

import asyncio

from loguru import logger

from .base import BaseTTS


class SayTTS(BaseTTS):
    """macOS `say` — бесплатно, мгновенно, голос Yuri/Milena для русского.

    Список голосов: `say -v ?`
    Установить русский голос: System Settings → Accessibility → Spoken Content
    → System Voice → Manage Voices → Russian (например, Yuri).
    """

    def __init__(self, voice: str = "Yuri", rate: int = 200) -> None:
        self.voice = voice
        self.rate = rate

    async def speak(self, text: str) -> None:
        text = (text or "").strip()
        if not text:
            return

        from .base import check_and_clear_interrupt

        if check_and_clear_interrupt():
            logger.info("TTS say прерван до старта")
            return

        # Аргументы передаются списком, никаких shell-инъекций — `say` получит текст as-is.
        # Используем `--` чтобы текст начинающийся с `-` не был принят за флаг.
        cmd = ["say", "-v", self.voice, "-r", str(self.rate), "--", text]

        logger.debug("🔊 say (voice={}, rate={}): {}", self.voice, self.rate, text[:80])
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )

        # Опрашиваем состояние процесса и флаг отмены
        while proc.returncode is None:
            if check_and_clear_interrupt():
                logger.info("🔊 TTS say прерван — останавливаю воспроизведение")
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass
                break
            await asyncio.sleep(0.05)

