"use strict";

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt1 = (v) => (v == null ? "—" : Number(v).toFixed(1).replace(/\.0$/, ""));

const ICON = {
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9.5"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h1.5v-8H10Zm3.5 0v8H15v-8h-1.5Z"/></svg>`,
  checkSmall: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 16.2-3.5-3.5L4 14.2l5 5 11-11-1.4-1.4z"/></svg>`,
  target: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2Zm0 4a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4V6Zm0 4a2 2 0 1 0 2 2h-2v-2Zm6-8 4 4-3 1-4 4-1.4-1.4 4-4 1-3Z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15 15 0 0 0-1.3-3.9A8 8 0 0 1 18.9 8ZM12 4c.9 1.2 1.6 2.6 2 4h-4c.4-1.4 1.1-2.8 2-4ZM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4H4.3Zm.8 2h3a15 15 0 0 0 1.3 3.9A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.3-3.9C8.8 5.3 8.4 6.6 8.1 8ZM12 20c-.9-1.2-1.6-2.6-2-4h4c-.4 1.4-1.1 2.8-2 4Zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4Zm.3 5.9c.6-1.2 1-2.5 1.3-3.9h3a8 8 0 0 1-4.3 3.9ZM16.3 14a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4h-3.4Z"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10h3v10H4Zm6 0V4h3v16h-3Zm6 0v-7h3v7h-3Z"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>`,
  trendUp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 7-7v5h2V5h-8v2h5l-6 6-4-4-7 7z"/></svg>`,
  trendDown: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l6 6 4-4 7 7v-5h2v8h-8v-2h5l-6-6-4 4-7-7z"/></svg>`,
  wave: `<svg class="wave" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h2v4H3zm4-4h2v12H7zm4-3h2v18h-2zm4 5h2v8h-2zm4 2h2v4h-2z"/></svg>`,
  notes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Zm-3 17h6v2H9z"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v1.6H8V12Zm0 3.5h8v1.6H8v-1.6Z"/></svg>`,
  download: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v9l3.5-3.5L18 11l-6 6-6-6 1.5-1.5L11 13V4ZM5 19h14v2H5z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z"/></svg>`,
  drills: [
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8c3-3 6 3 9 0s6 3 9 0v3c-3 3-6-3-9 0s-6-3-9 0V8Zm0 6c3-3 6 3 9 0s6 3 9 0v3c-3 3-6-3-9 0s-6-3-9 0v-3Z"/></svg>`,
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h11a3 3 0 1 0-3-3h-2a5 5 0 1 1 5 5H4V9Zm0 4h14a4 4 0 1 1-4 4h2a2 2 0 1 0 2-2H4v-2Z"/></svg>`,
    `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4a5 5 0 0 1 5 5v1h-2V9a3 3 0 1 0-6 0c0 1.4.6 2.2 1.4 3.1C8.3 13 9 14 9 16a2 2 0 0 0 4 0h2a4 4 0 0 1-8 0c0-1.2-.4-1.8-1.1-2.6C5 12.4 4 11.2 4 9a5 5 0 0 1 5-5Zm8.5 4.5 1.4-1.4a8 8 0 0 1 0 11.3l-1.4-1.4a6 6 0 0 0 0-8.5Z"/></svg>`,
  ],
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm11 8H6v10h12V10Zm-9 3h2v2H9v-2Z"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v12H8l-3 3V4Zm6 2-1.2 3.3L6.5 10.5l3.3 1.2L11 15l1.2-3.3 3.3-1.2-3.3-1.2L11 6Z"/></svg>`,
};

/* =============================================================== tabs */

function showTab(name, reportId = null) {
  document.querySelectorAll(".seg").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
  $("#tab-session").hidden = name !== "session";
  $("#tab-reports").hidden = name !== "reports";
  $("#tab-progress").hidden = name !== "progress";
  history.replaceState(null, "", name === "session" ? location.pathname : `#${name}`);
  if (name === "reports") loadReports(reportId);
  if (name === "progress") loadProgress();
}
document.querySelectorAll(".seg").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

/* =============================================================== live session */

// state -> [title, hint, pill text, pill style]
const STATES = {
  idle: ["Ready when you are", "Press start. Your browser will ask for microphone access. Headphones work best.", "Ready", "gray"],
  calibrating: ["Measuring room noise", "Stay quiet for a second so I can tell your voice from the background.", "Calibrating", "soft"],
  speaking: ["Coach is speaking", "Listen, then answer when it finishes.", "Coach speaking", ""],
  listening: ["Your turn", "Speak naturally. Pause for 3 seconds or press “I'm done talking” when you finish.", "Your turn", ""],
  talking: ["Listening to you…", "Take your time. Short pauses are fine.", "Listening", ""],
  thinking: ["Analyzing your speech…", "Listening to how you said it.", "Analyzing", "soft"],
  reporting: ["Writing your report…", "Re-listening to the whole session. This takes about 20 seconds.", "Writing report", "soft"],
  done: ["Session complete", "Your report is ready in the Therapy Report tab.", "Complete", "gray"],
};

const session = {
  ws: null, micCtx: null, playCtx: null, stream: null, analyser: null,
  state: "idle", userTalking: false, micLevel: 0,
  nextPlay: 0, leftover: null, endTimer: null, turns: 0, coachBubble: null,
  practised: new Map(), currentComponent: null,
};

function setState(state) {
  session.state = state;
  if (state !== "listening") session.userTalking = false;
  renderStage();
}

function renderStage() {
  const s = session.state === "listening" && session.userTalking ? "talking" : session.state;
  const [title, hint, pill, pillStyle] = STATES[s] || STATES.idle;
  $("#orb").dataset.state = s;
  $("#stageTitle").textContent = title;
  $("#stageHint").textContent = hint;
  $("#statePill").textContent = pill;
  $("#statePill").className = `pill ${pillStyle}`;
  const active = !["idle", "done"].includes(session.state);
  $("#startBtn").hidden = active;
  $("#startBtn span").textContent = session.state === "done" ? "Start a new session" : "Start session";
  $("#doneBtn").hidden = !active;
  $("#doneBtn").disabled = !(session.state === "listening" && session.userTalking);
  $("#reportBtn").hidden = !active;
  $("#reportBtn").disabled = !(session.state === "listening" && session.turns > 0);
  $("#stopBtn").hidden = !active;
}

