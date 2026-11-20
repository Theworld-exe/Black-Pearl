# Black Pearl

A modular Electron desktop game launcher, library manager, and Aria2-powered download manager built with React, Vite, and Tailwind CSS.

[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/Theworld-exe/black-pearl/actions/workflows/ci.yml/badge.svg)](https://github.com/Theworld-exe/black-pearl/actions/workflows/ci.yml)

<!-- TODO: Add screenshot or GIF of the main library and game detail views -->

## Features

- **Aria2 Download Engine:** Multi-threaded HTTP/HTTPS and magnet/torrent downloads over an authenticated local JSON-RPC session, with bandwidth limits, scheduled download windows, automatic pause/resume during gameplay, and an ad-blocked fallback browser window.
- **Debrid Unrestriction:** Optional integration with Real-Debrid, AllDebrid, and Torbox API keys to resolve hoster links and cached torrents.
- **Automatic Extraction & Registration:** Extracts `.zip`, `.rar`, `.7z`, `.tar`, `.iso`, and split archives (using 7-Zip, WinRAR/UnRAR, system `tar`, or PowerShell), flattens single-nested directories, detects the primary game executable, and registers titles in the library.
- **Modular Extension System:** Loads CommonJS `.js` source extensions from `./extensions/` and the user data directory, with an in-app Extension Manager for installing, switching, or removing sources.
- **Game Launcher & Playtime Tracking:** Launches native executables, macOS `.app` bundles, and Windows `.exe` titles on Linux/SteamOS via detected Proton installations or Wine, with per-game arguments, custom environment variables, high-priority mode, and session playtime tracking.
- **Steam Metadata & Achievements:** Fetches artwork, descriptions, system requirements, and achievement schemas from Steam, monitors local emulator achievement files, and displays an in-game desktop notification overlay.
- **Cloud Save Backup & Sync:** Locates game save directories, creates timestamped archive backups, and syncs snapshots to a local cloud folder (Google Drive, OneDrive, Dropbox) or a WebDAV server.
- **Library Utilities:** Local directory game scanner, library analytics view, game update/patch checker, Mod & ReShade manager (Unreal, Unity, RE Engine, Creation/Gamebryo detection), Discord Rich Presence, controller/gamepad navigation, 5 themes, and Lite Mode for lower-end hardware.

## Prerequisites

- [Node.js](https://nodejs.org/) `>= 20.0.0` and `npm`
- Git
- **Platform binaries:** Prebuilt `aria2c.exe` (Windows) and `aria2c` (macOS) binaries are included in the repository root. On Linux, place a compatible `aria2c-linux` binary in the project root (or app resources directory).
- *(Optional, Windows)* [7-Zip](https://www.7-zip.org/) or WinRAR for `.7z` / `.rar` archive extraction (built-in `tar.exe` / PowerShell are used as fallbacks for `.zip` / `.tar`).

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Theworld-exe/black-pearl.git
cd black-pearl

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment variables
cp .env.example .env

# 4. Start the Electron app in development mode
npm run dev
```

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite and launches the Electron desktop app with hot reload. |
| `npm run build` | Builds the React renderer (`dist/`) and Electron main/preload bundles (`dist-electron/`). |
| `npm run build:electron` | Builds the app and packages distributable binaries into `release/` via `electron-builder`. |
| `npm run lint` | Runs ESLint across `src/`, `electron/`, and `tests/`. |
| `npm test` | Runs the Node.js smoke test suite (`tests/smoke.test.mjs`). |
| `npm run preview` | Previews the built Vite renderer in a standard browser. |

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DISCORD_CLIENT_ID` | No | `121500000000000000` | Discord Application Client ID for Rich Presence IPC. |
| `BLACK_PEARL_EXTENSIONS_URL` | No | `""` (offline/local) | Optional base URL used when fetching remote marketplace `.js` extensions. Built-in extensions work offline via `./extensions/` and embedded templates. |
| `VITE_DEV_SERVER_URL` | No | Auto-set by Vite | Development renderer URL injected automatically by `vite-plugin-electron` during `npm run dev`. |

### Local Runtime Configuration (`userData`)

User preferences, library entries, download history, and cached Steam metadata are persisted locally in Electron's `userData` directory (`blackpearl_db.json` and `steam_cache.json`):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `profile.downloadPath` | OS Downloads folder | Target directory for downloads and extracted games. |
| `profile.liteMode` | `false` | Disables blur effects, shadows, and Framer Motion spring transitions. |
| `profile.autoExtract` | `true` | Automatically extracts completed archives and removes source archives on verified success. |
| `profile.speedLimits` | `"0"` / `"0"` | Global Aria2 download/upload rate caps (e.g. `5M`, `500K`, or `0` for unlimited). |
| `profile.downloadSchedule` | Disabled (`01:00`–`07:00`) | Restricts active downloads to a scheduled time window. |
| `profile.autoPauseDownloadsInGame` | `true` | Automatically pauses Aria2 downloads while a launched game is running. |
| `profile.discordRpc` | `true` | Enables or disables Discord Rich Presence status updates. |
| `profile.debrid` | Disabled | Provider (`realdebrid`, `alldebrid`, `torbox`) and user API key. |
| `profile.cloudSync` | Disabled | Local sync folder (`folder`) or remote WebDAV credentials (`webdav`). |

## Security & Trust Notes

- **Third-Party Extensions:** Extensions are executed as CommonJS modules inside Electron's main process. Only install extension `.js` files from sources you inspect and trust.
- **Local Credentials:** User-entered Debrid API keys and WebDAV credentials are stored locally in Electron's `userData/blackpearl_db.json` (never committed to Git). Avoid sharing your `userData` directory.
- **Local RPC:** Aria2 JSON-RPC binds exclusively to `127.0.0.1` on an ephemeral port and authenticates requests with a random per-session `--rpc-secret`.

## Project Structure

```text
.
├── .github/workflows/       # GitHub Actions CI (ci.yml) and Windows release (release.yml)
├── electron/
│   ├── main.js              # Electron main process, window lifecycle, and IPC wiring
│   ├── preload.js           # contextBridge API exposed to window.api
│   └── services/            # Backend modules:
│       ├── achievements.js  # Steam achievement schema + emulator file watcher
│       ├── aria2.js         # Aria2 process manager, authenticated RPC, download polling
│       ├── cloudSave.js     # Save discovery, zip backup/restore, folder & WebDAV sync
│       ├── database.js      # JSON persistence in Electron userData
│       ├── debrid.js        # Real-Debrid, AllDebrid, and Torbox clients
│       ├── discordRpc.js    # Native Discord IPC socket client
│       ├── extensions.js    # Extension loader, streaming IPC, built-in templates
│       ├── extractor.js     # Archive extraction, folder flattening, cleanup
│       ├── gameScanner.js   # Local folder scanner + Steam metadata matching
│       ├── launcher.js      # Cross-platform process launcher + playtime tracking
│       ├── modManager.js    # Engine detection, mod toggles, ReShade setup
│       ├── overlay.js       # Frameless desktop achievement popup window
│       ├── patchNotifier.js # Version parsing and update lookup
│       ├── proton.js        # Linux/SteamOS Proton detection and prefix builder
│       ├── scheduler.js     # Time-window scheduler & in-game auto-pause
│       ├── steam.js         # Steam Store metadata fetcher & local cache
│       └── scrapers/        # Direct file-hoster link extractors
├── extensions/              # Bundled source extensions
├── public/                  # Static web assets (favicon)
├── src/                     # React + Tailwind CSS renderer application
│   ├── components/          # UI views (library, downloads, layout, profile, common)
│   ├── constants/           # Built-in theme definitions
│   ├── hooks/               # Library streaming and gamepad navigation hooks
│   └── utils/               # Byte, playtime, and date formatting helpers
├── tests/                   # Node.js smoke test suite
├── .env.example             # Documented optional environment variables
├── eslint.config.mjs        # ESLint 10 flat configuration
└── vite.config.mjs          # Vite + React + Tailwind + Electron plugin configuration
```

## License & Attribution

Licensed under the [MIT License](./LICENSE).

Originally forked/adapted from [Black-Pearl](https://github.com/Levi477/Black-Pearl).
