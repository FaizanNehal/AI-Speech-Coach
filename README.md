# Gemini + Gradium playground

Gemini (LLM) + Gradium (speech-to-text / text-to-speech).

## Setup
```bash
source .venv/bin/activate          # or: python3 -m venv .venv && pip install -r requirements.txt
# put your keys in .env (GEMINI_API_KEY, GRADIUM_API_KEY)
```

## Web app (speech coach)
```bash
python server.py            # open http://localhost:8000 in Chrome
```
- **What the coach does**: after your first answer it scores a baseline on the 9 core components (phonetics, phonology, articulation, prosody, fluency, speech rate, voice quality, intonation, resonance), points out mistakes, and asks whether you want to make your accent more neutral. It focuses on stuttering, lisp, charisma, accent, fast speech, listening, over-explaining and precise speech. When it hears a mistake it teaches the word slowly (syllables, stress, tongue/lip position), checks your attempt, and has you say it once more when you get it right.
- **Session tab**: press *Start session* and talk. The coach asks questions and gives exercises, hears your raw voice and answers out loud. Your turn ends after 3s without speech, or when you press *I'm done talking* (or Enter). Say "give me my report" or press *Get my report* to finish.
- **Reports tab**: three sections (1 Speech, 2 Conversation, 3 Overall progress across all sessions), with overall score, skill charts, turn-by-turn speech rate, response time, pauses and fillers, strengths, priorities with exercises, and the transcript. Reports are saved as JSON and Markdown in `output/reports/`.

## Scripts
| Script | What it does |
|---|---|
| `python check_keys.py` | One tiny call to each API to make sure both keys work |
| `python pipeline.py --text "..."` | Text → Gemini → Gradium TTS → `output/reply.wav` |
| `python pipeline.py --audio q.wav` | WAV → Gradium STT → Gemini → Gradium TTS |
| `python voice_chat.py` | **Talk with your voice**: mic → Gradium STT → Gemini → spoken reply, in a loop |
| `python live_agent.py` | **Speech-therapy coach** (hands-free): asks you questions/exercises, hears your raw voice, gives spoken feedback. Noise-robust speech detection; turn ends after 3s without speech or any keypress. Say "give me my report" for a detailed speech + conversation-skills report (tables) saved to `output/reports/` (shown in the web app too) |
| `python voice_agent.py` | Mic → Gemini hears the raw audio (no STT) → Gradium TTS. `--mode analyze` describes your tone/emotion/pace; `--audio q.wav` uses a file |
| `python stream_demo.py "..."` | Streams Gemini tokens into Gradium streaming TTS (low latency) |

`config.py` builds both clients. Import `gemini_client()` / `gradium_client()` from there in your own code.
Play output on macOS with `afplay output/reply.wav`.

## Voice chat
- Speak after `🎙 listening...`; when you pause (~1–2 s) it answers out loud. Ctrl+C to quit.
- `--list-devices`, then `--input N --output N` to pick a mic/speaker.
- `--vad 0.7` makes it wait longer before deciding you're done talking (lower = snappier).
- First run: macOS will ask to give your terminal/IDE microphone access (System Settings → Privacy & Security → Microphone).
