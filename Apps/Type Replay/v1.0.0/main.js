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
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
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
  $("stage").hidden = v === "results";
  $("results").hidden = v !== "results";
  $("replay-bar").hidden = v !== "replay";
  $("replay-tag").hidden = v !== "replay";
  $("hint-replay").hidden = v !== "replay";
  $("modes").style.visibility = v === "test" ? "" : "hidden";
}

// ---------- live test ----------

const held = new Map(); // physical keys down right now -> wasWrong
let test, lastRecording;

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
  lastRecording = {
    mode: test.mode, amount: test.amount,
    words: test.state.words.slice(),
    events: test.events.filter(e => e.t <= endMs),
    duration: endMs,
  };
  showResults(lastRecording);
}

function isTypingKey(e) {
  if (e.key === "Backspace") return true;
  return e.key.length === 1 && !e.metaKey && !(e.ctrlKey && !e.altKey);
}

document.addEventListener("keydown", e => {
  if (e.key === "Tab") { e.preventDefault(); newTest(); return; }

  if (view === "replay") {
    if (e.key === " ") { e.preventDefault(); togglePlay(); }
    else if (e.key === "Escape") { rp.playing = false; show("results"); }
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

function showResults(rec) {
  const samples = [];
  const { s } = simulate(rec, rec.duration, (ms, st, errors) => {
    const r = stats(st, ms);
    samples.push({ sec: ms / 1000, wpm: r.wpm, raw: r.raw, errors });
  });
  const r = stats(s, rec.duration);
  const wpm = Math.round(r.wpm);

  const bestKey = `tr-best-${rec.mode}-${rec.amount}`;
  const best = load(bestKey, 0);
  if (wpm > best) save(bestKey, wpm);

  $("r-wpm").textContent = wpm;
  $("r-acc").textContent = Math.round(r.acc) + "%";
  $("r-mode").textContent = `${rec.mode} ${rec.amount}`;
  $("r-raw").textContent = Math.round(r.raw);
  $("r-chars").textContent = `${r.correct}/${r.incorrect}/${r.extra}/${r.missed}`;
  $("r-time").textContent = (rec.duration / 1000).toFixed(1) + "s";
  $("r-best").textContent = wpm > best ? `${wpm} (new!)` : best;
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
$("btn-replay").addEventListener("click", () => startReplay(lastRecording));

// ---------- replay ----------

const rp = { rec: null, t: 0, playing: false, speed: 1, last: 0 };
const scrub = $("rp-scrub");

function startReplay(rec) {
  if (!rec) return;
  rp.rec = rec;
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
    rpSeek(t, rp.t);
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
$("rp-close").addEventListener("click", () => { rp.playing = false; show("results"); });
scrub.addEventListener("input", () => { rp.playing = false; $("rp-play").textContent = "play"; rpSeek(+scrub.value); });
$("rp-speeds").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  rp.speed = +b.dataset.speed;
  for (const o of $("rp-speeds").children) o.classList.toggle("on", o === b);
  b.blur();
});

// ---------- start ----------

buildKeyboard();
paintModes();
newTest();
window.addEventListener("resize", () => { if (view !== "results") renderWords(view === "replay" ? simulate(rp.rec, rp.t).s : test.state, true); });
