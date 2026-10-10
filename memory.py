"""Long-term client memory, derived from all saved reports (output/memory.json).

The memory is rebuilt from the reports whenever one is added or deleted, so it always matches
what the Reports tab shows. It gives the coach context at the start of a new session (weakest
components, words to review, accent preference, last session) and powers the Progress tab.

Internal parameters per component:
  ema       exponentially weighted score (recent sessions count more), 1-5
  trend     latest score minus first score
  priority  how much the component needs work: (5 - ema) plus a penalty if it is slipping
  status    weakness | developing | improving | strong
"""
import json
import os

from coach import CONVERSATION_COMPONENTS, FOCUS_AREAS, PARAMETER_GROUPS, SPEECH_COMPONENTS, load_reports

MEMORY_PATH = "output/memory.json"
EMA_ALPHA = 0.5


def _component_params(series: list[tuple[str, float]]) -> dict:
    ema = None
    for _, score in series:
        ema = score if ema is None else EMA_ALPHA * score + (1 - EMA_ALPHA) * ema
    first, last = series[0][1], series[-1][1]
    trend = round(last - first, 2) if len(series) > 1 else 0.0
    priority = round((5 - ema) + max(0.0, -trend) * 0.5, 2)
    if ema < 3:
        status = "weakness"
    elif trend >= 0.5:
        status = "improving"
    elif ema >= 4:
        status = "strong"
    else:
        status = "developing"
    return {"ema": round(ema, 2), "first": first, "last": last, "trend": trend, "sessions": len(series),
            "priority": priority, "status": status, "history": [{"date": d, "score": s} for d, s in series]}


def report_scores(r: dict) -> dict:
    """Every score in a report by name: components, focus areas, and communication-profile group averages."""
    scores = {c["component"]: c["score"] for c in
              r["speech_skills"] + r["conversation_skills"] + r.get("focus_areas", [])}
    scores.update(r.get("metrics", {}).get("profile") or {})
    return scores


def build_memory(reports: list[dict] | None = None) -> dict:
    reports = load_reports() if reports is None else reports
    components: dict[str, dict] = {}
    groups = {**{c: "speech" for c in SPEECH_COMPONENTS}, **{c: "focus" for c in FOCUS_AREAS},
              **{c: "conversation" for c in CONVERSATION_COMPONENTS}, **{g: "profile" for g in PARAMETER_GROUPS}}
    for name, group in groups.items():
        series = []
        for r in reports:
            score = report_scores(r).get(name)
            if score is not None:
                series.append((r["created_at"], float(score)))
        if series:
            components[name] = {"group": group, **_component_params(series)}

    mastered, review = {}, {}
    for r in reports:
        for d in r.get("drills", []):
            key = d["target"].lower()
            entry = {k: d.get(k, "") for k in ("target", "respelling", "ipa", "area", "tip")}
            entry.update(date=r["created_at"], similar=d.get("similar", []))
            if d.get("result") == "mastered":
                mastered[key] = entry
                review.pop(key, None)
            elif key not in mastered:
                review[key] = entry

    ranked = sorted(components.items(), key=lambda kv: -kv[1]["priority"])
    accent = next((r.get("accent_opt_in") for r in reversed(reports) if r.get("accent_opt_in")), None)
    last = reports[-1] if reports else None
    memory = {
        "sessions": len(reports),
        "first_session": reports[0]["created_at"] if reports else None,
        "last_session": {
            "date": last["created_at"], "verdict": last["verdict"], "overall": last["overall_score"],
            "priorities": [p["title"] for p in last["priorities"]],
        } if last else None,
        "accent_opt_in": accent,
        "components": components,
        "weaknesses": [{"component": n, "ema": c["ema"], "trend": c["trend"]} for n, c in ranked
                       if c["status"] in ("weakness", "developing")][:5],
        "improving": sorted(({"component": n, "trend": c["trend"], "ema": c["ema"]} for n, c in components.items()
                             if c["trend"] > 0), key=lambda x: -x["trend"])[:5],
        "strengths": sorted(({"component": n, "ema": c["ema"]} for n, c in components.items() if c["ema"] >= 3.5),
                            key=lambda x: -x["ema"])[:5],
        "words_mastered": list(mastered.values()),
        "words_to_review": list(review.values()),
        "overall_history": [{"date": r["created_at"], "overall": r["overall_score"],
                             "speech": r["metrics"].get("speech_avg"),
                             "conversation": r["metrics"].get("conversation_avg")} for r in reports],
        "totals": {
            "speaking_s": round(sum(r["metrics"].get("speaking_s", 0) for r in reports), 1),
            "practice_days": len({r["created_at"][:10] for r in reports}),
            "words_mastered": len(mastered),
        },
    }
    return memory


