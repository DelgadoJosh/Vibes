"use strict";

// ---------- data ----------

const WORD_LIST = ("the be of and a to in he have it that for they with as not on she at by this we you do but " +
  "from or which one would all will there say who make when can more if no man out other so what time up go " +
  "about than into could state only new year some take come these know see use get like then first any work " +
  "now may such give over think most even find day also after way many must look before great back through " +
  "long where much should well people down own just because good each those feel seem how high too place " +
  "little world very still nation hand old life tell write become here show house both between need mean " +
  "call develop under last right move thing general school never same another begin while number part turn " +
  "real leave might want point form off child few small since against ask late home interest large person " +
  "end open public follow during present without again hold govern around possible head consider word " +
  "program problem however lead system set order eye plan run keep face fact group play stand increase early " +
  "course change help line").split(" ");

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

// [code, label, shifted label, width in key units]; rows add up to 15 units
const LAYOUT = [
  [["Backquote", "`", "~"], ["Digit1", "1", "!"], ["Digit2", "2", "@"], ["Digit3", "3", "#"], ["Digit4", "4", "$"],
   ["Digit5", "5", "%"], ["Digit6", "6", "^"], ["Digit7", "7", "&"], ["Digit8", "8", "*"], ["Digit9", "9", "("],
   ["Digit0", "0", ")"], ["Minus", "-", "_"], ["Equal", "=", "+"], ["Backspace", IS_MAC ? "delete" : "backspace", null, 2]],
  [["Tab", "tab", null, 1.5], ..."qwertyuiop".split("").map(letter), ["BracketLeft", "[", "{"], ["BracketRight", "]", "}"],
   ["Backslash", "\\", "|", 1.5]],
  [["CapsLock", "caps", null, 1.75], ..."asdfghjkl".split("").map(letter), ["Semicolon", ";", ":"], ["Quote", "'", "\""],
   ["Enter", IS_MAC ? "return" : "enter", null, 2.25]],
  [["ShiftLeft", "shift", null, 2.25], ..."zxcvbnm".split("").map(letter), ["Comma", ",", "<"], ["Period", ".", ">"],
   ["Slash", "/", "?"], ["ShiftRight", "shift", null, 2.75]],
  [["ControlLeft", "ctrl", null, 1.25], ["AltLeft", IS_MAC ? "opt" : "alt", null, 1.25],
   ["MetaLeft", IS_MAC ? "cmd" : "win", null, 1.25], ["Space", "", null, 7.5],
   ["MetaRight", IS_MAC ? "cmd" : "win", null, 1.25], ["AltRight", IS_MAC ? "opt" : "alt", null, 1.25],
   ["ControlRight", "ctrl", null, 1.25]],
];
function letter(c) { return ["Key" + c.toUpperCase(), c, c.toUpperCase(), 1, true]; }

// ---------- elements ----------

const $ = id => document.getElementById(id);
const wordsEl = $("words"), wl = $("wl"), caret = $("caret"), kb = $("keyboard");
const keyEls = new Map();

function buildKeyboard() {
  for (const row of LAYOUT) {
    const r = document.createElement("div");
    r.className = "row";
    for (const [code, label, shifted, u = 1, isLetter] of row) {
      const k = document.createElement("div");
      k.className = "key" + (shifted === null ? " mod" : "");
      k.style.setProperty("--u", u);
      if (isLetter) k.innerHTML = `<span class="lo">${label}</span><span class="hi">${shifted}</span>`;
      else if (shifted) k.innerHTML = `<span class="alt">${esc(shifted)}</span><span>${esc(label)}</span>`;
      else k.textContent = label;
      r.appendChild(k);
      keyEls.set(code, k);
    }
    kb.appendChild(r);
  }
}

// keys: Map code -> wasWrong
function paintKeys(keys) {
  for (const [code, el] of keyEls) {
    const down = keys.has(code);
    el.classList.toggle("down", down);
    el.classList.toggle("bad", down && keys.get(code) === true);
  }
  kb.classList.toggle("shifted", keys.has("ShiftLeft") || keys.has("ShiftRight"));
}

function esc(s) {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
}

