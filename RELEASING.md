# Releasing DonePath

## Data and privacy

- **Installers contain only the app** — not your tasks, meetings, or database.
- **Data is stored per user** on each machine:
  - **Windows:** `%APPDATA%\com.tjord.personal-data-spine\personal_spine.db`
  - **macOS:** `~/Library/Application Support/com.tjord.personal-data-spine/personal_spine.db`
- **Reinstalling or upgrading** on the same user account usually keeps existing data (same app data folder).
- **Other people** who install from a release get an **empty** database unless they import a backup you gave them.
- **Do not share** backup files unless you intend to share that data.

Settings and some UI state live in the platform webview store for that app install — also per user, not in the installer.

Broader security and privacy notes (LLM, encryption, backups): [SECURITY.md](SECURITY.md).

## What we ship on GitHub

| Approach | Use |
|----------|-----|
| **GitHub Releases** (recommended) | Attach Windows `.exe` and macOS `.dmg` to an app-version tag. Source stays on `v7`; binaries are release assets only. |
| **Commit installers on `v7`** | Avoid — bloats git history. |

The **Release** workflow (`.github/workflows/release.yml`) builds on **Windows** and **macOS** when you push a tag like `v0.3.1`.

## Version numbers

Keep these in sync before a release:

- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src-tauri/Cargo.lock` → `personal-data-spine` package version

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

Unsigned builds may trigger Windows SmartScreen; users can choose **More info → Run anyway** until code signing is added.

## Build locally (macOS)

From the project root:

```bash
xcode-select --install   # if needed
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm install
npm run tauri build -- --target universal-apple-darwin
```

Outputs:

| Artifact | Path |
|----------|------|
| **DMG (share this)** | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/DonePath_<version>_universal.dmg` |
| **App bundle** | `src-tauri/target/universal-apple-darwin/release/bundle/macos/DonePath.app` |

Prerequisites: Node 18+, Rust stable, Xcode Command Line Tools.

Unsigned builds require **right-click → Open** the first time (Gatekeeper). See [docs/MACOS.md](docs/MACOS.md).

## Publish via GitHub Releases (automated)

1. Commit and push source on `v7`.
2. Create and push an **app version** tag matching `vMAJOR.MINOR.PATCH` (e.g. `v0.3.1`):

   ```bash
   git tag v0.3.1
   git push origin v0.3.1
   ```

   **Milestone tags** (`v5.0.0`, `v6.0.0`) mark frozen scope in git; they do **not** run this workflow.

3. The **Release** workflow runs in parallel on `windows-latest` and `macos-latest` (universal binary) and attaches assets to one GitHub Release.

`package-lock.json` must be committed and in sync with `package.json` (CI runs `npm ci`). If a tagged release fails, fix the workflow on `v7`, push, delete and re-push the tag, or run **Actions → Release → Run workflow**.

### Changelog on the Releases page

`tauri-action` prepends the install blurb and appends **GitHub-generated release notes** (`generateReleaseNotes: true`).

Day-to-day PR validation uses **CI** (`.github/workflows/ci.yml`): `npm run build` and `npm test` on Ubuntu — no full Tauri build on every PR.

## macOS code signing and notarization (Phase 2 — optional)

Phase 1 ships **unsigned** universal `.dmg` files (same trust model as unsigned Windows builds).

When you want normal double-click install without Gatekeeper warnings:

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. Create a **Developer ID Application** certificate in Xcode or Apple Developer portal.
3. Add GitHub Actions secrets (names vary by setup; typical set):
   - `APPLE_CERTIFICATE` (base64 `.p12`)
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY`
   - `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`
4. Extend the macOS job in `release.yml` with Tauri signing env vars and `notarytool submit` + staple per [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).
5. Update [SECURITY.md](SECURITY.md) and [docs/MACOS.md](docs/MACOS.md) to remove unsigned first-run steps.

Until then, document Gatekeeper bypass for users (see README and MACOS.md).

## Publish manually (one-off)

1. Run `npm run tauri build` locally (Windows) or `npm run tauri build -- --target universal-apple-darwin` (macOS).
2. On GitHub: **Releases → Draft a new release** → tag `v0.3.1`.
3. Upload `DonePath_*_x64-setup.exe` and/or `DonePath_*_universal.dmg`.
4. Add release notes; publish.

## After users install

- They get a fresh local database on first run.
- Export/import backups from **Settings → Backup & data** to move between machines (Windows ↔ macOS supported via backup files).
