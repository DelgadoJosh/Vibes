"use strict";

// The version log the app shows, newest first. Every release adds one entry at the top: short, player-facing,
// plain text (it's drawn with textContent, and the default font is Roboto Mono, so no arrows or emoji).
const VERSIONS = [
  { v: "v1.1.3", date: "2026-11-06", notes: [
    "Replays, results and stats stay sharp and keep playing when the window isn't focused. Only a test you're typing asks for focus.",
  ] },
  { v: "v1.1.2", date: "2026-11-06", notes: [
    "Backspace now goes back as far as you like, through right words too, all the way to the first word. Opt/ctrl+backspace deletes a word at a time.",
    "Older replays still play back with the rules they were typed under, so their scores don't change.",
    "Added this version log.",
    "Imported files are checked more carefully.",
  ] },
  { v: "v1.1.1", date: "2026-11-02", notes: [
    "Export files are named with the local date and 24-hour time, so several exports in a day don't collide.",
  ] },
  { v: "v1.1.0", date: "2026-10-25", notes: [
    "Stats page: totals, a progress chart, recent tests and your top 10 per mode, each one replayable.",
    "Export and import your tests, recordings included, to move them to another browser.",
  ] },
  { v: "v1.0.0", date: "2026-10-25", notes: [
    "Typing test in time (15/30/60 s) and words (10/25/50) modes.",
    "A live keyboard that lights up every key you press, red for a wrong letter.",
    "Results with wpm, accuracy and a wpm-over-time chart, and a replay of the whole test at 0.5x to 4x.",
  ] },
];
