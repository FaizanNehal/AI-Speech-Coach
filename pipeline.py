"""Voice pipeline: (audio -> Gradium STT) -> Gemini -> Gradium TTS -> wav.

Usage:
  python pipeline.py --text "Explain zero-knowledge proofs in two sentences"
  python pipeline.py --audio question.wav
"""
import argparse
import asyncio

from config import GEMINI_MODEL, VOICE_ID, gemini_client, gradium_client

SYSTEM_PROMPT = "You are a concise voice assistant. Answer in 1-3 short spoken sentences, no markdown."


async def transcribe(path: str) -> str:
    with open(path, "rb") as f:
        audio = f.read()
    result = await gradium_client().stt(
        setup={"model_name": "default", "input_format": "wav", "json_config": {"language": "en"}},
        audio=audio,
    )
    return result.text


def ask_gemini(prompt: str) -> str:
    resp = gemini_client().models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={"system_instruction": SYSTEM_PROMPT},
    )
    return resp.text.strip()


async def speak(text: str, out_path: str) -> None:
    result = await gradium_client().tts(
        setup={"model_name": "default", "voice_id": VOICE_ID, "output_format": "wav"},
        text=text,
    )
    with open(out_path, "wb") as f:
        f.write(result.raw_data)


async def main() -> None:
    parser = argparse.ArgumentParser()
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--text", help="Prompt text to send to Gemini")
    src.add_argument("--audio", help="WAV file to transcribe with Gradium first")
    parser.add_argument("--out", default="output/reply.wav")
    args = parser.parse_args()

    prompt = args.text
    if args.audio:
        prompt = await transcribe(args.audio)
        print(f"[stt]    {prompt}")

    answer = ask_gemini(prompt)
    print(f"[gemini] {answer}")

    await speak(answer, args.out)
    print(f"[tts]    saved {args.out}")


if __name__ == "__main__":
    asyncio.run(main())
