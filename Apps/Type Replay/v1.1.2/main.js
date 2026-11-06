"use strict";

// ---------- data ----------

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
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
}

// ---------- rendering the words ----------

function renderWords(s, idle) {
  let html = "";
  for (let i = 0; i < s.words.length; i++) {
    const w = s.words[i], t = s.typed[i];
    let inner = "";
    for (let j = 0; j < w.length; j++) {
      const c = t === undefined || j >= t.length ? "" : t[j] === w[j] ? "c" : "x";
      inner += c ? `<span class="${c}">${esc(w[j])}</span>` : `<span>${esc(w[j])}</span>`;
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
  $("stage").hidden = v === "results" || v === "stats" || v === "versions";
  $("results").hidden = v !== "results";
  $("stats").hidden = v !== "stats";
  $("versions").hidden = v !== "versions";
  const tab = v === "versions" ? "versions" : v === "stats" || v === "replay" && rp.back === "stats" ? "stats" : "test";
  for (const b of $("views").children) b.classList.toggle("on", b.dataset.view === tab);
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
    mode: test.mode, amount: test.amount, v: s.v,
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
  if (e.target.matches?.("input[type=text]")) return; // typing a name, not a test
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

let lastRecording, lastRun;

// prevBest is given for a test just finished, and left out when opening a saved one
function showResults(rec, r, samples, run, prevBest) {
  lastRecording = rec;
  lastRun = run || null;
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
  paintSubmit();
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

function startReplay(rec, back, who) {
  if (!rec) return;
  rp.rec = rec;
  rp.back = back;
  $("replay-tag").textContent = who ? `replay · ${who}` : "replay";
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
let runs = load(RUNS_KEY, []);

function modeKey(r) { return `${r.mode} ${r.amount}`; }

function leaderboard(key) {
  return runs.filter(r => modeKey(r) === key).sort((a, b) => b.wpm - a.wpm || b.acc - a.acc || a.at - b.at).slice(0, TOP_N);
}

function loadRec(run) {
  const p = run.hasRec && load(REC_PREFIX + run.id, null);
  if (!p) return null;
  return unpackRec(p, run.mode, run.amount);
}

// The recordings to hold on to above all: leaderboard runs, and runs still waiting to reach the global board.
function topIds() {
  return new Set([...MODES.flatMap(key => leaderboard(key).map(r => r.id)), ...pendingIds()]);
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
let statsScope = "local"; // "local" or "global"; always opens on this device

function showStats() {
  rp.playing = false;
  statsMode ??= modeKey(config);
  for (const b of $("st-scope").children) b.classList.toggle("on", b.dataset.scope === statsScope);
  for (const b of $("st-modes").children) b.classList.toggle("on", b.dataset.key === statsMode);
  $("st-tiles").hidden = $("st-local").hidden = statsScope !== "local";
  $("st-global").hidden = statsScope !== "global";
  if (statsScope === "global") { showGlobal(); show("stats"); return; }
  const inMode = runs.filter(r => modeKey(r) === statsMode);
  const last10 = inMode.slice(-10);
  const avg = (list, key) => list.length ? list.reduce((a, r) => a + r[key], 0) / list.length : 0;
  const secs = runs.reduce((a, r) => a + r.dur, 0) / 1000;

  $("st-tests").textContent = runs.length;
  $("st-time").textContent = secs >= 3600 ? `${(secs / 3600).toFixed(1)}h` : secs >= 60 ? `${Math.round(secs / 60)}m` : `${Math.round(secs)}s`;
  $("st-best").textContent = inMode.length ? Math.round(Math.max(...inMode.map(r => r.wpm))) : "-";
  $("st-avg").textContent = last10.length ? Math.round(avg(last10, "wpm")) : "-";
  $("st-acc").textContent = last10.length ? Math.round(avg(last10, "acc")) + "%" : "-";

  drawHistory(inMode);
  const row = (r, first) => `<tr data-id="${esc(r.id)}">${first}<td class="hl">${Math.round(r.wpm)}</td><td>${Math.round(r.acc)}%</td>` +
    `<td>${Math.round(r.raw)}</td><td class="dim">${esc(fmtDate(r.at))}</td>` +
    `<td>${r.hasRec ? `<button data-act="replay">replay</button>` : ""}` +
    `${BOARD_ON && r.hasRec && !r.sent ? `<button data-act="submit" title="opens this run, with the public-data notice">submit</button>` : ""}</td></tr>`;
  const head = first => `<tr><th>${first}</th><th>wpm</th><th>acc</th><th>raw</th><th>date</th><th></th></tr>`;
  const lb = leaderboard(statsMode);
  $("st-lb").innerHTML = lb.length ? head("#") + lb.map((r, i) => row(r, `<td class="dim">${i + 1}</td>`)).join("")
    : `<tr><td class="dim">no ${esc(statsMode)} tests yet</td></tr>`;
  const recent = runs.slice(-RECENT_N).reverse();
  $("st-recent").innerHTML = recent.length ? head("test") + recent.map(r => row(r, `<td class="dim">${esc(modeKey(r))}</td>`)).join("")
    : `<tr><td class="dim">no tests yet</td></tr>`;
  show("stats");
}

function drawHistory(list) {
  const el = $("st-chart");
  if (list.length < 2) { el.innerHTML = `<p class="dim">progress shows up after two ${esc(statsMode)} tests</p>`; return; }
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
$("st-scope").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b) { statsScope = b.dataset.scope; b.blur(); showStats(); }
});
for (const t of [$("st-lb"), $("st-recent")]) t.addEventListener("click", e => {
  const tr = e.target.closest("tr[data-id]");
  const run = tr && runs.find(r => r.id === tr.dataset.id);
  if (run) openRun(run, !!e.target.closest("[data-act=replay]")); // "submit" opens the run too: the button and notice are there
});

$("views").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  b.blur();
  if (b.dataset.view === "stats") { statsMode = modeKey(config); statsScope = "local"; showStats(); }
  else if (b.dataset.view === "versions") showVersions();
  else newTest();
});

// ---------- version log ----------

function showVersions() {
  const list = $("vl-list");
  if (!list.childElementCount) {
    for (const entry of VERSIONS) {
      const div = document.createElement("div");
      div.className = "vl-entry";
      const h = document.createElement("h3");
      h.textContent = entry.v;
      const date = document.createElement("small");
      date.textContent = entry.date;
      h.append(" ", date);
      const ul = document.createElement("ul");
      for (const note of entry.notes) { const li = document.createElement("li"); li.textContent = note; ul.appendChild(li); }
      div.append(h, ul);
      list.appendChild(div);
    }
  }
  show("versions");
}

// An import file can come from anyone, so keep only known fields of the right types.
function cleanImportedRun(r) {
  if (!r || typeof r.id !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(r.id)) return null;
  const amount = Number(r.amount);
  if (typeof r.mode !== "string" || !MODES.includes(`${r.mode} ${amount}`)) return null;
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const clean = {
    id: r.id, at: num(r.at), mode: r.mode, amount, wpm: num(r.wpm), raw: num(r.raw), acc: num(r.acc),
    chars: Array.isArray(r.chars) ? r.chars.slice(0, 4).map(num) : [0, 0, 0, 0], dur: num(r.dur), hasRec: false,
  };
  if (r.sent === 1) clean.sent = 1;
  return clean;
}

$("btn-export").addEventListener("click", () => {
  const recs = {};
  for (const r of runs) if (r.hasRec) recs[r.id] = load(REC_PREFIX + r.id, null);
  const blob = new Blob([JSON.stringify({ app: "type-replay", version: 1, runs, recs })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const now = new Date(), pad = n => String(n).padStart(2, "0");
  a.download = `type-replay-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
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
  const added = data.runs.map(cleanImportedRun).filter(r => r && !have.has(r.id));
  for (const r of added) {
    const packed = data.recs?.[r.id];
    r.hasRec = !recShapeError(packed, false) && save(REC_PREFIX + r.id, packed.v ? { w: packed.w, d: packed.d, e: packed.e, v: packed.v } : { w: packed.w, d: packed.d, e: packed.e });
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
  remove(PENDING_KEY);
  showStats();
});

// ---------- global board ----------

// All of this is optional: a run is already saved locally before anything here happens, and every failure ends in
// "global board unavailable". Nothing else on the page waits for it. The URL is hardcoded and must never change,
// because every published version keeps calling it; only a page served from this machine may point elsewhere.
const IS_LOCAL_PAGE = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API = (IS_LOCAL_PAGE && new URLSearchParams(location.search).get("api")) || "https://typereplay.joshdelgado.fyi";
// The whole board stays out of sight, and the page never calls the API, until the Worker is live: set BOARD_LIVE to
// true in the release that turns it on. A page served from this machine with ?api= shows it anyway, for the tests.
const BOARD_LIVE = false;
const BOARD_ON = BOARD_LIVE || (IS_LOCAL_PAGE && new URLSearchParams(location.search).has("api"));
const TOKEN_KEY = "tr-token", NAME_KEY = "tr-name", PENDING_KEY = "tr-pending", BOARD_PREFIX = "tr-board-";
const API_TIMEOUT_MS = 5000, UNAVAILABLE = "global board unavailable";

function pendingIds() {
  const p = load(PENDING_KEY, []);
  return Array.isArray(p) ? p.filter(id => typeof id === "string") : [];
}
function setPending(ids) { if (ids.length) save(PENDING_KEY, ids); else remove(PENDING_KEY); }

// { down: true } for anything that isn't an answer from the Worker: no network, timeout, 5xx, Cloudflare's own error pages.
async function callApi(method, path, body) {
  if (!BOARD_ON) return { down: true };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), API_TIMEOUT_MS);
  const headers = {}, token = load(TOKEN_KEY, null);
  if (typeof token === "string") headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(API + path, { method, headers, body: body && JSON.stringify(body), signal: ctl.signal, cache: "no-store" });
    if (res.status >= 500) return { down: true };
    const data = await res.json();
    return { status: res.status, ok: res.ok, data };
  } catch {
    return { down: true };
  } finally {
    clearTimeout(timer);
  }
}

// ----- submitting

function setStatus(id, text, bad) {
  $(id).textContent = text;
  $(id).classList.toggle("bad", !!bad);
}

function paintSubmit() {
  const run = lastRun, can = BOARD_ON && !!run && run.hasRec;
  const btn = $("btn-submit");
  btn.hidden = $("r-notice").hidden = !can;
  btn.disabled = can && !!run.sent;
  btn.textContent = can && run.sent ? "submitted" : "submit to global";
  $("r-notice").hidden = !can || !!run.sent;
  $("name-box").hidden = true;
  const waiting = can && pendingIds().includes(run.id);
  setStatus("r-status", waiting ? `${UNAVAILABLE}: this run is waiting and will be sent on a later visit` : "");
}

function describeResult(data) {
  const you = `#${data.rank} on the global board`;
  return data.improved ? `submitted: ${you} at ${Math.round(data.best.wpm)} wpm`
    : `your best stays: ${you} at ${Math.round(data.best.wpm)} wpm`;
}

// Sends one run. Returns "sent", "wait" (try again later) or "refused" (won't ever work).
async function sendRun(run, onDone) {
  const rec = load(REC_PREFIX + run.id, null);
  if (!rec) { onDone("that run's recording is gone", true); return "refused"; }
  const res = await callApi("POST", "/v1/submit", { v: recVersion(rec), mode: run.mode, amount: run.amount, rec });
  if (res.down || res.status === 429) { onDone(res.down ? UNAVAILABLE : "too many submissions, it will be sent later", true); return "wait"; }
  if (res.status === 401) { // the server doesn't know this browser's token any more
    remove(TOKEN_KEY); remove(NAME_KEY);
    onDone("this browser's name wasn't recognised: claim it again or use your recovery code", true);
    return "refused";
  }
  if (!res.ok) { onDone(String(res.data?.message || "the board refused that run"), true); return "refused"; }
  run.sent = 1;
  save(RUNS_KEY, runs);
  onDone(describeResult(res.data), false);
  return "sent";
}

async function submitLast() {
  const run = lastRun;
  if (!run) return;
  if (typeof load(TOKEN_KEY, null) !== "string") {
    setStatus("r-status", "");
    openNameBox($("name-home"), () => { if (lastRun === run) submitLast(); });
    return;
  }
  $("btn-submit").disabled = true;
  setStatus("r-status", "submitting...");
  const say = (text, bad) => { if (lastRun === run && view === "results") setStatus("r-status", text, bad); };
  const out = await sendRun(run, say);
  if (out === "wait") {
    setPending([...new Set([...pendingIds(), run.id])]);
    pruneRecordings();
    say(`${UNAVAILABLE}: this run will be sent on a later visit`, true);
  } else setPending(pendingIds().filter(id => id !== run.id));
  if (lastRun === run && view === "results") {
    $("btn-submit").disabled = !!run.sent || out === "wait";
    $("btn-submit").textContent = run.sent ? "submitted" : "submit to global";
    $("r-notice").hidden = !!run.sent;
  }
}

// Retries waiting runs, one at a time, stopping at the first sign the board is still away.
async function flushPending() {
  if (!BOARD_ON) return;
  if (typeof load(TOKEN_KEY, null) !== "string") return;
  for (const id of pendingIds()) {
    const run = runs.find(r => r.id === id);
    const out = run ? await sendRun(run, () => {}) : "refused";
    if (out === "wait") return;
    setPending(pendingIds().filter(p => p !== id));
  }
  pruneRecordings();
}

$("btn-submit").addEventListener("click", e => { e.currentTarget.blur(); submitLast(); });

// ----- name

let afterName = null;

function openNameBox(home, then) {
  afterName = then;
  const box = $("name-box");
  home.appendChild(box);
  box.hidden = false;
  $("nb-code-row").hidden = true;
  $("nb-error").textContent = "";
  $("nb-name").focus();
}

function namedAs(data) {
  save(TOKEN_KEY, data.token);
  save(NAME_KEY, data.name);
  $("name-box").hidden = true;
  const then = afterName;
  afterName = null;
  flushPending();
  if (then) then();
}

$("name-form").addEventListener("submit", async e => {
  e.preventDefault();
  $("nb-error").textContent = "";
  $("nb-claim").disabled = true;
  const res = await callApi("POST", "/v1/claim", { name: $("nb-name").value });
  $("nb-claim").disabled = false;
  if (res.down) { $("nb-error").textContent = `${UNAVAILABLE}: try again later`; return; }
  if (!res.ok) {
    $("nb-error").textContent = String(res.data?.message || "that didn't work");
    if (res.status === 409) $("nb-code-row").hidden = false;
    return;
  }
  $("rc-code").textContent = String(res.data.recovery);
  const box = $("recovery-box");
  $("name-box").parentNode.insertBefore(box, $("name-box"));
  box.hidden = false;
  namedAs(res.data);
});

$("nb-have-code").addEventListener("click", () => { $("nb-code-row").hidden = false; $("nb-code").focus(); });

$("nb-link").addEventListener("click", async () => {
  $("nb-error").textContent = "";
  const res = await callApi("POST", "/v1/link", { name: $("nb-name").value, code: $("nb-code").value });
  if (res.down) { $("nb-error").textContent = `${UNAVAILABLE}: try again later`; return; }
  if (!res.ok) { $("nb-error").textContent = String(res.data?.message || "that didn't work"); return; }
  $("nb-code").value = "";
  namedAs(res.data);
});

$("rc-copy").addEventListener("click", () => navigator.clipboard?.writeText($("rc-code").textContent).catch(() => {}));
$("rc-done").addEventListener("click", () => { $("recovery-box").hidden = true; $("rc-code").textContent = ""; });

// ----- the board

let boardAsk = 0; // only the newest answer gets drawn

function paintBoard(b, cached) {
  const you = typeof b.you === "string" ? b.you : load(NAME_KEY, null);
  const top = Array.isArray(b.top) ? b.top : [];
  // names come from other people: esc, always
  const rows = top.map((r, i) => `<tr data-id="${Number(r.id) | 0}" class="${r.name === you ? "me" : ""}"><td class="dim">${i + 1}</td>` +
    `<td>${esc(r.name)}</td><td class="hl">${Math.round(Number(r.wpm))}</td><td>${Math.round(Number(r.acc))}%</td>` +
    `<td>${Math.round(Number(r.raw))}</td><td class="dim">${esc(fmtDate(Number(r.at)))}</td>` +
    `<td>${r.rec && !cached ? `<button data-act="replay">replay</button>` : ""}</td></tr>`).join("");
  $("gl-board").innerHTML = top.length
    ? `<tr><th>#</th><th>name</th><th>wpm</th><th>acc</th><th>raw</th><th>date</th><th></th></tr>${rows}`
    : `<tr><td class="dim">no ${esc(statsMode)} scores yet${cached ? " in the last copy" : ""}</td></tr>`;
  $("gl-me").textContent = b.me && !cached ? `you: #${Number(b.me.rank)} at ${Math.round(Number(b.me.wpm))} wpm` : "";
}

function paintWho() {
  const name = load(NAME_KEY, null), has = typeof load(TOKEN_KEY, null) === "string";
  $("gl-who").textContent = has ? `playing as ${name}` : "";
  $("gl-name").hidden = !has;
  if (has) { if ($("name-box").parentNode === $("gl-name-home")) $("name-box").hidden = true; }
  else openNameBox($("gl-name-home"), () => { paintWho(); if (statsScope === "global" && view === "stats") showGlobal(); });
}

async function showGlobal() {
  const mode = statsMode, ask = ++boardAsk;
  paintWho();
  const old = load(BOARD_PREFIX + mode, null);
  if (old) paintBoard(old.board, true); else $("gl-board").innerHTML = `<tr><td class="dim">loading...</td></tr>`;
  $("gl-me").textContent = "";
  setStatus("gl-status", "");
  const res = await callApi("GET", `/v1/board?mode=${encodeURIComponent(mode)}`);
  if (ask !== boardAsk || statsScope !== "global") return;
  if (res.down || !res.ok) {
    const when = old ? `, showing the last copy from ${fmtDate(Number(old.at))}` : "";
    setStatus("gl-status", UNAVAILABLE + when, true);
    if (!old) $("gl-board").innerHTML = "";
    return;
  }
  save(BOARD_PREFIX + mode, { at: Date.now(), board: { top: res.data.top, you: res.data.you } });
  paintBoard(res.data, false);
}

$("gl-board").addEventListener("click", async e => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr || !tr.querySelector("[data-act=replay]")) return;
  setStatus("gl-status", "loading replay...");
  const res = await callApi("GET", `/v1/replay/${Number(tr.dataset.id) | 0}`);
  if (res.down || !res.ok) { setStatus("gl-status", res.down ? UNAVAILABLE : "that replay is gone", true); return; }
  setStatus("gl-status", "");
  // the server checks these too, but this page shares an origin with every Vibes app: check again
  const d = res.data, modeParts = String(d.mode_key).split(" ");
  if (!MODES.includes(d.mode_key) || recShapeError(d.rec, true)) { setStatus("gl-status", "that replay looks wrong, so it wasn't played", true); return; }
  startReplay(unpackRec(d.rec, modeParts[0], +modeParts[1]), "stats", String(d.name));
});

$("btn-remove").addEventListener("click", async () => {
  if (!confirm("Remove all your scores and recordings from the global board? Your name stays yours.")) return;
  const res = await callApi("DELETE", "/v1/me/scores");
  if (res.down || !res.ok) { setStatus("gl-status", res.down ? UNAVAILABLE : "that didn't work", true); return; }
  for (const r of runs) delete r.sent;
  save(RUNS_KEY, runs);
  for (const key of MODES) remove(BOARD_PREFIX + key);
  showGlobal();
});

$("btn-forget").addEventListener("click", () => {
  if (!confirm("Forget this name on this browser? You'd need its recovery code to use it here again. Your scores stay on the board.")) return;
  remove(TOKEN_KEY); remove(NAME_KEY); remove(PENDING_KEY);
  showGlobal();
});

// ---------- start ----------

$("st-scope").hidden = !BOARD_ON;
buildKeyboard();
paintModes();
newTest();
flushPending();
window.addEventListener("resize", () => { if (view === "test" || view === "replay") renderWords(view === "replay" ? simulate(rp.rec, rp.t).s : test.state, true); });