const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(480); this.i = 0; this.sum = 0; }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    for (let k = 0; k < ch.length; k++) {
      const s = Math.max(-1, Math.min(1, ch[k]));
      this.sum += s * s;
      this.buf[this.i++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.i === 480) {
        this.port.postMessage({ pcm: this.buf.buffer, level: Math.sqrt(this.sum / 480) }, [this.buf.buffer]);
        this.buf = new Int16Array(480); this.i = 0; this.sum = 0;
      }
    }
    return true;
  }
}
registerProcessor("capture", Capture);`;

async function startSession(focus = null) {
  clearFeed();
  session.turns = 0;
  try {
    session.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
  } catch (e) {
    addSystem("Microphone access was blocked. Allow it in the browser's address bar and try again.");
    return;
  }
  session.micCtx = new AudioContext({ sampleRate: 16000 });
  session.playCtx = new AudioContext({ sampleRate: 48000 });
  session.analyser = session.playCtx.createAnalyser();
  session.analyser.fftSize = 512;
  session.analyser.connect(session.playCtx.destination);

  const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
  await session.micCtx.audioWorklet.addModule(url);
  const node = new AudioWorkletNode(session.micCtx, "capture");
  session.micCtx.createMediaStreamSource(session.stream).connect(node);
  node.port.onmessage = ({ data }) => {
    session.micLevel = data.level;
    if (session.ws?.readyState === WebSocket.OPEN) session.ws.send(data.pcm);
  };

  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
  ws.binaryType = "arraybuffer";
  session.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ type: "start", focus }));
  ws.onmessage = (ev) => (typeof ev.data === "string" ? onEvent(JSON.parse(ev.data)) : playPcm(ev.data));
  ws.onclose = () => {
    if (!["idle", "done"].includes(session.state)) {
      addSystem("Connection to the coach closed.");
      stopSession();
    }
  };
  setState("calibrating");
}

function stopSession(finalState = "idle") {
  const ws = session.ws;
  session.ws = null;
  ws?.close();
  session.stream?.getTracks().forEach((t) => t.stop());
  session.micCtx?.close();
  // let the last words finish when the session ended normally
  const ctx = session.playCtx;
  setTimeout(() => ctx?.close(), finalState === "done" ? 30000 : 0);
  clearTimeout(session.endTimer);
  session.nextPlay = 0;
  session.micLevel = 0;
  setState(finalState);
}

function send(obj) {
  if (session.ws?.readyState === WebSocket.OPEN) session.ws.send(JSON.stringify(obj));
}

function onEvent(ev) {
  switch (ev.type) {
    case "state":
      if (ev.state === "done") { setState("done"); setTimeout(() => stopSession("done"), 200); }
      else setState(ev.state);
      break;
    case "vad":
      session.userTalking = ev.speaking;
      renderStage();
      break;
    case "user_turn":
      session.turns = ev.n;
      addUserTurn(ev.n, ev.stats);
      break;
    case "coach":
      addCoach(ev.text, ev.notes, ev.drill, ev.exercise);
      if (ev.baseline) addBaseline(ev.baseline);
      if (ev.drill) { showDrill(ev.drill); track(ev.drill.area, ev.drill.status === "mastered" || ev.drill.status === "skipped"); }
      if (ev.exercise) { showExercise(ev.exercise); track(ev.exercise.component, ev.exercise.status === "done"); }
      if (ev.drill && !ev.exercise && ev.drill.status !== "mastered") $("#exerciseNow").hidden = true;
      if (ev.exercise && !ev.drill) $("#drillNow").hidden = true;
      if (ev.accent) showAccent(ev.accent);
      break;
    case "coach_delta":
      if (session.coachBubble) {
        session.coachBubble.textContent += ev.text;
        scrollFeed();
      }
      break;
    case "audio_end":
      session.coachBubble?.classList.remove("typing");
      scheduleEnd();
      break;
    case "report_ready":
      addReportReady(ev.id);
      break;
    case "error":
      addSystem(ev.message);
      break;
  }
}

/* ------------------------------------------------ playback (48 kHz int16 from Gradium) */

function playPcm(buf) {
  const ctx = session.playCtx;
  if (!ctx) return;
  let bytes = new Uint8Array(buf);
  if (session.leftover) {
    const merged = new Uint8Array(session.leftover.length + bytes.length);
    merged.set(session.leftover); merged.set(bytes, session.leftover.length);
    bytes = merged; session.leftover = null;
  }
  if (bytes.length % 2) { session.leftover = bytes.slice(-1); bytes = bytes.slice(0, -1); }
  if (!bytes.length) return;
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
  const audio = ctx.createBuffer(1, samples.length, 48000);
  const ch = audio.getChannelData(0);
  for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
  const src = ctx.createBufferSource();
  src.buffer = audio;
  src.connect(session.analyser);
  const at = Math.max(session.nextPlay, ctx.currentTime + 0.06);
  src.start(at);
  session.nextPlay = at + audio.duration;
}

function scheduleEnd() {
  const ctx = session.playCtx;
  const remaining = ctx ? Math.max(0, session.nextPlay - ctx.currentTime) : 0;
  clearTimeout(session.endTimer);
  session.endTimer = setTimeout(() => send({ type: "playback_done" }), remaining * 1000 + 200);
}

/* ------------------------------------------------ orb animation */

const coachBins = new Uint8Array(256);
function animate() {
  let level = 0;
  if (["speaking", "reporting", "done"].includes(session.state)) {
    if (session.analyser) {
      session.analyser.getByteTimeDomainData(coachBins);
      let sum = 0;
      for (const v of coachBins) sum += ((v - 128) / 128) ** 2;
      level = Math.sqrt(sum / coachBins.length) * 4;
    }
  } else if (session.state === "listening") {
    level = session.micLevel * 6;
  }
  const orb = $("#orb");
  const prev = parseFloat(orb.style.getPropertyValue("--level")) || 0;
  orb.style.setProperty("--level", (prev * 0.7 + Math.min(level, 1) * 0.3).toFixed(3));
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

/* ------------------------------------------------ feed */

function clearFeed() {
  $("#feed").innerHTML = "";
  $("#turnCount").hidden = true;
  $("#accentPill").hidden = true;
  $("#drillNow").hidden = true;
  $("#exerciseNow").hidden = true;
  $("#tracker").hidden = true;
  session.practised = new Map();
}
function scrollFeed() { $("#feed").lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
function addItem(html, cls) {
  const li = document.createElement("li");
  li.className = `msg ${cls}`;
  li.innerHTML = html;
  $("#feed").appendChild(li);
  scrollFeed();
  return li;
}

const DRILL_STATUS = {
  teach: ["Listen &amp; repeat", "soft"], retry: ["Try again", "peach"], correct: ["Correct · one more time", ""],
  mastered: ["Mastered", ""], skipped: ["Added to practice plan", "gray"],
};

function drillCard(d) {
  const [label, style] = DRILL_STATUS[d.status] || DRILL_STATUS.teach;
  return `<div class="drill-card"><div><div class="w">${esc(d.target)}</div>
    <div class="say">${esc(d.respelling)} <span class="sub">${esc(d.ipa)}</span></div></div>
    <span class="pill ${style}">${d.status === "mastered" ? ICON.checkSmall : ""}${label}</span>
    ${d.tip ? `<div class="tip">${esc(d.tip)}</div>` : ""}
    ${d.similar?.length ? `<div class="tip">Similar words: ${d.similar.map(wordChip).join(" ")}</div>` : ""}</div>`;
}

// Speak text locally with the browser's voice (slowly), e.g. to hear a target word again.
function hear(text, rate = 0.75) {
  if (!("speechSynthesis" in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.lang = "en-US";
  speechSynthesis.speak(u);
}
document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-hear]");
  if (chip) hear(chip.dataset.hear, Number(chip.dataset.rate || 0.75));
});

function wordChip(w, cls = "") {
  return `<button type="button" class="word-chip ${cls}" data-hear="${esc(w)}" title="Hear “${esc(w)}”">${ICON.speaker}${esc(w)}</button>`;
}

function exerciseCard(x) {
  const label = { new: "New exercise", retry: "Try again", done: "Done" }[x.status] || "Exercise";
  return `<div class="ex-card"><div class="k">${esc(x.component)} · ${esc(x.type)} · ${label}</div>
    ${x.script ? `<div class="s">“${esc(x.script)}”</div>` : ""}<div class="i">${esc(x.instruction)}</div></div>`;
}

function showExercise(x) {
  const active = x.status !== "done";
  $("#exerciseNow").hidden = !active;
  if (!active) return;
  $("#exerciseKind").textContent = `${x.component} · ${x.type}${x.status === "retry" ? " · try again" : ""}`;
  $("#exerciseInstruction").textContent = x.instruction;
  $("#exerciseScript").textContent = x.script ? `“${x.script}”` : "";
}

// Components practised this session: done ones get a check, the current one a ring.
function track(component, done) {
  if (!component) return;
  const name = component[0].toUpperCase() + component.slice(1);
  session.practised.set(name, session.practised.get(name) || done);
  session.currentComponent = name;
  $("#tracker").hidden = false;
  $("#trackerChips").innerHTML = [...session.practised].map(([c, ok]) =>
    `<span class="pill ${ok ? "" : "soft"} ${c === session.currentComponent ? "current" : ""}">${ok ? ICON.checkSmall : ""}${esc(c)}</span>`).join("");
}

function showDrill(d) {
  const active = ["teach", "retry", "correct"].includes(d.status);
  $("#drillNow").hidden = !active;
  if (!active) return;
  $("#drillWord").textContent = d.target;
  $("#drillSay").textContent = [d.respelling, d.ipa].filter(Boolean).join("  ·  ");
  $("#drillTip").textContent = d.status === "correct" ? "Correct! Say it one more time." : d.tip;
  $("#drillHear").onclick = () => hear(d.target, 0.6);
  $("#drillSimilar").hidden = !d.similar?.length;
  $("#drillSimilar").innerHTML = d.similar?.length ? `<span>Similar:</span>${d.similar.map((w) => wordChip(w)).join("")}` : "";
}

function showAccent(choice) {
  const pill = $("#accentPill");
  pill.hidden = false;
  pill.className = `pill ${choice === "yes" ? "" : "gray"}`;
  pill.textContent = choice === "yes" ? "Accent coaching on" : "Accent coaching off";
}

function addBaseline(baseline) {
  const items = Object.entries(baseline).map(([name, v]) => `
    <div class="baseline-item"><div class="top"><span>${esc(name)}</span><span>${fmt1(v.score)}</span></div>
      <div class="bar${v.score < 3 ? " peach" : ""}"><i style="width:${v.score * 20}%"></i></div>
      <div class="note">${esc(v.note)}</div></div>`).join("");
  addItem(`<div class="baseline"><h4>Your baseline</h4><p class="sub">The nine core components, scored from your first answer</p>
    <div class="baseline-grid">${items}</div></div>`, "baseline-msg");
}

function addCoach(text, notes, drill, exercise) {
  const li = addItem(`<div class="avatar">AI</div><div class="bubble"><p class="typing"></p>${
    drill ? drillCard(drill) : ""}${exercise ? exerciseCard(exercise) : ""}${notes ? `<div class="notes"><b>Coach notes</b>${esc(notes)}</div>` : ""}</div>`, "coach");
  session.coachBubble = li.querySelector("p");
  session.coachBubble.textContent = text;
}

function statChips(s) {
  const chips = [`${s.span_s.toFixed(1)} s speaking`, `${s.pauses.length} pause${s.pauses.length === 1 ? "" : "s"}`,
                 `replied after ${s.latency_s.toFixed(1)} s`];
  return `<div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>`;
}

function addUserTurn(n, stats) {
  const pill = $("#turnCount");
  pill.hidden = false;
  pill.textContent = `${n} turn${n === 1 ? "" : "s"}`;
  addItem(`<div class="avatar">YOU</div><div class="bubble"><div class="turn-label">Turn ${n}</div>${statChips(stats)}</div>`, "you");
}

function addSystem(text) { addItem(esc(text), "system"); }

function addReportReady(id) {
  const li = addItem(`<div class="report-ready"><div><strong>Your therapy report is ready</strong>
    <div class="muted">Speech &amp; conversation analysis with charts and a practice plan</div></div>
    <button class="btn light sm">View report</button></div>`, "ready");
  li.querySelector("button").onclick = () => showTab("reports", id);
}

$("#startBtn").onclick = () => startSession();
$("#stopBtn").onclick = () => stopSession("idle");
$("#doneBtn").onclick = () => send({ type: "end_turn" });
$("#reportBtn").onclick = () => send({ type: "report" });
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && session.state === "listening" && session.userTalking && document.activeElement.tagName !== "BUTTON") {
    send({ type: "end_turn" });
  }
});
renderStage();

/* =============================================================== reports */

const charts = [];
let reportsCache = [];
let currentReport = null;

function destroyCharts() { while (charts.length) charts.pop().destroy(); }

// Opens the newest report unless a specific one is asked for (e.g. from the session's "View report").
async function loadReports(reportId = null) {
  const res = await fetch("/api/reports");
  reportsCache = await res.json();
  if (!reportsCache.length) { renderEmpty(); return; }
  currentReport = reportsCache.some((r) => r.id === reportId) ? reportId : reportsCache[0].id;
  openReport(currentReport);
}

function renderEmpty() {
  destroyCharts();
  $("#reportView").innerHTML = `<div class="card empty">
    <span class="icon-tile mint">${ICON.doc}</span><h3>No reports yet</h3>
    <p>Finish a session by saying “give me my report” and your assessment will appear here.</p>
    <button class="btn primary" id="emptyStart">${ICON.play}Start a session</button></div>`;
  $("#emptyStart").onclick = () => showTab("session");
}

function fmtDate(iso, withTime = true) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
    (withTime ? ` · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : "");
}

