"""Talk to Gemini with your voice.

Mic -> Gradium realtime STT (VAD detects when you stop talking) -> Gemini chat
(streamed) -> Gradium streaming TTS -> speakers. Loops until Ctrl+C.

Usage:
  python voice_chat.py                  # default mic + speakers
  python voice_chat.py --list-devices   # show audio devices
  python voice_chat.py --input 4 --output 5
  python voice_chat.py --file q.wav     # use a WAV file instead of the mic (testing)
"""
import argparse
import asyncio
import wave

import numpy as np
import sounddevice as sd

from config import GEMINI_MODEL, VOICE_ID, gemini_client, gradium_client

STT_RATE = 24000      # Gradium "pcm" STT input: 24 kHz, int16, mono
FRAME = 1920          # 80 ms at 24 kHz
TTS_RATE = 48000      # Gradium "pcm" TTS output: 48 kHz, int16, mono
SYSTEM_PROMPT = "You are a friendly voice assistant. Answer in 1-3 short spoken sentences, no markdown."


async def mic_frames(device):
    """Yield 80 ms int16 frames from the microphone."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[bytes] = asyncio.Queue()

    def callback(indata, frames, time_info, status):
        loop.call_soon_threadsafe(queue.put_nowait, bytes(indata))

    with sd.RawInputStream(samplerate=STT_RATE, blocksize=FRAME, channels=1,
                           dtype="int16", device=device, callback=callback):
        while True:
            yield await queue.get()


async def file_frames(path):
    """Yield 80 ms frames from a 24 kHz mono WAV at real-time pace, then silence."""
    with wave.open(path, "rb") as w:
        if (w.getframerate(), w.getnchannels(), w.getsampwidth()) != (STT_RATE, 1, 2):
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
            pcm = pcm.reshape(-1, w.getnchannels())[:, 0]
            idx = np.linspace(0, len(pcm) - 1, int(len(pcm) * STT_RATE / w.getframerate()))
            data = np.interp(idx, np.arange(len(pcm)), pcm).astype(np.int16).tobytes()
        else:
            data = w.readframes(w.getnframes())
    for i in range(0, len(data), FRAME * 2):
        yield data[i:i + FRAME * 2]
        await asyncio.sleep(0.08)
    while True:  # trailing silence so VAD can detect the end of the turn
        yield bytes(FRAME * 2)
        await asyncio.sleep(0.08)


async def listen(frames, vad_threshold: float) -> str:
    """Stream audio to Gradium until VAD says the speaker stopped; return the transcript."""
    words: list[str] = []
    turn_over = asyncio.Event()

    async with gradium_client().stt_realtime(
        model_name="default", input_format="pcm",
        json_config={"language": "en", "delay_in_frames": 16},
    ) as stt:
        async def producer():
            async for frame in frames:
                if turn_over.is_set():
                    break
                await stt.send_audio(frame)
            await stt.send_eos()

        async def consumer():
            async for msg in stt:
                if msg["type"] == "text":
                    words.append(msg["text"])
                    print(msg["text"], end=" ", flush=True)
                elif msg["type"] == "step" and words and not turn_over.is_set():
                    if msg["vad"][2]["inactivity_prob"] > vad_threshold:
                        turn_over.set()  # producer stops and sends EOS
                elif msg["type"] == "end_of_stream":
                    return

        await asyncio.gather(producer(), consumer())
    print()
    return " ".join(words).strip()


async def respond(chat, text: str, output_device) -> None:
    """Stream Gemini's reply into Gradium TTS and play audio as it arrives."""
    async def gemini_tokens():
        async for chunk in await chat.send_message_stream(text):
            if chunk.text:
                print(chunk.text, end="", flush=True)
                yield chunk.text

    tts = await gradium_client().tts_stream(
        setup={"model_name": "default", "voice_id": VOICE_ID, "output_format": "pcm"},
        text=gemini_tokens(),
    )
    with sd.RawOutputStream(samplerate=TTS_RATE, channels=1, dtype="int16",
                            device=output_device) as speaker:
        async for audio in tts.iter_bytes():
            await asyncio.to_thread(speaker.write, audio)
    print()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=int, help="Input device index (see --list-devices)")
    parser.add_argument("--output", type=int, help="Output device index")
    parser.add_argument("--file", help="Use a WAV file instead of the mic (single turn)")
    parser.add_argument("--vad", type=float, default=0.5,
                        help="End-of-turn threshold on inactivity probability (default 0.5)")
    parser.add_argument("--list-devices", action="store_true")
    args = parser.parse_args()

    if args.list_devices:
        print(sd.query_devices())
        return

    chat = gemini_client().aio.chats.create(
        model=GEMINI_MODEL, config={"system_instruction": SYSTEM_PROMPT}
    )
    print(f"Voice chat with {GEMINI_MODEL}. Speak after the prompt; Ctrl+C to quit.\n")

    while True:
        print("🎙  listening... ", end="", flush=True)
        frames = file_frames(args.file) if args.file else mic_frames(args.input)
        text = await listen(frames, args.vad)
        await frames.aclose()  # releases the mic so it doesn't hear the reply
        if not text:
            continue
        print("🤖 ", end="", flush=True)
        await respond(chat, text, args.output)
        if args.file:
            break


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nbye")
