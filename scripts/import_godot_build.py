#!/usr/bin/env python3
"""Import a zipped Godot web export from VibeCoding-2-Extra-Vibes into both repos.

Usage:
    python3 -I scripts/import_godot_build.py [VERSION ...]

With no VERSION, imports the newest version folder that has a zip link.
For each version it:
  1. reads the zip link + SHA-256 from Exports/Games/<Game>/<version>/README.md
  2. downloads into a temp dir, verifies the hash, and unzips safely
  3. copies the files into VC2's export folder and Vibes' Games/<Game>/Versions/<version>/
  4. adds the version to the game's dropdown in Vibes/index.html (creating the card if needed)
Commits are left to the caller.
"""
import hashlib
import html
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

VIBES = Path(__file__).resolve().parent.parent
VC2 = VIBES.parent / "VibeCoding-2-Extra-Vibes"

# VC2 export folder name -> how it appears in Vibes
GAMES = {
    "DeadCitySurvival": {
        "vibes_dir": "Dead City Survival",
        "title": "Dead City Survival",
        "description": "Survive the dead city. Scavenge, hold out, and make it through the night.",
    },
}
GAME = "DeadCitySurvival"

LINK_RE = re.compile(r"\]\((https://[^)\s]+\.zip)\)[^`\n]*SHA-256\s*`([0-9a-f]{64})`")


def version_key(v):
    return tuple(int(n) for n in re.findall(r"\d+", v))


def find_zip(readme):
    m = LINK_RE.search(readme.read_text())
    if not m:
        raise SystemExit(f"No zip link + SHA-256 found in {readme}")
    return m.group(1), m.group(2)


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
        if f.is_file():
            shutil.copy2(f, dest / f.name)


def li(href, label):
    return f'                                <li><a class="dropdown-item" href="{href}">{label}</a></li>'


def update_index(game, version, html_name):
    cfg = GAMES[game]
    index = VIBES / "index.html"
    text = index.read_text()
    prefix = f"Games/{cfg['vibes_dir']}/Versions/"
    href = f"{prefix}{version}/{html_name}"

    if href in text:
        print("  index.html already lists this version")
        return

    if prefix not in text:
        card = f"""            <div class="col-md-6 col-lg-4 mt-4">
                <div class="card p-3 h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h5 class="card-title mb-0">{html.escape(cfg['title'])}</h5>
                            <span class="badge rounded-pill">{version}</span>
                        </div>
                        <p class="card-text">{html.escape(cfg['description'])}</p>
                        <div class="dropdown mt-3">
                            <button class="btn btn-primary w-100 dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                Play Version
                            </button>
                            <ul class="dropdown-menu w-100">
{li(href, version + " (Latest)")}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
"""
        # Insert after the last game card (the last card with a "Play Version" dropdown).
        last_ul = text.rfind("</ul>", 0, text.find("Open App") if "Open App" in text else len(text))
        anchor = text.find("            <div class=\"col-", last_ul)
        text = text[:anchor] + card + text[anchor:]
        print("  added new card to index.html")
    else:
        start = text.find(prefix)
        card_start = text.rfind('<div class="card-body">', 0, start)
        card_end = text.find("</ul>", start)
        card = text[card_start:card_end]
        existing = re.findall(re.escape(prefix) + r"([^/\"]+)/", card)
        is_latest = all(version_key(version) > version_key(v) for v in existing)
        if is_latest:
            card = card.replace(" (Latest)</a>", "</a>")
            card = re.sub(r'(<span class="badge rounded-pill">)[^<]*(</span>)', rf"\g<1>{version}\g<2>", card, count=1)
            ul = card.find('<ul class="dropdown-menu w-100">') + len('<ul class="dropdown-menu w-100">')
            card = card[:ul] + "\n" + li(href, version + " (Latest)") + card[ul:]
        else:
            # Insert in version order below newer entries.
            lines = card.split("\n")
            ver_re = re.compile(re.escape(prefix) + r"([^/\"]+)/")
            pos = next((i for i, l in enumerate(lines)
                        if prefix in l and version_key(ver_re.search(l).group(1)) < version_key(version)),
                       len(lines) - 1)
            lines.insert(pos, li(href, version))
            card = "\n".join(lines)
        text = text[:card_start] + card + text[card_end:]
        print("  added dropdown entry to index.html")
    index.write_text(text)


def main():
    game = GAME
    exports = VC2 / "Exports" / "Games" / game
    r = subprocess.run(["git", "-C", str(VC2), "pull", "-q"], capture_output=True, text=True)
    if r.returncode:
        print(f"warning: git pull in VC2 failed, using local copy ({r.stderr.strip().splitlines()[-1]})")

    versions = sys.argv[1:]
    if not versions:
        candidates = sorted((d.name for d in exports.iterdir() if (d / "README.md").exists()), key=version_key)
        versions = [candidates[-1]]

    for version in versions:
        print(f"{game} {version}")
        url, sha = find_zip(exports / version / "README.md")
        with tempfile.TemporaryDirectory() as tmp:
            src = download_and_extract(url, sha, Path(tmp))
            html_name = next(src.glob("*.html")).name
            copy_files(src, exports / version)
            copy_files(src, VIBES / "Games" / GAMES[game]["vibes_dir"] / "Versions" / version)
            print(f"  copied {sum(1 for f in src.iterdir() if f.is_file())} files to both repos")
        update_index(game, version, html_name)


if __name__ == "__main__":
    main()