function sessionSelect() {
  return `<select class="select-pill" id="sessionSelect" aria-label="Choose a session">${reportsCache.map((r) =>
    `<option value="${r.id}" ${r.id === currentReport ? "selected" : ""}>${fmtDate(r.created_at)}${
      r.legacy ? " · text only" : ` · ${r.overall_score.toFixed(1)}/5`}</option>`).join("")}</select>`;
}

function bindHeader(id) {
  $("#sessionSelect").onchange = (e) => openReport(e.target.value);
  $("#exportBtn").href = `/api/reports/${id}/markdown`;
  $("#deleteBtn").onclick = () => {
    $("#deleteSlot").innerHTML = `<span class="confirm">Delete this report?
      <button class="btn sm danger" id="confirmDelete">Delete</button><button class="btn sm" id="cancelDelete">Cancel</button></span>`;
    $("#confirmDelete").onclick = () => deleteReport(id);
    $("#cancelDelete").onclick = () => bindHeader(id) || openReport(id);
  };
}

async function openReport(id) {
  currentReport = id;
  const res = await fetch(`/api/reports/${id}`);
  if (!res.ok) return;
  const r = await res.json();
  destroyCharts();
  if (r.legacy) renderLegacy(r); else renderReport(r);
  bindHeader(id);
}

function headerHtml(eyebrow, title, meta) {
  return `<div class="page-head">
    <div><div class="eyebrow"><i class="dot"></i>${eyebrow}</div><h1>${title}</h1><p class="meta">${meta}</p></div>
    <div class="head-actions">${sessionSelect()}
      <span id="deleteSlot"><button class="btn icon-btn" id="deleteBtn" title="Delete this report">${ICON.trash}</button></span>
      <a class="btn primary" id="exportBtn">${ICON.download}Export report</a></div>
  </div>`;
}

function renderLegacy(r) {
  $("#reportView").innerHTML = headerHtml("Session report · text only", "Speech Assessment",
    "Created by an earlier version of the coach, so it has no charts.") +
    `<div class="card prose">${marked.parse(r.markdown)}</div>`;
}

/* ------------------------------------------------ chart theme */

Chart.defaults.font.family = "Inter, system-ui, sans-serif";
Chart.defaults.font.size = 11;

function tooltip(extra = {}) {
  return {
    backgroundColor: css("--primary"), titleColor: css("--primary-ink"), bodyColor: css("--primary-ink"),
    padding: 10, cornerRadius: 10, displayColors: false, titleFont: { weight: "600" }, ...extra,
  };
}

function axes({ yMax, yStep, xGrid = false } = {}) {
  return {
    x: { grid: { display: xGrid, color: css("--grid") }, border: { color: css("--axis") }, ticks: { color: css("--muted") } },
    y: { beginAtZero: true, suggestedMax: yMax, grid: { color: css("--axis"), drawTicks: false }, border: { display: false },
         ticks: { color: css("--muted"), maxTicksLimit: 4, stepSize: yStep, padding: 6 } },
  };
}

function miniBar(canvas, labels, data, suffix, yMax) {
  charts.push(new Chart(canvas, {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: css("--teal"), borderRadius: 4, borderSkipped: "start", maxBarThickness: 18 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: { legend: { display: false }, tooltip: tooltip({ callbacks: { label: (i) => (i.raw == null ? "n/a" : `${i.raw}${suffix}`) } }) },
      scales: axes({ yMax }),
    },
  }));
}

function paceChart(canvas, turns) {
  const labels = turns.map((t) => `Turn ${t.n}`);
  const target = 150;
  const teal = css("--teal");
  const band = {
    id: "band",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales } = chart;
      const top = scales.y.getPixelForValue(160), bottom = scales.y.getPixelForValue(140);
      ctx.save();
      ctx.fillStyle = css("--mint");
      ctx.globalAlpha = 0.35;
      ctx.fillRect(a.left, top, a.right - a.left, bottom - top);
      ctx.restore();
    },
  };
  const vals = turns.map((t) => t.wpm).filter((v) => v != null);
  charts.push(new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Your pace", data: turns.map((t) => t.wpm), borderColor: teal, backgroundColor: teal, borderWidth: 2.5,
          pointRadius: 4.5, pointHoverRadius: 6, pointBackgroundColor: teal, pointBorderColor: css("--surface-2"),
          pointBorderWidth: 2, tension: 0.4, spanGaps: true },
        { label: "Target", data: turns.map(() => target), borderColor: css("--muted"), borderDash: [5, 5],
          borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, tension: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltip({ callbacks: { label: (i) => (i.datasetIndex ? `Target ${target} wpm` : `${i.raw ?? "n/a"} wpm`) } }),
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: css("--muted") } },
        y: { min: 0, suggestedMin: Math.max(0, Math.min(100, ...vals.map((v) => v - 20))), suggestedMax: Math.max(200, ...vals.map((v) => v + 20)),
             grid: { color: css("--axis"), drawTicks: false }, border: { display: false },
             ticks: { color: css("--muted"), maxTicksLimit: 5, padding: 6 } },
      },
    },
    plugins: [band],
  }));
}

