# Security & privacy — DonePath

DonePath is a **local-first** desktop app. It does not provide cloud sync, accounts, or encrypted storage by default. This document describes what that means for you and anyone you share the installer with.

## Summary

| Topic | DonePath behavior |
|--------|-------------------|
| **Your data** | Stored in SQLite on your PC (`%APPDATA%\com.tjord.personal-data-spine\personal_spine.db`) |
| **Installers** | Contain the app only — **not** your tasks, meetings, or database |
| **Internet** | No telemetry; optional LLM and font loading (see below) |
| **Encryption** | Database is **not** encrypted at rest |
| **Best for** | Everyday personal productivity — not classified or high-assurance secrets |

## Threat model

**Low risk from strangers on the internet** — there is no DonePath server receiving your items.

**Higher risk from local access** — anyone (or any malware) that can read your Windows user profile or backup files can read your data. Use **device encryption** (e.g. BitLocker) and a strong Windows login for sensitive content.

**Installer trust** — download releases only from the official [GitHub Releases](https://github.com/Tjjordan3/personal-data-spine/releases) page. Unsigned builds may show Windows SmartScreen until the app is code-signed.

## Data on disk

- The SQLite file is **plaintext**. Do not treat DonePath like a password manager or secrets vault.
- Reinstalling or upgrading on the **same Windows user** usually **keeps** existing data (same app data folder).
- A **new user** or **new machine** starts with an **empty** database.

## Backups and restore

- **Export** (Settings → Backup & data) writes `.db` or `.json` files you choose. Those files are full copies of your data — protect them like any sensitive backup.
- **Restore** overwrites the live database with the file you select. Only restore files you trust.

## Optional LLM refinement (Meetings only)

**v7 product rule:** LLM is opt-in, local-by-default (Ollama), and limited to **Meeting Mode** note refinement. No inbox, Focus, project, or background AI calls.

Disabled by default. When enabled in **Settings → LLM refinement**:

- **Ollama** — meeting note text is sent to the URL you configure (default `http://localhost:11434`, typically stays on your machine).
- **OpenAI** — meeting note text and your API key are sent to `https://api.openai.com`.

API keys are stored in the app’s local WebView storage (plaintext on disk). Review your provider’s privacy policy before enabling.

## Network use

- **IBM Plex Sans** may load from Google Fonts on first launch (IP request to Google; not your task content).
- **LLM** only when you enable it (above).
- No built-in analytics or crash reporting to a DonePath backend.

## Recommendations for users

1. Prefer **local Ollama** if you want AI refinement without sending notes to a third party.
2. Do not store highly sensitive data unless your **whole device** is protected.
3. Do not share **backup `.db` files** unless you intend to share that data.
4. Keep the app updated from official releases.

## Recommendations for maintainers

- Publish installers via **GitHub Releases**, not committed binaries on `main`.
- Consider code signing for Windows to reduce SmartScreen friction.
- Future hardening (not shipped today): SQLCipher or OS keychain for optional encryption, stricter CSP, credential store for API keys.

## Reporting issues

If you find a security issue in DonePath, open a private report or GitHub issue on [personal-data-spine](https://github.com/Tjjordan3/personal-data-spine) with steps to reproduce. Do not include real personal data in public issues.
