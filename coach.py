"""Speech-coach core shared by the terminal agent (live_agent.py) and the web app (server.py).

- TurnDetector: voice-activity detection that splits a 16 kHz mic stream into user turns.
- coach_reply(): streams the coach's next spoken reply (or signals a report request), and
  parses the tag lines the coach writes first: [notes], [baseline], [drill], [accent].
- generate_report(): re-listens to the whole session, compares it with earlier sessions and
  returns a structured report, saved as JSON (web dashboard) and Markdown under output/reports/.
"""
import glob
import io
import json
import os
import wave
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import AsyncIterator

import numpy as np
import webrtcvad
from google.genai import types
from pydantic import BaseModel

from config import GEMINI_MODEL

MIC_RATE = 16000
TTS_RATE = 48000             # Gradium "pcm" output: 48 kHz, 16-bit signed, mono
BLOCK = 480                  # 30 ms at 16 kHz; webrtcvad accepts 10/20/30 ms frames
BLOCK_S = BLOCK / MIC_RATE
PREROLL_BLOCKS = 10          # keep ~0.3s before speech starts so the first word isn't clipped
START_WINDOW, START_MIN = 10, 5   # speech starts when 5 of the last 10 frames (0.3s) are speech; low enough for one-word drill answers like "think"
MIN_PAUSE_S = 0.25           # silent gaps inside a turn at least this long are reported as pauses
MIN_SPEECH_S = 0.5
MAX_HISTORY = 21             # messages kept for live replies; odd so it always starts on a user turn
REPORTS_DIR = "output/reports"

SPEECH_COMPONENTS = ["Phonetics", "Phonology", "Articulation", "Prosody", "Fluency", "Speech rate",
                     "Voice quality", "Intonation", "Resonance"]
CONVERSATION_COMPONENTS = ["Pragmatics", "Turn-taking", "Discourse", "Active listening",
                           "Conversational repair", "Pauses & timing", "Non-verbal communication",
                           "Paralinguistics", "Semantic processing", "Conversational coherence"]
FOCUS_AREAS = ["Stuttering", "Lisp", "Charisma", "Accent", "Fast speech", "Listening",
               "Over-explanation", "Precise speech"]
DRILL_STATUSES = ["teach", "retry", "correct", "mastered", "skipped"]
EXERCISE_STATUSES = ["new", "retry", "done"]

# Perceptual "communication profile": listener impressions, kept separate from speech mechanics.
PARAMETER_GROUPS = {
    "Clarity & intelligibility": {
        "Intelligibility": "share of words a listener understands first time",
        "Enunciation": "how distinctly syllables and words are pronounced",
        "Consonant precision": "clarity of consonants, especially word endings",
        "Vowel clarity": "distinction between vowel sounds",
        "Word boundary clarity": "whether individual words are distinguishable",
        "Syllable timing": "consistency of syllable duration and rhythm",
        "Reduction patterns": "natural use of connected speech, contractions and reduced sounds",
    },
    "Vocal confidence & authority": {
        "Vocal projection": "sufficient volume without straining",
        "Pitch stability": "controlled pitch without unintended wobble",
        "Vocal steadiness": "no trembling or uncontrolled variation",
        "Assertiveness": "direct, decisive language without aggression",
        "Hesitation frequency": "hesitation markers and unnecessary pauses",
        "Filler-word frequency": "um, uh, like, you know",
        "Statement finality": "statements end decisively instead of sounding uncertain",
        "Pace control": "intentionally slowing down or speeding up",
    },
    "Charisma & vocal presence": {
        "Vocal expressiveness": "variation in pitch, volume and rhythm",
        "Emotional engagement": "delivery conveys interest and involvement",
        "Vocal warmth": "perceived friendliness and approachability",
        "Emphasis placement": "highlighting important words and ideas",
        "Dynamic range": "varying vocal intensity appropriately",
        "Storytelling ability": "narrative structure, suspense and emphasis",
        "Audience engagement": "direct address, relatable examples, inviting language",
        "Strategic pauses": "intentional silence for emphasis or processing",
    },
    "Positivity & emotional tone": {
        "Vocal enthusiasm": "perceived energy and excitement",
        "Positive language ratio": "constructive versus negative wording",
        "Emotional warmth": "friendly, reassuring tone",
        "Optimistic framing": "framing challenges constructively",
        "Emotional regulation": "stable, appropriate expressed emotion",
        "Empathetic responsiveness": "acknowledging the other person's feelings",
    },
    "Conversational intelligence": {
        "Turn-taking": "entering and leaving the conversation at the right moments",
        "Response relevance": "how directly an answer addresses the other speaker",
        "Active listening": "reflecting or building on what the other person said",
        "Question quality": "asking relevant, clear, engaging questions",
        "Conversational coherence": "logical connections between ideas",
        "Topic transitions": "moving smoothly between subjects",
        "Interruptions": "frequency and appropriateness of interruptions",
        "Conversational reciprocity": "balance of speaking and listening",
        "Repair strategies": "recovering smoothly from misunderstandings",
    },
    "Communication style": {
        "Authenticity": "natural rather than over-rehearsed delivery",
        "Humor": "appropriate humour and playfulness",
        "Social adaptability": "adjusting tone and language to context",
        "Verbal creativity": "interesting descriptions, analogies and examples",
        "Humility and openness": "acknowledging uncertainty and other viewpoints",
        "Persuasiveness": "convincing, evidence-based arguments",
    },
}


def _parameter_list() -> str:
    return "\n".join(f"- {group}: " + "; ".join(f"{p} ({d})" for p, d in params.items())
                     for group, params in PARAMETER_GROUPS.items())

OPENER = (
    "Hi, I'm your speech and accent coach. To start, tell me a little about yourself, and which parts "
    "of your speaking you'd like to improve, for example your accent, speaking too fast, stuttering, "
    "or a lisp. Whenever you want your full assessment, just say: give me my report."
)

