# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-11-20

### Added
- Built-in extension manager and local `extensions/` catalog support (`fitgirl`, `steamrip`, `dodi`, `goggames`, `onlinefix`).
- Debrid unrestriction support for Real-Debrid, AllDebrid, and Torbox.
- Automatic archive extraction (`.zip`, `.rar`, `.7z`, `.tar`, `.iso`, split archives) with automatic primary executable discovery.
- Cloud save backup and synchronization via local cloud folders (Google Drive, OneDrive, Dropbox) or WebDAV servers.
- Achievement schema fetching, local emulator achievement watching, and a native desktop achievement notification overlay.
- Local game directory scanner with Steam Store metadata matching and one-click library import.
- Mod & ReShade manager with automatic engine detection (Unreal, Unity, RE Engine, Creation/Gamebryo).
- Game update/patch checker against the active extension.
- Download speed limits, scheduled download windows, and automatic pause/resume while playing games.
- Discord Rich Presence IPC integration.
- Linux/SteamOS Proton prefix management and runner detection.
- Controller/gamepad navigation (`LB`/`RB` tab switching, D-pad/stick spatial focus, `A` select, `B` back, `Y` search).
- Library analytics dashboard and per-game launch profiles (custom launch arguments, environment variables, high process priority).
- Zero-dependency smoke test suite (`npm test`), `.env.example`, `LICENSE`, and GitHub Actions CI workflow.

### Security
- Authenticated local Aria2 JSON-RPC sessions with a random per-session `--rpc-secret`.
- Restricted `open-external` IPC handler to `http:` and `https:` URLs only.
- HTML-escaped achievement metadata and validated icon URLs in the achievement overlay window.
- URL-encoded AllDebrid API keys in outbound requests.

### Fixed
- Exported `call` from `electron/services/aria2.js` so download scheduling and auto-pause work properly.
- Exported `resolveSteamMetadata` from `electron/services/gameScanner.js` for post-extraction library registration.
- Exported `getSteamCache` from `electron/services/steam.js` for cached Steam AppID and artwork reuse.
- Scoped `aria2c.exe` / `aria2c` platform `extraResources` in `package.json` and removed the missing `aria2c-linux` reference.
- Renamed `eslint.config.js` to `eslint.config.mjs` to eliminate Node ESM reparsing warnings.
