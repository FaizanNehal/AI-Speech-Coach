"""Low-latency demo: stream Gemini tokens straight into Gradium streaming TTS.

Audio starts generating before Gemini has finished its answer.

Usage:
  python stream_demo.py "Tell me a short story about a robot at a hackathon"
"""
import asyncio
import sys
import time
import wave

from config import GEMINI_MODEL, VOICE_ID, gemini_client, gradium_client

OUT = "output/stream_reply.wav"


async def main(prompt: str) -> None:
    gemini = gemini_client()
    t0 = time.perf_counter()

    async def gemini_tokens():
        stream = await gemini.aio.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=prompt,
            config={"system_instruction": "Answer in plain spoken English, no markdown."},
        )
        async for chunk in stream:
            if chunk.text:
                print(chunk.text, end="", flush=True)
                yield chunk.text

    tts = await gradium_client().tts_stream(
        setup={"model_name": "default", "voice_id": VOICE_ID, "output_format": "pcm"},
        text=gemini_tokens(),
    )

    pcm, first_audio = bytearray(), None
    async for audio in tts.iter_bytes():
        if first_audio is None:
            first_audio = time.perf_counter() - t0
        pcm.extend(audio)

    # Gradium "pcm" output is 48 kHz, 16-bit signed, mono.
    with wave.open(OUT, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(48000)
        w.writeframes(bytes(pcm))

    print(f"\n\n[stream] first audio after {first_audio:.2f}s, total {time.perf_counter() - t0:.2f}s -> {OUT}")


if __name__ == "__main__":
    asyncio.run(main(" ".join(sys.argv[1:]) or "Say hello to the ETH hackathon in two sentences."))