COACH_PROMPT = f"""You are an expert speech-language pathologist and accent coach running a live, \
spoken session in an app that helps people improve their speech and make their accent more \
neutral. You hear the client's raw audio, so judge HOW they speak, not only what they say. You \
are not a general chatbot: every turn assesses, corrects or practises speech.

Each client turn includes app measurements in brackets (speaking span, pauses, response latency). \
They are more precise than your hearing; use them (speech rate = words / speaking span).

WHAT TO LISTEN FOR
Core components, judged on every turn: phonetics (accuracy of individual sounds), phonology \
(sound patterns, e.g. final-consonant deletion, th-stopping), articulation (clarity of consonants \
and vowels: substitutions, omissions, distortions), prosody (stress and rhythm), fluency, speech \
rate, voice quality (breathy, hoarse, strained, vocal fry), intonation (pitch movement, uptalk, \
flat endings), resonance (too nasal or not nasal enough).
Focus areas; any the client mentions are top priority:
- Stuttering: repetitions ("b-b-but"), prolongations ("sssso"), blocks, visible tension. Teach easy \
onset, light contact, slow stretched speech and pausing. Never finish their words or rush them.
- Lisp: /s/ and /z/ made with the tongue between the teeth (sounds like "th") or with air escaping \
at the sides (slushy). Teach: tongue tip just behind the upper front teeth, teeth lightly together, \
a thin stream of air down the middle.
- Charisma: monotone, low energy, hedging, uptalk on statements. Coach vocal variety, warmth, \
confident falling endings and pausing for emphasis.
- Accent: non-neutral vowels and consonants (e.g. v/w, th as t or s, r quality, short i vs long ee, \
dropped final consonants), misplaced word stress, syllable-timed rhythm, intonation carried over \
from another language. Target: a neutral, widely understood General American style accent unless \
the client asks for another.
- Fast speech: above about 160 words per minute or words running together. Coach short phrases and \
pausing at commas.
- Listening: answers that miss the question or ignore details you gave. Test with questions that \
need careful listening, or ask them to repeat back what you said.
- Over-explanation: long, circular, repetitive answers. Ask for the answer in two sentences, point first.
- Precise speech: vague words, fillers (um, uh, like, you know), hedges, swallowed word endings. \
Coach crisp word choice and finishing every final consonant.
- Speech exercises: use them often: minimal pairs, tongue twisters, reading a sentence aloud, \
repeating your model sentence.

Secondary parameters; listen for these too and give feedback on them when they matter most:
{_parameter_list()}
Use the app measurements for the objective side: pitch range under about 4 semitones sounds \
monotone, 4-10 is natural and expressive; loudness variation under about 2 dB sounds flat; a low \
phonation ratio means a lot of silence inside the turn. Treat confidence, charisma, warmth, \
persuasiveness and enthusiasm as listener impressions, backed by concrete moments from the audio. \
Natural pauses, stuttering and accent differences must NOT lower confidence or charisma judgements.

SESSION FLOW
1. The client's FIRST turn is the baseline. In your spoken reply, point out the one or two clearest \
mistakes you heard, quoting the exact words, and respond to the areas they said they want to work \
on. If you heard ANY accent features, describe the most noticeable one briefly (e.g. "your v in \
'very' sounds like a w") and ask: "Would you like to work on making your accent more neutral?" If \
you heard no accent features, ask which area they want to start with.
2. Accent choice: if they say yes, include accent corrections from then on. If they say no, never \
correct their accent again and focus on the other areas.
3. CORRECTION LOOP. When you hear a mistake worth fixing, pick ONE word or short phrase and teach it:
   a. Say what was wrong in a few words.
   b. Demonstrate it slowly, syllable by syllable, separating syllables with " ... " so the voice \
pauses, and name the stressed syllable, e.g. "thought ... ful, stress on thought".
   c. Give one physical instruction (tongue, lips, teeth, air or voice), e.g. "rest the tip of your \
tongue lightly between your teeth and blow gently".
   d. Ask them to say it slowly, just like you did.
   Then judge their next attempt:
   - Not right yet: say exactly what is still off, demonstrate again even more slowly, ask them to \
try again. After three unsuccessful attempts, praise the effort, say you'll add it to their \
practice plan, and move on.
   - Right: praise it specifically, then ask them to say it ONE more time, at a natural pace or \
inside a short sentence you give them, so it sticks.
   - Right again on that practice round: it is mastered. Congratulate them and move on.
   Work on one target at a time; don't start a new correction while a drill is in progress unless \
they ask.
   When a word is mastered, offer one or two of its SIMILAR words (same sound or stress pattern) as \
a quick follow-up drill, then move on.
4. COMPONENT ROTATION. Cover as many components as possible in a session, weakest first (use the \
client memory below and what you hear). Spend at most about three turns on one component or drill, \
then switch to a different component and announce it naturally, e.g. "Nice work. Let's switch gears \
and practise your intonation." Alternate exercises with short open questions so you also hear \
spontaneous speech.
5. EXERCISE MENU, pick the type that fits the component and vary it:
   - Phonetics, articulation, accent, lisp: word drills, minimal pairs (ship / sheep, vest / west), \
tongue twisters.
   - Phonology: minimal pairs for the error pattern, final-consonant sets (cat, cap, cab).
   - Prosody: stress shift (REcord the noun vs reCORD the verb), emphasis shift ("I didn't say he \
stole it", stressing a different word each time).
   - Intonation and pitch: one word as a question then a statement, a pitch glide on "ah" from low \
to high, "really" said surprised, bored and excited, confident falling endings.
   - Fluency and stuttering: easy onset on vowel-initial words, slow stretched phrases, pausing.
   - Speech rate and fast speech: read a sentence in short chunks with pauses, count one to ten at \
a steady pace.
   - Voice quality: count to ten on one breath, hum then speak on the same relaxed voice.
   - Resonance: hum "mmm" into "my mom made muffins", contrast nasal and oral words.
   - Charisma: deliver a line with warmth and energy, a ten-second story with emphasis.
   - Listening: paraphrase what you said, follow a two-step instruction.
   - Over-explanation: answer a question in exactly two sentences.
   - Precise speech: say a sentence with no fillers, pausing instead; land every final consonant.
   - Projection and statement finality: say a sentence to someone at the back of a room, ending \
with a firm downward pitch.
   - Expressiveness, emphasis and strategic pauses: read a line twice, the second time stressing \
the key word and pausing before it; a 20-second story with suspense.
   - Warmth, enthusiasm and empathy: respond to "I had a rough day" kindly; introduce something you \
love with energy.
   - Conversational intelligence: ask the coach a good follow-up question; change topic smoothly; \
summarise the coach's point before answering.
   - Persuasiveness and style: a 30-second pitch with one piece of evidence and a vivid example.

STYLE
A warm, encouraging coach. Plain spoken English: no markdown, lists, emojis, IPA or capital-letter \
spellings in what you say aloud. Keep each spoken reply to 2-4 short sentences (the first-turn \
baseline may use up to 5). The client should do most of the talking. Never diagnose medical \
conditions; if something sounds clinically significant (e.g. severe stuttering), suggest also \
seeing a speech-language pathologist in person.

OUTPUT FORMAT, strict. First the tag lines, each on its own line, then the spoken reply:
[notes] terse clinical notes on the client's last turn, e.g. "~175 wpm; th->t in 'think'; 2 fillers; \
uptalk on statements; pitch range 3 st (monotone); latency 0.4s". Always include this line.
[baseline] ONLY in reply to the client's first turn: one-line JSON scoring the nine core components \
1-5 with a short note each, exactly these keys: {json.dumps({c: [3, "note"] for c in SPEECH_COMPONENTS})}
[drill] in every reply that teaches or checks a target word or phrase: one-line JSON \
{{"target": "thoughtful", "respelling": "THAWT-ful", "ipa": "/ˈθɔːt.fəl/", "tip": "one-line mouth \
instruction", "area": "accent", "status": "teach", "similar": ["thoughtless", "thorough", \
"birthday"]}}. area is one of the focus areas or core components. status: teach = first \
demonstration; retry = their attempt was not right yet; correct = right once, asking for one more \
practice; mastered = right on the practice round; skipped = moving on after three tries. similar = \
2-4 words that practise the same sound or stress pattern.
[exercise] in every reply that gives or checks any other exercise (pitch, intonation, pace, \
fluency, voice, resonance, charisma, listening, ...): one-line JSON {{"type": "question vs \
statement", "component": "Intonation", "instruction": "one-line instruction", "script": "the exact \
words the client should say, or empty", "status": "new"}}. component is a core component or focus \
area; status: new = just given; retry = their attempt needs another go; done = completed, moving on.
A reply may carry both a [drill] and an [exercise] line, e.g. when a drill is mastered and you give \
a new exercise in the same reply.
[accent] yes or no, ONLY in the reply right after the client answers the accent question.
Then the spoken reply on a new line. Tag lines are shown on screen and stored for the report; they \
are never spoken.

EXCEPTION: if the client asks for their report, analysis, assessment, results, overall feedback, \
or to end the session, in any wording ("analyze it now", "give me a report", "how did I do \
overall", "let's wrap up"), output exactly "[report]" and nothing else."""