// ---------- typing engine (shared by live tests and replays) ----------

function newState(words, endOnLast) {
  return { words, typed: [""], wi: 0, keys: 0, goodKeys: 0, done: false, endOnLast };
}

// Applies one key to the state. Returns true/false for a right/wrong keystroke, null if it wasn't one.
function applyKey(s, k, wordMod) {
  const word = s.words[s.wi], cur = s.typed[s.wi];
  if (k === "Backspace") {
    if (cur.length) s.typed[s.wi] = wordMod ? "" : cur.slice(0, -1);
    else if (s.wi > 0 && s.typed[s.wi - 1] !== s.words[s.wi - 1]) {
      s.typed.pop();
      s.wi--;
      if (wordMod) s.typed[s.wi] = "";
    }
    return null;
  }
  if (k === " ") {
    if (!cur.length) return null;
    const ok = cur === word;
    s.keys++;
    if (ok) s.goodKeys++;
    s.wi++;
    s.typed.push("");
    if (s.wi >= s.words.length) s.done = true;
    return ok;
  }
  if (!k || k.length !== 1 || cur.length >= word.length + 8) return null;
  const ok = word[cur.length] === k;
  s.keys++;
  if (ok) s.goodKeys++;
  s.typed[s.wi] = cur + k;
  if (s.endOnLast && s.wi === s.words.length - 1 && s.typed[s.wi] === word) s.done = true;
  return ok;
}

function stats(s, ms) {
  let correct = 0, incorrect = 0, extra = 0, missed = 0, all = 0, wpmChars = 0;
  for (let i = 0; i <= s.wi && i < s.words.length; i++) {
    const w = s.words[i], t = s.typed[i] || "", past = i < s.wi;
    for (let j = 0; j < Math.max(w.length, t.length); j++) {
      if (j >= t.length) { if (past) missed++; }
      else if (j >= w.length) extra++;
      else if (t[j] === w[j]) correct++;
      else incorrect++;
    }
    all += t.length + (past ? 1 : 0);
    if (past && t === w) wpmChars += w.length + 1;
    if (!past && t && w.startsWith(t)) wpmChars += t.length;
  }
  const min = ms / 60000;
  return {
    wpm: min > 0 ? wpmChars / 5 / min : 0,
    raw: min > 0 ? all / 5 / min : 0,
    acc: s.keys ? s.goodKeys / s.keys * 100 : 100,
    correct, incorrect, extra, missed,
  };
}

// ---------- rendering the words ----------

function renderWords(s, idle) {
  let html = "";
  for (let i = 0; i < s.words.length; i++) {
    const w = s.words[i], t = s.typed[i];
    let inner = "";
    for (let j = 0; j < w.length; j++) {
      const c = t === undefined || j >= t.length ? "" : t[j] === w[j] ? "c" : "x";
      inner += c ? `<span class="${c}">${w[j]}</span>` : `<span>${w[j]}</span>`;
    }
    if (t) for (let j = w.length; j < t.length; j++) inner += `<span class="e">${esc(t[j])}</span>`;
    html += `<div class="word${i < s.wi && t !== w ? " err" : ""}">${inner}</div>`;
  }
  wl.innerHTML = html;

  const wEl = wl.children[Math.min(s.wi, s.words.length - 1)];
  if (!wEl) return;
  const t = s.wi < s.words.length ? s.typed[s.wi] : s.words[s.words.length - 1];
  const letters = wEl.children;
  let x;
  if (t.length < letters.length) x = letters[t.length].offsetLeft;
  else { const l = letters[letters.length - 1]; x = l.offsetLeft + l.offsetWidth; }
  const lineTop = wEl.offsetTop, lineH = wEl.offsetHeight;
  caret.style.left = x + "px";
  caret.style.top = lineTop + (lineH - caret.offsetHeight) / 2 + "px";
  caret.classList.toggle("idle", !!idle);
  wordsEl.style.transform = `translateY(${-Math.max(0, lineTop - lineH)}px)`;
}

// ---------- settings ----------

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } // blocked or full
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* storage blocked */ }
}

let config = load("tr-config", { mode: "time", amount: 30 });

