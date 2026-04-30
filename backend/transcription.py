"""
Audio transcription using Groq Whisper API (cloud).
Replaces local Whisper — faster, no GPU needed.
"""

import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def transcribe_audio(file_path: str) -> dict:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    file_size = os.path.getsize(file_path)
    if file_size == 0:
        raise ValueError("Audio file is empty")
    if file_size > 25 * 1024 * 1024:
        raise ValueError("Audio file exceeds 25 MB limit. Please use a shorter recording or compress the file.")

    logger.info(f"Transcribing via Groq Whisper: {file_path} ({file_size / 1024:.1f} KB)")

    with open(file_path, "rb") as f:
        transcription = client.audio.transcriptions.create(
            file=(os.path.basename(file_path), f.read()),
            model="whisper-large-v3",
            response_format="verbose_json",
            temperature=0.0,
        )

    transcript_text = transcription.text or ""
    segments = []
    if hasattr(transcription, "segments") and transcription.segments:
        segments = [
            {
                "start": round(seg.get("start", 0), 2) if isinstance(seg, dict) else round(getattr(seg, "start", 0), 2),
                "end": round(seg.get("end", 0), 2) if isinstance(seg, dict) else round(getattr(seg, "end", 0), 2),
                "text": (seg.get("text", "") if isinstance(seg, dict) else getattr(seg, "text", "")).strip(),
            }
            for seg in transcription.segments
        ]

    language = getattr(transcription, "language", "unknown") or "unknown"
    logger.info(f"Transcription complete: {len(transcript_text)} chars, language={language}")

    return {
        "text": transcript_text.strip(),
        "segments": segments,
        "language": language,
    }
