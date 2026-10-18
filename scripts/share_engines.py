#!/usr/bin/env python3
"""Move duplicate Godot engine files out of each build into Engines/<hash>/, shared by every build.

Usage:
    python3 -I scripts/share_engines.py

Every Godot web export ships the same ~40 MB engine .wasm, so 200 builds came to ~12 GB and broke the
GitHub Pages deploy (1 GB limit). This keeps one copy per engine and points each build's GODOT_CONFIG
at it ("executable" = shared path, "mainPack" = the build's own .pck). Safe to rerun; the importers
call it after every import.
"""
import hashlib
import json
import os
import re
import shutil
from pathlib import Path

VIBES = Path(__file__).resolve().parent.parent
ENGINES = VIBES / "Engines"
CONFIG = re.compile(r"(const GODOT_CONFIG = )(\{.*?\});")
# Files the engine loads relative to "executable" (see locateFile in the export's .js).
ENGINE_SUFFIXES = (".wasm", ".js", ".audio.worklet.js", ".audio.position.worklet.js")


def file_hash(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def share_build(html):
    text = html.read_text()
    m = CONFIG.search(text)
    if not m:
        return False
    cfg = json.loads(m.group(2))
    stem = cfg.get("executable", "")
    wasm = html.parent / f"{stem}.wasm"
    if "/" in stem or not wasm.is_file():
        return False  # already shared, or not a standard export

    engine = ENGINES / file_hash(wasm)
    engine.mkdir(parents=True, exist_ok=True)
    for suffix in ENGINE_SUFFIXES:
        src, dest = html.parent / f"{stem}{suffix}", engine / f"godot{suffix}"
        if src.is_file() and not dest.exists():
            shutil.copy2(src, dest)

    exe = Path(os.path.relpath(engine / "godot", html.parent)).as_posix()
    sizes = cfg.get("fileSizes", {})
    if f"{stem}.wasm" in sizes:
        sizes[f"{exe}.wasm"] = sizes.pop(f"{stem}.wasm")
    cfg["executable"] = exe
    cfg["mainPack"] = f"{stem}.pck"
    new = m.group(1) + json.dumps(cfg, separators=(",", ":"), ensure_ascii=False) + ";"
    html.write_text(text[:m.start()] + new + text[m.end():])
    wasm.unlink()
    return True


def share_engines():
    moved = sum(share_build(h) for h in sorted((VIBES / "Games").rglob("*.html")))
    if moved:
        print(f"Shared engine for {moved} build(s) in {ENGINES.relative_to(VIBES)}/")
    return moved


if __name__ == "__main__":
    share_engines()
