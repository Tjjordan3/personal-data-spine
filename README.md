# DonePath (v7)

**DonePath** is a local-first desktop app for tasks, meetings, and focus on your computer. Built with Tauri 2, React, TypeScript, and SQLite.

> The git checkout folder is still named `personal-data-spine` for continuity with earlier snapshots.

| Milestone | Branch / snapshot | App version | GitHub release tag |
|-----------|-------------------|-------------|-------------------|
| **v7 (active)** | `v7` · [V7.md](V7.md) | **0.3.0** | [`v0.3.0`](https://github.com/Tjjordan3/personal-data-spine/releases/tag/v0.3.0) |
| v6 (frozen) | `v6` · `../personal-data-spine-v6/` · [V6.md](V6.md) | 0.2.0 | [`v0.2.0`](https://github.com/Tjjordan3/personal-data-spine/releases/tag/v0.2.0) |
| v5 (frozen) | `v5` · `../personal-data-spine-v5/` · [V5.md](V5.md) | — | `v5.0.0` (milestone) |
| v4 (frozen) | `v4` · `../personal-data-spine-v4/` · [V4.md](V4.md) | — | `v4.0.0` (milestone) |
| v3 (frozen) | `../personal-data-spine-v3/` · [V3.md](V3.md) | — | — |
| v2 (frozen) | `../personal-data-spine-v2/` · [V2.md](V2.md) | — | — |
| v1 | `../personal-data-spine-v1/` · [V1.md](V1.md) | — | — |

## v7 updates (app **0.3.0**, tag **v0.3.0**)

Shipped in v7.0 (see [V7.md](V7.md) for backlog and v7.1 plans):

- **Link suggestions** — confirm before linking after meeting save; no silent graph links
- **Focus spine** — project/meeting context on task rows; one click to open linked hub
- **LLM firewall** — documented opt-in, local-by-default, Meetings-only rule ([SECURITY.md](SECURITY.md), Settings)

**Planned (v7.1):** persist graph show/hide + neighborhood scope; weekly rollup of completed tasks with outcomes.

## v6 updates (app **0.2.0**, tag **v0.2.0**)

### Hubs (Meetings / Projects / Subscriptions parity)

- **Projects hub** — 3-column layout (list, detail, linked tasks); sidebar task edit; add task to project; new project; project compose template; related-items panel and cross-links to Subscriptions/Inbox
- **Subscriptions hub** — 3-column layout; catalog picker; renewal detail in center
- **Renewal reminders** — local Windows toasts (7-day window, Settings toggle, deduped per day)

### Daily flow & capture

- **Snooze / reschedule** — shared actions on hub task rows
- **Command palette** — go to project, new meeting from template, export backup
- **Post-meeting save** — quick actions prompt after save
- **Capture** — shared `CaptureForm`; floating capture window (close + resize); inline capture on Focus; tag suggestions (`TagAddField`, common tags) in capture and item edit

### Power user

- **ICS export** — active tasks with due dates (Settings, palette)
- **Graph scope** — full graph vs selection neighborhood; graph default off in Inbox
- **Duplicate item** — optional one-hop link copy
- **Meeting templates** — user templates; duplicate last meeting
- **Recurring tasks / subscriptions** — weekly/monthly/yearly metadata in Focus stream
- **Markdown folder import** — `.md` → notes with `#imported` and path dedupe

### Shell, graph, releases

- **UI identity** — IBM Plex Sans, type scale, nav icons, milestone app icon, emerald accents
- **Graph view** — larger viewport, type icons, legend, labels on focus/hover
- **Windows installer** — GitHub Actions + [RELEASING.md](RELEASING.md); assets on Releases (not in git)
- **Security docs** — [SECURITY.md](SECURITY.md); LLM privacy blurb in Settings

## v5 features (milestone **v5.0.0**)

- **Backup & data** — Settings: DB path, SQLite + JSON export/restore, last backup time
- **Command palette** — `Ctrl+K` / `Cmd+K`, navigation, create, focus timer, search
- **Focus actions** — Start / Done / Snooze / Reschedule / Log outcome; Start next
- **Meetings hub** — split view, title metadata, linked-task sidebar edit, decisions parser, project on tasks
- **Search & graph** — FTS5, link picker, linked-to-selection filter, spring layout
- **Capture templates** — meeting + note templates; shortcuts in Settings
- **Polish** — empty states, mark visible done, FTS performance

## Download (Windows)

Pre-built installers are published on **[GitHub Releases](https://github.com/Tjjordan3/personal-data-spine/releases)** (not stored in the git tree).

- **Latest:** [`DonePath_0.3.0_x64-setup.exe`](https://github.com/Tjjordan3/personal-data-spine/releases/latest) (tag `v0.3.0`)
- Older: `DonePath_0.2.0_x64-setup.exe` (`v0.2.0`)
- **Your data stays on your PC** — the installer does not include tasks or meetings from anyone else’s machine. Each user gets their own local database. Reinstalling on the same Windows user keeps existing data.
- **Privacy:** optional meeting LLM sends note text to Ollama or OpenAI when you turn it on in Settings. The database is not encrypted at rest. See [SECURITY.md](SECURITY.md).
- Build or publish yourself: [RELEASING.md](RELEASING.md).

## v4 features (milestone **v4.0.0**)

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

| | |
|--|--|
| **App version** | `0.3.0` (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`) |
| **Active branch** | `v7` |
| **Local DB** | `%APPDATA%\com.tjord.personal-data-spine\personal_spine.db` |
| **Publish installer** | Tag `v*` (e.g. `v0.3.0`) → [RELEASING.md](RELEASING.md) |

From the **project root** (this folder):

```bash
npm install
npm run tauri dev
```

`npm run dev` starts Vite only (browser at http://127.0.0.1:1420) and does **not** open the DonePath desktop window. Always use `npm run tauri dev` for the GUI.

```bash
npm run build    # typecheck + Vite
npm test         # Vitest (e.g. meeting heuristic parser)
npm run tauri build   # Windows installer under src-tauri/target/release/bundle/
```

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
