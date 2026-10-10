"""Web app for the speech coach: live session over a WebSocket + reports dashboard.

  python server.py          # then open http://localhost:8000

WebSocket protocol (/ws):
  browser -> server  binary: 16 kHz mono int16 mic audio (any chunk size)
                     text:   {"type": "start" | "end_turn" | "report" | "playback_done"}
  server -> browser  binary: 48 kHz mono int16 coach speech (play in order)
                     text:   {"type": "state", "state": calibrating|speaking|listening|thinking|reporting|done}
                             {"type": "vad", "speaking": bool}         user started / stopped talking
                             {"type": "user_turn", "n", "stats"}       a user turn was captured
                             {"type": "coach", "text", "notes"?}       start of a coach message
                             {"type": "coach_delta", "text"}           streamed coach text
                             {"type": "audio_end"}                     no more audio for this message
                             {"type": "report_ready", "id"}
                             {"type": "error", "message"}
"""
import asyncio
import glob
import json
import os
import re
import traceback

import aiohttp
import numpy as np
import uvicorn
import webrtcvad
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from coach import (BLOCK, OPENER, REPORTS_DIR, TurnDetector, coach_reply, generate_report, noise_gate,
                   session_context, user_content)
from memory import load_memory, memory_prompt, opener_for, report_scores, save_memory
from config import VOICE_ID, gemini_client, gradium_client

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
CALIBRATION_BLOCKS = 33      # ~1s of room noise
SILENCE_S = 3.0

app = FastAPI()
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


