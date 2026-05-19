<!-- INTERNAL: Do not publish, link from README, or include in release notes unless the product owner explicitly approves. -->

*Internal maintainer doc — not for distribution.*

# What not to build — DonePath

DonePath is a **local-first spine**: your items, explicit links, and leverage (fewer taps toward action). This list keeps scope honest when ideas feel obvious or competitors ship them. If something is not here, check [V6.md](V6.md) and [ROADMAP.md](ROADMAP.md) before expanding.

---

## Hard no

Explicitly out of scope unless the product thesis changes in a major version note.

- **Cloud sync, accounts, or multi-device** — no DonePath backend holding your items; one SQLite DB per machine ([V5.md](V5.md), [V6.md](V6.md)).
- **Mobile client** — desktop Tauri only for now.
- **OAuth or live calendar APIs** — no Google/Outlook sync; file-based ICS export is the ceiling ([V6.md](V6.md)).
- **Team / multi-user / collaboration** — sharing is “export a backup you chose,” not shared workspaces.
- **Analytics or telemetry to DonePath servers** — no crash reporting, usage funnels, or product analytics phoning home ([SECURITY.md](SECURITY.md)).
- **Committing release binaries to git** — installers on GitHub Releases or CI artifacts only ([RELEASING.md](RELEASING.md)).
- **Shipping secrets in the repo** — no API keys, real `.env`, or sample databases with personal data in version control.
- **“Encrypted vault” marketing without real encryption** — the DB is plaintext SQLite today; do not imply password-manager-grade protection ([SECURITY.md](SECURITY.md)).

---

## Defer / resist

Tempting directions that dilute coherence **right now**. Revisit only with a deliberate version-scope change.

- **New hub layouts or a fourth entity tab** — Meetings, Projects, and Subscriptions already share the 3-column pattern; another hub or layout variant multiplies maintenance without new leverage.
- **LLM in every workflow** — inbox triage, project summaries, auto-tagging, “smart” search rewrite, etc. AI belongs behind an explicit gate, not as default UX ([SECURITY.md](SECURITY.md)).
- **Auto-creating links without user confirmation** — suggest links; never silently wire the graph. Links are intentional relationships.
- **Graph-first or graph-always-on inbox** — the graph is an optional lens in Inbox, not the product surface. Default views stay list- and action-oriented ([ROADMAP.md](ROADMAP.md)).
- **Full RRULE engines or two-way calendar sync** — recurring tasks/subscriptions in metadata + ICS **export** are enough; resist becoming a calendar client.
- **Inbox as a second “everything” hub** — resist duplicating Focus/Meetings/Projects responsibilities in Inbox chrome.
- **Feature bloat “because v5 shipped it”** — new tabs, dashboards, and widgets that do not reduce taps toward Done / Start / Snooze / link / capture.
- **Another accent color system or rebrand churn** — emerald + IBM Plex + milestone icon are settled for v6; cosmetic churn steals leverage work.
- **Real-time sync metaphors in copy or UI** — no “synced,” “online,” or “team” language that implies a server.
- **Background agents that mutate the DB** — no always-on crawlers, email parsers, or schedulers writing items without a visible user action.
- **SQLCipher / keychain “soon” in user-facing copy** — document in [SECURITY.md](SECURITY.md) as future maintainer hardening until actually shipped.

---

## Build instead when tempted

| Instead of… | Do this |
|-------------|---------|
| Another hub or tab | **Command palette** navigation, **Focus** stream actions, hub parity only where an entity already exists |
| AI everywhere | **Opt-in Meetings LLM** ([SECURITY.md](SECURITY.md)); heuristic parser + templates first |
| Auto-links | **Link picker**, optional **suggest links** with confirm |
| Graph as home | **Inbox list + Related panel**; graph toggle / selection neighborhood ([V6.md](V6.md)) |
| Cloud backup | **Settings → Backup & data** export/restore, ICS file export |
| Calendar product | Due dates, snooze/reschedule, `.ics` export — no OAuth |
| “Smart” inbox sort | **FTS5 search**, facets, linked-to-selection filter |
| New capture surface | **Quick capture**, meeting/note templates, Markdown folder import |
| Collaboration | Export **JSON/SQLite** the user controls |
| Pretty empty features | **Empty states**, batch “mark visible done,” linked-task cards with Done/Start |
| Trust without docs | [SECURITY.md](SECURITY.md), honest Settings copy |

---

## LLM firewall

Rules for any AI-related work:

1. **Opt-in** — disabled by default; user enables in Settings with clear provider behavior (Ollama local vs OpenAI remote).
2. **Documented** — update [SECURITY.md](SECURITY.md) and in-app privacy text when behavior or data paths change.
3. **Meetings-only (v7)** — meeting note refinement is the only shipped LLM surface unless **[V7.md](V7.md)** or a successor version doc (e.g. V8.md) explicitly adds another scope in a version note. v7 does not expand LLM beyond Meetings.
4. **No silent sends** — no background LLM calls; no task/inbox/project content uploaded without a deliberate user action on that flow.
5. **No training / telemetry narrative** — we do not claim “your data improves the model”; we state what leaves the machine per provider.

Expanding LLM beyond Meetings requires: user-visible toggle, SECURITY.md update, and an explicit bullet in the active version doc (V7.md / V8.md) — not a drive-by PR.

---

## How to use this doc

- **Before a feature PR:** name the temptation (e.g. “auto-link on save”) and point to the row or bullet above.
- **Council / review:** treat items here as **defaults**, not suggestions — change the doc if the thesis changes.
- **Related:** [ROADMAP.md](ROADMAP.md) (leverage philosophy), [V6.md](V6.md) (shipped scope), [V7.md](V7.md) (planned backlog), [SECURITY.md](SECURITY.md) (privacy truth).