def save_memory() -> dict:
    memory = build_memory()
    os.makedirs(os.path.dirname(MEMORY_PATH), exist_ok=True)
    with open(MEMORY_PATH, "w") as f:
        json.dump(memory, f, indent=2)
    return memory


def load_memory() -> dict:
    if os.path.exists(MEMORY_PATH):
        with open(MEMORY_PATH) as f:
            return json.load(f)
    return save_memory()


def memory_prompt(memory: dict) -> str:
    """Context appended to the coach's system prompt at the start of a session."""
    if not memory or not memory.get("sessions"):
        return "\n\nCLIENT MEMORY: this is the client's first session; there is no history yet."
    last = memory["last_session"]
    lines = [f"\n\nCLIENT MEMORY (from {memory['sessions']} previous session(s); use it to plan the "
             "session, mention it briefly and naturally, never read it out as a list):"]
    if memory["accent_opt_in"] == "yes":
        lines.append("- Accent: the client already chose to work on a neutral accent. Don't ask again; keep correcting it.")
    elif memory["accent_opt_in"] == "no":
        lines.append("- Accent: the client declined accent work. Don't ask again and don't correct their accent.")
    if memory["weaknesses"]:
        lines.append("- Weakest components (score out of 5, change since first session): " + "; ".join(
            f"{w['component']} {w['ema']:g} ({w['trend']:+g})" for w in memory["weaknesses"]))
    if memory["improving"]:
        lines.append("- Improving: " + ", ".join(f"{w['component']} ({w['trend']:+g})" for w in memory["improving"]))
    if memory["strengths"]:
        lines.append("- Strengths: " + ", ".join(s["component"] for s in memory["strengths"]))
    if memory["words_to_review"]:
        lines.append("- Words still to master (review these early in the session): " + ", ".join(
            f"{w['target']} ({w['respelling']})" for w in memory["words_to_review"][-6:]))
    if memory["words_mastered"]:
        lines.append("- Already mastered (you may spot-check one, or practise its similar words): " + ", ".join(
            w["target"] for w in memory["words_mastered"][-8:]))
    if last:
        lines.append(f"- Last session ({last['date'][:10]}): overall {last['overall']:g}/5. {last['verdict']} "
                     f"Priorities then: {', '.join(last['priorities'])}.")
    lines.append("Plan: after the client's first answer, review one word to master if there is one, then "
                 "rotate through their weakest components with varied exercises.")
    return "\n".join(lines)


def opener_for(memory: dict, focus: str | None = None) -> str | None:
    """Personalised greeting for returning clients (None = use the default first-session opener)."""
    if focus:
        return (f"Hi again! You asked to practise {focus}, so we'll start there. First, to warm up, tell me "
                "in a few sentences how your day is going. Say give me my report whenever you're done.")
    if not memory or not memory.get("sessions"):
        return None
    last = memory["last_session"]
    topics = " and ".join(p.lower() for p in last["priorities"][:2]) if last else "your speech"
    review = memory["words_to_review"][-1]["target"] if memory["words_to_review"] else None
    return (f"Welcome back! Last time we worked on {topics}. "
            + (f"Today we'll start by reviewing the word {review}, and then practise a few different skills. "
               if review else "Today we'll practise a few different skills. ")
            + "To warm up, tell me about something you did this week. Say give me my report whenever you're done.")