function paintModes() {
  for (const g of document.querySelectorAll("#modes .group")) {
    const active = g.dataset.mode === config.mode;
    g.querySelector(".mode-kind").classList.toggle("on", active);
    for (const b of g.querySelectorAll("[data-amount]")) b.classList.toggle("on", active && +b.dataset.amount === config.amount);
  }
}

$("modes").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const mode = b.closest(".group").dataset.mode;
  const amount = b.dataset.amount ? +b.dataset.amount : (mode === config.mode ? config.amount : mode === "time" ? 30 : 25);
  config = { mode, amount };
  save("tr-config", config);
  paintModes();
  newTest();
  b.blur();
});

// ---------- views ----------

let view = "test";

function show(v) {
  view = v;
  $("stage").hidden = v === "results" || v === "stats";
  $("results").hidden = v !== "results";
  $("stats").hidden = v !== "stats";
  for (const b of $("views").children) b.classList.toggle("on", b.dataset.view === (v === "stats" || v === "replay" && rp.back === "stats" ? "stats" : "test"));
  $("replay-bar").hidden = v !== "replay";
  $("replay-tag").hidden = v !== "replay";
  $("hint-replay").hidden = v !== "replay";
  $("modes").style.visibility = v === "test" ? "" : "hidden";
}

// ---------- live test ----------

const held = new Map(); // physical keys down right now -> wasWrong
let test;

function randomWords(n, prev) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let w;
    do w = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]; while (w === (out[i - 1] ?? prev));
    out.push(w);
  }
  return out;
}

function newTest() {
  const timed = config.mode === "time";
  test = {
    mode: config.mode, amount: config.amount,
    state: newState(randomWords(timed ? 100 : config.amount), !timed),
    start: null, events: [], tick: null,
  };
  rp.playing = false;
  show("test");
  paintLive(0);
  renderWords(test.state, true);
  paintKeys(held);
}

function elapsed() { return test.start === null ? 0 : performance.now() - test.start; }

function paintLive(ms, s = test.state, mode = test.mode, amount = test.amount) {
  $("live-progress").textContent = mode === "time"
    ? Math.max(0, Math.ceil(amount - ms / 1000))
    : `${Math.min(s.wi, s.words.length)}/${s.words.length}`;
  $("live-wpm").textContent = ms > 0 ? Math.round(stats(s, ms).wpm) + " wpm" : "";
}

function finish(endMs) {
  clearInterval(test.tick);
  const s = test.state;
  const rec = {
    mode: test.mode, amount: test.amount,
    words: s.words.slice(0, s.wi + 30),
    events: test.events.filter(e => e.t <= endMs),
    duration: endMs,
  };
  const prevBest = leaderboard(modeKey(rec))[0]?.wpm ?? 0;
  const { r, samples } = analyze(rec);
  const run = s.keys ? saveRun(rec, r) : null;
  showResults(rec, r, samples, run, prevBest);
}

function isTypingKey(e) {
  if (e.key === "Backspace") return true;
  return e.key.length === 1 && !e.metaKey && !(e.ctrlKey && !e.altKey);
}

document.addEventListener("keydown", e => {
  if (e.key === "Tab") { e.preventDefault(); newTest(); return; }

  if (view === "replay") {
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "Escape") closeReplay();
    else if (e.key === "ArrowLeft") rpSeek(Math.max(0, rp.t - 1000));
    else if (e.key === "ArrowRight") rpSeek(Math.min(rp.rec.duration, rp.t + 1000));
    return;
  }
  if (view !== "test" || test.state.done) return;

  const typing = isTypingKey(e);
  if (typing) e.preventDefault();

  if (test.start === null && typing && e.key !== " " && e.key !== "Backspace") {
    test.start = performance.now();
    for (const code of held.keys()) test.events.push({ t: 0, d: 1, c: e.code === code ? "" : code, k: "" });
    test.events = test.events.filter(ev => ev.c);
    test.tick = setInterval(() => {
      const ms = elapsed();
      if (test.mode === "time" && ms >= test.amount * 1000) finish(test.amount * 1000);
      else paintLive(ms);
    }, 100);
  }

  const k = typing ? e.key : "";
  const wordMod = e.altKey || e.ctrlKey || e.metaKey;
  const ok = k ? applyKey(test.state, k, wordMod) : null;
  held.set(e.code, ok === false);
  paintKeys(held);

  if (test.start === null) return;
  const t = elapsed();
  test.events.push({ t, d: 1, c: e.code, k, m: wordMod ? 1 : 0 });

  const s = test.state;
  if (test.mode === "time" && s.wi > s.words.length - 30) s.words.push(...randomWords(50, s.words[s.words.length - 1]));
  renderWords(s, false);
  paintLive(t);
  if (s.done) finish(t);
});