class Session:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.send_lock = asyncio.Lock()
        self.gemini, self.gradium = gemini_client(), gradium_client()
        self.vad = webrtcvad.Vad(3)
        self.state = "idle"
        self.pcm = bytearray()
        self.calibration: list[np.ndarray] = []
        self.detector: TurnDetector | None = None
        self.history: list = []
        self.turn_stats: list[dict] = []
        self.coach_lines: list[str] = [OPENER]
        self.baseline: dict | None = None
        self.drill_events: list[dict] = []
        self.exercise_events: list[dict] = []
        self.timeline: list[dict] = []
        self.opener = OPENER
        self.context = session_context(OPENER)
        self.accent_opt_in: str | None = None
        self.task: asyncio.Task | None = None

    # ------------------------------------------------------------ sending

    async def send(self, **event) -> None:
        async with self.send_lock:
            await self.ws.send_text(json.dumps(event))

    async def send_audio(self, data: bytes) -> None:
        async with self.send_lock:
            await self.ws.send_bytes(data)

    async def set_state(self, state: str) -> None:
        self.state = state
        await self.send(type="state", state=state)

    def spawn(self, coro) -> None:
        self.task = asyncio.create_task(self._guard(coro))

    async def _guard(self, coro) -> None:
        try:
            await coro
        except (WebSocketDisconnect, RuntimeError):
            pass
        except Exception as e:
            traceback.print_exc()
            await self.send(type="error", message=f"{type(e).__name__}: {e}")
            await self.send(type="audio_end")
            if self.detector:
                await self.start_listening()

    async def speak(self, text) -> None:
        """Stream text (str or async generator) through Gradium TTS to the browser."""
        for attempt in range(3):  # the connection to Gradium occasionally times out; it fails before any text is read
            try:
                tts = await self.gradium.tts_stream(
                    setup={"model_name": "default", "voice_id": VOICE_ID, "output_format": "pcm"},
                    text=text,
                )
                break
            except (aiohttp.ClientConnectionError, asyncio.TimeoutError):
                if attempt == 2:
                    raise
                await asyncio.sleep(1)
        async for audio in tts.iter_bytes():
            await self.send_audio(audio)
        await self.send(type="audio_end")

    # ------------------------------------------------------------ incoming

    async def on_message(self, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "start" and self.state == "idle":
            # Personalise the session from long-term memory (and an optional focus the user picked).
            focus = (msg.get("focus") or "").strip()[:200] or None
            memory = load_memory()
            self.opener = opener_for(memory, focus) or OPENER
            self.coach_lines = [self.opener]
            self.context = session_context(self.opener, memory_prompt(memory), focus)
            await self.set_state("calibrating")
        elif kind == "playback_done" and self.state == "speaking":
            await self.start_listening()
        elif kind == "end_turn" and self.state == "listening" and self.detector:
            turn = self.detector.finish()
            if turn:
                self.spawn(self.handle_turn(turn))
            else:
                await self.send(type="vad", speaking=False)
        elif kind == "report" and self.state == "listening":
            if not self.turn_stats:
                await self.send(type="error", message="Talk with the coach for at least one turn first.")
            else:
                self.spawn(self.make_report())

    async def on_audio(self, data: bytes) -> None:
        self.pcm.extend(data)
        while len(self.pcm) >= BLOCK * 2:
            block = np.frombuffer(bytes(self.pcm[:BLOCK * 2]), dtype=np.int16)
            del self.pcm[:BLOCK * 2]
            if self.state == "calibrating":
                self.calibration.append(block)
                if len(self.calibration) >= CALIBRATION_BLOCKS:
                    self.detector = TurnDetector(self.vad, noise_gate(self.calibration), SILENCE_S)
                    await self.set_state("speaking")
                    await self.send(type="coach", text=self.opener)
                    self.spawn(self.speak(self.opener))
            elif self.state == "listening":
                was_speaking = self.detector.speaking
                turn = self.detector.feed(block)
                if turn:
                    self.spawn(self.handle_turn(turn))
                elif self.detector.speaking != was_speaking:
                    await self.send(type="vad", speaking=self.detector.speaking)

    # ------------------------------------------------------------ flow

    async def start_listening(self) -> None:
        self.detector.reset()
        self.pcm.clear()
        await self.set_state("listening")

    async def handle_turn(self, turn) -> None:
        await self.set_state("thinking")
        self.history.append(user_content(turn))
        self.turn_stats.append(turn.stats)
        await self.send(type="user_turn", n=len(self.turn_stats), stats=turn.stats)
        try:
            reply = await coach_reply(self.gemini, self.history, self.context)
        except Exception:
            self.history.pop()
            self.turn_stats.pop()
            raise
        if reply.report:
            await self.make_report()
            return

        async def forwarded():
            async for text in reply.text:
                await self.send(type="coach_delta", text=text)
                yield text

        await self.set_state("speaking")
        self.baseline = self.baseline or reply.baseline
        self.accent_opt_in = reply.accent or self.accent_opt_in
        if reply.drill:
            self.drill_events.append(reply.drill)
        if reply.exercise:
            self.exercise_events.append(reply.exercise)
        # what the coach worked on after each user turn (drives the report's session timeline)
        entries = [{"kind": "drill", "component": reply.drill["area"], "label": reply.drill["target"],
                    "status": reply.drill["status"], "script": reply.drill["target"]}] if reply.drill else []
        if reply.exercise:
            entries.append({"kind": "exercise", "component": reply.exercise["component"],
                            "label": reply.exercise["type"], "status": reply.exercise["status"],
                            "script": reply.exercise["script"]})
        for e in entries or [{"kind": "talk", "component": "", "label": "", "status": ""}]:
            self.timeline.append({"turn": len(self.turn_stats), **e})
        await self.send(type="coach", text="", notes=reply.notes, baseline=reply.baseline,
                        drill=reply.drill, exercise=reply.exercise, accent=reply.accent)
        await self.speak(forwarded())
        self.history.append(reply.model_content())
        self.coach_lines.append(reply.spoken_text)

    async def make_report(self) -> None:
        await self.set_state("reporting")
        ack = "Sure. Let me listen back to our whole session and put your report together."
        await self.send(type="coach", text=ack)
        await self.speak(ack)
        record = await generate_report(self.gemini, self.history, self.turn_stats, self.coach_lines, {
            "baseline": self.baseline, "drill_events": self.drill_events, "accent_opt_in": self.accent_opt_in,
            "exercise_events": self.exercise_events, "timeline": self.timeline})
        save_memory()
        await self.send(type="report_ready", id=record["id"])
        await self.send(type="coach", text=record["spoken_summary"])
        await self.speak(record["spoken_summary"])
        await self.set_state("done")


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    session = Session(ws)
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes"):
                await session.on_audio(msg["bytes"])
            elif msg.get("text"):
                await session.on_message(json.loads(msg["text"]))
    except WebSocketDisconnect:
        pass
    finally:
        if session.task and not session.task.done() and session.state != "reporting":
            session.task.cancel()


# ---------------------------------------------------------------- reports API

ID_RE = re.compile(r"^[0-9]{8}_[0-9]{6}$")


def legacy_reports() -> list[dict]:
    """Markdown-only reports written by earlier versions of live_agent.py."""
    out = []
    for path in glob.glob("output/speech_report_*.md"):
        rid = os.path.basename(path)[len("speech_report_"):-3]
        if ID_RE.match(rid) and not os.path.exists(f"{REPORTS_DIR}/{rid}.json"):
            out.append({"id": rid, "legacy": True,
                        "created_at": f"{rid[:4]}-{rid[4:6]}-{rid[6:8]}T{rid[9:11]}:{rid[11:13]}:{rid[13:15]}"})
    return out


@app.get("/api/reports")
def list_reports():
    reports = []
    for path in glob.glob(f"{REPORTS_DIR}/*.json"):
        with open(path) as f:
            r = json.load(f)
        scores = {c["component"]: c["score"] for c in
                  r["speech_skills"] + r["conversation_skills"] + r.get("focus_areas", [])}
        reports.append({"id": r["id"], "created_at": r["created_at"], "overall_score": r["overall_score"],
                        "verdict": r["verdict"], "metrics": r["metrics"], "scores": scores})
    return sorted(reports + legacy_reports(), key=lambda r: r["created_at"], reverse=True)


@app.get("/api/reports/{rid}")
def get_report(rid: str):
    if not ID_RE.match(rid):
        raise HTTPException(404)
    if os.path.exists(f"{REPORTS_DIR}/{rid}.json"):
        with open(f"{REPORTS_DIR}/{rid}.json") as f:
            return json.load(f)
    legacy = f"output/speech_report_{rid}.md"
    if os.path.exists(legacy):
        with open(legacy) as f:
            return {"id": rid, "legacy": True, "markdown": f.read()}
    raise HTTPException(404)


@app.delete("/api/reports/{rid}")
def delete_report(rid: str):
    if not ID_RE.match(rid):
        raise HTTPException(404)
    paths = [p for p in (f"{REPORTS_DIR}/{rid}.json", f"{REPORTS_DIR}/{rid}.md", f"output/speech_report_{rid}.md")
             if os.path.exists(p)]
    if not paths:
        raise HTTPException(404)
    for p in paths:
        os.remove(p)
    save_memory()  # the coach's memory is rebuilt from the remaining reports
    return {"deleted": rid}


@app.get("/api/progress")
def progress():
    from coach import load_reports
    sessions = [{
        "id": r["id"], "created_at": r["created_at"], "overall_score": r["overall_score"], "verdict": r["verdict"],
        "metrics": r["metrics"], "progress_summary": r.get("progress_summary", ""),
        "scores": report_scores(r),
    } for r in load_reports()]
    return {"memory": save_memory(), "sessions": sessions}


@app.get("/api/reports/{rid}/markdown", response_class=PlainTextResponse)
def get_markdown(rid: str):
    if not ID_RE.match(rid):
        raise HTTPException(404)
    for path in (f"{REPORTS_DIR}/{rid}.md", f"output/speech_report_{rid}.md"):
        if os.path.exists(path):
            with open(path) as f:
                return PlainTextResponse(f.read(), headers={
                    "Content-Disposition": f'attachment; filename="speech_report_{rid}.md"'})
    raise HTTPException(404)


@app.get("/")
def index():
    return FileResponse(os.path.join(WEB_DIR, "index.html"))


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("Speech coach running at http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
