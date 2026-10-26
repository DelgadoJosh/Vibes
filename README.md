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

Both importers copy builds into `Games/<game>/Versions/<version>/`, add them to `games.json`, and run `scripts/share_engines.py`. Read the docstring at the top of each script for usage. Each game's newest 10 versions, plus the last build of each minor version, live here on Pages. Every older version lives on Cloudflare R2 (see **Old builds on R2** below), so **every import ends with `archive_to_r2.py --apply`**.

Importing by hand (what Claude does, so the commit gets its Co-Authored-By line):

```sh
git pull -q --rebase origin main
python3 -I scripts/import_vibecoding_builds.py [GAME]     # and/or import_godot_build.py for VC2
python3 -I scripts/build_version_logs.py
python3 -I scripts/archive_to_r2.py --apply --verify      # uploads what fell out of the newest 10, rewrites hrefs, git rm's them
git add -A games.json Games Engines version_logs.json     # explicit paths: anything else committed here gets published
git commit -m "Add <Game> vX-vY builds; archive N old builds to R2" && git push -q origin main
```

- `scripts/publish_vibecoding_builds.sh` – the same steps in one command for `../VibeCoding` builds (read-only; never edit or pull it): import, version logs, archive to R2, commit, push. Its commit message comes from the `games.json` diff (a build imported and archived in the same run never appears as an added file). Run `python3 -I scripts/import_vibecoding_builds.py -n` and `python3 -I scripts/archive_to_r2.py` (no `--apply`) for dry runs.
- Other agents export into `../VibeCoding` while you import. A version skipped with "expected one .html, found 0" is usually still being written. Once it's complete, rerun with `GAME VERSION`.
- `python3 -I scripts/import_godot_build.py` – imports from `../VibeCoding-2-Extra-Vibes`. It doesn't commit or archive; follow it with the version logs and `archive_to_r2.py --apply` steps above. Commit the new export folder in VC2 too: VC2 commits often contain only the text files of an export, and the importer fills in the binaries from the zip.
- Unknown export folders are only reported. If one has its own `project.godot` and matches no existing game, add it to `SOURCES`. If it's a renamed game, map it to that game's `vibes_dir`. New games get placeholder `description`/`model`/`context`/`images`. Fill those in by hand.
- **Size budget.** GitHub Pages limits a deploy to 1 GB, and this repo deploys the whole `main` branch (Settings > Pages: deploy from branch, `/`), so every file counts, including hidden cards. `archive_to_r2.py` prints the site size and exits 1 over 900 MB; then don't push, and ask. To measure by hand: `echo $(( ($(du -sk . | cut -f1) - $(du -sk .git | cut -f1)) / 1024 )) MB`. Since R2 the site sits around 410 MB, growing only by one milestone build per new minor version.
  - `share_engines.py` shares each engine's `.wasm`, `.js` and audio worklets in `Engines/<hash>/`. It only removes a build's copy when it's byte-identical to the shared one; the engine loads its worklets from next to `executable`. After importing, `find Games -name '*.wasm' -o -name '*.js'` should print nothing. A new `Engines/<hash>/` folder should only appear for a new Godot version.
  - What's left is mostly each build's own `.pck`, which can't be shared. A busy import round has added up to about 220 MB (176 builds); Ashfall builds run about 2.4 MB each (Oct 2026), Bloomworks about 1.7 MB. The site was about 925 MB on 2026-10-24, and Ashfall (about 306 MB, 244 builds) and Bloomworks (about 200 MB, 218 builds) are most of it. Judge a new game by its size without the engine: Kenshilike's export folder is 1 GB, but it added only 5 MB because it reuses an existing engine. Earlier savings came from sharing the `.js` (saved about 143 MB) and deleting the hidden duplicate Puyos Revenge builds (saved 221 MB).
  - **Old builds on R2.** `python3 -I scripts/archive_to_r2.py [--apply] [--verify] [GAME ...]` computes each game's keep set (newest 10 plus the last build of each `major.minor`). It uploads every other `Games/<dir>/Versions/<v>/` folder, plus all of `Engines/`, to the `vibes-builds` bucket at the same path, so each build's relative `../../../../Engines/<hash>/` path still resolves there and a whole build plays from one origin (no CORS). It checks every upload with `rclone check`, and only then points those hrefs at `https://builds.joshdelgado.fyi/<percent-encoded path>`, `git rm`s the folders and reruns `build_version_logs.py`. Without `--apply` it only prints the plan. `--verify` checks that every relative href exists and that 20 random R2 hrefs answer 200. It never deletes from R2, never commits, and exits 1 over 900 MB. GAME filters by title or folder, but the size guard still measures the whole working tree. Bucket and base URL: `scripts/r2_config.json`. Keys: macOS Keychain only (service `vibes-r2`: `account-id`, `access-key-id`, `secret-access-key`), loaded by `scripts/r2_env.sh` for rclone (`brew install rclone`), so archiving only works on Josh's Mac. Setup, costs and rollback: `../VibeCoding/docs/vibes-r2-migration.md`.
  - R2 gotchas: check caching with a GET (`curl -s -o /dev/null -D - <url>` twice; the second says `cf-cache-status: HIT`), because `curl -I` always says `DYNAMIC`. A build moved to R2 starts with fresh browser saves (storage is per origin). Git shows archived icons as "renamed" into new builds' folders; that's only rename detection on identical files. Moved builds stay in git history, so `.git` keeps growing (revisit at 5 GB).
  - Other ways to make room (not needed since R2; they need the owner's OK): remove older builds of the biggest games, or switch Pages to a GitHub Actions workflow that publishes only some builds.
  - A GitHub Actions workflow does **not** lift the cap. GitHub documents published sites as limited to 1 GB however they're deployed, and the "custom workflow" exemption on the limits page most likely covers only the 10-builds-per-hour cap. What a workflow does allow is publishing a subset (for example, the newest builds) while keeping everything in the repo. The repo itself is also under a separate recommended 1 GB limit (`.git` was about 607 MB on 2026-10-25).
  - History: on 2026-10-25 a 56-build round would have taken the site from 925 MB to 1,049 MB. Moving 694 old builds (641 MB) to R2 the same day brought it to 408 MB; the next import (26 Ashfall builds) archived 26 and left it at 409 MB.
  - Before deleting builds, note that the Vibes copies aren't backups. Their engine files were moved out and their HTML rewritten. The complete originals live in the source repo (`../VibeCoding/Exports/<Game>/` or the VC2 export zips), so check they're there instead of copying the Vibes folder back.

To preview locally, serve the folder (opening `index.html` directly can't load the JSON):

```
python3 -m http.server
```