REPORT_PROMPT = f"""You are a speech-language pathologist and accent coach writing the \
end-of-session assessment. The conversation holds the client's raw audio turns (with app timing \
measurements) and your own turns (starting with tag lines such as [notes], [baseline], [drill]). \
Listen to every client audio turn again and assess the client only. Use the measurements for \
speech rate, pauses and timing. The final message lists this session's pronunciation drills, the \
client's accent choice, and their PREVIOUS SESSIONS.

Fill the JSON schema:
- session_summary: 2-3 sentences: what the session covered and the overall impression.
- speech_skills: exactly these components, in order: {", ".join(SPEECH_COMPONENTS)}.
- conversation_skills: exactly these components, in order: {", ".join(CONVERSATION_COMPONENTS)}.
- focus_areas: exactly these areas, in order: {", ".join(FOCUS_AREAS)}. Score null when there was \
no evidence either way. For Accent, describe the features heard; if the client declined accent \
work, still assess it but say they chose not to work on it.
  For every component and area: score 1-5 (5 = excellent, 3 = adequate with clear room to \
improve, 1 = significant difficulty; halves allowed) or null if it could not be judged; observed = \
specific evidence quoting the client's words and naming the turn (if null, say which task would \
assess it); improve = one concrete recommendation. One or two sentences each.
- communication_profile: exactly these six groups and parameters, in order:
{_parameter_list()}
  For each group: impression = a 1-2 sentence listener impression of the client for that group, \
with a concrete moment from the recording; tip = one concrete way to improve. For each parameter: \
score 1-5 or null if it could not be judged, and evidence = one short sentence describing how it \
comes across to a listener, with an example. Use the app's pitch and loudness measurements for \
expressiveness, dynamic range, pitch stability and projection. These are perceptual listener \
impressions: keep them separate from the speech-mechanics scores, and never let natural pauses, \
stuttering or an accent lower confidence or charisma scores.
- fluency_profile: counts across all client turns of speech blocks, sound prolongations, and \
repetitions by type (sound "b-b-but", syllable "ba-ba-baby", whole word "I I I", phrase "I want I want"); \
recovery_smoothness 1-5 (how smoothly they continue after a disfluency) or null if none occurred; \
tension = one sentence on audible speaking-related tension, or "none observed"; notes = one sentence.
- accent_summary: 2-3 sentences: accent features heard, how close to neutral the accent is, and how \
the accent drills went.
- strengths: exactly 3 short strengths.
- priorities: the top 3 things to work on, each with a title, the problem, the evidence, and one \
concrete daily exercise (target words or sentences, minutes per day). Include words that were not \
mastered in the drills.
- overall_score: 1-5 for speech mechanics and clarity only (not a personality score); verdict: one sentence.
- exercises: 6 varied practice exercises for home, aimed at the weakest components and focus \
areas and at words not yet mastered. Mix types (word drill, minimal pairs, tongue twister, stress \
shift, question vs statement, pitch glide, chunked reading, breath support, humming, two-sentence \
answer, shadowing...). Each: title, component (a core component or focus area), type, instructions \
(how to do it, 1-2 sentences), script (the exact words to say aloud), minutes per day.
- progress_summary: 2-4 sentences on how the client is progressing since their first session, \
using PREVIOUS SESSIONS: which components improved, which stalled or slipped, and what to aim for \
next. If there are no previous sessions, say this session is their baseline and what to aim for next time.
- turns: one entry per client audio turn, in order (turn 1 = first client turn): a verbatim \
transcript of what the client said (keep fillers like um/uh and stutters), the word count, the \
syllable count, the number of filler words, the number of repetitions (sound, syllable, word or \
phrase), and a short note on how that turn sounded.
- spoken_summary: a warm 2-3 sentence summary in plain speech, read aloud to the client.

Rules: be specific and evidence-based. Address the client directly as "you". Non-verbal \
communication: you only have audio, so assess vocal non-verbal cues (laughter, sighs, breathing, \
hesitation sounds) and state that visual cues (eye contact, gestures, posture) were not \
observable. Never invent observations. The client's last turn may be their request for this \
report; don't count ending the session against them."""


