# Vibes

This project is hosted at the following link: [https://delgadojosh.github.io/Vibes/](https://delgadojosh.github.io/Vibes/)

To find the link in the future, go to **Settings > Pages** in the repository.

## Editing the site

All card content lives in [`games.json`](games.json); `index.html` renders it. Each project has:

- `title`, `description`, `kind` (`game` or `app`), `folder`
- `model` – what made it (shown as a tag), `context` – why it was made (shown under "Why I made this")
- `images` – screenshots shown in the card gallery, first one is the cover (e.g. `Images/Time Keeper Title Screenshot.png`); empty uses the placeholder
- `updated`, `historyPage` (optional), `versions` (newest first; optional `label` per version)

## Version logs

[`versions.html`](https://delgadojosh.github.io/Vibes/versions.html) shows every game's version notes, with a link to play each build. It reads `version_logs.json`, which `python3 -I scripts/build_version_logs.py` writes from the games' own logs: `scripts/version_log.gd` in `../VibeCoding`, `VERSION_LOG.md` in `../VibeCoding-2-Extra-Vibes`, and `puyos_revenge_versions.html`. `publish_vibecoding_builds.sh` reruns it on every publish; after `import_godot_build.py`, run it yourself and commit the JSON. It lists the projects it found no log for (their builds still show, without notes). Deep links: `versions.html#bloomworks`, `versions.html#bloomworks-v0.1.40`.

## Importing builds

Both importers copy builds into `Games/<game>/Versions/<version>/`, add them to `games.json`, and run `scripts/share_engines.py`. Read the docstring at the top of each script for usage.

- `scripts/publish_vibecoding_builds.sh` – imports from `../VibeCoding` (read-only; never edit or pull it), then commits and pushes. Run `python3 -I scripts/import_vibecoding_builds.py -n` for a dry run.
- Other agents export into `../VibeCoding` while you import. A version skipped with "expected one .html, found 0" is usually still being written. Once it's complete, rerun with `GAME VERSION`.
- `python3 -I scripts/import_godot_build.py` – imports from `../VibeCoding-2-Extra-Vibes`. It doesn't commit. Commit the new export folder in VC2 too: VC2 commits often contain only the text files of an export, and the importer fills in the binaries from the zip.
- Unknown export folders are only reported. If one has its own `project.godot` and matches no existing game, add it to `SOURCES`. If it's a renamed game, map it to that game's `vibes_dir`. New games get placeholder `description`/`model`/`context`/`images`. Fill those in by hand.
- GitHub Pages limits a deploy to 1 GB. After importing, `find Games -name '*.wasm'` should print nothing. A new `Engines/<hash>/` folder should only appear for a new Godot version. The site was about 860 MB on 2026-10-18. Most of that is `.pck` files. Each build also keeps its own ~280 KB engine `.js` (about 100 MB in total).

To preview locally, serve the folder (opening `index.html` directly can't load the JSON):

```
python3 -m http.server
```
