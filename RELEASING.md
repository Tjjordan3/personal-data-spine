# Releasing DonePath

## Data and privacy

- **Installers contain only the app** — not your tasks, meetings, or database.
- **Data is stored per Windows user** on each machine, typically:
  - `%APPDATA%\com.tjord.personal-data-spine\personal_spine.db`
- **Reinstalling or upgrading** on the same PC keeps existing data (same app data folder).
- **Other people** who install from a release get an **empty** database unless they import a backup you gave them.
- **Do not share** `personal_spine_backup.db` unless you intend to share that data.

Settings and some UI state live in WebView2 local storage for that app install — also per user, not in the installer.

Broader security and privacy notes (LLM, encryption, backups): [SECURITY.md](SECURITY.md).

## What we ship on GitHub

| Approach | Use |
|----------|-----|
| **GitHub Releases** (recommended) | Attach `DonePath_*_setup.exe` to a version tag. Source stays on `main`; binaries are release assets only. |
| **Commit `.exe` on `main`** | Avoid — bloats git history; use Releases or CI artifacts instead. |

This repo uses a **GitHub Actions** workflow (`.github/workflows/release.yml`) to build the Windows installer when you push a tag like `v0.2.0`.

## Version numbers

Keep these in sync before a release:

- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`

`productName` in `tauri.conf.json` is **DonePath** (installer filename prefix).

## Build locally (Windows)

From the project root:

```powershell
npm install
npm run tauri build
```

Outputs:

| Artifact | Path |
|----------|------|
| **NSIS installer (share this)** | `src-tauri\target\release\bundle\nsis\DonePath_<version>_x64-setup.exe` |
| MSI installer | `src-tauri\target\release\bundle\msi\DonePath_<version>_x64_en-US.msi` |
| Raw binary (dev/testing) | `src-tauri\target\release\personal-data-spine.exe` |

Prerequisites: Node 18+, Rust, Visual Studio Build Tools with **Desktop development with C++**.

Unsigned builds may trigger Windows SmartScreen; users can choose **More info → Run anyway** until you add code signing later.

## Publish via GitHub Releases (automated)

1. Commit and push source (workflow must be on the default branch).
2. Create and push an **app version** tag matching `vMAJOR.MINOR.PATCH` (e.g. `v0.3.0`):

   ```powershell
   git tag v0.3.0
   git push origin v0.3.0
   ```

   **Milestone tags** (`v5.0.0`, `v6.0.0`) mark frozen scope in git; they do **not** run this workflow (no installer build).

3. The **Release** workflow builds on `windows-latest` and uploads the NSIS (and MSI) assets to a new GitHub Release for that tag.

`package-lock.json` must be committed and in sync with `package.json` (CI runs `npm ci`). If a tagged release fails, fix the workflow or lockfile on `v7`, push, then re-push the tag (see below) or run **Actions → Release → Run workflow**.

### Changelog on the Releases page

When an app-version tag is pushed, `tauri-action` prepends the install blurb above and appends **GitHub-generated release notes** (`generateReleaseNotes: true`). You can still edit the release text on GitHub after publish.

Day-to-day PR validation uses **CI** (`.github/workflows/ci.yml`): `npm run build` and `npm test` on Ubuntu — no Tauri/Rust on every PR.

## Publish manually (one-off)

1. Run `npm run tauri build` locally.
2. On GitHub: **Releases → Draft a new release** → choose or create tag `v0.2.0`.
3. Upload `DonePath_0.2.0_x64-setup.exe` from `bundle\nsis\`.
4. Add release notes; publish.

## After users install

- They get a fresh local database on first run.
- Export/import backups from **Settings → Backup & data** if they move machines.