# ---------------------------------------------------------------- turn detection

def rms(block: np.ndarray) -> float:
    return float(np.sqrt(np.mean(block.astype(np.float32) ** 2)))


def noise_gate(blocks: list[np.ndarray]) -> float:
    """From ~1s of room noise, the loudness a frame must exceed to count as speech."""
    noise = np.median([rms(b) for b in blocks]) if blocks else 50.0
    return max(float(noise) * 2.0, 100.0)


def acoustic_features(audio: np.ndarray) -> dict:
    """Objective voice measurements for one turn: pitch (F0) and loudness, over voiced frames.

    F0 comes from a normalised autocorrelation pitch tracker (75-400 Hz, 40 ms frames, 10 ms hop).
    Pitch variability is reported in semitones so it is comparable across voices.
    """
    x = audio.astype(np.float32)
    frame, hop = 640, 160
    if len(x) < frame * 2:
        return {}
    starts = range(0, len(x) - frame, hop)
    frames = np.stack([x[i:i + frame] for i in starts])
    rms_f = np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-9
    active = rms_f > max(np.percentile(rms_f, 95) * 0.15, 100.0)
    if active.sum() < 10:
        return {}
    db = 20 * np.log10(rms_f[active] / 32768.0)

    window = np.hanning(frame).astype(np.float32)
    lo, hi = MIC_RATE // 400, MIC_RATE // 75
    f0 = []
    for fr in frames[active]:
        fr = (fr - fr.mean()) * window
        spec = np.fft.rfft(fr, 2 * frame)
        ac = np.fft.irfft(spec * np.conj(spec))[:frame]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.5:
            f0.append(MIC_RATE / lag)
    out = {"loudness_db": round(float(np.mean(db)), 1), "loudness_sd_db": round(float(np.std(db)), 1)}
    if len(f0) >= 10:
        f0 = np.array(f0)
        st = 12 * np.log2(f0 / np.median(f0))
        st = st[np.abs(st) < 12]                       # drop octave errors
        out.update(f0_hz=round(float(np.median(f0))), pitch_sd_st=round(float(np.std(st)), 1),
                   pitch_range_st=round(float(np.percentile(st, 90) - np.percentile(st, 10)), 1))
    return out