document.addEventListener("keyup", e => {
  held.delete(e.code);
  if (view === "test") {
    paintKeys(held);
    if (test.start !== null && !test.state.done) test.events.push({ t: elapsed(), d: 0, c: e.code });
  }
});

window.addEventListener("blur", () => {
  held.clear();
  if (view === "test") paintKeys(held);
  $("focus-hint").hidden = false;
  wordsEl.classList.add("blur");
});
window.addEventListener("focus", () => {
  $("focus-hint").hidden = true;
  wordsEl.classList.remove("blur");
});

// ---------- results ----------

// Rebuilds the test up to untilMs. Keys pressed after flashFrom stay lit even if already released,
// so presses shorter than a frame still show during playback.
function simulate(rec, untilMs, onSecond, flashFrom = untilMs) {
  const s = newState(rec.words.slice(), rec.mode === "words");
  const keys = new Map(), flash = new Map();
  let errorsThisSecond = 0, nextSecond = 1000;
  for (const ev of rec.events) {
    if (ev.t > untilMs) break;
    while (onSecond && ev.t > nextSecond) {
      onSecond(nextSecond, s, errorsThisSecond);
      errorsThisSecond = 0;
      nextSecond += 1000;
    }
    if (ev.d) {
      const ok = ev.k ? applyKey(s, ev.k, !!ev.m) : null;
      if (ok === false) errorsThisSecond++;
      keys.set(ev.c, ok === false);
      if (ev.t > flashFrom) flash.set(ev.c, ok === false);
    } else keys.delete(ev.c);
  }
  if (onSecond) {
    while (nextSecond < untilMs) { onSecond(nextSecond, s, errorsThisSecond); errorsThisSecond = 0; nextSecond += 1000; }
    onSecond(untilMs, s, errorsThisSecond);
  }
  for (const [c, bad] of flash) if (!keys.has(c)) keys.set(c, bad);
  return { s, keys };
}

function analyze(rec) {
  const samples = [];
  const { s } = simulate(rec, rec.duration, (ms, st, errors) => {
    const r = stats(st, ms);
    samples.push({ sec: ms / 1000, wpm: r.wpm, raw: r.raw, errors });
  });
  return { r: stats(s, rec.duration), samples };
}

let lastRecording;

// prevBest is given for a test just finished, and left out when opening a saved one
function showResults(rec, r, samples, run, prevBest) {
  lastRecording = rec;
  const wpm = Math.round(r.wpm);
  const rank = run ? leaderboard(modeKey(run)).findIndex(x => x.id === run.id) + 1 : 0;
  let rankText = rank ? `#${rank}` : "-";
  if (prevBest !== undefined && rank === 1) rankText += prevBest ? " new best!" : " first run";
  if (prevBest === undefined && run) rankText += " · " + fmtDate(run.at);

  $("r-wpm").textContent = wpm;
  $("r-acc").textContent = Math.round(r.acc) + "%";
  $("r-mode").textContent = `${rec.mode} ${rec.amount}`;
  $("r-raw").textContent = Math.round(r.raw);
  $("r-chars").textContent = `${r.correct}/${r.incorrect}/${r.extra}/${r.missed}`;
  $("r-time").textContent = (rec.duration / 1000).toFixed(1) + "s";
  $("r-best").textContent = rankText;
  $("btn-replay").disabled = !rec.events.length;
  drawChart(samples);
  show("results");
}

