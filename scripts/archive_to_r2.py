#!/usr/bin/env python3
"""Move old builds from Pages to Cloudflare R2, keeping every version playable.

Usage:
    python3 -I scripts/archive_to_r2.py [--apply] [--verify] [GAME ...]

Per game, the keep set is the newest KEEP_NEWEST versions plus the last build of each
major.minor (e.g. Ashfall v0.12.x's last). Every other version under Games/<dir>/Versions/ is
uploaded to the bucket at the same path, its games.json href becomes the absolute R2 URL, and its
folder is removed from the repo. Engines/ is uploaded too, so each build's relative
"../../../../Engines/<hash>/" path still resolves on R2.

Without --apply it only prints the plan. With --apply it uploads (rclone, keys from the Keychain
via r2_env.sh), checks every upload, and only then rewrites games.json, `git rm`s the folders and
rebuilds version_logs.json. It never deletes from R2, never commits and never pushes. It exits 1
if the site would be over SIZE_LIMIT_MB afterwards.

GAME filters by project title or folder name (case-insensitive). --verify checks that every
relative href exists and that a sample of R2 hrefs answers 200. Settings: scripts/r2_config.json.
See ../VibeCoding/docs/vibes-r2-migration.md.
"""
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

VIBES = Path(__file__).resolve().parent.parent
GAMES_JSON = VIBES / "games.json"
CONFIG = VIBES / "scripts" / "r2_config.json"
ENV_SH = VIBES / "scripts" / "r2_env.sh"
KEEP_NEWEST = 10
SIZE_LIMIT_MB = 900
CACHE_HEADER = "Cache-Control: public, max-age=31536000, immutable"
FOLDER_RE = re.compile(r"^(Games/[^/]+/Versions/[^/]+)/")
VERSION_RE = re.compile(r"^v(\d+(?:\.\d+)*)$")


def vkey(version):
    m = VERSION_RE.match(version)
    return tuple(int(n) for n in m.group(1).split(".")) if m else None


def keep_set(versions):
    """Versions to leave on Pages: the newest KEEP_NEWEST plus each major.minor's last build."""
    ranked = sorted((v for v in versions if vkey(v)), key=vkey, reverse=True)
    keep = set(ranked[:KEEP_NEWEST])
    seen = set()
    for v in ranked:
        if vkey(v)[:2] not in seen:
            seen.add(vkey(v)[:2])
            keep.add(v)
    return keep | {v for v in versions if not vkey(v)}


def folder_bytes(path):
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def site_bytes():
    """What Pages publishes: everything but .git and scripts/."""
    total = 0
    for root, dirs, files in os.walk(VIBES):
        if root == str(VIBES):
            dirs[:] = [d for d in dirs if d not in (".git", "scripts")]
        total += sum(os.path.getsize(os.path.join(root, f)) for f in files)
    return total


def mb(n):
    return f"{n / 1e6:,.0f} MB"


def rclone(env, *args):
    subprocess.run(["rclone", *args], env=env, check=True)


def r2_env():
    """rclone's environment with the r2 remote configured from the Keychain."""
    out = subprocess.run(["sh", "-c", f'. "{ENV_SH}" && env -0'], capture_output=True, check=True)
    env = dict(line.split("=", 1) for line in out.stdout.decode().split("\0") if "=" in line)
    env["RCLONE_CONFIG"] = os.devnull
    return env


def plan(projects, filters):
    """[(project, version entry, folder)] to archive, and the count kept, for matching games."""
    todo, kept = [], 0
    for p in projects:
        name = p["folder"].split("/")[-1]
        if filters and not {p["title"].lower(), name.lower()} & filters:
            continue
        keep = keep_set([v["version"] for v in p["versions"]])
        for v in p["versions"]:
            m = FOLDER_RE.match(v["href"])
            if v["href"].startswith("https://") or not m or v["version"] in keep:
                kept += not v["href"].startswith("https://")
                continue
            todo.append((p, v, m.group(1)))
    return todo, kept