def to_wav(audio: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(MIC_RATE)
        w.writeframes(audio.astype(np.int16).tobytes())
    return buf.getvalue()


@dataclass
class Turn:
    wav: bytes
    stats: dict

    @property
    def stats_text(self) -> str:
        s = self.stats
        pauses = ", ".join(f"{p:.1f}s" for p in s["pauses"]) or "none"
        return (f"[measured by app] speaking span {s['span_s']:.1f}s, voiced {s['voiced_s']:.1f}s; "
                f"started speaking {s['latency_s']:.1f}s after the coach finished; "
                f"{len(s['pauses'])} internal pauses >= {MIN_PAUSE_S}s ({pauses}); "
                f"phonation ratio {s['voiced_s'] / max(s['span_s'], 0.01):.0%}"
                + (f"; pitch median {s['f0_hz']} Hz, range {s['pitch_range_st']} semitones (SD {s['pitch_sd_st']})"
                   if "f0_hz" in s else "")
                + (f"; loudness mean {s['loudness_db']} dBFS, variation {s['loudness_sd_db']} dB"
                   if "loudness_db" in s else ""))


class TurnDetector:
    """Feed 30 ms int16 frames; returns a Turn when the user has finished speaking.

    A frame counts as speech only if the VAD hears a voice AND it is louder than the noise
    gate. The turn ends after `silence_s` without speech, or when finish() is called.
    """

    def __init__(self, vad: webrtcvad.Vad, gate: float, silence_s: float):
        self.vad, self.gate, self.end_blocks = vad, gate, int(silence_s / BLOCK_S)
        self.reset()

    def reset(self) -> None:
        self.preroll: deque = deque(maxlen=PREROLL_BLOCKS)
        self.recent: deque = deque(maxlen=START_WINDOW)
        self.voiced: list = []
        self.quiet = self.frames = 0
        self.latency_s = 0.0

    @property
    def speaking(self) -> bool:
        return bool(self.voiced)

    def feed(self, block: np.ndarray) -> Turn | None:
        self.frames += 1
        is_speech = rms(block) > self.gate and self.vad.is_speech(block.tobytes(), MIC_RATE)
        self.recent.append(is_speech)
        if not self.voiced:
            self.preroll.append((block, is_speech))
            if sum(self.recent) >= START_MIN:
                self.voiced = list(self.preroll)
                self.latency_s = max(self.frames - START_WINDOW, 0) * BLOCK_S
            return None
        self.voiced.append((block, is_speech))
        # Isolated noise blips don't reset the silence timer; sustained speech does.
        self.quiet = 0 if sum(list(self.recent)[-5:]) >= 3 else self.quiet + 1
        return self.finish() if self.quiet >= self.end_blocks else None

    def finish(self) -> Turn | None:
        """End the turn now. Returns None (and keeps listening) if there was no real speech."""
        voiced = self.voiced[:max(len(self.voiced) - self.quiet + PREROLL_BLOCKS, 1)]
        latency = self.latency_s
        self.reset()
        flags = [f for _, f in voiced]
        if not voiced or not any(flags) or len(voiced) * BLOCK_S < MIN_SPEECH_S:
            return None
        speech = [i for i, f in enumerate(flags) if f]
        pauses, run = [], 0
        for f in flags[speech[0]:speech[-1] + 1]:
            if f:
                if run * BLOCK_S >= MIN_PAUSE_S:
                    pauses.append(round(run * BLOCK_S, 2))
                run = 0
            else:
                run += 1
        audio = np.concatenate([b for b, _ in voiced])
        stats = {"span_s": round((speech[-1] - speech[0] + 1) * BLOCK_S, 2),
                 "voiced_s": round(len(speech) * BLOCK_S, 2),
                 "latency_s": round(latency, 2), "pauses": pauses, **acoustic_features(audio)}
        return Turn(to_wav(audio), stats)


def user_content(turn: Turn) -> types.Content:
    return types.Content(role="user", parts=[
        types.Part.from_bytes(data=turn.wav, mime_type="audio/wav"), types.Part(text=turn.stats_text),
    ])


# ---------------------------------------------------------------- live coaching

@dataclass
class CoachReply:
    report: bool = False
    notes: str = ""
    baseline: dict | None = None    # first turn only: {component: {"score", "note"}}
    drill: dict | None = None       # pronunciation drill being taught / checked
    accent: str | None = None       # "yes" / "no" after the client answers the accent question
    exercise: dict | None = None    # non-word exercise (pitch, pace, fluency, ...) being given / checked
    tags: list[str] = field(default_factory=list)
    text: AsyncIterator[str] | None = None     # spoken reply, streamed
    spoken: list[str] = field(default_factory=list)

    @property
    def spoken_text(self) -> str:
        return "".join(self.spoken).strip()

    def model_content(self) -> types.Content:
        return types.Content(role="model", parts=[types.Part(text="\n".join(self.tags + [self.spoken_text]))])

    def parse_tag(self, line: str) -> None:
        tag, _, value = line.partition("]")
        tag, value = tag.strip("[ ").lower(), value.strip()
        self.tags.append(line)
        try:
            if tag == "notes":
                self.notes = value
            elif tag == "baseline":
                raw = json.loads(value)
                self.baseline = {c: {"score": float(raw[c][0]), "note": str(raw[c][1])}
                                 for c in SPEECH_COMPONENTS if c in raw}
            elif tag == "drill":
                drill = json.loads(value)
                if drill.get("target") and drill.get("status") in DRILL_STATUSES:
                    self.drill = {k: str(drill.get(k, "")) for k in
                                  ("target", "respelling", "ipa", "tip", "area", "status")}
                    self.drill["similar"] = [str(w) for w in drill.get("similar", [])][:4]
            elif tag == "exercise":
                ex = json.loads(value)
                if ex.get("type") and ex.get("status") in EXERCISE_STATUSES:
                    self.exercise = {k: str(ex.get(k, "")) for k in
                                     ("type", "component", "instruction", "script", "status")}
            elif tag == "accent":
                self.accent = "yes" if value.lower().startswith("y") else "no"
        except (ValueError, TypeError, KeyError, IndexError):
            pass  # a malformed tag shouldn't break the conversation


def session_context(opener: str, memory_text: str = "", focus: str | None = None) -> str:
    """Per-session additions to the coach prompt: client memory, chosen focus, the opener used."""
    return (memory_text
            + (f"\n\nThe client asked to focus on: {focus}. Start with that, then rotate as usual." if focus else "")
            + f'\n\nYou opened the session by saying: "{opener}"')


async def coach_reply(gemini, history: list, context: str = "") -> CoachReply:
    """Start the coach's next turn. Consume `.text` to stream the spoken reply."""
    stream = await gemini.aio.models.generate_content_stream(
        model=GEMINI_MODEL, contents=history[-MAX_HISTORY:],
        config={"system_instruction": COACH_PROMPT + (context or session_context(OPENER))},
    )
    chunks = aiter(stream)
    reply = CoachReply()

    # Read the tag lines ([notes], [baseline], [drill], [accent] or [report]) before speaking.
    pending, done = "", False
    while not done:
        # stop reading as soon as the text is clearly spoken (not a tag), so speech starts quickly
        while "\n" not in pending and not done and (not pending.strip() or pending.lstrip().startswith("[")):
            try:
                pending += (await anext(chunks)).text or ""
            except StopAsyncIteration:
                done = True
        line, newline, rest = pending.partition("\n")
        if not line.lstrip().startswith("["):
            break
        if line.strip().lower().startswith("[report]"):
            return CoachReply(report=True)
        if not newline and not done:
            continue
        reply.parse_tag(line.strip())
        pending = rest
        if not newline:
            break
    opening = pending

    async def speech():
        if opening.strip():
            reply.spoken.append(opening)
            yield opening
        async for chunk in chunks:
            if chunk.text:
                reply.spoken.append(chunk.text)
                yield chunk.text
        if not reply.spoken_text:
            reply.spoken.append("Sorry, could you say that again?")
            yield reply.spoken[-1]

    reply.text = speech()
    return reply


def summarize_exercises(events: list[dict]) -> list[dict]:
    """Collapse the per-turn [exercise] events into one row per exercise."""
    out: dict[tuple, dict] = {}
    for e in events:
        key = (e["type"].lower(), e.get("script", "").lower())
        x = out.setdefault(key, {**e, "attempts": 0, "result": "started"})
        x.update({k: v for k, v in e.items() if v and k != "status"})
        if e["status"] != "new":
            x["attempts"] += 1
        if e["status"] == "done":
            x["result"] = "done"
    rows = list(out.values())
    for x in rows[:-1]:  # the coach moved on to something else, so the client did attempt these
        if x["result"] == "started":
            x["result"] = "practised"
    return [{k: v for k, v in x.items() if k != "status"} for x in rows]


def summarize_drills(events: list[dict]) -> list[dict]:
    """Collapse the per-turn [drill] events into one row per target word."""
    drills: dict[str, dict] = {}
    for e in events:
        key = e["target"].strip().lower()
        d = drills.setdefault(key, {**e, "attempts": 0, "result": "practising"})
        d.update({k: v for k, v in e.items() if v and k != "status"})
        d["similar"] = list(dict.fromkeys(d.get("similar", []) + e.get("similar", [])))[:6]
        if e["status"] != "teach":
            d["attempts"] += 1
        if e["status"] == "mastered":
            d["result"] = "mastered"
        elif e["status"] == "skipped" and d["result"] != "mastered":
            d["result"] = "needs practice"
    return [{k: v for k, v in d.items() if k != "status"} for d in drills.values()]


# ---------------------------------------------------------------- report

class Component(BaseModel):
    component: str
    score: float | None
    observed: str
    improve: str


class Priority(BaseModel):
    title: str
    problem: str
    evidence: str
    exercise: str


class PracticeExercise(BaseModel):
    title: str
    component: str
    type: str
    instructions: str
    script: str
    minutes: int


class TurnAnalysis(BaseModel):
    transcript: str
    words: int
    syllables: int
    fillers: int
    repetitions: int
    note: str


class ParameterScore(BaseModel):
    parameter: str
    score: float | None
    evidence: str


class ParameterGroup(BaseModel):
    group: str
    impression: str
    tip: str
    parameters: list[ParameterScore]


class FluencyProfile(BaseModel):
    blocks: int
    prolongations: int
    sound_repetitions: int
    syllable_repetitions: int
    word_repetitions: int
    phrase_repetitions: int
    recovery_smoothness: float | None
    tension: str
    notes: str


class ReportModel(BaseModel):
    session_summary: str
    speech_skills: list[Component]
    conversation_skills: list[Component]
    focus_areas: list[Component]
    communication_profile: list[ParameterGroup]
    fluency_profile: FluencyProfile
    accent_summary: str
    strengths: list[str]
    priorities: list[Priority]
    exercises: list[PracticeExercise]
    overall_score: float
    verdict: str
    progress_summary: str
    turns: list[TurnAnalysis]
    spoken_summary: str


def _words(text: str) -> list[str]:
    return [w for w in "".join(c.lower() if c.isalnum() or c in "' " else " " for c in text).split() if w]


def target_wer(reference: str, transcript: str) -> float | None:
    """Word error rate of the client's attempt at a target word or script.

    Extra speech before or after the attempt is free (the client may add "okay, so ..."), so this
    is the error rate inside the best-matching stretch of the transcript.
    """
    ref, hyp = _words(reference), _words(transcript)
    if not ref or not hyp or not set(ref) & set(hyp):
        return None                                   # no attempt at the target (e.g. they asked for the report)
    prev = [0] * (len(hyp) + 1)                       # free leading insertions
    for i, r in enumerate(ref, 1):
        cur = [i] + [0] * len(hyp)
        for j, h in enumerate(hyp, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h))
        prev = cur
    return round(min(prev) / len(ref), 2)            # free trailing insertions


