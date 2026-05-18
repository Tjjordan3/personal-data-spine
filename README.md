# Personal Data Spine (v4)

Local-first desktop app built with Tauri 2, React, TypeScript, and SQLite.

- **v1 snapshot:** `../personal-data-spine-v1/` and [V1.md](V1.md)
- **v2 snapshot (frozen):** `../personal-data-spine-v2/` and [V2.md](V2.md)
- **v3 snapshot (frozen):** `../personal-data-spine-v3/` and [V3.md](V3.md)
- **v4 scope (active):** [V4.md](V4.md)

## v3 features (shipped)

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

```bash
npm install
npm run tauri dev
```

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
