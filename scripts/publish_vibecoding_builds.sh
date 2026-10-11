#!/bin/sh
# Pull Vibes, import new VibeCoding builds, then commit and push them.
# Usage: scripts/publish_vibecoding_builds.sh [GAME [VERSION ...]]   (no args = every game)
set -e
cd "$(dirname "$0")/.."

git pull -q --rebase origin main
python3 -I scripts/import_vibecoding_builds.py "$@"

git add games.json Games
if git diff --cached --quiet; then
    echo "Nothing new to publish."
    exit 0
fi

# e.g. "Bloomworks v0.1.38-v0.1.40, Potion Maker v0.1.9"
summary=$(git diff --cached --name-only -- Games | python3 -I -c '
import re, sys
found = {}
for line in sys.stdin:
    m = re.match(r"Games/([^/]+)/Versions/(v[\d.]+)", line)
    if m:
        found.setdefault(m.group(1), set()).add(m.group(2))
key = lambda v: [int(n) for n in v[1:].split(".")]
parts = []
for game, vs in found.items():
    vs = sorted(vs, key=key)
    parts.append(f"{game} {vs[0]}" + (f"-{vs[-1]}" if len(vs) > 1 else ""))
print(", ".join(parts) or "games.json")
')

git commit -q -m "Add $summary builds"
git push -q origin main
echo "Published: $summary"
