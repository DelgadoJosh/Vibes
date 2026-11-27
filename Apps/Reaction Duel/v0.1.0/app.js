"use strict";
// Reaction Duel: a reaction-time game for the Meta Ray-Ban Display (Web Apps path).
// Input on the glasses: Neural Band swipes arrive as ArrowUp/Down/Left/Right keydown,
// pinch as Enter, back as Escape/Backspace. The desktop keyboard and the simulator
// buttons send the same keys, so one handler covers all three.
//
// Every valid reaction is stored per input and per environment ("lens" or "desktop").
// Comparing the two on the Stats screen gives the glasses' input lag, which the
// rhythm game will need as its offset.

const VERSION = "0.1.0";
const STORE_KEY = "rd-v1";
const MAX_SAMPLES = 60;   // kept per input per environment
const TOO_SLOW_MS = 1500;
const INPUTS = ["Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
const INPUT_LABEL = { Enter: "Pinch", ArrowUp: "Swipe up", ArrowDown: "Swipe down", ArrowLeft: "Swipe left", ArrowRight: "Swipe right" };
const RIVALS = ["Dusty Pete", "Cactus Jo", "Two-Step Tess", "Old Mesquite", "Rattler Ray",
  "Doc Tumbleweed", "Sundown Sal", "The Quiet Kid", "Mesa Mae", "Hollow Hank"];

// ---------- environment ----------
const params = new URLSearchParams(location.search);
const ENV = params.get("env") === "lens" || params.get("env") === "desktop"
  ? params.get("env")
  : (window.innerWidth <= 700 && window.innerHeight <= 700 ? "lens" : "desktop");
document.body.classList.add(ENV);
document.getElementById("ver").textContent = VERSION;

// ---------- storage ----------
function freshState() {
  const samples = {};
  for (const env of ["lens", "desktop"]) {
    samples[env] = {};
    for (const k of INPUTS) samples[env][k] = [];
  }
  return { v: 1, bestDuel: 0, sound: true, samples };
}
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.v === 1 && s.samples) return s;
  } catch (e) { /* private mode or bad data */ }
  return freshState();
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
const state = loadState();

function recordSample(key, ms) {
  const list = state.samples[ENV][key];
  list.push(Math.round(ms));
  if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
  saveState();
}

// ---------- maths ----------
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = (ms) => (ms == null ? "–" : Math.round(ms) + " ms");

