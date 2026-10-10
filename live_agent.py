"""Live speech-therapy coach in the terminal (the web version is server.py).

Loop: mic (a voice-activity detector separates your speech from background noise; your turn
ends after a few seconds without speech, or instantly when you press any key) -> Gemini hears
the raw audio plus measured timing (pauses, response latency) -> the coach gives one piece of
feedback and asks one question / exercise, spoken via Gradium TTS -> listens again.

Say "give me my report" / "analyze it now" (any wording) to end the session: Gemini re-listens
to the whole conversation and writes a detailed report, saved to output/reports/ (also visible
in the web app's Reports tab) and summarised out loud. Ctrl+C to quit without a report.

Usage:
  python live_agent.py
  python live_agent.py --silence 2      # end your turn after 2s without speech (default 3s)
  python live_agent.py --vad 2          # less strict speech detection if soft speech is missed (0-3)
"""
import argparse
import asyncio
import queue
import select
import sys
import termios
import tty
from contextlib import contextmanager

import sounddevice as sd
import webrtcvad

from coach import (BLOCK, MIC_RATE, OPENER, TTS_RATE, TurnDetector, coach_reply, generate_report,
                   noise_gate, render_markdown, user_content)
from config import VOICE_ID, gemini_client, gradium_client
from coach import session_context
from memory import load_memory, memory_prompt, opener_for, save_memory


def open_mic(q: queue.Queue) -> sd.InputStream:
    return sd.InputStream(samplerate=MIC_RATE, channels=1, dtype="int16", blocksize=BLOCK,
                          callback=lambda data, *_: q.put(data[:, 0].copy()))


@contextmanager
def keypress_mode():
    """Let single keypresses be read without Enter (Ctrl+C still works)."""
    if not sys.stdin.isatty():
        yield
        return
    old = termios.tcgetattr(sys.stdin)
    try:
        tty.setcbreak(sys.stdin)
        yield
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old)


def key_pressed() -> bool:
    if sys.stdin.isatty() and select.select([sys.stdin], [], [], 0)[0]:
        sys.stdin.read(1)
        return True
    return False


def calibrate() -> float:
    q: queue.Queue = queue.Queue()
    print("[mic]    measuring background noise, stay quiet for a second...")
    with open_mic(q):
        sd.sleep(1000)
    return noise_gate(list(q.queue))


def listen(detector: TurnDetector, silence_s: float):
    """Block until the user has said something; return the Turn."""
    while True:
        if sys.stdin.isatty():
            termios.tcflush(sys.stdin, termios.TCIFLUSH)  # ignore keys pressed while the agent spoke
        detector.reset()
        q: queue.Queue = queue.Queue()
        print(f"[mic]    listening... (stop talking for {silence_s:g}s or press any key when done)", flush=True)
        turn = None
        with open_mic(q):
            while turn is None:
                turn = detector.feed(q.get())
                if turn is None and detector.speaking and key_pressed():
                    turn = detector.finish()
                    if turn is None:
                        break
        if turn:
            print(f"[you]    {turn.stats_text.removeprefix('[measured by app] ')}")
            return turn


async def play(gradium, text) -> None:
    """Speak a string (or an async stream of text) through Gradium TTS and the speakers."""
    tts = await gradium.tts_stream(
        setup={"model_name": "default", "voice_id": VOICE_ID, "output_format": "pcm"},
        text=text,
    )
    with sd.RawOutputStream(samplerate=TTS_RATE, channels=1, dtype="int16") as speaker:
        async for audio in tts.iter_bytes():
            await asyncio.to_thread(speaker.write, audio)


async def printed(text_stream):
    print("[coach]  ", end="", flush=True)
    async for text in text_stream:
        print(text, end="", flush=True)
        yield text
    print()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--silence", type=float, default=3.0, help="seconds without speech that end your turn")
    parser.add_argument("--vad", type=int, default=3, choices=range(4),
                        help="speech-detector strictness: 3 ignores the most noise, 0 the least")
    args = parser.parse_args()

    gemini, gradium = gemini_client(), gradium_client()
    detector = TurnDetector(webrtcvad.Vad(args.vad), calibrate(), args.silence)
    print("[mic]    ready. Press any key to finish a turn early, Ctrl+C to quit.\n")

    memory = load_memory()
    opener = opener_for(memory) or OPENER
    context = session_context(opener, memory_prompt(memory))
    print(f"[coach]  {opener}")
    await play(gradium, opener)

    history, turn_stats, coach_lines = [], [], [opener]
    extras = {"baseline": None, "drill_events": [], "exercise_events": [], "timeline": [], "accent_opt_in": None}
    while True:
        turn = await asyncio.to_thread(listen, detector, args.silence)
        history.append(user_content(turn))
        turn_stats.append(turn.stats)
        try:
            reply = await coach_reply(gemini, history, context)
            if reply.report:
                print("[coach]  Generating your report...")
                await play(gradium, "Sure. Let me listen back to our whole session and put your report "
                                    "together. This takes a few seconds.")
                record = await generate_report(gemini, history, turn_stats, coach_lines, extras)
                save_memory()
                print("\n" + render_markdown(record))
                print(f"[report] saved to output/reports/{record['id']}.md  (also in the web app's Reports tab)")
                await play(gradium, record["spoken_summary"])
                return
            if reply.notes:
                print(f"[notes]  {reply.notes}")
            if reply.baseline:
                extras["baseline"] = reply.baseline
                print("[baseline] " + ", ".join(f"{c} {v['score']:g}" for c, v in reply.baseline.items()))
            if reply.drill:
                extras["drill_events"].append(reply.drill)
                d = reply.drill
                print(f"[drill]  {d['target']}  ->  {d['respelling']} {d['ipa']}  ({d['status']}) {d['tip']}")
            if reply.exercise:
                extras["exercise_events"].append(reply.exercise)
                e = reply.exercise
                print(f"[exercise] {e['component']}: {e['type']} ({e['status']})  {e['script']}")
            if reply.accent:
                extras["accent_opt_in"] = reply.accent
            await play(gradium, printed(reply.text))
        except Exception as e:
            print(f"\n[error]  {type(e).__name__}: {e}  (say that again)")
            history.pop()
            turn_stats.pop()
            continue
        history.append(reply.model_content())
        coach_lines.append(reply.spoken_text)


if __name__ == "__main__":
    try:
        with keypress_mode():
            asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[bye]")
