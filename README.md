# DonePath (v7)

**DonePath** is a local-first desktop app for tasks, meetings, and focus on your computer. Built with Tauri 2, React, TypeScript, and SQLite.

> The git checkout folder is still named `personal-data-spine` for continuity with earlier snapshots.

- **v1 snapshot:** `../personal-data-spine-v1/` and [V1.md](V1.md)
- **v2 snapshot (frozen):** `../personal-data-spine-v2/` and [V2.md](V2.md)
- **v3 snapshot (frozen):** `../personal-data-spine-v3/` and [V3.md](V3.md)
- **v4 snapshot (frozen):** `../personal-data-spine-v4/` and [V4.md](V4.md)
- **v5 snapshot (frozen):** `../personal-data-spine-v5/` and [V5.md](V5.md)
- **v6 snapshot (frozen):** `../personal-data-spine-v6/` and [V6.md](V6.md)
- **v7 scope (active):** [V7.md](V7.md) on branch `v7`

## v7 updates (0.3.0)

- **Link suggestions** — confirm before linking after meeting save; no silent graph links
- **Focus spine** — project/meeting context on task rows; one click to open linked hub
- **LLM firewall** — documented opt-in, local-by-default, Meetings-only rule

See [V7.md](V7.md) for full backlog.

## v6 updates

- **Projects hub** — 3-column layout (list, detail, linked tasks) aligned with Meetings
- **Subscriptions hub** — same 3-column pattern; renewal detail in center; Windows renewal toasts (Settings toggle, 7-day window)
- **UI identity** — IBM Plex Sans, type scale, nav icons, milestone app icon, consistent emerald accents
- **Graph view** — larger viewport, type icons on nodes, labels on focus/hover, optional “Show labels”
- **Windows installer** — pre-built setup on [GitHub Releases](https://github.com/Tjjordan3/personal-data-spine/releases) (`DonePath_*_x64-setup.exe`); see [RELEASING.md](RELEASING.md)
- **Security & privacy** — local-only data, optional LLM; see [SECURITY.md](SECURITY.md)

## Download (Windows)

Pre-built installers are published on **[GitHub Releases](https://github.com/Tjjordan3/personal-data-spine/releases)** (not stored in the git tree).

- Download `DonePath_*_x64-setup.exe` and run it.
- **Your data stays on your PC** — the installer does not include tasks or meetings from anyone else’s machine. Each user gets their own local database. Reinstalling on the same Windows user keeps existing data.
- **Privacy:** optional meeting LLM sends note text to Ollama or OpenAI when you turn it on in Settings. The database is not encrypted at rest. See [SECURITY.md](SECURITY.md).
- Build or publish yourself: [RELEASING.md](RELEASING.md).

## v4 features (shipped)

- **Pomodoro timer** — Focus tab work/break blocks, streaks, chimes, start from task
- **Light mode contrast** — readable muted and body text in light theme
- All v3 features: Focus stream, themes, subscriptions, projects, links, graph, search facets

## v3 features

- **Focus (Today)** — urgency-sorted stream: tasks due, subscription renewals, active projects
- **Light / dark theme** — system default on first launch; toggle in header or Settings
- **Subscriptions & projects** — dedicated tabs; renewal dates, project status, notes metadata
- All v2 features: links, graph, search facets, capture loop, quick create, edit items

## v2 features

- **Bidirectional links** — `item_links` join table; relate any items by ID
- **Related panel** — see links for the selected inbox item
- **Graph view** — toggle link visualization in inbox
- **Search + facets** — date range, due-soon (7d), type/tag/status; each result shows *why it matched*
- **Quick capture** — editable tags, stay-open save loop, Ctrl+Z undo
- **Quick create** — new note/meeting/task from inbox type filter
- **Edit items** — content, tags, task owner/due/meeting link
- All v1 features: capture, meeting parser, mark/archive/delete

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with “Desktop development with C++”

## Development

From the **project root** (this folder):

```bash
npm install
npm run tauri dev
```

`npm run dev` starts Vite only (browser at http://127.0.0.1:1420) and does **not** open the DonePath desktop window. Always use `npm run tauri dev` for the GUI.

### Dev window blank or `tauri dev` exits immediately

- **Port 1420 in use** — another Vite or old dev session is running. Stop it or free the port, then run `npm run tauri dev` again.
- **WebView cannot reach Vite** — dev uses `http://127.0.0.1:1420` (IPv4). Do not point `devUrl` at `localhost` alone on Windows if Vite is IPv6-only.
- **WebView2** — install the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) if the shell never appears.

> Schema is applied at startup via `CREATE TABLE IF NOT EXISTS` (no Rust migration checksums).

If you previously saw **"migration 1 was previously applied but has been modified"**, restart the app after updating — that error is resolved in current builds.

## Shortcuts

| Action | Keys |
|--------|------|
| Quick capture | Alt+Shift+Space |
| Save capture (stay open) | Enter |
| Undo last capture | Ctrl+Z |
| Close capture | Esc |
| Focus search | `/` (inbox) |
