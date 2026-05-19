# DonePath on macOS

First-run checklist for the universal `.dmg` from [GitHub Releases](https://github.com/Tjjordan3/personal-data-spine/releases).

## Install (unsigned build)

1. Download `DonePath_<version>_universal.dmg` from the release for your tag (e.g. `v0.3.2`).
2. Open the DMG and drag **DonePath** to Applications (or run from the mounted volume).
3. First launch: macOS may block the app. Use **right-click → Open**, or **System Settings → Privacy & Security → Open Anyway**.

After you trust the app once, normal double-click works until you download a new unsigned build.

### App won’t open from the icon (fixed in v0.3.2+)

On **v0.3.1** and earlier, double-click could fail while the app still ran if you started `Contents/MacOS/personal-data-spine` by hand — the bundle expected `DonePath` as the executable name. **v0.3.2+** aligns the binary with `productName`. Upgrade from [Releases](https://github.com/Tjjordan3/personal-data-spine/releases/latest).

## Data location

- Database: `~/Library/Application Support/com.tjord.personal-data-spine/personal_spine.db`
- Settings (theme, shortcuts): WebView local storage for that app install
- Installers do **not** include your tasks or meetings

Move data between machines with **Settings → Backup & data** (export `.db` / `.json`, restore on the other Mac).

## Shortcuts

| Action | Default |
|--------|---------|
| Quick capture | **⌥⇧Space** (Alt+Shift+Space), then **⌘⇧Space** if registration fails |
| Command palette | **⌘K** |
| Focus search (Inbox) | `/` |

Change capture shortcut in **Settings**; the app re-registers on save.

## Permissions

- **Notifications** — optional; enable in Settings → Subscriptions for renewal reminders within 7 days.
- **Accessibility / Input monitoring** — macOS may prompt if global shortcuts fail; allow DonePath in System Settings if capture hotkey does not work.

## Smoke test (maintainers)

After a release or local build:

- [ ] Light and dark theme; capture window matches main window
- [ ] Capture hotkey opens floating panel; save a note
- [ ] Focus, Inbox, Meetings, Projects, Subscriptions load
- [ ] Subscription renewal notification (if due in window)
- [ ] Backup export and restore

## Build from source

See [RELEASING.md](../RELEASING.md) § Build locally (macOS).
