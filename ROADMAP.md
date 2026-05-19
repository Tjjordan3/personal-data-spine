# DonePath roadmap

Local-first Tauri/React/SQLite app. Philosophy: **leverage** (fewer taps, action-oriented), not new tabs.

## Milestones

| # | Theme | Status |
|---|--------|--------|
| **M0** | Trust the data — export, backup, import | **Shipped** (v5) |
| **M1** | Command palette (`Ctrl+K` / `Cmd+K`) | **Shipped** (v5) |
| **M2** | Today that acts — Focus actions, snooze, Start focus | **Shipped** (v5) |
| **M3** | Meetings leverage — parser, linked tasks rollup | **Shipped** (v5) |
| **M4** | Search & graph — FTS5, link picker, layout | **Shipped** (v5) |
| **M5** | Capture everywhere — shortcuts, templates | **Shipped** (v5) |
| **M6** | Polish & performance — empty states, batch ops | **Shipped** (v5) |

## M0 — Trust the data

- Settings → **Backup & data**: DB path, SQLite export, JSON export (items + links)
- Destructive restore with confirmation; `lastBackupAt` in `pds-settings`
- Rust: `get_db_path`, `export_database`, `import_database`

## M1 — Command palette

- Global `Ctrl+K` / `Cmd+K` (disabled while typing in inputs)
- Navigation, new task/note, focus timer, fuzzy item search

## M2 — Focus leverage

- Task row actions: Start, Done, Snooze, Reschedule, Log outcome
- `metadata.snoozed_until` hides tasks until date
- **Start focus** — highest-urgency task in stream

## M3 — Meetings leverage

- Linked tasks sidebar: status, Done/restore, overdue, Start focus
- Save meeting with notes only (`task_count` 0)
- Parser: `DECISION:` lines → `metadata.decisions[]`; relative dates (tomorrow, EOW, weekdays)
- Project picker on parse preview rows; meeting keyboard shortcuts

## M4 — Search & graph

- SQLite **FTS5** (`items_fts`) with LIKE fallback; rebuild on import
- **Link picker** modal in Related panel (search by title/content)
- Inbox **Linked to selection** filter; spring-refined graph layout

## M5 — Capture everywhere

- Meeting templates (Standup, 1:1, Retro)
- Note templates in capture window and command palette
- Shortcuts documented in Settings

## M6 — Polish & performance

- Shared **EmptyState** for Focus, Inbox, Meetings, etc.
- Inbox **Mark visible done** batch action
- FTS-backed search; single-query meeting task list

## Startup performance

- `index.html`: themed splash + `pds-settings` sync before JS bundle
- Code-split heavy routes (Subscriptions, Projects, Meetings, Settings, Graph)

## Later

See [V5.md](V5.md) optional items (subscription reminders, mobile, etc.).
