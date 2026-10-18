#!/usr/bin/env python3
"""Collect every game's version log into version_logs.json for versions.html.

Usage:
    python3 -I scripts/build_version_logs.py

Sources (both repos are only read):
  - ../VibeCoding/Games/**/scripts/version_log.gd: Godot games. The export folder named in
    export_presets.cfg maps the project to Vibes the same way import_vibecoding_builds.py does.
  - ../VibeCoding-2-Extra-Vibes/Games/<Game>/VERSION_LOG.md: "## vX.Y.Z — date" sections.
  - puyos_revenge_versions.html: the hand-written Puyo's Revenge notes in this repo.
Each log entry is joined to the build of the same version in games.json (for the play link), and
builds without notes are listed too. Projects with no parseable log are printed and still get
their builds listed.
"""
import ast
import datetime
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_godot_build as vc2  # noqa: E402
import import_vibecoding_builds as vc1  # noqa: E402

VIBES = Path(__file__).resolve().parent.parent
OUT = VIBES / "version_logs.json"
PUYO_PAGE = VIBES / "puyos_revenge_versions.html"
VERSION_RE = re.compile(r"^v?(\d+(?:\.\d+)*)$")
# Log versions the importer's renames don't cover (Deadblock's v1.0.0 was never exported).
EXTRA_RENAMES = {"Deadblock": {"v1.0.0": "v0.1.0"}}


def norm(v):
    m = VERSION_RE.match(str(v).strip())
    return f"v{m.group(1)}" if m else None


def gd_array(text, name):
    """The literal `const NAME := [...]` from a GDScript file, as Python data."""
    m = re.search(rf"^const {name}\s*:?=\s*\[", text, re.M)
    if not m:
        return None
    i, depth, start = m.end() - 1, 0, m.end() - 1
    while i < len(text):
        if text.startswith('"""', i):
            i = text.index('"""', i + 3) + 3
            continue
        c = text[i]
        if c == '"':
            i += 1
            while text[i] != '"':
                i += 2 if text[i] == "\\" else 1
        elif c == "#":
            i = text.find("\n", i)
        elif c in "[{":
            depth += 1
        elif c in "]}":
            depth -= 1
            if depth == 0:
                return ast.literal_eval(text[start:i + 1])
        i += 1
    return None


def godot_entries(path):
    out = []
    for e in gd_array(path.read_text(), "ENTRIES") or []:
        lines = [f"- {c}" for c in e.get("changes", [])]
        if e.get("body"):
            lines.append(e["body"].replace("• ", "- "))
        if e.get("limitations"):
            lines += ["", f"**Limitations:** {e['limitations']}"]
        out.append({"version": e["version"], "date": e.get("date", ""), "title": e.get("title", ""),
                    "notes": "\n".join(lines).strip()})
    return out


def vc1_sources():
    """{vibes_dir: (source label, entries)} for VibeCoding's Godot projects."""
    found = {}
    for log in sorted(vc1.VC.glob("Games/**/scripts/version_log.gd")):
        project = log.parent.parent
        presets = project / "export_presets.cfg"
        m = presets.exists() and re.search(r'export_path="[^"]*Exports/([^/"]+)/', presets.read_text())
        if not m:
            print(f"  {project.relative_to(vc1.VC)}: no export path, skipped")
            continue
        cfg = vc1.config(m.group(1))
        entries = godot_entries(log)
        rename = {**cfg["rename"], **EXTRA_RENAMES.get(cfg["vibes_dir"], {})}
        for e in entries:
            e["version"] = rename.get(norm(e["version"]), norm(e["version"]))
        found[cfg["vibes_dir"]] = (str(log.relative_to(vc1.VC.parent)), entries)
    return found


def md_entries(path):
    """Sections headed "## v0.1.2 — 2026-10-12" (or "-") from a VERSION_LOG.md; other sections are dropped."""
    out = []
    for section in re.split(r"^## ", path.read_text(), flags=re.M)[1:]:
        head, _, body = section.partition("\n")
        m = re.match(r"(v[\d.]+)\s*[—–-]\s*(\S+)", head)
        if m:
            out.append({"version": m.group(1), "date": m.group(2), "title": md_title(body), "notes": body.strip()})
    return out


def md_title(body):
    """A short title from the entry's first clause, e.g. "Bugfix + save-slots update"."""
    line = next((l.strip() for l in body.splitlines() if l.strip()), "")
    line = re.sub(r"^[-*]\s+", "", line)
    for ch in '*`"':
        line = line.replace(ch, "")
    title = re.split(r"[,:.]\s|\s\(| [—–-] ", line, maxsplit=1)[0].strip(" :.")
    return title if len(title) <= 70 else title[:67].rsplit(" ", 1)[0] + "…"


def vc2_sources():
    found = {}
    for log in sorted(vc2.VC2.glob("Games/*/VERSION_LOG.md")):
        found[vc2.game_info(log.parent.name)["vibes_dir"]] = (str(log.relative_to(vc2.VC2.parent)), md_entries(log))
    return found


def puyo_entries():
    text = PUYO_PAGE.read_text()
    pairs = re.findall(r'<h5 class="mb-1">(v[\d.]+)</h5>.*?<p class="mb-1">(.*?)</p>', text, re.S)
    return [{"version": v, "date": "", "title": html.unescape(t), "notes": ""} for v, t in pairs]


def iso_date(d):
    """"October 5, 2026" -> "2026-10-05"; ISO dates pass through."""
    try:
        return datetime.datetime.strptime(d, "%B %d, %Y").date().isoformat()
    except ValueError:
        return d


def slug(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def main():
    data = json.loads(vc1.DATA.read_text())
    sources = {**vc1_sources(), **vc2_sources()}
    sources["Puyo's Revenge"] = sources["Puyos Revenge"] = (PUYO_PAGE.name, puyo_entries())

    games, missing, ids = [], [], set()
    for p in data["projects"]:
        if p.get("hidden"):
            continue
        vibes_dir = p["folder"].split("/", 1)[1]
        source, entries = sources.get(vibes_dir, (None, []))
        builds = {v["version"]: v for v in p.get("versions", [])}
        merged = {}
        for e in entries:
            e["date"] = iso_date(e["date"])
            if e["version"] and e["version"] not in merged:
                merged[e["version"]] = e
        for v in builds:
            merged.setdefault(v, {"version": v, "date": "", "title": "", "notes": ""})
        for v, e in merged.items():
            if v in builds:
                e["href"] = builds[v]["href"]
                if builds[v].get("label"):
                    e["label"] = builds[v]["label"]
        versions = sorted(merged.values(), key=lambda e: vc1.version_key(e["version"]), reverse=True)
        gid = slug(p["title"])
        while gid in ids:
            gid += "-2"
        ids.add(gid)
        games.append({"id": gid, "title": p["title"], "kind": p["kind"], "updated": p.get("updated", ""),
                      "source": source, "versions": versions})
        if not entries:
            missing.append(p["title"])

    used = {p["folder"].split("/", 1)[1] for p in data["projects"]}
    unmatched = sorted(set(sources) - used)
    OUT.write_text(json.dumps({"games": games}, ensure_ascii=False, separators=(",", ":")) + "\n")
    noted = sum(1 for g in games for v in g["versions"] if v["notes"] or v["title"])
    print(f"Wrote {OUT.name}: {len(games)} projects, {noted} versions with notes, {OUT.stat().st_size // 1024} KB")
    if missing:
        print("No version log (builds listed without notes): " + ", ".join(missing))
    if unmatched:
        print("Logs with no project in games.json: " + ", ".join(unmatched))


if __name__ == "__main__":
    main()
