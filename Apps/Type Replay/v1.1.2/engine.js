"use strict";

// The typing engine: pure functions shared by the page (a classic <script>), the Worker and the Node tests.
// No DOM, no timers, no randomness. A change that alters scoring must raise ENGINE_VERSION and keep the old
// behaviour behind a check of s.v, because every recording replays (on the page and on the server) with the
// engine version that recorded it.
//   v1 (v1.0.0 to v1.1.1): backspace at the start of a word only reopens the previous word if it was wrong.
//   v2 (v1.1.2): backspace keeps going back through every earlier word, right ones included.

const ENGINE_VERSION = 2;
const MODES = ["time 15", "time 30", "time 60", "words 10", "words 25", "words 50"];

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

function newState(words, endOnLast, v = ENGINE_VERSION) {
  return { words, typed: [""], wi: 0, keys: 0, goodKeys: 0, done: false, endOnLast, v };
}

// The version a recording was made with: packed and unpacked recordings carry v from v2 on; none means v1.
function recVersion(rec) { return rec && rec.v ? rec.v : 1; }

// Applies one key to the state. Returns true/false for a right/wrong keystroke, null if it wasn't one.
function applyKey(s, k, wordMod) {
  if (s.done) return null; // only a hostile recording has keys after the end
  const word = s.words[s.wi], cur = s.typed[s.wi];
  if (k === "Backspace") {
    if (cur.length) s.typed[s.wi] = wordMod ? "" : cur.slice(0, -1);
    else if (s.wi > 0 && (s.v >= 2 || s.typed[s.wi - 1] !== s.words[s.wi - 1])) {
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

// Rebuilds the test up to untilMs. Keys pressed after flashFrom stay lit even if already released,
// so presses shorter than a frame still show during playback.
function simulate(rec, untilMs, onSecond, flashFrom = untilMs) {
  const s = newState(rec.words.slice(), rec.mode === "words", recVersion(rec));
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

function packRec(rec) {
  const p = {
    w: rec.words.join(" "), d: Math.round(rec.duration),
    e: rec.events.map(e => e.d ? [Math.round(e.t), e.c, e.k, e.m ? 1 : 0] : [Math.round(e.t), e.c]),
  };
  if (recVersion(rec) > 1) p.v = recVersion(rec); // v1 recordings pack exactly as they always did
  return p;
}

// The opposite of packRec.
function unpackRec(p, mode, amount) {
  return {
    mode, amount, words: p.w.split(" "), duration: p.d, v: recVersion(p),
    events: p.e.map(([t, c, k, m]) => k === undefined ? { t, d: 0, c } : { t, d: 1, c, k, m }),
  };
}

const WORD_SET = new Set(WORD_LIST);

// Checks the shape of a packed recording that came from outside this browser (server, import file) so the
// rest of the code can trust its types. Returns a reason string, or "" if it's fine. Words are only checked
// against the list when listOnly is set; the page escapes every letter it draws either way.
function recShapeError(p, listOnly) {
  if (!p || typeof p !== "object" || typeof p.w !== "string" || !p.w) return "no words";
  if (!Number.isInteger(p.d) || p.d <= 0 || !Array.isArray(p.e)) return "bad recording";
  if (p.v !== undefined && !(Number.isInteger(p.v) && p.v >= 2 && p.v <= ENGINE_VERSION)) return "unknown engine version";
  let last = 0;
  for (const ev of p.e) {
    if (!Array.isArray(ev) || (ev.length !== 2 && ev.length !== 4)) return "bad event";
    const [t, c, k, m] = ev;
    if (!Number.isInteger(t) || t < last || t > p.d) return "bad event time";
    if (typeof c !== "string" || !/^[A-Za-z0-9]{0,24}$/.test(c)) return "bad key code";
    if (ev.length === 4) {
      if (typeof k !== "string" || (k.length > 1 && k !== "Backspace")) return "bad key";
      if (m !== 0 && m !== 1) return "bad modifier";
    }
    last = t;
  }
  if (listOnly) {
    const words = p.w.split(" ");
    for (let i = 0; i < words.length; i++) {
      if (!WORD_SET.has(words[i])) return "word not in the list";
      if (i && words[i] === words[i - 1]) return "repeated word";
    }
  }
  return "";
}

// The page gets these as globals; the Worker and Node import them.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ENGINE_VERSION, MODES, WORD_LIST, WORD_SET, newState, recVersion, applyKey, stats, simulate, analyze, packRec, unpackRec, recShapeError,
  };
}
