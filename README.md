# Vibes

This project is hosted at the following link: [https://delgadojosh.github.io/Vibes/](https://delgadojosh.github.io/Vibes/)

To find the link in the future, go to **Settings > Pages** in the repository.

## Editing the site

All card content lives in [`games.json`](games.json); `index.html` renders it. Each project has:

- `title`, `description`, `kind` (`game` or `app`), `folder`
- `model` – what made it (shown as a tag), `context` – why it was made (shown under "Why I made this")
- `images` – screenshots shown in the card gallery, first one is the cover (e.g. `Images/Time Keeper Title Screenshot.png`); empty uses the placeholder
- `updated`, `historyPage` (optional), `versions` (newest first; optional `label` per version)

`scripts/import_godot_build.py` adds new versions and games to `games.json` automatically.

To preview locally, serve the folder (opening `index.html` directly can't load the JSON):

```
python3 -m http.server
```

## Importing games from VibeCoding2

New builds from [VibeCoding-2-Extra-Vibes](https://github.com/DelgadoJosh/VibeCoding-2-Extra-Vibes) (VC2) come in through `scripts/import_godot_build.py`:

1. Clone VC2 next to this repo (`../VibeCoding-2-Extra-Vibes`, or lowercase `../vibecoding-2-extra-vibes`).
2. Run `python3 -I scripts/import_godot_build.py` to import every version not yet in `Games/` (or pass `GAME [VERSION ...]`, e.g. `BeltAndSteam v0.1.7`).
3. Commit `games.json` and `Games/`. New games get a stub entry in `games.json`; fill in `context` and `images`.

How it works: each `Exports/Games/<Game>/<version>/README.md` in VC2 has a Muse zip link plus SHA-256. The script downloads it, checks the hash, and unzips into `Games/<Game>/Versions/<version>/`. It also copies the files into the VC2 checkout; only commit those there if you mean to.

Gotchas:
- Muse links expire after about 2 days (each README lists the date). Dead links are listed at the end of the run; get a fresh link from Muse.
- `muse.ai` must be on the network allowlist. In a Claude Code cloud environment, add it under the environment's Network access → Allowed domains, or downloads fail with a 403.
