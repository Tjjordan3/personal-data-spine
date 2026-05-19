# DonePath roadmap

Local-first Tauri/React/SQLite app. Philosophy: **leverage** (fewer taps, action-oriented), not new tabs.

## Milestones

| # | Theme | Status |
|---|--------|--------|
| **M0** | Trust the data — export, backup, import | **Shipped** (v5) |
| **M1** | Command palette (`Ctrl+K` / `Cmd+K`) | **Shipped** (v5) |
| **M2** | Today that acts — Focus actions, snooze, Start focus | **Shipped** (v5) |
| **M3** | Meetings leverage — parser, linked tasks rollup | Planned |
| **M4** | Search & graph — FTS5, link picker, layout | Planned |
| **M5** | Capture everywhere — shortcuts, templates | Planned |
| **M6** | Polish & performance — empty states, batch ops | Planned |

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

## Startup performance

- `index.html`: themed splash + `pds-settings` sync before JS bundle
- Code-split heavy routes (Subscriptions, Projects, Meetings, Settings, Graph)

## Later (M3–M6)

See [V5.md](V5.md) for meetings hub and deferred v4 items.
