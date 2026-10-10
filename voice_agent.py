"""Voice agent: raw audio -> Gemini (native audio understanding) -> Gradium TTS -> wav.

No speech-to-text step: Gemini hears the recording itself, so it can pick up
tone, emotion, pace, hesitation and background sound, not just the words.

Usage:
  python voice_agent.py                     # record from mic, press Enter to stop
  python voice_agent.py --audio q.wav       # use an existing recording
  python voice_agent.py --mode analyze      # describe *how* you spoke instead of answering
"""
import argparse
import asyncio
import queue
import wave

import numpy as np
import sounddevice as sd
from google.genai import types

from config import GEMINI_MODEL, gemini_client
from pipeline import speak

SAMPLE_RATE = 16000
MIC_PATH = "output/mic.wav"

PROMPTS = {
    "chat": (
        "You are a concise, empathetic voice assistant. Listen to the user's audio: respond to what "
        "they said, and adapt to how they said it (mood, energy, uncertainty). "
        "Answer in 1-3 short spoken sentences, no markdown."
    ),
    "analyze": (
        "You are a voice analyst. Listen to the audio and describe how the speaker sounds: emotion, "
        "energy, confidence, speaking pace, hesitations or filler words, and anything notable in the "
        "background. Briefly mention what they said. Answer in 3-5 short spoken sentences, no markdown."
    ),
}


def record(path: str) -> str:
    chunks: queue.Queue = queue.Queue()
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16",
                        callback=lambda data, *_: chunks.put(data.copy())):
        input("[mic]    recording... press Enter to stop ")
    audio = np.concatenate(list(chunks.queue)) if not chunks.empty() else np.zeros((0, 1), "int16")

    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(audio.tobytes())
    print(f"[mic]    {len(audio) / SAMPLE_RATE:.1f}s saved to {path}")
    return path


def listen_with_gemini(path: str, mode: str) -> str:
    with open(path, "rb") as f:
        audio = f.read()
    resp = gemini_client().models.generate_content(
        model=GEMINI_MODEL,
        contents=[types.Part.from_bytes(data=audio, mime_type="audio/wav")],
        config={"system_instruction": PROMPTS[mode]},
    )
    return resp.text.strip()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", help="WAV file to send (default: record from the microphone)")
    parser.add_argument("--mode", choices=PROMPTS, default="chat")
    parser.add_argument("--out", default="output/agent_reply.wav")
    args = parser.parse_args()

    path = args.audio or record(MIC_PATH)
    answer = listen_with_gemini(path, args.mode)
    print(f"[gemini] {answer}")

    await speak(answer, args.out)
    print(f"[tts]    saved {args.out}")


if __name__ == "__main__":
    asyncio.run(main())