// ---------- sound (Web Audio, unlocked on the first input) ----------
let audio = null;
function unlockAudio() {
  if (audio) { if (audio.state === "suspended") audio.resume(); return; }
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; }
}
function tone(freq, dur, type = "square", gain = 0.08, delay = 0) {
  if (!audio || !state.sound) return;
  const t0 = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audio.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
const sfx = {
  draw: () => tone(880, 0.12),
  win: () => { tone(660, 0.1, "triangle", 0.1); tone(990, 0.16, "triangle", 0.1, 0.1); },
  lose: () => { tone(220, 0.25, "sawtooth", 0.06); },
  foul: () => { tone(140, 0.3, "sawtooth", 0.07); },
  tick: () => tone(520, 0.04, "triangle", 0.05),
};

// ---------- timers (one set per screen, cleared on screen change) ----------
let timers = [];
function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

// ---------- screens ----------
const lens = document.getElementById("lens");
let screen = null;
function go(next) {
  clearTimers();
  screen = next;
  screen.enter && screen.enter();
  screen.render();
}
function draw(html) { lens.innerHTML = html; }

// Stimulus clock: performance.now() taken right after the DOM change. Key events carry
// event.timeStamp on the same clock, so reaction = timeStamp - shownAt (within a frame).
function show(html) { draw(html); return performance.now(); }

// ===== Menu =====
const menu = {
  sel: 0,
  items() {
    return ["Duel", "Quick Draw", "Swipe Draw", "Stats", "Sound: " + (state.sound ? "On" : "Off")];
  },
  render() {
    const items = this.items().map((t, i) => `<li class="${i === this.sel ? "sel" : ""}">${t}</li>`).join("");
    draw(`
      <h1 class="title">REACTION DUEL</h1>
      <p class="sub">Fastest pinch in the West</p>
      <ul class="menu">${items}</ul>
      <div class="hint">Swipe to move · Pinch to pick</div>`);
  },
  input(key) {
    const n = this.items().length;
    if (key === "ArrowUp" || key === "ArrowLeft") { this.sel = (this.sel + n - 1) % n; sfx.tick(); this.render(); }
    else if (key === "ArrowDown" || key === "ArrowRight") { this.sel = (this.sel + 1) % n; sfx.tick(); this.render(); }
    else if (key === "Enter") {
      if (this.sel === 0) go(duel);
      else if (this.sel === 1) go(quick);
      else if (this.sel === 2) go(swipe);
      else if (this.sel === 3) go(stats);
      else { state.sound = !state.sound; saveState(); this.render(); }
    } else return false;
    return true;
  },
};

// ===== Duel: beat a rival's draw time; a decoy "HOLD" cue appears from round 4 =====
const duel = {
  enter() { this.round = 0; this.lives = 3; this.beaten = 0; this.next(); },
  next() {
    this.round++;
    this.rival = RIVALS[(this.round - 1) % RIVALS.length];
    this.rivalMs = Math.round(Math.max(175, 470 - 24 * (this.round - 1)) + rand(-15, 15));
    this.phase = "intro";
  },
  header() {
    const lives = [0, 1, 2].map((i) => `<span class="${i < this.lives ? "on" : ""}"></span>`).join("");
    return `<div class="top"><span>Round ${this.round}</span><span class="lives">${lives}</span></div>`;
  },
  render() {
    const h = this.header();
    if (this.phase === "intro") {
      draw(`${h}
        <p class="small">Your rival</p>
        <p class="mid gold">${this.rival}</p>
        <p class="body">draws in about <b>${this.rivalMs} ms</b></p>
        ${this.round >= 4 ? `<p class="small red">Watch for HOLD. Don't pinch on it.</p>` : ""}
        <div class="hint">Pinch to step up</div>`);
    } else if (this.phase === "steady") {
      draw(`${h}<p class="mid" style="color:var(--dim)">Steady…</p><p class="small">Pinch on DRAW</p>`);
    }
  },
  standoff() {
    this.phase = "steady";
    this.render();
    const wait = rand(1500, 4000);
    const decoy = this.round >= 4 && Math.random() < 0.35;
    if (decoy) {
      later(() => {
        this.phase = "decoy";
        show(`${this.header()}<p class="big red">HOLD</p>`);
        later(() => { this.phase = "steady"; this.render(); later(() => this.fire(), rand(900, 2200)); }, 800);
      }, wait * 0.6);
    } else {
      later(() => this.fire(), wait);
    }
  },
  fire() {
    this.phase = "draw";
    this.shownAt = show(`${this.header()}<p class="big gold">DRAW!</p>`);
    sfx.draw();
    later(() => { if (this.phase === "draw") this.resolve(null); }, TOO_SLOW_MS);
  },
  resolve(ms) {
    clearTimers();
    const won = ms != null && ms < this.rivalMs;
    if (won) { this.beaten++; sfx.win(); } else { this.lives--; sfx.lose(); }
    if (ms != null) recordSample("Enter", ms);
    this.phase = "result";
    const verdict = won ? `<p class="mid green">You win</p>` : `<p class="mid red">${ms == null ? "Too slow" : "Outdrawn"}</p>`;
    draw(`${this.header()}${verdict}
      <p class="big ${won ? "green" : "red"}" style="font-size:72px">${ms == null ? "–" : Math.round(ms)}</p>
      <p class="body">${ms == null ? "" : "ms · "}${this.rival}: ${this.rivalMs} ms</p>
      <div class="hint">Pinch to go on</div>`);
  },
  foul() {
    clearTimers();
    this.lives--;
    sfx.foul();
    this.phase = "result";
    draw(`${this.header()}<p class="mid red">Jumped the gun!</p>
      <p class="body">${this.rival} wins this one.</p>
      <div class="hint">Pinch to go on</div>`);
  },
  over() {
    const record = this.beaten > state.bestDuel;
    if (record) { state.bestDuel = this.beaten; saveState(); }
    this.phase = "over";
    draw(`<p class="small">Game over</p>
      <p class="big gold">${this.beaten}</p>
      <p class="body">rival${this.beaten === 1 ? "" : "s"} beaten</p>
      <p class="small ${record ? "green" : ""}">${record ? "New best!" : "Best: " + state.bestDuel}</p>
      <div class="hint">Pinch to go again · Back for menu</div>`);
  },
  input(key, t) {
    if (key !== "Enter") return false;
    if (this.phase === "intro") this.standoff();
    else if (this.phase === "steady" || this.phase === "decoy") this.foul();
    else if (this.phase === "draw") this.resolve(t - this.shownAt);
    else if (this.phase === "result") {
      if (this.lives <= 0) this.over();
      else { this.next(); this.render(); }
    } else if (this.phase === "over") go(duel);
    return true;
  },
};

// ===== Trials shared by Quick Draw and Swipe Draw =====
function trialScreen(opts) {
  return {
    enter() { this.i = 0; this.times = []; this.misses = 0; this.phase = "intro"; },
    render() {
      if (this.phase === "intro") {
        draw(`<p class="title">${opts.title}</p>
          <p class="body">${opts.blurb}</p>
          <p class="small">${opts.count} tries. Too early or wrong way doesn't count.</p>
          <div class="hint">Pinch to start</div>`);
      }
    },
    counter() { return `<div class="top"><span>${opts.title}</span><span>${this.i + 1} / ${opts.count}</span></div>`; },
    arm() {
      this.phase = "wait";
      this.target = opts.pick();
      draw(`${this.counter()}${opts.waiting()}`);
      later(() => {
        this.phase = "live";
        this.shownAt = show(`${this.counter()}${opts.live(this.target)}`);
        sfx.draw();
        later(() => { if (this.phase === "live") this.miss("Too slow"); }, TOO_SLOW_MS);
      }, rand(1000, 3200));
    },
    miss(why) {
      clearTimers();
      this.misses++;
      sfx.foul();
      this.phase = "note";
      draw(`${this.counter()}<p class="mid red">${why}</p><p class="small">Try that one again</p>`);
      later(() => this.arm(), 1100);
    },
    hit(key, ms) {
      clearTimers();
      this.times.push({ key, ms });
      recordSample(key, ms);
      this.phase = "note";
      draw(`${this.counter()}<p class="big green" style="font-size:80px">${Math.round(ms)}</p><p class="small">ms</p>`);
      this.i++;
      later(() => (this.i >= opts.count ? this.results() : this.arm()), 900);
    },
    results() {
      this.phase = "done";
      const ms = this.times.map((x) => x.ms);
      const best = Math.min(...ms);
      let extra = "";
      if (opts.perKey) {
        const rows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map((k) => {
          const xs = this.times.filter((x) => x.key === k).map((x) => x.ms);
          return `<tr><td>${INPUT_LABEL[k].replace("Swipe ", "")}</td><td>${fmt(median(xs))}</td></tr>`;
        }).join("");
        extra = `<table><tr><th>Swipe</th><th>Median</th></tr>${rows}</table>`;
      }
      sfx.win();
      draw(`<p class="small">${opts.title} · median</p>
        <p class="big gold">${median(ms)}</p>
        <p class="body">ms · best ${Math.round(best)} · misses ${this.misses}</p>
        ${extra}
        <div class="hint">Pinch to go again · Back for menu</div>`);
    },
    input(key, t) {
      if (this.phase === "intro") { if (key !== "Enter") return false; this.arm(); return true; }
      if (this.phase === "done") { if (key !== "Enter") return false; go(this); return true; }
      if (!INPUTS.includes(key)) return false;
      if (this.phase === "wait") { this.miss("Too early"); return true; }
      if (this.phase === "live") {
        if (opts.accepts(key, this.target)) this.hit(key, t - this.shownAt);
        else this.miss("Wrong way");
        return true;
      }
      return true; // swallow input during short notes
    },
  };
}

const quick = trialScreen({
  title: "Quick Draw",
  blurb: "The ring lights up. Pinch.",
  count: 10,
  pick: () => "Enter",
  waiting: () => `<div class="ring"></div><p class="small">Wait for it…</p>`,
  live: () => `<div class="ring live"></div><p class="mid green">NOW</p>`,
  accepts: (key) => key === "Enter",
});

const ARROW_ROT = { ArrowUp: 0, ArrowRight: 90, ArrowDown: 180, ArrowLeft: 270 };
const swipe = trialScreen({
  title: "Swipe Draw",
  blurb: "A chevron appears. Swipe the way it points.",
  count: 12,
  perKey: true,
  pick: () => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"][Math.floor(Math.random() * 4)],
  waiting: () => `<div class="arrow"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="6" fill="#7f8aa3"/></svg></div><p class="small">Wait for it…</p>`,
  // Drawn as SVG, not an arrow glyph, so it shows whatever fonts the glasses have.
  live: (k) => `<div class="arrow"><svg viewBox="0 0 100 100"><g transform="rotate(${ARROW_ROT[k]} 50 50)">
      <polyline points="22,62 50,32 78,62" fill="none" stroke="#59d8ff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    </g></svg></div>`,
  accepts: (key, target) => key === target,
});

// ===== Stats: per input, this environment vs the other =====
const stats = {
  confirm: false,
  enter() { this.confirm = false; },
  render() {
    const rows = INPUTS.map((k) => {
      const l = state.samples.lens[k];
      const d = state.samples.desktop[k];
      const ml = median(l), md = median(d);
      const lag = ml != null && md != null ? (ml - md > 0 ? "+" : "") + (ml - md) : "–";
      return `<tr><td>${INPUT_LABEL[k]}</td><td>${fmt(ml)}</td><td>${fmt(md)}</td><td class="cyan">${lag}</td></tr>`;
    }).join("");
    draw(`<p class="title" style="font-size:34px">Stats</p>
      <p class="small">Median of the last ${MAX_SAMPLES} · this screen counts as <b>${ENV}</b></p>
      <table><tr><th></th><th>Lens</th><th>Desktop</th><th>Lag</th></tr>${rows}</table>
      <p class="small">Lag = glasses minus laptop: the input delay to offset in a rhythm game.</p>
      <p class="small">Best duel: ${state.bestDuel}</p>
      <div class="hint">${this.confirm ? `<span class="red">Pinch again to erase all stats</span>` : "Pinch to reset · Back for menu"}</div>`);
  },
  input(key) {
    if (key !== "Enter") return false;
    if (this.confirm) {
      const keep = { sound: state.sound };
      Object.assign(state, freshState(), keep);
      saveState();
      this.confirm = false;
    } else this.confirm = true;
    this.render();
    return true;
  },
};

// ---------- input ----------
function handle(key, t) {
  unlockAudio();
  if (key === "Escape" || key === "Backspace") {
    if (screen === menu) return false; // let the host handle back at the root
    go(menu);
    return true;
  }
  return screen.input(key, t);
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (handle(e.key, e.timeStamp)) e.preventDefault();
});

// Simulator buttons: pointerdown, not click, so the measured time isn't padded by the release.
document.querySelectorAll("#sim button").forEach((b) => {
  b.addEventListener("pointerdown", (e) => { e.preventDefault(); handle(b.dataset.key, e.timeStamp); });
});

go(menu);
