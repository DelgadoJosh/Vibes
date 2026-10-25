# Vibes

This project is hosted at the following link: [https://delgadojosh.github.io/Vibes/](https://delgadojosh.github.io/Vibes/)

To find the link in the future, go to **Settings > Pages** in the repository.

## Editing the site

All card content lives in [`games.json`](games.json); `index.html` renders it. Each project has:

- `title`, `description`, `kind` (`game` or `app`), `folder`
- `model` – what made it (shown as a tag), `context` – why it was made (shown under "Why I made this")
- `images` – screenshots shown in the card gallery, first one is the cover (e.g. `Images/Time Keeper Title Screenshot.png`); empty uses the placeholder
- `updated`, `historyPage` (optional), `versions` (newest first; optional `label` per version)
- `hidden: true` (optional) – leaves the card off the home page and the version logs, but its files are still deployed

## Version logs

[`versions.html`](https://delgadojosh.github.io/Vibes/versions.html) shows every game's version notes, with a link to play each build. It reads `version_logs.json`, which `python3 -I scripts/build_version_logs.py` writes from the games' own logs: `scripts/version_log.gd` in `../VibeCoding`, `VERSION_LOG.md` in `../VibeCoding-2-Extra-Vibes`, and `puyos_revenge_versions.html`. `publish_vibecoding_builds.sh` reruns it on every publish; after `import_godot_build.py`, run it yourself and commit the JSON. It lists the projects it found no log for (their builds still show, without notes). "Logs with no project in games.json" means a log maps to a folder no card uses. After deleting or renaming a game, update the mapping in `build_version_logs.py`; the hand-written Puyo's Revenge notes are mapped there by folder name. Deep links: `versions.html#bloomworks`, `versions.html#bloomworks-v0.1.40`.

## Importing builds

Both importers copy builds into `Games/<game>/Versions/<version>/`, add them to `games.json`, and run `scripts/share_engines.py`. Read the docstring at the top of each script for usage.

- `scripts/publish_vibecoding_builds.sh` – imports from `../VibeCoding` (read-only; never edit or pull it), then commits and pushes. Run `python3 -I scripts/import_vibecoding_builds.py -n` for a dry run.
- Other agents export into `../VibeCoding` while you import. A version skipped with "expected one .html, found 0" is usually still being written. Once it's complete, rerun with `GAME VERSION`.
- `python3 -I scripts/import_godot_build.py` – imports from `../VibeCoding-2-Extra-Vibes`. It doesn't commit. Commit the new export folder in VC2 too: VC2 commits often contain only the text files of an export, and the importer fills in the binaries from the zip.
- Unknown export folders are only reported. If one has its own `project.godot` and matches no existing game, add it to `SOURCES`. If it's a renamed game, map it to that game's `vibes_dir`. New games get placeholder `description`/`model`/`context`/`images`. Fill those in by hand.
- **Size budget.** GitHub Pages limits a deploy to 1 GB, and this repo deploys the whole `main` branch (Settings > Pages: deploy from branch, `/`), so every file counts, including hidden cards. Measure before pushing: `echo $(( ($(du -sk . | cut -f1) - $(du -sk .git | cut -f1)) / 1024 )) MB`. Over about 980 MB, don't push; make room first.
  - `share_engines.py` shares each engine's `.wasm`, `.js` and audio worklets in `Engines/<hash>/`. It only removes a build's copy when it's byte-identical to the shared one; the engine loads its worklets from next to `executable`. After importing, `find Games -name '*.wasm' -o -name '*.js'` should print nothing. A new `Engines/<hash>/` folder should only appear for a new Godot version.
  - What's left is mostly each build's own `.pck`, which can't be shared. A busy import round has added up to about 220 MB (176 builds); Ashfall builds run about 1 MB each, Bloomworks about 1.5 MB. The site was about 925 MB on 2026-10-24, and Ashfall (about 306 MB, 244 builds) and Bloomworks (about 200 MB, 218 builds) are most of it. Judge a new game by its size without the engine: Kenshilike's export folder is 1 GB, but it added only 5 MB because it reuses an existing engine. Earlier savings came from sharing the `.js` (saved about 143 MB) and deleting the hidden duplicate Puyos Revenge builds (saved 221 MB).
  - Ways to make more room, which need the owner's OK: remove older builds of the biggest games, or switch Pages to a GitHub Actions workflow that publishes only some builds.
  - A GitHub Actions workflow does **not** lift the cap. GitHub documents published sites as limited to 1 GB however they're deployed, and the "custom workflow" exemption on the limits page most likely covers only the 10-builds-per-hour cap. What a workflow does allow is publishing a subset (for example, the newest builds) while keeping everything in the repo. The repo itself is also under a separate recommended 1 GB limit (`.git` was about 607 MB on 2026-10-25).
  - On 2026-10-25, a 56-build round (Bloomworks, Ashfall, Infection Cleaner) would have taken the site from 925 MB to 1009 MB, so it was held back until room is made.
  - Before deleting builds, note that the Vibes copies aren't backups. Their engine files were moved out and their HTML rewritten. The complete originals live in the source repo (`../VibeCoding/Exports/<Game>/` or the VC2 export zips), so check they're there instead of copying the Vibes folder back.

To preview locally, serve the folder (opening `index.html` directly can't load the JSON):

```
python3 -m http.server
```
