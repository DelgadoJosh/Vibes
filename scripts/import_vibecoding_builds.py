#!/usr/bin/env python3
"""Import Godot web exports from the original VibeCoding repo (read-only) into Vibes.

Usage:
    python3 -I scripts/import_vibecoding_builds.py [-n]                   # new builds of every game
    python3 -I scripts/import_vibecoding_builds.py [-n] GAME [VERSION ...]  # force specific versions
    python3 -I scripts/import_vibecoding_builds.py --check                # is every game complete? (exit 1 if not)
                                                                          # also lists cards missing screenshots/description/model

VibeCoding/Exports/<Game>/<version>/ holds the unzipped export. "New" means newer than the newest
version games.json lists for that project (older ones were left out on purpose), or every version
if the project isn't in games.json yet. GAME is an export folder or Vibes folder name. -n = dry run.
Files are copied into Vibes/Games/<dir>/Versions/<version>/ and listed in games.json.
VibeCoding is never modified. Commits are left to the caller.
"""
import datetime
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from share_engines import share_engines  # noqa: E402

VIBES = Path(__file__).resolve().parent.parent
VC = VIBES.parent / "VibeCoding"
EXPORTS = VC / "Exports"
DATA = VIBES / "games.json"

# Export folder -> how it maps into Vibes. Unlisted folders are only reported (folders get renamed upstream);
# add them here, or name one on the command line to import it as a new game.
# Order matters where two folders feed one project (Cooking Factory was renamed Bloomworks at v0.1.13).
SOURCES = {
    "Puyos Revenge": {"vibes_dir": "Puyo's Revenge"},  # Godot Inventory Manager builds
    "Cooking Factory": {"vibes_dir": "Bloomworks", "title": "Bloomworks"},
    "Bloomworks": {},
    "Deadblock": {"rename": {"v1.0.1": "v0.1.1", "v1.0.2": "v0.1.2"}},
    "Deadblock 3D": {},
    "Deadblock 3D 2 - Ashfall": {},
    "Potion Maker": {},
    "Time Keeper": {},
    "Honk Raid": {},
    "Top Down Mech": {},
    "Kenshilike": {},
    "Infection Cleaner": {},
    # Imported 2026-10-27 from VibeCoding-2-Extra-Vibes; already on the site, folder names match.
    "BeltAndSteam": {},
    "CrowdRunner": {},
    "Dead City Survival": {},
    "Dead City Survival 2D": {},
    "ForgeGrid": {},
    "WebRTC Zombies": {"vibes_dir": "Multiplayer Tech Demo", "title": "Multiplayer Tech Demo",
                       "description": "Testing to see if we can have Multiplayer in Godot Web exports"},
    "Hookpin Heist": {},
    "Chomp Tower": {"description": "Tap smaller numbers, chomp them, get BIG, eat the boss. A silly fake-ad tower game for phones."},
    "Pour Decisions": {"description": "Tap a test tube, pour the sand. Sort every color into its own tube across endless levels that keep getting harder."},
    "Gridlock Getaway": {},
    "Senpai Alert": {},
    "Valet Shuffle": {},
    "Iron Orders": {"description": "Give your orders in secret, then watch every player's moves play out one at a time. Take regions with armies and commanders against AI or friends online, on built-in maps or ones you make."},
    "Siege Lines": {},
    "Delivery Driver": {"skip": True},  # single flat build, already on the site as Dangerous Delivery Driver
}
SKIP_FILES = {".DS_Store", "README.md"}
VERSION_DIR = re.compile(r"^(v\d+(?:\.\d+)*)(?:\s+(.+))?$")  # "v0.5.0 Scoreboard" -> version, label


def version_key(v):
    return tuple(int(n) for n in re.findall(r"\d+", v))


def config(name):
    cfg = {"vibes_dir": name, "title": name, "rename": {}, "skip": False}
    cfg.update(SOURCES.get(name, {}))
    cfg.setdefault("title", cfg["vibes_dir"])
    return cfg


def builds(name, cfg):
    """[(dir, version, label)] for an export folder, oldest first."""
    out = []
    for d in (EXPORTS / name).iterdir():
        m = d.is_dir() and VERSION_DIR.match(d.name)
        if m:
            out.append((d, cfg["rename"].get(m.group(1), m.group(1)), m.group(2)))
    return sorted(out, key=lambda b: version_key(b[1]))


def build_date(path):
    r = subprocess.run(["git", "-C", str(VC), "log", "-1", "--format=%cs", "--", str(path)],
                       capture_output=True, text=True)
    return r.stdout.strip() or datetime.date.fromtimestamp(path.stat().st_mtime).isoformat()


def find_project(data, cfg):
    return next((p for p in data["projects"] if p["folder"] == f"Games/{cfg['vibes_dir']}"), None)


SKIPPED = []  # repeated at the end of the run so a skip can't scroll past unnoticed


