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