def _per(n, d, scale=1.0):
    return round(n / d * scale, 1) if d else None


def _mean(values) -> float | None:
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 2) if values else None


def load_reports() -> list[dict]:
    """All structured reports, oldest first."""
    reports = []
    for path in glob.glob(f"{REPORTS_DIR}/*.json"):
        with open(path) as f:
            reports.append(json.load(f))
    return sorted(reports, key=lambda r: r["created_at"])


def _previous_sessions_text(previous: list[dict]) -> str:
    if not previous:
        return "PREVIOUS SESSIONS: none, this is the client's first session."
    lines = ["PREVIOUS SESSIONS (oldest first):"]
    for r in previous[-8:]:
        scores = ", ".join(f"{c['component']} {c['score']:g}" for c in
                           r["speech_skills"] + r.get("focus_areas", []) if c["score"] is not None)
        mastered = [d["target"] for d in r.get("drills", []) if d.get("result") == "mastered"]
        lines.append(f"- {r['created_at'][:10]}: overall {r['overall_score']:g}; speech avg "
                     f"{r['metrics']['speech_avg']}; conversation avg {r['metrics']['conversation_avg']}; "
                     f"{scores}; priorities: {', '.join(p['title'] for p in r['priorities'])}"
                     + (f"; mastered: {', '.join(mastered)}" if mastered else ""))
    return "\n".join(lines)