def import_build(data, cfg, src, version, label, dry):
    # Prefer the top-level build; extra variants (e.g. threaded/) live in subfolders.
    # Installable (PWA) exports add a <name>.offline.html fallback page; it's copied, but isn't the build's page.
    page = lambda p: not p.name.endswith(".offline.html")
    htmls = [p for p in src.glob("*.html") if page(p)] or \
        [p for p in src.rglob("*.html") if "__MACOSX" not in p.parts and page(p)]
    if len(htmls) != 1:
        print(f"  {version}: expected one .html, found {len(htmls)}, skipping")
        SKIPPED.append(f"{cfg['title']} {version} ({len(htmls)} .html)")
        return
    # A round commits a chunk's export only once it's tested; an uncommitted or modified export
    # folder is still mid-chunk, so leave it for the next run.
    dirty = subprocess.run(["git", "-C", str(VC), "status", "--porcelain", "--untracked-files=all", "--", str(src)],
                           capture_output=True, text=True).stdout.strip()
    if dirty:
        print(f"  {version}: export not committed in VibeCoding yet, skipping")
        SKIPPED.append(f"{cfg['title']} {version} (not committed yet)")
        return
    html = htmls[0]
    vdir = version + (f" {label}" if label else "")
    dest = VIBES / "Games" / cfg["vibes_dir"] / "Versions" / vdir
    entry = {"version": version, **({"label": label} if label else {}),
             "href": f"Games/{cfg['vibes_dir']}/Versions/{vdir}/{html.name}"}
    print(f"  {version}{' — ' + label if label else ''} -> {dest.relative_to(VIBES)}")
    if dry:
        return

    dest.mkdir(parents=True, exist_ok=True)
    for f in html.parent.iterdir():
        if f.is_file() and f.name not in SKIP_FILES and f.suffix != ".zip":
            shutil.copy2(f, dest / f.name)

    project = find_project(data, cfg)
    if project is None:
        project = {"title": cfg["title"], "kind": "game", "folder": f"Games/{cfg['vibes_dir']}",
                   "description": cfg.get("description", f"{cfg['title']}, made in Godot."), "updated": "", "model": "",
                   "context": "", "images": [], "versions": []}
        data["projects"].append(project)
        print("  (new project in games.json: fill in description, model, context and images)")
    versions = [v for v in project["versions"] if v["version"] != version] + [entry]
    project["versions"] = sorted(versions, key=lambda v: version_key(v["version"]), reverse=True)
    if project["versions"][0]["version"] == version:
        project["updated"] = build_date(src)


def check(data):
    """Report export versions missing from games.json and unknown export folders; True if complete."""
    site = {p["folder"]: [v["version"] for v in p["versions"]] for p in data["projects"]}
    ok = True
    for name in SOURCES:
        cfg = config(name)
        if cfg["skip"] or not (EXPORTS / name).is_dir():
            continue
        have = site.get(f"Games/{cfg['vibes_dir']}", [])
        newest = max(map(version_key, have), default=())
        missing = [v for _, v, _ in builds(name, cfg) if v not in have and version_key(v) > newest]
        if missing:
            ok = False
            print(f"{name}: {len(missing)} missing ({missing[0]} - {missing[-1]})")
    unlisted = sorted(d.name for d in EXPORTS.iterdir()
                      if d.is_dir() and d.name not in SOURCES and not VERSION_DIR.match(d.name))
    if unlisted:
        ok = False
        print(f"Unknown export folders: {unlisted}")
    print("Every game is complete." if ok else "Not complete.")
    # Card details aren't builds, so they don't fail the check, but a new game isn't done without them.
    for p in data["projects"]:
        if p.get("hidden"):
            continue
        gaps = [g for g, bad in (("no screenshots", not p.get("images")),
                                 ("placeholder description", p.get("description", "").endswith(", made in Godot.")),
                                 ("no model", not p.get("model"))) if bad]
        if gaps:
            print(f"Card needs details: {p['title']} ({', '.join(gaps)}); see README#screenshots")
    return ok


def main():
    args = sys.argv[1:]
    if "--check" in args:
        sys.exit(0 if check(json.loads(DATA.read_text())) else 1)
    dry = "-n" in args
    args = [a for a in args if a != "-n"]
    data = json.loads(DATA.read_text())
    names = [n for n in SOURCES if (EXPORTS / n).is_dir()]
    unlisted = sorted(d.name for d in EXPORTS.iterdir()
                      if d.is_dir() and d.name not in SOURCES and not VERSION_DIR.match(d.name))

    if args:
        game = args[0].lower()
        names = [n for n in names + unlisted if game in (n.lower(), config(n)["vibes_dir"].lower())]
        if not names:
            raise SystemExit(f"Unknown game {args[0]!r}")

    for name in names:
        cfg = config(name)
        if cfg["skip"] and not args:
            continue
        print(f"{name} -> {cfg['vibes_dir']}")
        found = 0
        for src, version, label in builds(name, cfg):
            if args[1:]:
                if version not in args[1:]:
                    continue
            else:
                project = find_project(data, cfg)
                if project and project["versions"] and \
                        version_key(version) <= version_key(project["versions"][0]["version"]):
                    continue
            import_build(data, cfg, src, version, label, dry)
            found += 1
        if not found:
            print("  up to date")

    if SKIPPED:
        print(f"SKIPPED {len(SKIPPED)} build(s), not imported: " + ", ".join(SKIPPED))
    if unlisted and not args:
        print(f"Not imported, unknown export folders: {unlisted}. Add them to SOURCES or pass one as GAME.")
    if not dry:
        DATA.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        share_engines()


if __name__ == "__main__":
    main()
