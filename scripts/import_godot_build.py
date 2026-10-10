#!/usr/bin/env python3
"""Import a zipped Godot web export from VibeCoding-2-Extra-Vibes into both repos.

Usage:
    python3 -I scripts/import_godot_build.py                     # every version of every game not yet imported
    python3 -I scripts/import_godot_build.py GAME [VERSION ...]  # GAME = folder under Exports/Games (default: newest)

For each version it:
  1. reads the zip link + SHA-256 from Exports/Games/<Game>/<version>/README.md
  2. downloads into a temp dir, verifies the hash, and unzips safely
  3. copies the files into VC2's export folder and Vibes' Games/<Game>/Versions/<version>/
  4. adds the version to the game's entry in Vibes/games.json (creating the entry if needed)
Commits are left to the caller.
"""
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

VIBES = Path(__file__).resolve().parent.parent
VC2 = VIBES.parent / "VibeCoding-2-Extra-Vibes"

EXPORTS = VC2 / "Exports" / "Games"

# VC2 games are built by Muse; edit the project in games.json if one was made differently.
DEFAULT_MODEL = "Muse (unknown model, Oct 2026)"

# Optional per-game overrides; otherwise title/description come from the game's project.godot.
OVERRIDES = {
    "DeadCitySurvival": {"vibes_dir": "Dead City Survival", "title": "Dead City Survival"},
}


def game_info(game):
    project = VC2 / "Games" / game / "project.godot"
    text = project.read_text() if project.exists() else ""
    name = re.search(r'^config/name="([^"]*)"', text, re.M)
    desc = re.search(r'^config/description="([^"]*)"', text, re.M)
    title = name.group(1) if name else game
    info = {"vibes_dir": title, "title": title, "description": desc.group(1) if desc else f"{title}, made in Godot."}
    info.update(OVERRIDES.get(game, {}))
    return info

# Accepts "[x.zip](url) — SHA-256 `hash`" and "**Download:** url" / "**SHA-256:** hash" on separate lines.
URL_RE = re.compile(r"https://[^\s)<>]+\.zip")
SHA_RE = re.compile(r"SHA-256[^0-9a-f\n]*\n?[^0-9a-f\n]*([0-9a-f]{64})")


def version_key(v):
    return tuple(int(n) for n in re.findall(r"\d+", v))


def find_zip(readme):
    text = readme.read_text() if readme.exists() else ""
    url = URL_RE.search(text)
    sha = url and SHA_RE.search(text, url.end())
    return (url.group(0), sha.group(1)) if sha else None


def download_and_extract(url, sha, workdir):
    zpath = workdir / "export.zip"
    print(f"  downloading {url.rsplit('/', 1)[-1]} ...")
    # curl uses the system cert store (python.org builds often lack CA certs).
    subprocess.run(["curl", "-fsSL", "-o", str(zpath), url], check=True)
    digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
    if digest != sha:
        raise SystemExit(f"  SHA-256 mismatch: got {digest}, expected {sha}")
    out = workdir / "extracted"
    out.mkdir()
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():
            target = (out / name).resolve()
            if not target.is_relative_to(out.resolve()):
                raise SystemExit(f"  Unsafe path in zip: {name}")
        z.extractall(out)
    htmls = [p for p in out.rglob("*.html") if "__MACOSX" not in p.parts]
    if len(htmls) != 1:
        raise SystemExit(f"  Expected one .html in zip, found {[str(p) for p in htmls]}")
    return htmls[0].parent


def copy_files(src, dest):
    dest.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        # The repo README holds the zip link; never let a stale copy from the zip clobber it.
        if f.is_file() and f.name not in ("README.md", ".DS_Store"):
            shutil.copy2(f, dest / f.name)


def update_data(cfg, version, html_name):
    data_file = VIBES / "games.json"
    data = json.loads(data_file.read_text())
    folder = f"Games/{cfg['vibes_dir']}"
    href = f"{folder}/Versions/{version}/{html_name}"
    today = datetime.date.today().isoformat()

    project = next((p for p in data["projects"] if p["folder"] == folder), None)
    if project is None:
        project = {"title": cfg["title"], "kind": "game", "folder": folder, "description": cfg["description"],
                   "updated": today, "model": DEFAULT_MODEL, "context": "", "images": [], "versions": []}
        data["projects"].append(project)
        print("  added new project to games.json (fill in context/thumbnail there)")

    versions = project["versions"]
    if any(v["href"] == href for v in versions):
        print("  games.json already lists this version")
        return
    versions = [v for v in versions if v["version"] != version] + [{"version": version, "href": href}]
    project["versions"] = sorted(versions, key=lambda v: version_key(v["version"]), reverse=True)
    if project["versions"][0]["version"] == version:
        project["updated"] = today
    data_file.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("  added version to games.json")


def import_version(game, cfg, version):
    print(f"{game} {version}")
    zip_info = find_zip(EXPORTS / game / version / "README.md")
    if not zip_info:
        print("  no zip link + SHA-256 in README yet, skipping")
        return
    with tempfile.TemporaryDirectory() as tmp:
        src = download_and_extract(*zip_info, Path(tmp))
        html_name = next(src.glob("*.html")).name
        copy_files(src, EXPORTS / game / version)
        copy_files(src, VIBES / "Games" / cfg["vibes_dir"] / "Versions" / version)
        print(f"  copied {sum(1 for f in src.iterdir() if f.is_file())} files to both repos")
    update_data(cfg, version, html_name)


def versions_of(game):
    return sorted((d.name for d in (EXPORTS / game).iterdir() if (d / "README.md").exists()), key=version_key)


def main():
    r = subprocess.run(["git", "-C", str(VC2), "pull", "-q", "--rebase", "--autostash"], capture_output=True, text=True)
    if r.returncode:
        print(f"warning: git pull in VC2 failed, using local copy ({r.stderr.strip().splitlines()[-1]})")

    if len(sys.argv) > 1:
        match = [d.name for d in EXPORTS.iterdir() if d.name.lower() == sys.argv[1].lower()]
        if not match:
            raise SystemExit(f"Unknown game {sys.argv[1]!r}; choose from {sorted(d.name for d in EXPORTS.iterdir() if d.is_dir())}")
        game = match[0]
        for version in sys.argv[2:] or versions_of(game)[-1:]:
            import_version(game, game_info(game), version)
        return

    # No args: every version of every game that isn't in Vibes yet.
    for d in sorted(EXPORTS.iterdir()):
        if not d.is_dir():
            continue
        game, cfg = d.name, game_info(d.name)
        new = [v for v in versions_of(game)
               if not any((VIBES / "Games" / cfg["vibes_dir"] / "Versions" / v).glob("*.html"))]
        if not new:
            print(f"{game}: up to date")
        for version in new:
            import_version(game, cfg, version)


if __name__ == "__main__":
    main()