async def generate_report(gemini, history: list, turn_stats: list[dict], coach_lines: list[str],
                          extras: dict | None = None) -> dict:
    """Assess the whole session; save output/reports/<id>.json and .md; return the record.

    extras: {"baseline": {...}, "drill_events": [...], "exercise_events": [...], "timeline": [...],
             "accent_opt_in": "yes"|"no"|None}
    """
    extras = extras or {}
    drills = summarize_drills(extras.get("drill_events", []))
    accent = {"yes": "chose to work on their accent", "no": "declined accent work"}.get(
        extras.get("accent_opt_in"), "was not asked about accent work, or did not answer")
    exercises_done = summarize_exercises(extras.get("exercise_events", []))
    drill_text = "; ".join(f"{d['target']} ({d['area']}): {d['result']} after {d['attempts']} attempts"
                           for d in drills) or "none"
    request = types.Content(role="user", parts=[types.Part(text=(
        "Write the end-of-session report now.\n"
        f"Pronunciation drills this session: {drill_text}\n"
        f"Other exercises this session: {'; '.join(f'{e["type"]} ({e["component"]}): {e["result"]}' for e in exercises_done) or 'none'}\n"
        f"Accent: the client {accent}.\n" + _previous_sessions_text(load_reports())))])
    resp = await gemini.aio.models.generate_content(
        model=GEMINI_MODEL, contents=history + [request],
        config={"system_instruction": REPORT_PROMPT, "response_mime_type": "application/json",
                "response_schema": ReportModel},
    )
    report = resp.parsed if isinstance(resp.parsed, ReportModel) else ReportModel.model_validate_json(resp.text)

    # What the client was asked to say before each turn (drill word or exercise script), for WER.
    targets: dict[int, str] = {}
    for t in extras.get("timeline", []):
        if t.get("script") and t.get("status") not in ("mastered", "done", "skipped"):
            targets[t["turn"] + 1] = t["script"]

    turns = []
    for i, stats in enumerate(turn_stats):
        analysis = report.turns[i] if i < len(report.turns) else None
        words = analysis.words if analysis else None
        syllables = analysis.syllables if analysis else None
        span, voiced, pauses = stats["span_s"], stats["voiced_s"], stats["pauses"]
        transcript = analysis.transcript if analysis else ""
        reference = targets.get(i + 1)
        turns.append({
            "n": i + 1, **stats,
            "transcript": transcript,
            "words": words, "syllables": syllables, "fillers": analysis.fillers if analysis else None,
            "repetitions": analysis.repetitions if analysis else None,
            "note": analysis.note if analysis else "",
            "wpm": round(words / (span / 60)) if words and span > 0 else None,
            "articulation_rate": _per(syllables, voiced) if syllables else None,
            "pause_per_min": _per(len(pauses), span, 60),
            "mean_pause_ms": round(sum(pauses) / len(pauses) * 1000) if pauses else None,
            "phonation_ratio": round(voiced / span, 2) if span else None,
            "target": reference, "wer": target_wer(reference, transcript) if reference else None,
            "coach": coach_lines[i + 1] if i + 1 < len(coach_lines) else "",
        })
    all_pauses = [p for t in turns for p in t["pauses"]]
    total_words = sum(t["words"] or 0 for t in turns)
    profile = {g.group: _mean(p.score for p in g.parameters) for g in report.communication_profile}

    now = datetime.now()
    record = {
        "id": now.strftime("%Y%m%d_%H%M%S"),
        "created_at": now.isoformat(timespec="seconds"),
        **report.model_dump(exclude={"turns"}),
        "opener": coach_lines[0] if coach_lines else "",
        "baseline": extras.get("baseline"),
        "accent_opt_in": extras.get("accent_opt_in"),
        "drills": drills,
        "exercise_log": exercises_done,
        "timeline": extras.get("timeline", []),
        "components_practised": sorted({e["component"] for e in exercises_done} | {d["area"] for d in drills if d.get("area")}),
        "turns": turns,
        "metrics": {
            "turns": len(turns),
            "speaking_s": round(sum(t["voiced_s"] for t in turns), 1),
            "avg_wpm": _mean(t["wpm"] for t in turns),
            "avg_latency_s": _mean(t["latency_s"] for t in turns),
            "fillers": sum(t["fillers"] or 0 for t in turns),
            "pauses": sum(len(t["pauses"]) for t in turns),
            "speech_avg": _mean(c.score for c in report.speech_skills),
            "conversation_avg": _mean(c.score for c in report.conversation_skills),
            "focus_avg": _mean(c.score for c in report.focus_areas),
            "drills_total": len(drills),
            "drills_mastered": sum(d["result"] == "mastered" for d in drills),
            # objective measurements (section 8)
            "articulation_rate": _per(sum(t["syllables"] or 0 for t in turns), sum(t["voiced_s"] for t in turns if t["syllables"])),
            "pause_per_min": _per(len(all_pauses), sum(t["span_s"] for t in turns), 60),
            "mean_pause_ms": round(sum(all_pauses) / len(all_pauses) * 1000) if all_pauses else None,
            "phonation_ratio": round(sum(t["voiced_s"] for t in turns) / max(sum(t["span_s"] for t in turns), 0.01), 2),
            "pitch_range_st": _mean(t.get("pitch_range_st") for t in turns),
            "pitch_sd_st": _mean(t.get("pitch_sd_st") for t in turns),
            "f0_hz": _mean(t.get("f0_hz") for t in turns),
            "loudness_db": _mean(t.get("loudness_db") for t in turns),
            "loudness_sd_db": _mean(t.get("loudness_sd_db") for t in turns),
            "fillers_per_100w": _per(sum(t["fillers"] or 0 for t in turns), total_words, 100),
            "repetitions_per_100w": _per(sum(t["repetitions"] or 0 for t in turns), total_words, 100),
            "wer": _mean(t["wer"] for t in turns),
            "profile": profile,
            "profile_avg": _mean(profile.values()),
        },
    }
    os.makedirs(REPORTS_DIR, exist_ok=True)
    with open(f"{REPORTS_DIR}/{record['id']}.json", "w") as f:
        json.dump(record, f, indent=2)
    with open(f"{REPORTS_DIR}/{record['id']}.md", "w") as f:
        f.write(render_markdown(record))
    return record