// "10 Oct", or "10 Oct 14:56" when several sessions share a day
function sessionLabels(list) {
  const day = (r) => fmtDate(r.created_at, false).replace(/,? \d{4}$/, "");
  const days = list.map(day);
  return list.map((r, i) => (days.filter((d) => d === days[i]).length > 1
    ? `${days[i]} ${new Date(r.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : days[i]));
}

function progressChart(canvas, list) {
  const series = [["Overall", (r) => r.overall_score, "--series-1"],
                  ["Speech", (r) => r.metrics.speech_avg, "--series-2"],
                  ["Conversation", (r) => r.metrics.conversation_avg, "--series-3"]];
  charts.push(new Chart(canvas, {
    type: "line",
    data: {
      labels: sessionLabels(list),
      datasets: series.map(([label, get, color]) => ({
        label, data: list.map(get), borderColor: css(color), backgroundColor: css(color),
        borderWidth: 2, pointRadius: 3.5, pointHoverRadius: 5, tension: 0.35,
        pointBorderColor: css("--surface"), pointBorderWidth: 1.5,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: tooltip({ displayColors: true }) },
      scales: {
        x: { grid: { display: false }, border: { color: css("--axis") }, ticks: { color: css("--muted"), maxTicksLimit: 6 } },
        y: { min: 0, max: 5, grid: { color: css("--axis"), drawTicks: false }, border: { display: false }, ticks: { color: css("--muted"), stepSize: 1, padding: 6 } },
      },
    },
  }));
}

/* ------------------------------------------------ report pieces */

function status(score) {
  if (score == null) return ["Not assessed", "gray"];
  if (score >= 4) return ["Strong", ""];
  if (score >= 3) return ["Progressing", "soft"];
  return ["Focus area", "peach"];
}

function ring(score) {
  const r = 26, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(1, score / 5));
  return `<svg class="ring" viewBox="0 0 62 62" role="img" aria-label="${score} out of 5">
    <circle class="track" cx="31" cy="31" r="${r}"/>
    <circle class="val" cx="31" cy="31" r="${r}" stroke-dasharray="${(c * pct).toFixed(1)} ${c.toFixed(1)}"/>
    <text x="31" y="31">${fmt1(score)}</text></svg>`;
}

function scoreCell(score, start) {
  if (score == null) return `<span class="num"><small>N/A</small></span>`;
  const tick = start != null ? `<span class="tick" style="left:${start * 20}%" title="Start of session: ${fmt1(start)}"></span>` : "";
  return `<span class="num">${fmt1(score)}<small>/5</small></span>
    <div class="bar-wrap"><div class="bar${score < 3 ? " peach" : ""}"><i style="width:${score * 20}%"></i></div>${tick}</div>
    ${start != null ? `<div class="start-mark">start ${fmt1(start)}</div>` : ""}`;
}

function skillTable(title, sub, skills, avg, baseline = null) {
  const rows = skills.map((s) => {
    const [label, style] = status(s.score);
    return `<tr>
      <td><div class="skill-name">${esc(s.component)}</div><div class="skill-obs">${esc(s.observed)}</div>
        <div class="skill-tip">→ ${esc(s.improve)}</div></td>
      <td class="skill-score">${scoreCell(s.score, baseline?.[s.component]?.score)}</td>
      <td class="skill-status"><span class="pill ${style}">${label}</span></td></tr>`;
  }).join("");
  return `<div class="card">
    <div class="card-head"><div><h3>${title}</h3><p class="sub">${sub}</p></div>
      <span class="pill gray">avg ${fmt1(avg)} / 5</span></div>
    <table class="skill-table"><thead><tr><th>Component &amp; evidence</th><th>Score</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function focusCard(areas) {
  if (!areas?.length) return "";
  const judged = areas.filter((a) => a.score != null).length;
  return `<div class="card">
    <div class="synth-head"><span class="icon-tile mint">${ICON.target}</span>
      <div><h3>Focus Areas</h3><p class="sub">${judged} of ${areas.length} assessed this session · tap a row for details</p></div></div>
    <div class="focus-list">${areas.map((a) => {
      const [label, style] = status(a.score);
      return `<div class="focus-row"><details><summary><span class="name">${esc(a.component)}</span></summary>
          <p>${esc(a.observed)}</p><p class="skill-tip">→ ${esc(a.improve)}</p></details>
        <div class="score">${a.score == null ? `<span class="sub">N/A</span>` : `${fmt1(a.score)}<span class="sub">/5</span>
          <div class="bar${a.score < 3 ? " peach" : ""}"><i style="width:${a.score * 20}%"></i></div>`}</div>
        <span class="pill ${style}">${label}</span></div>`;
    }).join("")}</div></div>`;
}

function accentCard(r) {
  if (!r.accent_summary) return "";
  const accent = (r.focus_areas || []).find((a) => a.component === "Accent");
  const choice = r.accent_opt_in === "yes" ? ["Accent coaching on", ""] : r.accent_opt_in === "no" ? ["Declined accent work", "gray"] : ["Not discussed", "gray"];
  return `<div class="card">
    <div class="synth-head"><span class="icon-tile soft">${ICON.globe}</span>
      <div><h3>Accent</h3><p class="sub">Target: neutral, widely understood English</p></div>
      <span class="pill ${choice[1]}" style="margin-left:auto">${choice[0]}</span></div>
    ${accent?.score != null ? `<div class="kpi-row" style="margin-bottom:10px"><div class="kpi-value" style="margin:0">${fmt1(accent.score)}<small>/5</small></div>
      <div style="flex:1;max-width:180px"><div class="bar"><i style="width:${accent.score * 20}%"></i></div>
      <div class="pace-scale" style="margin-top:4px"><span>strong accent</span><span>neutral</span></div></div></div>` : ""}
    <p style="font-size:13.5px;line-height:1.6">${esc(r.accent_summary)}</p></div>`;
}

function drillsCard(drills) {
  const mastered = drills.filter((d) => d.result === "mastered").length;
  const RESULT = { mastered: ["Mastered", ""], "needs practice": ["Needs practice", "peach"], practising: ["In progress", "soft"] };
  return `<div class="card">
    <div class="card-head"><div><h3>Pronunciation Drills</h3><p class="sub">Words and phrases you practised with the coach</p></div>
      ${drills.length ? `<span class="pill">${mastered} of ${drills.length} mastered</span>` : ""}</div>
    ${drills.length ? `<table class="drill-table"><thead><tr><th>Word / phrase</th><th>Say it as</th><th>Area</th><th>Tries</th><th>Result</th></tr></thead><tbody>
      ${drills.map((d) => { const [label, style] = RESULT[d.result] || RESULT.practising; return `<tr>
        <td><div class="w">${esc(d.target)} <button type="button" class="word-chip" data-hear="${esc(d.target)}" data-rate="0.6" title="Hear it slowly">${ICON.speaker}</button></div>
          ${d.tip ? `<div class="sub">${esc(d.tip)}</div>` : ""}
          ${d.similar?.length ? `<div class="chip-row" style="margin-top:6px"><span class="sub">Similar:</span>${d.similar.map((w) => wordChip(w)).join("")}</div>` : ""}</td>
        <td><div class="say">${esc(d.respelling)}</div><div class="ipa">${esc(d.ipa)}</div></td>
        <td><span class="pill gray">${esc(d.area)}</span></td><td>${d.attempts}</td>
        <td><span class="pill ${style}">${label}</span></td></tr>`; }).join("")}</tbody></table>`
      : `<p class="sub">No pronunciation drills in this session. When the coach hears a word to fix, it will teach it slowly and practise it with you.</p>`}
  </div>`;
}

function sectionHead(n, title, sub) {
  return `<div class="section-head"><span class="section-num">${n}</span><div><h2>${title}</h2><p class="sub">${sub}</p></div></div>`;
}

function minutesOf(text) {
  const m = String(text).match(/(\d+)\s*(?:-|–|to)?\s*\d*\s*min/i);
  return m ? `${m[1]} min${m[1] === "1" ? "" : "s"}` : null;
}

const PROGRESS_COMPONENTS = ["Phonetics", "Phonology", "Articulation", "Prosody", "Fluency", "Speech rate",
  "Voice quality", "Intonation", "Resonance", "Accent", "Fast speech", "Stuttering", "Lisp", "Charisma",
  "Listening", "Over-explanation", "Precise speech"];

function radarChart(canvas, labels, datasets) {
  charts.push(new Chart(canvas, {
    type: "radar",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 600 },
      plugins: { legend: { display: false }, tooltip: tooltip({ displayColors: true }) },
      scales: { r: {
        min: 0, max: 5, ticks: { stepSize: 1, display: false },
        grid: { color: css("--axis") }, angleLines: { color: css("--axis") },
        pointLabels: { color: css("--ink-2"), font: { size: 11, weight: "600" } },
      } },
    },
  }));
}

function radarSets(now, before, nowLabel, beforeLabel) {
  const teal = css("--series-1"), muted = css("--muted");
  const sets = [{ label: nowLabel, data: now, borderColor: teal, backgroundColor: teal + "33", borderWidth: 2,
                  pointBackgroundColor: teal, pointRadius: 3 }];
  if (before) sets.push({ label: beforeLabel, data: before, borderColor: muted, backgroundColor: "transparent",
                          borderDash: [4, 4], borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: muted });
  return sets;
}

function radarCard(r) {
  return `<div class="card">
    <div class="card-head"><div><h3>Skill Profile</h3><p class="sub">The nine core components at a glance</p></div>
      <div class="legend"><span><i class="swatch" style="background:var(--series-1)"></i>This session</span>
      ${r.baseline ? `<span><i class="dashed"></i>Session start</span>` : ""}</div></div>
    <div class="chart-box radar-box"><canvas id="radarChart" aria-label="Skill profile radar chart"></canvas></div></div>`;
}

const TL_STATUS = { teach: ["Learning", "soft"], retry: ["Retrying", "peach"], correct: ["Correct", ""], mastered: ["Mastered", ""],
  skipped: ["Skipped", "gray"], new: ["Started", "soft"], done: ["Done", ""] };

function timelineCard(r) {
  const steps = (r.timeline || []).filter((t) => t.kind !== "talk" || t.turn === 1);
  if (!steps.length) return "";
  return `<div class="card" style="margin-top:20px">
    <div class="card-head"><div><h3>Session Timeline</h3><p class="sub">What the coach worked on after each of your turns · scroll sideways</p></div>
      <div class="legend"><span><i class="solid"></i>Pronunciation drill</span><span><i class="solid" style="background:var(--peach-bar)"></i>Exercise</span></div></div>
    <div class="timeline">${steps.map((t) => {
      const [label, style] = TL_STATUS[t.status] || ["Conversation", "gray"];
      return `<div class="tl-step tl-${t.kind}"><div class="t">After turn ${t.turn}</div>
        <div class="c">${esc(t.component || "Conversation")}</div><div class="l" title="${esc(t.label)}">${esc(t.label || "open question")}</div>
        <span class="pill ${style}">${label}</span></div>`;
    }).join("")}</div></div>`;
}

const TYPE_ICON = (type) => /pitch|intonation|question|statement|glide|really/i.test(type) ? ICON.wave
  : /pace|chunk|rate|count|metronome/i.test(type) ? ICON.drills[0] : /breath|hum|voice|reson/i.test(type) ? ICON.drills[1]
  : /twister|pair|drill|word|sound/i.test(type) ? ICON.drills[2] : ICON.spark;

function practiceSection(r, num = 3) {
  const exercises = r.exercises || [];
  const comps = [...new Set(exercises.map((e) => e.component))];
  const log = r.exercise_log || [];
  return `${sectionHead(num, "Practice", "Exercises picked for your weak spots. Hear them, or practise them live with the coach.")}
    ${exercises.length ? `<div class="card">
      <div class="card-head"><div><h3>Practice Exercises</h3><p class="sub">${exercises.length} exercises · filter by component</p></div>
        <span class="pill">${exercises.reduce((a, e) => a + (e.minutes || 0), 0)} min / day</span></div>
      <div class="filter-row">${["All", ...comps].map((c, i) =>
        `<button class="filter" data-filter="${esc(c)}" aria-pressed="${i === 0}">${esc(c)}</button>`).join("")}</div>
      <div class="ex-grid">${exercises.map((e, i) => `
        <div class="ex-tile" data-component="${esc(e.component)}">
          <div class="top"><span class="icon-tile ${["mint", "soft", "peach"][i % 3]}">${TYPE_ICON(e.type)}</span>
            <div><h4>${esc(e.title)}</h4><div class="sub">${esc(e.type)}</div></div></div>
          <div class="meta-row"><span class="pill gray">${esc(e.component)}</span><span class="pill gray">${e.minutes} min</span></div>
          <p>${esc(e.instructions)}</p>
          ${e.script ? `<div class="script">“${esc(e.script)}”</div>` : ""}
          <div class="actions">
            ${e.script ? `<button class="btn sm" data-hear="${esc(e.script)}" data-rate="0.8">${ICON.speaker}Hear it</button>` : ""}
            <button class="btn sm primary" data-practise="${esc(`${e.title} (${e.component}): ${e.instructions} ${e.script ? `Script: "${e.script}"` : ""}`)}">${ICON.play}Practise with coach</button>
          </div></div>`).join("")}</div></div>` : ""}
    ${log.length ? `<div class="card" style="margin-top:20px">
      <div class="card-head"><div><h3>Exercises Done This Session</h3><p class="sub">Beyond word drills: pitch, pace, fluency and more</p></div></div>
      <table class="log-table"><thead><tr><th>Component</th><th>Exercise</th><th>Script</th><th>Tries</th><th>Result</th></tr></thead><tbody>
      ${log.map((x) => `<tr><td><span class="pill gray">${esc(x.component)}</span></td><td>${esc(x.type)}</td>
        <td>${x.script ? `“${esc(x.script)}”` : "—"}</td><td>${x.attempts}</td>
        <td><span class="pill ${x.result === "started" ? "soft" : ""}">${{ done: "Done", practised: "Practised" }[x.result] || "Started"}</span></td></tr>`).join("")}
      </tbody></table></div>` : ""}`;
}

function progressTeaser(r, history, num = 4) {
  const n = history.length, first = history[0];
  const change = n > 1 ? r.overall_score - first.overall_score : null;
  return `${sectionHead(num, "Overall Progress", n > 1 ? `Across your ${n} sessions` : "Your starting point")}
    <div class="card teaser"><span class="icon-tile dark">${ICON.chart}</span>
      <p>${esc(r.progress_summary || "")}</p>
      <div class="head-actions">${change != null ? `<span class="pill ${change < 0 ? "peach" : "soft"}">${change < 0 ? ICON.trendDown : ICON.trendUp}${change >= 0 ? "+" : ""}${change.toFixed(1)} since first session</span>` : ""}
        <button class="btn primary sm" id="toProgress">${ICON.chart}Open progress dashboard</button></div></div>`;
}

function bindReportInteractions(r) {
  document.querySelectorAll(".filter").forEach((b) => (b.onclick = () => {
    document.querySelectorAll(".filter").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.querySelectorAll(".ex-tile").forEach((t) => (t.hidden = b.dataset.filter !== "All" && t.dataset.component !== b.dataset.filter));
  }));
  document.querySelectorAll("[data-practise]").forEach((b) => (b.onclick = () => {
    showTab("session");
    if (session.state === "idle" || session.state === "done") startSession(b.dataset.practise);
  }));
  const toProgress = $("#toProgress");
  if (toProgress) toProgress.onclick = () => showTab("progress");
}

async function deleteReport(id) {
  const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
  if (!res.ok) return;
  currentReport = null;
  loadReports();
}

/* ------------------------------------------------ objective metrics, fluency, communication profile */

// [label, value, unit, reference text, status(v) -> [label, style] | null]
function objectiveMetrics(m) {
  const band = (v, lo, hi, low, high, ok = "Typical") => v == null ? null : v < lo ? [low, "peach"] : v > hi ? [high, "peach"] : [ok, ""];
  return [
    ["Articulation rate", m.articulation_rate, "syll/s", "typical 4–6, excluding pauses", (v) => band(v, 3.5, 6.5, "Slow", "Fast")],
    ["Speaking rate", m.avg_wpm ? Math.round(m.avg_wpm) : null, "wpm", "target 140–160, including pauses", (v) => band(v, 140, 160, "Below target", "Above target", "On target")],
    ["Pause frequency", m.pause_per_min, "/min", "silences ≥ 0.25 s inside turns", () => null],
    ["Mean pause", m.mean_pause_ms, "ms", "natural 250–800 ms", (v) => band(v, 0, 1000, "", "Long pauses", "Natural")],
    ["Phonation ratio", m.phonation_ratio != null ? Math.round(m.phonation_ratio * 100) : null, "%", "voiced time / speaking time", (v) => band(v, 60, 100, "Lots of silence", "", "Good flow")],
    ["Pitch range", m.pitch_range_st, "st", "under 4 sounds monotone, 4–10 expressive", (v) => band(v, 4, 12, "Monotone risk", "Very wide", "Expressive")],
    ["Pitch variability", m.pitch_sd_st, "st SD", "F0 standard deviation", () => null],
    ["Loudness variation", m.loudness_sd_db, "dB", "under 2 dB sounds flat", (v) => band(v, 2, 10, "Flat", "Uneven", "Dynamic")],
    ["Filler frequency", m.fillers_per_100w, "/100 words", "under 2 is polished", (v) => band(v, -1, 3, "", "Frequent", "Low")],
    ["Repetition frequency", m.repetitions_per_100w, "/100 words", "under 1 is fluent", (v) => band(v, -1, 2, "", "Frequent", "Low")],
    ["Response latency", m.avg_latency_s, "s", "coach finishing → you starting", (v) => band(v, 0, 2.5, "", "Slow start", "Prompt")],
    ["Target-phrase WER", m.wer != null ? Math.round(m.wer * 100) : null, "%", "word error rate on drills and scripts", (v) => band(v, -1, 20, "", "Needs work", "Accurate")],
  ];
}

function metricsCard(m) {
  const rows = objectiveMetrics(m);
  if (!rows.some(([, v]) => v != null)) return "";
  return `<div class="card" style="margin-bottom:20px">
    <div class="card-head"><div><h3>Objective Measurements</h3><p class="sub">Measured from your recording: timing, pitch and loudness, plus counts from the transcript</p></div>
      <span class="pill gray">${rows.filter(([, v]) => v != null).length} metrics</span></div>
    <div class="metric-grid">${rows.map(([label, v, unit, ref, st]) => {
      const s = v == null ? null : st(v);
      return `<div class="metric"><div class="metric-label">${label}</div>
        <div class="metric-value">${v == null ? "—" : fmt1(v)}<small>${unit}</small></div>
        ${s && s[0] ? `<span class="pill ${s[1]}">${s[0]}</span>` : ""}<div class="metric-ref">${ref}</div></div>`;
    }).join("")}</div></div>`;
}

function fluencyCard(f) {
  if (!f) return "";
  const reps = f.sound_repetitions + f.syllable_repetitions + f.word_repetitions + f.phrase_repetitions;
  const total = reps + f.blocks + f.prolongations;
  return `<div class="card">
    <div class="synth-head"><span class="icon-tile peach">${ICON.wave}</span>
      <div><h3>Fluency Profile</h3><p class="sub">Blocks, prolongations and repetitions across your turns</p></div>
      <span class="pill ${total ? "peach" : ""}" style="margin-left:auto">${total ? `${total} disfluencies` : "Fluent"}</span></div>
    <div class="fluency-stats">
      <div><b>${f.blocks}</b><span>blocks</span></div><div><b>${f.prolongations}</b><span>prolongations</span></div>
      <div><b>${reps}</b><span>repetitions</span></div>
      <div><b>${f.recovery_smoothness == null ? "—" : fmt1(f.recovery_smoothness)}</b><span>recovery /5</span></div></div>
    ${reps ? `<div class="chart-box" style="height:120px;margin-top:12px"><canvas id="repChart" aria-label="Repetitions by type"></canvas></div>` : ""}
    <p class="sub" style="margin-top:10px"><strong>Tension:</strong> ${esc(f.tension)}</p>
    <p class="sub" style="margin-top:4px">${esc(f.notes)}</p></div>`;
}

function profileSection(r) {
  const groups = r.communication_profile || [];
  if (!groups.length) return "";
  const avg = (g) => { const v = g.parameters.map((p) => p.score).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return `${sectionHead(3, "Communication Profile", "Listener impressions: how your delivery comes across. Kept separate from speech mechanics, with no single personality score.")}
    <div class="profile-top">
      <div class="card"><div class="card-head"><div><h3>Profile Overview</h3><p class="sub">Average per group, out of 5</p></div></div>
        <div class="chart-box radar-box"><canvas id="profileRadar" aria-label="Communication profile radar"></canvas></div></div>
      <div class="card"><div class="card-head"><div><h3>Group Scores</h3><p class="sub">Tap a group below for every parameter</p></div></div>
        <div class="group-bars">${groups.map((g) => { const a = avg(g); return `
          <a class="group-bar" href="#pg-${groups.indexOf(g)}"><span class="name">${esc(g.group)}</span>
            <div class="bar${a != null && a < 3 ? " peach" : ""}"><i style="width:${(a || 0) * 20}%"></i></div>
            <span class="num">${a == null ? "N/A" : fmt1(a)}</span></a>`; }).join("")}</div>
        <p class="sub" style="margin-top:12px">Natural pauses, stuttering and accent differences never lower confidence or charisma scores.</p></div>
    </div>
    <div class="profile-grid">${groups.map((g, gi) => { const a = avg(g); return `
      <div class="card profile-card" id="pg-${gi}">
        <div class="card-head"><div><h3>${esc(g.group)}</h3></div><span class="pill ${a != null && a < 3 ? "peach" : a != null && a >= 4 ? "" : "soft"}">${a == null ? "N/A" : `${fmt1(a)} / 5`}</span></div>
        <p class="impression">“${esc(g.impression)}”</p>
        <div class="param-list">${g.parameters.map((p) => `
          <details class="param"><summary><span class="name">${esc(p.parameter)}</span>
            <div class="bar${p.score != null && p.score < 3 ? " peach" : ""}"><i style="width:${(p.score || 0) * 20}%"></i></div>
            <span class="num">${p.score == null ? "N/A" : fmt1(p.score)}</span></summary>
            <p>${esc(p.evidence)}</p></details>`).join("")}</div>
        <div class="skill-tip" style="margin-top:10px">→ ${esc(g.tip)}</div></div>`; }).join("")}</div>`;
}

function renderProfileCharts(r) {
  const groups = r.communication_profile || [];
  if (groups.length && $("#profileRadar")) {
    const vals = groups.map((g) => { const v = g.parameters.map((p) => p.score).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; });
    radarChart($("#profileRadar"), groups.map((g) => g.group.replace(" & ", " &\n").split("\n")), radarSets(vals, null, "This session"));
  }
  const f = r.fluency_profile;
  if (f && $("#repChart")) {
    charts.push(new Chart($("#repChart"), {
      type: "bar",
      data: { labels: ["Sound", "Syllable", "Word", "Phrase"],
              datasets: [{ data: [f.sound_repetitions, f.syllable_repetitions, f.word_repetitions, f.phrase_repetitions],
                           backgroundColor: css("--peach-bar"), borderRadius: 4, borderSkipped: "start", maxBarThickness: 16 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltip({ callbacks: { label: (i) => `${i.raw} repetitions` } }) },
        scales: { x: { beginAtZero: true, ticks: { precision: 0, color: css("--muted") }, grid: { color: css("--axis") }, border: { display: false } },
                  y: { grid: { display: false }, ticks: { color: css("--ink-2") }, border: { color: css("--axis") } } } },
    }));
  }
}

function renderReport(r) {
  const m = r.metrics, turns = r.turns;
  const full = reportsCache.filter((x) => !x.legacy).slice().reverse();          // oldest -> newest
  const idx = full.findIndex((x) => x.id === r.id);
  const history = full.slice(0, idx + 1);
  const prev = idx > 0 ? full[idx - 1] : null;
  const delta = prev ? r.overall_score - prev.overall_score : null;

  const wpm = m.avg_wpm ? Math.round(m.avg_wpm) : null;
  const paceState = wpm == null ? null : wpm > 160 ? ["Above target", "peach"] : wpm < 140 ? ["Below target", "peach"] : ["On target", ""];
  const trackPos = (v) => `${Math.max(0, Math.min(100, ((v - 80) / 140) * 100))}%`;
  const fillersPerMin = m.speaking_s ? m.fillers / (m.speaking_s / 60) : 0;
  const lat = m.avg_latency_s;
  const latState = lat == null ? null : lat <= 1.5 ? ["Prompt turn-taking", false] : lat <= 3 ? ["Considered responses", false] : ["Slow to start", true];
  const overallWord = r.overall_score >= 4.5 ? "Excellent" : r.overall_score >= 4 ? "Strong" : r.overall_score >= 3 ? "Progressing" : "Needs focus";

  const wpmTurns = turns.filter((t) => t.wpm != null);
  const fastest = wpmTurns.reduce((a, b) => (b.wpm > (a?.wpm ?? -1) ? b : a), null);
  const slowest = wpmTurns.reduce((a, b) => (b.wpm < (a?.wpm ?? 1e9) ? b : a), null);

  $("#reportView").innerHTML =
    headerHtml("Session report · Speech &amp; communication", "Speech Assessment",
      `Session completed ${fmtDate(r.created_at)} • ${m.turns} turn${m.turns === 1 ? "" : "s"} • ${Math.round(m.speaking_s)} s of speech analyzed`) + `

    <div class="kpis">
      <div class="card kpi">
        <div class="kpi-top"><span class="kpi-label">Overall score</span>${delta != null ? `<span class="pill ${delta < 0 ? "peach" : "soft"}">${delta < 0 ? ICON.trendDown : ICON.trendUp}${delta >= 0 ? "+" : ""}${delta.toFixed(1)}</span>` : ""}</div>
        <div class="kpi-row"><div><div class="kpi-value">${fmt1(r.overall_score)}<small>/5</small></div>
          <div class="kpi-status">${overallWord}</div></div>${ring(r.overall_score)}</div>
        <div class="kpi-foot">Speech ${fmt1(m.speech_avg)} · Conversation ${fmt1(m.conversation_avg)}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-top"><span class="kpi-label">Cadence &amp; pace</span>${paceState ? `<span class="pill ${paceState[1]}">${paceState[0]}</span>` : ""}</div>
        <div class="kpi-value">${wpm ?? "—"}<small>WPM</small></div>
        <div class="pace-track"><div class="band" style="left:${trackPos(140)};right:${100 - parseFloat(trackPos(160))}%"></div>
          ${wpm ? `<div class="marker" style="left:${trackPos(wpm)}"></div>` : ""}</div>
        <div class="pace-scale"><span>80</span><span>150</span><span>220</span></div>
        <div class="kpi-foot">Target conversational band: 140–160 WPM.</div>
      </div>
      <div class="card kpi">
        <div class="kpi-top"><span class="kpi-label">Fluency</span>${ICON.wave}</div>
        <div class="kpi-value">${m.fillers}<small>fillers</small></div>
        <div class="kpi-status ${fillersPerMin > 4 ? "warn" : ""}">${fillersPerMin.toFixed(1)} per minute</div>
        <div class="kpi-foot ${fillersPerMin > 4 ? "warn" : ""}">${fillersPerMin > 4 ? ICON.alert : ICON.check}
          ${m.pauses} mid-turn pause${m.pauses === 1 ? "" : "s"} of 0.25 s or longer.</div>
      </div>
      <div class="card kpi">
        <div class="kpi-top"><span class="kpi-label">Pronunciation</span>${m.drills_total ? `<span class="pill">${m.drills_mastered}/${m.drills_total} mastered</span>` : `<span class="pill gray">${m.turns} turns</span>`}</div>
        <div class="kpi-value">${m.drills_total ? m.drills_mastered : (lat != null ? lat.toFixed(1) : "—")}<small>${m.drills_total ? "words" : "s"}</small></div>
        ${m.drills_total ? `<div class="kpi-status">mastered with the coach</div>` : latState ? `<div class="kpi-status ${latState[1] ? "warn" : ""}">${latState[0]}</div>` : ""}
        <div class="kpi-foot">${m.drills_total ? `Average response time ${lat != null ? lat.toFixed(1) : "—"} s.` : "Average time from the coach finishing to you starting to speak."}</div>
      </div>
    </div>

    ${sectionHead(1, "Speech", "The nine core components, objective measurements, your focus areas, accent and pronunciation practice")}
    ${metricsCard(m)}
    <div class="report-grid">
      <div class="col">
        ${skillTable("Speech Skill Performance", r.baseline ? "Scored from your audio · tick = your baseline from the first answer" : "Articulation, voice and prosody, scored from your audio",
          r.speech_skills, m.speech_avg, r.baseline)}
        ${drillsCard(r.drills || [])}
        <div class="card">
          <div class="card-head"><div><h3>Speech Rate Contour</h3><p class="sub">Words per minute across your turns</p></div>
            <div class="legend"><span><i class="solid"></i>Your pace</span><span><i class="dashed"></i>Target 150 wpm</span></div></div>
          <div class="chart-panel">
            <div class="chart-panel-head"><span>WPM</span><span>Shaded: 140–160 target band</span></div>
            <div class="chart-box" style="height:220px"><canvas id="paceChart" aria-label="Speech rate per turn"></canvas></div>
            <div class="chart-foot">${fastest ? `Fastest: <strong>Turn ${fastest.n} · ${fastest.wpm} wpm</strong> • Slowest: <strong>Turn ${slowest.n} · ${slowest.wpm} wpm</strong>` : "No speech-rate data for this session."}
              ${paceState ? `<div class="${paceState[1] ? "warn" : "ok"}">Average ${wpm} wpm: ${paceState[0].toLowerCase()}</div>` : ""}</div>
          </div>
        </div>
      </div>
      <div class="col">
        ${radarCard(r)}
        <div class="card">
          <div class="synth-head"><span class="icon-tile dark">${ICON.spark}</span>
            <div><h3>Coach Synthesis</h3><p class="sub">AI speech coach · assessed from your recorded audio</p></div></div>
          <div class="panel synth-notes"><h4>${ICON.notes}Session notes</h4><p>${esc(r.session_summary)}</p>
            <p class="synth-verdict">${esc(r.verdict)}</p></div>
          <ul class="checklist">
            ${r.strengths.map((s) => `<li>${ICON.check}<span>${esc(s)}</span></li>`).join("")}
            ${r.priorities.slice(0, 1).map((p) => `<li class="warn">${ICON.alert}<span>${esc(p.title)}: ${esc(p.problem)}</span></li>`).join("")}
          </ul>
        </div>
        ${focusCard(r.focus_areas)}
        ${accentCard(r)}
        ${fluencyCard(r.fluency_profile)}
      </div>
    </div>

    ${timelineCard(r)}

    ${sectionHead(2, "Conversation", "How you manage the exchange: listening, timing, coherence")}
    <div class="report-grid">
      <div class="col">
        ${skillTable("Conversation Skill Performance", "Pragmatics, turn-taking, discourse and more", r.conversation_skills, m.conversation_avg)}
        <div class="card">
          <div class="card-head"><div><h3>Timing &amp; Voice by Turn</h3><p class="sub">Measured by the app from your audio</p></div></div>
          <div class="minis">
            <div class="mini"><h4>Response time</h4><p class="sub">seconds before you started</p><div class="chart-box"><canvas id="latChart"></canvas></div></div>
            <div class="mini"><h4>Pauses</h4><p class="sub">silences ≥ 0.25 s</p><div class="chart-box"><canvas id="pauseChart"></canvas></div></div>
            <div class="mini"><h4>Filler words</h4><p class="sub">um, uh, like…</p><div class="chart-box"><canvas id="fillerChart"></canvas></div></div>
            ${turns.some((t) => t.pitch_range_st != null) ? `
            <div class="mini"><h4>Pitch range</h4><p class="sub">semitones · under 4 sounds flat</p><div class="chart-box"><canvas id="pitchChart"></canvas></div></div>
            <div class="mini"><h4>Loudness variation</h4><p class="sub">dB · under 2 sounds flat</p><div class="chart-box"><canvas id="loudChart"></canvas></div></div>` : ""}
            ${turns.some((t) => t.articulation_rate != null) ? `
            <div class="mini"><h4>Articulation rate</h4><p class="sub">syllables per second</p><div class="chart-box"><canvas id="artChart"></canvas></div></div>` : ""}
          </div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><div><h3>Practice Plan</h3><p class="sub">Daily exercises before your next session</p></div>
            <span class="pill">${r.priorities.length} drills</span></div>
          <div class="drills">${r.priorities.map((p, i) => {
            const mins = minutesOf(p.exercise);
            return `<div class="drill"><span class="icon-tile ${["mint", "soft", "peach"][i % 3]}">${ICON.drills[i % 3]}</span>
              <div><h4>${esc(p.title)}</h4><p>${esc(p.exercise)}</p>
                <div class="drill-meta">${mins ? `<span class="pill gray">${mins} daily</span>` : ""}<span class="pill gray">Priority ${i + 1}</span></div>
                <details><summary>Why this drill</summary><p>${esc(p.problem)}</p><p><em>Evidence:</em> ${esc(p.evidence)}</p></details>
              </div></div>`;
          }).join("")}</div>
        </div>
        <div class="cta">
          <span class="icon-tile">${ICON.calendar}</span>
          <div><h4>Ready for your next session?</h4><p>Practise the drills, then track your progress here.</p></div>
          <button class="btn light sm" id="ctaStart">Start session</button>
        </div>
      </div>
    </div>

    ${profileSection(r)}

    ${practiceSection(r, (r.communication_profile || []).length ? 4 : 3)}

    ${progressTeaser(r, history, (r.communication_profile || []).length ? 5 : 4)}

    <div class="card" style="margin-top:28px">
      <div class="card-head"><div><h3>Session Transcript</h3><p class="sub">What you said, as the coach heard it, with timing for each turn</p></div></div>
      <div class="transcript">
        ${r.opener ? `<div class="msg"><div class="avatar">AI</div><div class="bubble"><p>${esc(r.opener)}</p></div></div>` : ""}
        ${turns.map((t) => `
          <div class="msg you"><div class="avatar">YOU</div><div class="bubble">
            <div class="turn-label">Turn ${t.n}</div><p>${esc(t.transcript) || "<span class='sub'>(no transcript)</span>"}</p>
            <div class="chips" style="margin-top:8px">${[`${t.span_s.toFixed(1)} s`, t.wpm ? `${t.wpm} wpm` : null,
              `${t.pauses.length} pauses`, t.fillers != null ? `${t.fillers} fillers` : null, `replied after ${t.latency_s.toFixed(1)} s`,
              t.pitch_range_st != null ? `pitch range ${fmt1(t.pitch_range_st)} st` : null,
              t.wer != null ? `target WER ${Math.round(t.wer * 100)}%` : null]
              .filter(Boolean).map((c) => `<span class="chip">${c}</span>`).join("")}</div>
            ${t.target ? `<div class="note">Target: “${esc(t.target)}”</div>` : ""}
            ${t.note ? `<div class="note">${esc(t.note)}</div>` : ""}</div></div>
          ${t.coach ? `<div class="msg"><div class="avatar">AI</div><div class="bubble"><p>${esc(t.coach)}</p></div></div>` : ""}`).join("")}
      </div>
    </div>`;

  $("#ctaStart").onclick = () => { showTab("session"); if (session.state === "idle" || session.state === "done") startSession(); };

  const labels = turns.map((t) => `T${t.n}`);
  paceChart($("#paceChart"), turns);
  miniBar($("#latChart"), labels, turns.map((t) => t.latency_s), " s", 2);
  miniBar($("#pauseChart"), labels, turns.map((t) => t.pauses.length), " pauses", 3);
  miniBar($("#fillerChart"), labels, turns.map((t) => t.fillers), " fillers", 3);
  if ($("#pitchChart")) miniBar($("#pitchChart"), labels, turns.map((t) => t.pitch_range_st ?? null), " semitones", 8);
  if ($("#loudChart")) miniBar($("#loudChart"), labels, turns.map((t) => t.loudness_sd_db ?? null), " dB", 4);
  if ($("#artChart")) miniBar($("#artChart"), labels, turns.map((t) => t.articulation_rate ?? null), " syll/s", 6);
  renderProfileCharts(r);
  const speechNames = r.speech_skills.map((c) => c.component);
  radarChart($("#radarChart"), speechNames, radarSets(r.speech_skills.map((c) => c.score),
    r.baseline ? speechNames.map((c) => r.baseline[c]?.score ?? null) : null, "This session", "Session start"));
  bindReportInteractions(r);
}

/* =============================================================== progress tab */

const progressCharts = [];
const SPEECH = ["Phonetics", "Phonology", "Articulation", "Prosody", "Fluency", "Speech rate", "Voice quality", "Intonation", "Resonance"];
const FOCUS = ["Stuttering", "Lisp", "Charisma", "Accent", "Fast speech", "Listening", "Over-explanation", "Precise speech"];
const PROFILE = ["Clarity & intelligibility", "Vocal confidence & authority", "Charisma & vocal presence",
  "Positivity & emotional tone", "Conversational intelligence", "Communication style"];
const CONVERSATION = ["Pragmatics", "Turn-taking", "Discourse", "Active listening", "Conversational repair", "Pauses & timing",
  "Non-verbal communication", "Paralinguistics", "Semantic processing", "Conversational coherence"];

async function loadProgress() {
  const res = await fetch("/api/progress");
  const data = await res.json();
  while (progressCharts.length) progressCharts.pop().destroy();
  renderProgressTab(data);
}

function sparkline(history) {
  if (!history || history.length < 2) return `<svg class="spark"></svg>`;
  const w = 90, h = 26, pad = 3;
  const pts = history.map((p, i) => [pad + (i / (history.length - 1)) * (w - 2 * pad), h - pad - ((p.score - 1) / 4) * (h - 2 * pad)]);
  const down = history[history.length - 1].score < history[0].score;
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="spark ${down ? "down" : ""}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/><circle cx="${lx}" cy="${ly}" r="2.6"/></svg>`;
}

function heatColor(score) {
  const p = Math.round(12 + ((score - 1) / 4) * 80);
  return { bg: `color-mix(in srgb, var(--teal) ${p}%, var(--surface))`, fg: p > 55 ? "var(--primary-ink)" : "var(--ink)" };
}

function heatmap(sessions) {
  const groups = [["Speech", SPEECH], ["Focus areas", FOCUS], ["Conversation", CONVERSATION], ["Communication profile", PROFILE]]
    .filter(([, comps]) => comps.some((c) => sessions.some((s) => s.scores?.[c] != null)));
  const labels = sessionLabels(sessions);
  return `<div class="heatmap-wrap"><table class="heatmap">
    <thead><tr><th></th>${labels.map((l) => `<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>
    ${groups.map(([g, comps]) => `<tr class="group"><th colspan="${sessions.length + 1}">${g}</th></tr>` + comps.map((c) =>
      `<tr><th>${esc(c)}</th>${sessions.map((s) => {
        const v = s.scores?.[c];
        if (v == null) return `<td class="na" title="${esc(c)}: not assessed">–</td>`;
        const { bg, fg } = heatColor(v);
        return `<td style="background:${bg};color:${fg}" title="${esc(c)}: ${fmt1(v)}/5">${fmt1(v)}</td>`;
      }).join("")}</tr>`).join("")).join("")}
    </tbody></table></div>
    <div class="heat-legend"><span>Score</span><span>1</span><span class="ramp">${[1, 2, 3, 4, 5].map((v) => `<i style="background:${heatColor(v).bg}"></i>`).join("")}</span><span>5</span>
      <span class="pill gray" style="margin-left:8px">– not assessed</span></div>`;
}

function trendList(items, components, emptyText) {
  if (!items.length) return `<p class="sub">${emptyText}</p>`;
  return `<div class="trend-list">${items.map((it) => {
    const c = components[it.component] || {};
    const d = c.trend ?? 0;
    return `<div class="trend-row"><div><div class="name">${esc(it.component)}</div>
        <div class="sub">now ${fmt1(c.ema)}/5 · ${c.sessions} session${c.sessions === 1 ? "" : "s"}</div></div>
      ${sparkline(c.history)}
      <span class="chg ${d > 0 ? "up" : d < 0 ? "down" : "flat"}">${d > 0 ? "+" : ""}${d === 0 ? "±0" : fmt1(d)}</span></div>`;
  }).join("")}</div>`;
}

function renderProgressTab({ memory, sessions }) {
  const view = $("#progressView");
  if (!sessions.length) {
    view.innerHTML = `<div class="card empty"><span class="icon-tile mint">${ICON.chart}</span><h3>No progress yet</h3>
      <p>Finish a session with “give me my report”. Your progress across sessions will build up here.</p>
      <button class="btn primary" id="progressStart">${ICON.play}Start a session</button></div>`;
    $("#progressStart").onclick = () => showTab("session");
    return;
  }
  const first = sessions[0], last = sessions[sessions.length - 1], n = sessions.length;
  const change = n > 1 ? last.overall_score - first.overall_score : null;
  const t = memory.totals, comps = memory.components;
  const speaking = t.speaking_s;
  const latestSummary = last.progress_summary;
  const accent = { yes: ["Working on a neutral accent", ""], no: ["Declined accent work", "gray"] }[memory.accent_opt_in] || ["Accent not discussed yet", "gray"];
  const needs = Object.entries(comps).filter(([, c]) => (c.group !== "conversation" || c.ema < 3) && c.trend < 1)
    .sort((a, b) => b[1].priority - a[1].priority).slice(0, 6).map(([component]) => ({ component }));
  const improving = Object.entries(comps).filter(([, c]) => c.trend > 0)
    .sort((a, b) => b[1].trend - a[1].trend).slice(0, 6).map(([component]) => ({ component }));

  view.innerHTML = `
    <div class="page-head"><div><div class="eyebrow"><i class="dot"></i>Overall progress · all sessions</div>
      <h1>Your Progress</h1>
      <p class="meta">${n} session${n === 1 ? "" : "s"} since ${fmtDate(first.created_at, false)} • last session ${fmtDate(last.created_at)}</p></div>
      <div class="head-actions"><button class="btn primary" id="progressPractise">${ICON.play}Practise my weak spots</button></div></div>

    <div class="kpis">
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Current level</span>${change != null ? `<span class="pill ${change < 0 ? "peach" : "soft"}">${change < 0 ? ICON.trendDown : ICON.trendUp}${change >= 0 ? "+" : ""}${change.toFixed(1)}</span>` : ""}</div>
        <div class="kpi-row"><div><div class="kpi-value">${fmt1(last.overall_score)}<small>/5</small></div>
          <div class="kpi-status">${change == null ? "Baseline" : change > 0 ? "Improving" : change < 0 ? "Slipped a little" : "Holding steady"}</div></div>${ring(last.overall_score)}</div>
        <div class="kpi-foot">First session: ${fmt1(first.overall_score)}/5</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Sessions</span>${ICON.wave}</div>
        <div class="kpi-value">${n}</div><div class="kpi-status">${t.practice_days} practice day${t.practice_days === 1 ? "" : "s"}</div>
        <div class="kpi-foot">${speaking >= 60 ? `${Math.floor(speaking / 60)} min ${Math.round(speaking % 60)} s` : `${Math.round(speaking)} s`} of your speech analyzed</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Words mastered</span><span class="pill">${ICON.checkSmall}${t.words_mastered}</span></div>
        <div class="kpi-value">${t.words_mastered}</div><div class="kpi-status ${memory.words_to_review.length ? "warn" : ""}">${memory.words_to_review.length} still to master</div>
        <div class="kpi-foot">The coach reviews unmastered words first.</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Top focus now</span></div>
        <div class="kpi-value" style="font-size:24px">${esc(memory.weaknesses[0]?.component || "—")}</div>
        <div class="kpi-status warn">${memory.weaknesses[0] ? `${fmt1(memory.weaknesses[0].ema)}/5` : ""}</div>
        <div class="kpi-foot">${memory.weaknesses.slice(1, 3).map((w) => esc(w.component)).join(" · ") || "No weak spots recorded"}</div></div>
    </div>

    <div class="two">
      <div class="card narrative"><span class="icon-tile dark">${ICON.spark}</span>
        <div><h3 style="font-size:17px;margin-bottom:6px">Coach's take</h3><p>${esc(latestSummary || "Complete more sessions to see how you're progressing.")}</p></div></div>
      <div class="card">
        <div class="synth-head"><span class="icon-tile mint">${ICON.notes}</span>
          <div><h3>What the coach remembers</h3><p class="sub">Used to plan every new session · rebuilt from your reports</p></div></div>
        <div class="memory-list">
          <div><div class="row-label">Accent</div><span class="pill ${accent[1]}">${accent[0]}</span></div>
          <div><div class="row-label">Weak spots</div><div class="chip-row">${memory.weaknesses.map((w) => `<span class="pill peach">${esc(w.component)} ${fmt1(w.ema)}</span>`).join("") || `<span class="sub">none yet</span>`}</div></div>
          <div><div class="row-label">Strengths</div><div class="chip-row">${memory.strengths.map((w) => `<span class="pill">${esc(w.component)} ${fmt1(w.ema)}</span>`).join("") || `<span class="sub">none yet</span>`}</div></div>
          <div><div class="row-label">Words to master</div><div class="chip-row">${memory.words_to_review.map((w) => wordChip(w.target, "review")).join("") || `<span class="sub">none, nice!</span>`}</div></div>
        </div></div>
    </div>

    <div class="two">
      <div class="card"><div class="card-head"><div><h3>Scores Over Time</h3><p class="sub">Averages out of 5, per session</p></div>
          <div class="legend"><span><i class="swatch" style="background:var(--series-1)"></i>Overall</span>
            <span><i class="swatch" style="background:var(--series-2)"></i>Speech</span>
            <span><i class="swatch" style="background:var(--series-3)"></i>Conversation</span></div></div>
        <div class="chart-panel"><div class="chart-box" style="height:240px"><canvas id="pScores"></canvas></div></div></div>
      <div class="card"><div class="card-head"><div><h3>Skill Profile</h3><p class="sub">Core components: first session vs latest</p></div>
          <div class="legend"><span><i class="swatch" style="background:var(--series-1)"></i>Latest</span>${n > 1 ? `<span><i class="dashed"></i>First</span>` : ""}</div></div>
        <div class="chart-box radar-box"><canvas id="pRadar"></canvas></div></div>
    </div>

    <div class="two">
      <div class="card"><div class="card-head"><div><h3>Improving</h3><p class="sub">Biggest gains since your first session</p></div><span class="pill soft">${ICON.trendUp}${improving.length}</span></div>
        ${trendList(improving, comps, n > 1 ? "No gains yet. Keep practising!" : "Trends appear after your second session.")}</div>
      <div class="card"><div class="card-head"><div><h3>Needs More Focus</h3><p class="sub">Lowest recent scores, and anything slipping</p></div><span class="pill peach">${needs.length}</span></div>
        ${trendList(needs, comps, "Nothing flagged.")}</div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-head"><div><h3>Component Heatmap</h3><p class="sub">Every component, every session: darker is stronger</p></div></div>
      ${heatmap(sessions)}</div>

    <div class="two">
      <div class="card"><div class="card-head"><div><h3>Speech Rate by Session</h3><p class="sub">Average words per minute · shaded 140–160 target</p></div></div>
        <div class="chart-panel"><div class="chart-box" style="height:200px"><canvas id="pWpm"></canvas></div></div></div>
      <div class="card"><div class="card-head"><div><h3>Fillers & Mastered Words</h3><p class="sub">Filler words per minute, and words mastered, per session</p></div></div>
        <div class="minis" style="grid-template-columns:1fr 1fr">
          <div class="mini"><h4>Fillers / min</h4><div class="chart-box" style="height:150px"><canvas id="pFillers"></canvas></div></div>
          <div class="mini"><h4>Words mastered</h4><div class="chart-box" style="height:150px"><canvas id="pWords"></canvas></div></div>
        </div></div>
    </div>

    ${sessions.some((s) => s.metrics.pitch_range_st != null || s.metrics.articulation_rate != null) ? `
    <div class="card" style="margin-bottom:20px"><div class="card-head"><div><h3>Objective Voice Metrics</h3><p class="sub">Measured from your recordings, per session</p></div></div>
      <div class="minis" style="grid-template-columns:repeat(4, minmax(0, 1fr))">
        <div class="mini"><h4>Pitch range</h4><p class="sub">semitones · 4–10 expressive</p><div class="chart-box"><canvas id="pPitch"></canvas></div></div>
        <div class="mini"><h4>Articulation rate</h4><p class="sub">syllables / s · 4–6 typical</p><div class="chart-box"><canvas id="pArt"></canvas></div></div>
        <div class="mini"><h4>Phonation ratio</h4><p class="sub">% of turn voiced</p><div class="chart-box"><canvas id="pPhon"></canvas></div></div>
        <div class="mini"><h4>Fillers per 100 words</h4><p class="sub">under 2 is polished</p><div class="chart-box"><canvas id="pF100"></canvas></div></div>
      </div></div>` : ""}

    ${memory.words_mastered.length ? `<div class="card"><div class="card-head"><div><h3>Your Mastered Words</h3><p class="sub">Tap a word to hear it</p></div></div>
      <div class="chip-row">${memory.words_mastered.map((w) => wordChip(w.target)).join("")}</div></div>` : ""}`;

  const labels = sessionLabels(sessions);
  const line = (canvas, datasets, yOpts, plugins = []) => progressCharts.push(new Chart(canvas, {
    type: "line", data: { labels, datasets },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: tooltip({ displayColors: datasets.length > 1 }) },
      scales: { x: { grid: { display: false }, border: { color: css("--axis") }, ticks: { color: css("--muted"), maxTicksLimit: 6 } },
                y: { grid: { color: css("--axis"), drawTicks: false }, border: { display: false }, ticks: { color: css("--muted"), padding: 6, maxTicksLimit: 6 }, ...yOpts } } },
    plugins,
  }));
  const ds = (label, data, color) => ({ label, data, borderColor: css(color), backgroundColor: css(color), borderWidth: 2,
    pointRadius: 3.5, pointHoverRadius: 5, tension: 0.35, spanGaps: true, pointBorderColor: css("--surface"), pointBorderWidth: 1.5 });
  line($("#pScores"), [ds("Overall", sessions.map((s) => s.overall_score), "--series-1"),
    ds("Speech", sessions.map((s) => s.metrics.speech_avg), "--series-2"),
    ds("Conversation", sessions.map((s) => s.metrics.conversation_avg), "--series-3")], { min: 0, max: 5 });
  const band = { id: "band", beforeDatasetsDraw(chart) {
    const { ctx, chartArea: a, scales } = chart;
    const top = scales.y.getPixelForValue(160), bottom = scales.y.getPixelForValue(140);
    ctx.save(); ctx.fillStyle = css("--mint"); ctx.globalAlpha = 0.35; ctx.fillRect(a.left, top, a.right - a.left, bottom - top); ctx.restore();
  } };
  line($("#pWpm"), [ds("WPM", sessions.map((s) => s.metrics.avg_wpm ? Math.round(s.metrics.avg_wpm) : null), "--series-1")],
    { suggestedMin: 100, suggestedMax: 200 }, [band]);
  const bar = (canvas, data, suffix) => progressCharts.push(new Chart(canvas, {
    type: "bar", data: { labels, datasets: [{ data, backgroundColor: css("--teal"), borderRadius: 4, borderSkipped: "start", maxBarThickness: 22 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
      tooltip: tooltip({ callbacks: { label: (i) => `${i.raw}${suffix}` } }) }, scales: axes({ yMax: 3 }) },
  }));
  bar($("#pFillers"), sessions.map((s) => s.metrics.speaking_s ? +(s.metrics.fillers / (s.metrics.speaking_s / 60)).toFixed(1) : 0), " per min");
  bar($("#pWords"), sessions.map((s) => s.metrics.drills_mastered || 0), " words");
  if ($("#pPitch")) {
    bar($("#pPitch"), sessions.map((s) => s.metrics.pitch_range_st ?? null), " semitones");
    bar($("#pArt"), sessions.map((s) => s.metrics.articulation_rate ?? null), " syll/s");
    bar($("#pPhon"), sessions.map((s) => (s.metrics.phonation_ratio != null ? Math.round(s.metrics.phonation_ratio * 100) : null)), "%");
    bar($("#pF100"), sessions.map((s) => s.metrics.fillers_per_100w ?? null), " per 100 words");
  }
  const radarCanvas = $("#pRadar");
  const before = charts.length;
  radarChart(radarCanvas, SPEECH, radarSets(SPEECH.map((c) => last.scores[c] ?? null),
    n > 1 ? SPEECH.map((c) => first.scores[c] ?? null) : null, "Latest", "First"));
  progressCharts.push(...charts.splice(before));

  $("#progressPractise").onclick = () => {
    const focus = [...memory.weaknesses.slice(0, 3).map((w) => w.component), ...memory.words_to_review.slice(-3).map((w) => `the word "${w.target}"`)].join(", ");
    showTab("session");
    if (session.state === "idle" || session.state === "done") startSession(focus || null);
  };
}

// Re-draw charts with the right colours when the OS switches light/dark.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!$("#tab-reports").hidden && currentReport) openReport(currentReport);
  if (!$("#tab-progress").hidden) loadProgress();
});

if (location.hash === "#reports") showTab("reports");
if (location.hash === "#progress") showTab("progress");
