# DonePath (v7)

**DonePath** is a local-first desktop app for tasks, meetings, and focus on your computer. Built with Tauri 2, React, TypeScript, and SQLite.

> The git checkout folder is still named `personal-data-spine` for continuity with earlier snapshots.

| Milestone | Archive | App version | GitHub tag |
|-----------|---------|-------------|------------|
| **v7 (active)** | branch **`v7`** · [V7.md](V7.md) | **0.3.4** | [`v0.3.4`](https://github.com/Tjjordan3/personal-data-spine/releases/tag/v0.3.4) (installers) |
| v6 (frozen) | `../personal-data-spine-v6/` · [V6.md](V6.md) | 0.2.0 | [`v6.0.0`](https://github.com/Tjjordan3/personal-data-spine/tree/v6.0.0) (milestone) · [`v0.2.0`](https://github.com/Tjjordan3/personal-data-spine/releases/tag/v0.2.0) (installer) |
| v5 (frozen) | `../personal-data-spine-v5/` · [V5.md](V5.md) | — | [`v5.0.0`](https://github.com/Tjjordan3/personal-data-spine/tree/v5.0.0) (milestone) |
| v4 (frozen) | `../personal-data-spine-v4/` · [V4.md](V4.md) | — | `v4.0.0` (milestone, local tag) |
| v3 (frozen) | `../personal-data-spine-v3/` · [V3.md](V3.md) | — | — |
| v2 (frozen) | `../personal-data-spine-v2/` · [V2.md](V2.md) | — | — |
| v1 | `../personal-data-spine-v1/` · [V1.md](V1.md) | — | — |

### Branching and archive policy

- **Active development** uses a single git branch: **`v7`** (GitHub default branch).
- **Frozen milestones** are preserved with **git tags** (e.g. `v6.0.0`, `v5.0.0`) and **sibling snapshot folders** on disk (`../personal-data-spine-v6/`, etc.), not long-lived `v4`/`v5`/`v6` branches.
- **Installers** ship on **app version** tags (`v0.2.0`, `v0.3.2`, …) via [RELEASING.md](RELEASING.md) — **Windows** `.exe` and **macOS** universal `.dmg`. **Milestone** tags (`v6.0.0`, `v5.0.0`) freeze scope only — they do not run the Release workflow.
- Older milestone branches were removed from GitHub to reduce clutter; history remains in `v7` and at the tagged commits.

## v7 updates (app **0.3.4**, tag **v0.3.4**)

Shipped in v7.0+ (see [V7.md](V7.md) for backlog and v7.1 plans):

- **Link suggestions** — confirm before linking after meeting save; no silent graph links
- **Focus spine** — project/meeting context on task rows; one click to open linked hub
- **LLM firewall** — documented opt-in, local-by-default, Meetings-only rule ([SECURITY.md](SECURITY.md), Settings)
- **macOS distribution** — universal `.dmg` on GitHub Releases ([docs/MACOS.md](docs/MACOS.md)); same codebase as Windows

**Planned (v7.1):** persist graph show/hide + neighborhood scope; weekly rollup of completed tasks with outcomes.

## v6 updates (app **0.2.0**, tag **v0.2.0**)

### Hubs (Meetings / Projects / Subscriptions parity)

- **Projects hub** — 3-column layout (list, detail, linked tasks); sidebar task edit; add task to project; new project; project compose template; related-items panel and cross-links to Subscriptions/Inbox
- **Subscriptions hub** — 3-column layout; catalog picker; renewal detail in center
- **Renewal reminders** — local desktop notifications (7-day window, Settings toggle, deduped per day)

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
- **Installers** — GitHub Actions + [RELEASING.md](RELEASING.md); Windows `.exe` and macOS `.dmg` on Releases (not in git)
- **Security docs** — [SECURITY.md](SECURITY.md); LLM privacy blurb in Settings

## v5 features (milestone **v5.0.0**)

- **Backup & data** — Settings: DB path, SQLite + JSON export/restore, last backup time
- **Command palette** — `Ctrl+K` / `Cmd+K`, navigation, create, focus timer, search
- **Focus actions** — Start / Done / Snooze / Reschedule / Log outcome; Start next
- **Meetings hub** — split view, title metadata, linked-task sidebar edit, decisions parser, project on tasks
- **Search & graph** — FTS5, link picker, linked-to-selection filter, spring layout
- **Capture templates** — meeting + note templates; shortcuts in Settings
- **Polish** — empty states, mark visible done, FTS performance

## Download

Pre-built installers are on **[GitHub Releases](https://github.com/Tjjordan3/personal-data-spine/releases)** (not in the git tree).

### Windows

- **Latest:** [`DonePath_0.3.4_x64-setup.exe`](https://github.com/Tjjordan3/personal-data-spine/releases/latest) (tag `v0.3.4`)
- Older: `DonePath_0.2.0_x64-setup.exe` (`v0.2.0`)
- SmartScreen may warn on unsigned builds → **More info → Run anyway**

### macOS (Apple Silicon + Intel)

- **Latest:** `DonePath_0.3.4_universal.dmg` on [Releases](https://github.com/Tjjordan3/personal-data-spine/releases/latest) (tag `v0.3.4`)
- First launch: **right-click → Open**, or **System Settings → Privacy & Security → Open Anyway** (unsigned build)
- First-run guide: [docs/MACOS.md](docs/MACOS.md)

### All platforms

- **Your data stays on your device** — installers do not include anyone else’s tasks or meetings. Each user gets a local database. Reinstalling on the same user account usually keeps data.
- **Privacy:** optional meeting LLM sends note text to Ollama or OpenAI when enabled in Settings. The database is not encrypted at rest. See [SECURITY.md](SECURITY.md).
- Build yourself: [RELEASING.md](RELEASING.md).

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
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)

## Development

| | |
|--|--|
| **App version** | `0.3.4` (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`) |
| **Active branch** | `v7` |
| **Local DB** | Win: `%APPDATA%\com.tjord.personal-data-spine\personal_spine.db` · Mac: `~/Library/Application Support/com.tjord.personal-data-spine/personal_spine.db` |
| **Publish installer** | Tag `v0.x.y` → [RELEASING.md](RELEASING.md) (Windows + macOS) |

From the **project root** (this folder):

```bash
npm install
npm run tauri dev
```

`npm run dev` starts Vite only (browser at http://127.0.0.1:1420) and does **not** open the DonePath desktop window. Always use `npm run tauri dev` for the GUI.

```bash
npm run build    # typecheck + Vite
npm test         # Vitest (e.g. meeting heuristic parser)
npm run tauri build   # Windows: bundle/ · macOS: --target universal-apple-darwin (see RELEASING.md)
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
| Quick capture | Alt+Shift+Space (macOS: ⌥⇧Space or ⌘⇧Space fallback) |
| Save capture (stay open) | Enter |
| Undo last capture | Ctrl+Z |
| Close capture | Esc |
| Focus search | `/` (inbox) |
