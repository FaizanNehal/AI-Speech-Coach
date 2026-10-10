"""Smoke test: verifies both API keys work with one tiny request each."""
import asyncio

from config import GEMINI_MODEL, VOICE_ID, gemini_client, gradium_client


def check_gemini() -> None:
    resp = gemini_client().models.generate_content(
        model=GEMINI_MODEL, contents="Reply with exactly: pong"
    )
    print(f"[gemini]  OK  model={GEMINI_MODEL} reply={resp.text.strip()!r}")


async def check_gradium() -> None:
    result = await gradium_client().tts(
        setup={"model_name": "default", "voice_id": VOICE_ID, "output_format": "wav"},
        text="Gradium is working.",
    )
    path = "output/check_gradium.wav"
    with open(path, "wb") as f:
        f.write(result.raw_data)
    print(f"[gradium] OK  {len(result.raw_data)} bytes @ {result.sample_rate} Hz -> {path}")


if __name__ == "__main__":
    for name, fn in [("gemini", check_gemini), ("gradium", lambda: asyncio.run(check_gradium()))]:
        try:
            fn()
        except Exception as e:
            print(f"[{name}] FAILED: {type(e).__name__}: {e}")
