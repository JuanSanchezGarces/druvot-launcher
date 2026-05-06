# Druvot Launcher

Game launcher for the Druvot OT server. Players download it once — the launcher handles all future client updates automatically.

---

## How it works

1. Player installs `druvot_launcher.exe` (the NSIS installer)
2. On every open, the launcher fetches `manifest.json` from this repo's `master` branch
3. If the version in the manifest differs from what's installed locally, it downloads `client.zip` from the corresponding GitHub Release
4. After download + SHA-256 verification + extraction, the **JOGAR** button enables
5. Clicking JOGAR launches `otclient_dx_x64.exe` (prefers DX, falls back to GL) and closes the launcher

The client files live at `%APPDATA%\druvot-launcher\client\` on the player's machine.

---

## Project structure

```
assets/
  logo.png           — shown in the launcher titlebar
  background.png     — background image behind the changelog panel
  icon.ico           — auto-generated from logo.png, used by the Windows installer
src/
  config.js          — GitHub owner/repo, URLs, window size
  main.js            — Electron main process: update engine, download, launch
  preload.js         — secure bridge between main and renderer
  renderer/
    index.html       — UI layout
    renderer.js      — progress bar, changelog, play button wiring
    style.css        — dark gold theme, 900×500px
scripts/
  generate-manifest.js  — run this before every release
changelog.json       — edit manually to add entries
manifest.json        — auto-generated, committed to master after each release
```

---

## Releasing a client update

Do this every time you change anything in the OTClient folder.

### Step 1 — Zip the client folder

Right-click the `Druvot` OTClient folder → Send to → Compressed folder.  
Rename the result to `client.zip`.  
Or copy it to a simple path first: `C:\TFS\client.zip`

### Step 2 — Generate the manifest

```
node scripts/generate-manifest.js <version> C:\TFS\client.zip
```

Example:
```
node scripts/generate-manifest.js 1.0.1 C:\TFS\client.zip
```

This creates/updates `manifest.json` with the new version and SHA-256 hash.

### Step 3 — Update the changelog

Edit `changelog.json` and add a new entry **at the top** of the array:

```json
[
  {
    "date": "2026-05-10",
    "version": "v1.0.1",
    "changes": [
      "Descrição da mudança 1",
      "Descrição da mudança 2"
    ]
  },
  {
    "date": "2026-05-06",
    "version": "v1.0.0",
    "changes": [
      "Lançamento do servidor Druvot!"
    ]
  }
]
```

### Step 4 — Commit and push

```
git add manifest.json changelog.json
git commit -m "chore: client v1.0.1"
git push
```

This makes the new `manifest.json` and `changelog.json` live immediately via `raw.githubusercontent.com`.

### Step 5 — Upload the zip to a GitHub Release

> The GitHub web UI has a 25 MB upload limit — always use the CLI.

Copy the zip to a simple path first to avoid path issues:
```
Copy-Item "C:\path\to\client.zip" C:\TFS\client.zip
```

Then create the release and upload:
```
gh release create client-v1.0.1 C:\TFS\client.zip --title "Client v1.0.1" --notes "" --repo JuanSanchezGarces/druvot-launcher
```

Done. The next time any player opens the launcher, it will detect the new version and download the update.

---

## Building the installer

Run this from an **Administrator terminal** (or with Developer Mode enabled in Windows Settings):

```
& "C:\Program Files\nodejs\npm.cmd" run build
```

Output: `dist\druvot_launcher.exe`

Share this file with players. They only need to download it once — future client updates happen automatically through the launcher.

> Players may see a Windows SmartScreen warning on first run ("Windows protected your PC"). They need to click **More info → Run anyway**. This is normal for unsigned apps.

---

## Running locally (development)

```
& "C:\Program Files\nodejs\npm.cmd" start
```

---

## Updating the launcher's own assets

| Asset | File | Notes |
|---|---|---|
| Titlebar logo | `assets/logo.png` | Any size, PNG |
| Background image | `assets/background.png` | Shown behind changelog, ideally 900×360px |
| App/installer icon | `assets/icon.ico` | Auto-generated — see below |

To regenerate `icon.ico` after changing `logo.png`:

```
node -e "const {default:p}=require('png-to-ico'),fs=require('fs');p('assets/logo.png').then(b=>fs.writeFileSync('assets/icon.ico',b))"
```

Then rebuild the installer.

---

## Updating `src/config.js`

| Field | Purpose |
|---|---|
| `SERVER_NAME` | Displayed in the titlebar |
| `GITHUB_OWNER` | Your GitHub username |
| `GITHUB_REPO` | Repository name |
| `MANIFEST_URL` | Full raw URL to `manifest.json` on master branch |
| `CHANGELOG_URL` | Full raw URL to `changelog.json` on master branch |
| `WINDOW_WIDTH/HEIGHT` | Launcher window size (default 900×500) |

---

## GitHub repository

- **Repo:** https://github.com/JuanSanchezGarces/druvot-launcher (public — must be public for downloads to work)
- **Branch:** `master`
- `manifest.json` and `changelog.json` are served from the master branch via `raw.githubusercontent.com`
- `client.zip` is hosted on GitHub Releases, tagged `client-vX.Y.Z`
