# Personal Data Spine

Local-first desktop app built with Tauri 2, React, TypeScript, and SQLite. A unified `items` table stores notes, meetings, and tasks.

## Features

- **Quick capture** — global shortcut (default `Alt+Shift+Space`) opens a minimal overlay; Enter saves with auto-tags
- **Inbox** — search, filter by type/tag, dark minimal UI
- **Meeting mode** — paste notes, parse action items (owner, due date), preview/edit, save meeting + linked tasks
- **LLM refine** (optional) — Ollama or OpenAI in Settings
- **Database backup** — export SQLite file from Settings

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the “Desktop development with C++” workload (provides `link.exe`)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Schema

| Column     | Type        |
|------------|-------------|
| id         | UUID (TEXT) |
| type       | string      |
| content    | text        |
| tags       | JSON array  |
| created_at | ISO timestamp |
| source     | string      |
| metadata   | JSON object |

## Shortcuts

| Action        | Default            |
|---------------|--------------------|
| Quick capture | Alt+Shift+Space    |
| Focus search  | `/` (inbox)        |
| Save capture  | Enter              |
| Dismiss capture | Esc              |