def verify(projects, base):
    local = [v["href"] for p in projects for v in p["versions"] if not v["href"].startswith("https://")]
    missing = [h for h in local if not (VIBES / h).exists()]
    remote = [v["href"] for p in projects for v in p["versions"] if v["href"].startswith(base)]
    failed = []
    for href in random.sample(remote, min(20, len(remote))):
        # curl, not urllib: python.org's Python has no CA certificates unless set up.
        status = subprocess.run(["curl", "-s", "-o", os.devnull, "-I", "-m", "20", "-w", "%{http_code}",
                                 href], capture_output=True, text=True).stdout
        if status != "200":
            failed.append((href, status))
    print(f"Verify: {len(local)} local hrefs, {len(missing)} missing; "
          f"{min(20, len(remote))} of {len(remote)} R2 hrefs sampled, {len(failed)} failed.")
    for h in missing:
        print(f"  missing: {h}")
    for h, s in failed:
        print(f"  R2 {s}: {h}")
    return not missing and not failed


def main():
    args = sys.argv[1:]
    apply = "--apply" in args
    check = "--verify" in args
    filters = {a.lower() for a in args if not a.startswith("--")}
    config = json.loads(CONFIG.read_text())
    base = config["public_base"].rstrip("/")
    data = json.loads(GAMES_JSON.read_text())
    projects = data["projects"]

    todo, kept = plan(projects, filters)
    folders = sorted({f for _, _, f in todo})
    moved = sum(folder_bytes(VIBES / f) for f in folders)
    before = site_bytes()
    after = before - moved

    by_game = {}
    for p, v, _ in todo:
        by_game.setdefault(p["title"], []).append(v["version"])
    for title, vs in by_game.items():
        vs.sort(key=vkey)
        print(f"  {title}: {len(vs)} ({vs[0]} – {vs[-1]})")
    print(f"{'Archiving' if apply else 'Would archive'} {len(folders)} builds ({mb(moved)}); "
          f"keeping {kept} on Pages. Site: {mb(before)} -> {mb(after)} (limit {SIZE_LIMIT_MB} MB).")

    if apply and folders:
        env = r2_env()
        bucket = f"r2:{config['bucket']}"
        rclone(env, "copy", str(VIBES / "Engines"), f"{bucket}/Engines",
               "--header-upload", CACHE_HEADER, "--transfers", "8")
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as listing:
            for f in folders:
                for path in sorted((VIBES / f).rglob("*")):
                    if path.is_file():
                        listing.write(str(path.relative_to(VIBES)) + "\n")
        try:
            rclone(env, "copy", str(VIBES), bucket, "--files-from-raw", listing.name,
                   "--header-upload", CACHE_HEADER, "--transfers", "16", "--stats-one-line",
                   "--stats", "30s")
            # Stop here, before touching the repo, if anything didn't land.
            rclone(env, "check", str(VIBES), bucket, "--files-from-raw", listing.name, "--one-way")
            rclone(env, "check", str(VIBES / "Engines"), f"{bucket}/Engines", "--one-way")
        finally:
            os.unlink(listing.name)

        for _, v, _ in todo:
            v["href"] = f"{base}/{urllib.parse.quote(v['href'])}"
        GAMES_JSON.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        for f in folders:
            subprocess.run(["git", "rm", "-r", "-q", "-f", "--ignore-unmatch", "--", f],
                           cwd=VIBES, check=True)
            shutil.rmtree(VIBES / f, ignore_errors=True)
        subprocess.run([sys.executable, "-I", str(VIBES / "scripts" / "build_version_logs.py")],
                       cwd=VIBES, check=True)
        after = site_bytes()
        print(f"Archived {len(folders)} builds. Site now {mb(after)}.")

    ok = verify(projects, base) if check else True
    if after > SIZE_LIMIT_MB * 1e6:
        print(f"Site would be {mb(after)}, over {SIZE_LIMIT_MB} MB. Don't push.")
        return 1
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