function drawChart(samples) {
  const W = 600, H = 180, L = 32, B = 20, T = 8;
  const end = samples.length ? samples[samples.length - 1].sec : 1;
  const top = Math.max(20, Math.ceil(Math.max(...samples.map(p => Math.max(p.wpm, p.raw)), 0) / 20) * 20);
  const x = sec => L + (sec / end) * (W - L - 4);
  const y = v => T + (1 - v / top) * (H - T - B);
  const line = key => samples.map((p, i) => `${i ? "L" : "M"}${x(p.sec).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");

  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="wpm over time">`;
  for (let v = 0; v <= top; v += top / 4) {
    svg += `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="axis" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  }
  const step = Math.max(1, Math.ceil(end / 10));
  for (let sec = step; sec <= end; sec += step) svg += `<text class="axis" x="${x(sec)}" y="${H - 4}" text-anchor="middle">${sec}</text>`;
  svg += `<path d="${line("raw")}" fill="none" stroke="var(--sub)" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  svg += `<path d="${line("wpm")}" fill="none" stroke="var(--main)" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
  for (const p of samples) {
    if (p.errors) svg += `<text x="${x(p.sec)}" y="${y(p.wpm) - 8}" fill="var(--error)" font-size="12" text-anchor="middle">x${p.errors > 1 ? p.errors : ""}</text>`;
  }
  $("chart").innerHTML = svg + "</svg>";
}

$("btn-next").addEventListener("click", newTest);
$("btn-replay").addEventListener("click", () => startReplay(lastRecording, "results"));
$("btn-stats").addEventListener("click", () => { statsMode = modeKey(lastRecording); showStats(); });

// ---------- replay ----------

const rp = { rec: null, t: 0, playing: false, speed: 1, last: 0, back: "results" };
const scrub = $("rp-scrub");

function startReplay(rec, back) {
  if (!rec) return;
  rp.rec = rec;
  rp.back = back;
  $("rp-close").textContent = back;
  scrub.max = Math.round(rec.duration);
  show("replay");
  rpSeek(0);
  rp.playing = true;
  rp.last = performance.now();
  $("rp-play").textContent = "pause";
  requestAnimationFrame(rpFrame);
}

function rpSeek(t, from = t) {
  rp.t = t;
  const { s, keys } = simulate(rp.rec, t, null, from);
  renderWords(s, !rp.playing);
  paintKeys(t >= rp.rec.duration ? new Map() : keys);
  paintLive(t, s, rp.rec.mode, rp.rec.amount);
  scrub.value = Math.round(t);
  $("rp-time").textContent = `${(t / 1000).toFixed(1)}s`;
}

function rpFrame(now) {
  if (view !== "replay") return;
  if (rp.playing) {
    const t = Math.min(rp.rec.duration, rp.t + (now - rp.last) * rp.speed);
    rpSeek(t, Math.max(rp.t, t - 100));
    if (t >= rp.rec.duration) { rp.playing = false; $("rp-play").textContent = "replay"; }
  }
  rp.last = now;
  requestAnimationFrame(rpFrame);
}

function togglePlay() {
  if (!rp.playing && rp.t >= rp.rec.duration) rpSeek(0);
  rp.playing = !rp.playing;
  rp.last = performance.now();
  $("rp-play").textContent = rp.playing ? "pause" : "play";
}

$("rp-play").addEventListener("click", e => { togglePlay(); e.currentTarget.blur(); });
function closeReplay() {
  rp.playing = false;
  if (rp.back === "stats") showStats();
  else show("results");
}

$("rp-close").addEventListener("click", closeReplay);
scrub.addEventListener("input", () => { rp.playing = false; $("rp-play").textContent = "play"; rpSeek(+scrub.value); });
$("rp-speeds").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  rp.speed = +b.dataset.speed;
  for (const o of $("rp-speeds").children) o.classList.toggle("on", o === b);
  b.blur();
});

// ---------- history (saved on this device) ----------

// tr-runs holds a summary of every test; tr-rec-<id> holds the recording for the runs in keptIds()
const RUNS_KEY = "tr-runs", REC_PREFIX = "tr-rec-", TOP_N = 10, RECENT_N = 20;
const MODES = ["time 15", "time 30", "time 60", "words 10", "words 25", "words 50"];
let runs = load(RUNS_KEY, []);

function modeKey(r) { return `${r.mode} ${r.amount}`; }

function leaderboard(key) {
  return runs.filter(r => modeKey(r) === key).sort((a, b) => b.wpm - a.wpm || b.acc - a.acc || a.at - b.at).slice(0, TOP_N);
}

function packRec(rec) {
  return {
    w: rec.words.join(" "), d: Math.round(rec.duration),
    e: rec.events.map(e => e.d ? [Math.round(e.t), e.c, e.k, e.m ? 1 : 0] : [Math.round(e.t), e.c]),
  };
}

function loadRec(run) {
  const p = run.hasRec && load(REC_PREFIX + run.id, null);
  if (!p) return null;
  return {
    mode: run.mode, amount: run.amount, words: p.w.split(" "), duration: p.d,
    events: p.e.map(([t, c, k, m]) => k === undefined ? { t, d: 0, c } : { t, d: 1, c, k, m }),
  };
}

function topIds() {
  return new Set(MODES.flatMap(key => leaderboard(key).map(r => r.id)));
}

function pruneRecordings() {
  const keep = topIds();
  for (const r of runs.slice(-RECENT_N)) keep.add(r.id);
  for (const r of runs) if (r.hasRec && !keep.has(r.id)) { remove(REC_PREFIX + r.id); r.hasRec = false; }
  save(RUNS_KEY, runs);
}

function storeRecording(run, packed) {
  const tops = topIds();
  // when storage is full, give up the oldest recent (non-leaderboard) recordings first
  while (!(run.hasRec = save(REC_PREFIX + run.id, packed))) {
    const victim = runs.find(r => r.hasRec && r !== run && !tops.has(r.id));
    if (!victim) break;
    remove(REC_PREFIX + victim.id);
    victim.hasRec = false;
  }
}

function saveRun(rec, r) {
  const round1 = v => Math.round(v * 10) / 10;
  const run = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(),
    mode: rec.mode, amount: rec.amount, wpm: round1(r.wpm), raw: round1(r.raw), acc: round1(r.acc),
    chars: [r.correct, r.incorrect, r.extra, r.missed], dur: Math.round(rec.duration), hasRec: false,
  };
  runs.push(run);
  pruneRecordings();
  storeRecording(run, packRec(rec));
  save(RUNS_KEY, runs);
  return run;
}

function fmtDate(at) {
  const d = new Date(at);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ---------- stats page ----------

let statsMode = null;

function showStats() {
  rp.playing = false;
  statsMode ??= modeKey(config);
  const inMode = runs.filter(r => modeKey(r) === statsMode);
  const last10 = inMode.slice(-10);
  const avg = (list, key) => list.length ? list.reduce((a, r) => a + r[key], 0) / list.length : 0;
  const secs = runs.reduce((a, r) => a + r.dur, 0) / 1000;

  $("st-tests").textContent = runs.length;
  $("st-time").textContent = secs >= 3600 ? `${(secs / 3600).toFixed(1)}h` : secs >= 60 ? `${Math.round(secs / 60)}m` : `${Math.round(secs)}s`;
  $("st-best").textContent = inMode.length ? Math.round(Math.max(...inMode.map(r => r.wpm))) : "-";
  $("st-avg").textContent = last10.length ? Math.round(avg(last10, "wpm")) : "-";
  $("st-acc").textContent = last10.length ? Math.round(avg(last10, "acc")) + "%" : "-";
  for (const b of $("st-modes").children) b.classList.toggle("on", b.dataset.key === statsMode);

  drawHistory(inMode);
  const row = (r, first) => `<tr data-id="${r.id}">${first}<td class="hl">${Math.round(r.wpm)}</td><td>${Math.round(r.acc)}%</td>` +
    `<td>${Math.round(r.raw)}</td><td class="dim">${fmtDate(r.at)}</td>` +
    `<td>${r.hasRec ? `<button data-act="replay">replay</button>` : ""}</td></tr>`;
  const head = first => `<tr><th>${first}</th><th>wpm</th><th>acc</th><th>raw</th><th>date</th><th></th></tr>`;
  const lb = leaderboard(statsMode);
  $("st-lb").innerHTML = lb.length ? head("#") + lb.map((r, i) => row(r, `<td class="dim">${i + 1}</td>`)).join("")
    : `<tr><td class="dim">no ${statsMode} tests yet</td></tr>`;
  const recent = runs.slice(-RECENT_N).reverse();
  $("st-recent").innerHTML = recent.length ? head("test") + recent.map(r => row(r, `<td class="dim">${modeKey(r)}</td>`)).join("")
    : `<tr><td class="dim">no tests yet</td></tr>`;
  show("stats");
}

function drawHistory(list) {
  const el = $("st-chart");
  if (list.length < 2) { el.innerHTML = `<p class="dim">progress shows up after two ${statsMode} tests</p>`; return; }
  const W = 600, H = 160, L = 32, B = 8, T = 8;
  const top = Math.max(20, Math.ceil(Math.max(...list.map(r => r.wpm)) / 20) * 20);
  const x = i => L + (i / (list.length - 1)) * (W - L - 6);
  const y = v => T + (1 - v / top) * (H - T - B);
  const rolling = list.map((_, i) => { const w = list.slice(Math.max(0, i - 9), i + 1); return w.reduce((a, r) => a + r.wpm, 0) / w.length; });
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="wpm per test">`;
  for (let v = 0; v <= top; v += top / 4) {
    svg += `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="axis" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  }
  svg += list.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.wpm)}" r="2.5" fill="var(--sub)"/>`).join("");
  svg += `<path d="${rolling.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="var(--main)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
  el.innerHTML = svg + "</svg>";
}

function openRun(run, replay) {
  const rec = loadRec(run);
  if (replay) return startReplay(rec, "stats");
  if (!rec) return;
  const { r, samples } = analyze(rec);
  showResults(rec, r, samples, run);
}

$("st-modes").innerHTML = MODES.map(k => `<button data-key="${k}">${k}</button>`).join("");
$("st-modes").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b) { statsMode = b.dataset.key; showStats(); }
});
for (const t of [$("st-lb"), $("st-recent")]) t.addEventListener("click", e => {
  const tr = e.target.closest("tr[data-id]");
  const run = tr && runs.find(r => r.id === tr.dataset.id);
  if (run) openRun(run, !!e.target.closest("[data-act=replay]"));
});

$("views").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  b.blur();
  if (b.dataset.view === "stats") { statsMode = modeKey(config); showStats(); }
  else newTest();
});

$("btn-export").addEventListener("click", () => {
  const recs = {};
  for (const r of runs) if (r.hasRec) recs[r.id] = load(REC_PREFIX + r.id, null);
  const blob = new Blob([JSON.stringify({ app: "type-replay", version: 1, runs, recs })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `type-replay-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("btn-import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  if (data?.app !== "type-replay" || !Array.isArray(data.runs)) { alert("That isn't a Type Replay export."); return; }
  const have = new Set(runs.map(r => r.id));
  const added = data.runs.filter(r => r && r.id && !have.has(r.id) && MODES.includes(modeKey(r)));
  for (const r of added) {
    const packed = data.recs?.[r.id];
    r.hasRec = !!packed && save(REC_PREFIX + r.id, packed);
  }
  runs = runs.concat(added).sort((a, b) => a.at - b.at);
  pruneRecordings();
  showStats();
  alert(`Imported ${added.length} test${added.length === 1 ? "" : "s"}.`);
});

$("btn-clear").addEventListener("click", () => {
  if (!confirm("Delete every saved test and recording on this device?")) return;
  for (const r of runs) remove(REC_PREFIX + r.id);
  runs = [];
  save(RUNS_KEY, runs);
  showStats();
});

// ---------- start ----------

buildKeyboard();
paintModes();
newTest();
window.addEventListener("resize", () => { if (view === "test" || view === "replay") renderWords(view === "replay" ? simulate(rp.rec, rp.t).s : test.state, true); });