def _score_text(score: float | None) -> str:
    return "N/A" if score is None else f"{score:g}/5"


def render_markdown(r: dict) -> str:
    def cell(text: str) -> str:
        return str(text).replace("|", "\\|").replace("\n", " ")

    def table(rows: list[dict]) -> str:
        lines = ["| Component | Score | What I observed | How to improve |", "|---|---|---|---|"]
        for c in rows:
            score = "N/A" if c["score"] is None else f"{c['score']:g}/5"
            lines.append(f"| {c['component']} | {score} | {cell(c['observed'])} | {cell(c['improve'])} |")
        return "\n".join(lines)

    m = r["metrics"]
    out = [
        "# Speech & Communication Report", "",
        f"*{r['created_at'].replace('T', ' ')}* · {m['turns']} turns · {m['speaking_s']}s speaking"
        + (f" · ~{m['avg_wpm']:.0f} wpm" if m["avg_wpm"] else ""), "",
        r["session_summary"], "",
        f"**Overall: {r['overall_score']:g}/5** — {r['verdict']}", "",
        "## 1. Speech skills", table(r["speech_skills"]), "",
        "### Focus areas", table(r.get("focus_areas", [])), "",
        f"**Accent:** {r.get('accent_summary', '')}", "",
    ]
    if r.get("drills"):
        out += ["### Pronunciation drills", "| Word / phrase | Say it as | Area | Attempts | Result |", "|---|---|---|---|---|"]
        out += [f"| {cell(d['target'])} | {cell(d.get('respelling', ''))} {cell(d.get('ipa', ''))} | "
                f"{cell(d.get('area', ''))} | {d['attempts']} | {d['result']} |" for d in r["drills"]]
        out.append("")
    m_ = r["metrics"]
    objective = [("Articulation rate", m_.get("articulation_rate"), "syllables/s"), ("Speaking rate", m_.get("avg_wpm"), "wpm"),
                 ("Pause frequency", m_.get("pause_per_min"), "per min"), ("Mean pause", m_.get("mean_pause_ms"), "ms"),
                 ("Phonation ratio", m_.get("phonation_ratio"), ""), ("Pitch range", m_.get("pitch_range_st"), "semitones"),
                 ("Pitch SD", m_.get("pitch_sd_st"), "semitones"), ("Loudness variation", m_.get("loudness_sd_db"), "dB"),
                 ("Filler frequency", m_.get("fillers_per_100w"), "per 100 words"),
                 ("Repetition frequency", m_.get("repetitions_per_100w"), "per 100 words"),
                 ("Response latency", m_.get("avg_latency_s"), "s"), ("Target-phrase WER", m_.get("wer"), "")]
    if any(v is not None for _, v, _ in objective):
        out += ["### Objective measurements", "| Metric | Value |", "|---|---|"]
        out += [f"| {n} | {v:g} {u} |" for n, v, u in objective if v is not None]
        out.append("")
    if r.get("fluency_profile"):
        f = r["fluency_profile"]
        out += ["### Fluency profile", f"Blocks {f['blocks']} · prolongations {f['prolongations']} · repetitions: "
                f"sound {f['sound_repetitions']}, syllable {f['syllable_repetitions']}, word {f['word_repetitions']}, "
                f"phrase {f['phrase_repetitions']} · recovery smoothness "
                f"{_score_text(f['recovery_smoothness'])}. "
                f"Tension: {f['tension']}. {f['notes']}", ""]
    out += ["## 2. Conversation skills", table(r["conversation_skills"]), "",
            "## 3. Communication profile (listener impressions)"]
    for g in r.get("communication_profile", []):
        avg = _mean(p["score"] for p in g["parameters"])
        out += [f"### {g['group']}" + (f" — {avg:g}/5" if avg is not None else ""), g["impression"], f"*Tip:* {g['tip']}", "",
                "| Parameter | Score | Impression |", "|---|---|---|"]
        out += [f"| {p['parameter']} | {_score_text(p['score'])} | {cell(p['evidence'])} |"
                for p in g["parameters"]]
        out.append("")
    out += ["## 4. Overall progress", r.get("progress_summary", ""), "",
            "## Key strengths", *[f"- {s}" for s in r["strengths"]], "",
            "## Top 3 priorities"]
    for i, p in enumerate(r["priorities"], 1):
        out += [f"{i}. **{p['title']}** — {p['problem']}", f"   - *Evidence:* {p['evidence']}",
                f"   - *Exercise:* {p['exercise']}"]
    if r.get("exercises"):
        out += ["", "## Practice exercises"]
        out += [f"- **{e['title']}** ({e['component']}, {e['type']}, {e['minutes']} min/day): {e['instructions']}"
                + (f" Say: *{e['script']}*" if e["script"] else "") for e in r["exercises"]]
    out += ["", "## Transcript"]
    for t in r["turns"]:
        out.append(f"- **Turn {t['n']}** ({t['span_s']}s, {len(t['pauses'])} pauses"
                   + (f", ~{t['wpm']} wpm" if t["wpm"] else "") + f"): {t['transcript']}")
    return "\n".join(out) + "\n"
