#!/bin/sh
# Pull Vibes, import new VibeCoding builds, then commit and push them.
# Usage: scripts/publish_vibecoding_builds.sh [GAME [VERSION ...]]   (no args = every game)
set -e
cd "$(dirname "$0")/.."

git pull -q --rebase origin main
python3 -I scripts/import_vibecoding_builds.py "$@"
python3 -I scripts/build_version_logs.py
# Move builds that fell out of each game's newest 10 to R2 (stops before commit if over 900 MB).
if [ -f scripts/r2_config.json ]; then
    python3 -I scripts/archive_to_r2.py --apply
fi

git add -A games.json Games Engines version_logs.json
if git diff --cached --quiet; then
    echo "Nothing new to publish."
    exit 0
fi

# e.g. "Add Bloomworks v0.1.38-v0.1.40, Potion Maker v0.1.9 builds; archive 3 old builds to R2".
# Read from games.json, not file paths: a build imported and archived in the same run never shows
# up as an added file.
msg=$(git show HEAD:games.json | python3 -I -c '
import json, sys
old = {p["folder"]: {v["version"]: v["href"] for v in p["versions"]} for p in json.load(sys.stdin)["projects"]}
new = json.load(open("games.json"))["projects"]
key = lambda v: [int(n) for n in v[1:].split(".")] if v[1:].replace(".", "").isdigit() else [0]
parts, archived = [], 0
for p in new:
    was = old.get(p["folder"], {})
    vs = sorted((v["version"] for v in p["versions"] if v["version"] not in was), key=key)
    if vs:
        parts.append(p["folder"].split("/")[-1] + f" {vs[0]}" + (f"-{vs[-1]}" if len(vs) > 1 else ""))
    archived += sum(v["href"].startswith("https://") and not was.get(v["version"], "").startswith("https://")
                    for v in p["versions"])
msg = "Add " + ", ".join(parts) + " builds" if parts else "Update games.json and version logs"
if archived:
    msg += f"; archive {archived} old builds to R2"
print(msg)
')
git commit -q -m "$msg"
git push -q origin main
echo "Published: $msg"
