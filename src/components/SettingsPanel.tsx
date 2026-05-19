import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_LLM_SETTINGS,
  loadLlmSettings,
  saveLlmSettings,
  type LlmSettings,
} from "../lib/meeting/llmRefiner";
import {
  exportJsonBackup,
  exportSqliteBackup,
  formatLastBackup,
  importSqliteRestore,
} from "../lib/backup";
import { exportTasksIcs } from "../lib/calendar/icsExport";
import { importNotesFromFolder } from "../lib/import/markdownFolder";
import { emit } from "@tauri-apps/api/event";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
  type ThemePreference,
} from "../lib/settings";
import { getSchemaVersion, CURRENT_SCHEMA_VERSION } from "../lib/db/schema";
import { applyTheme, broadcastThemeChange } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

interface SettingsPanelProps {
  onClose: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
  onDataRestored?: () => void;
}

export function SettingsPanel({
  onClose,
  onToast,
  onDataRestored,
}: SettingsPanelProps) {
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    loadSettings(),
  );
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() =>
    loadLlmSettings(),
  );
  const [dbPath, setDbPath] = useState("");
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    void loadDbPath();
    void getSchemaVersion()
      .then(setSchemaVersion)
      .catch(() => setSchemaVersion(null));
  }, []);

  async function loadDbPath() {
    try {
      const path = await invoke<string>("get_db_path");
      setDbPath(path);
    } catch {
      setDbPath("Unavailable");
    }
  }

  async function applyShortcut() {
    try {
      await invoke("register_shortcut", {
        accelerator: appSettings.captureShortcut,
      });
      saveSettings(appSettings);
      onToast("Capture shortcut updated.", "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to register shortcut",
        "error",
      );
    }
  }

  async function handleExportSqlite() {
    setBackupBusy(true);
    try {
      const path = await exportSqliteBackup();
      if (path) {
        setAppSettings(loadSettings());
        onToast(`SQLite backup saved.`, "success");
      }
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Export failed",
        "error",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleExportJson() {
    setBackupBusy(true);
    try {
      const path = await exportJsonBackup();
      if (path) {
        setAppSettings(loadSettings());
        onToast(`JSON export saved.`, "success");
      }
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "JSON export failed",
        "error",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleExportIcs() {
    setBackupBusy(true);
    try {
      const result = await exportTasksIcs();
      if (!result) return;
      if (result.count === 0) {
        onToast("No active tasks with due dates to export.", "error");
        return;
      }
      onToast(`Exported ${result.count} task(s) to calendar file.`, "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "ICS export failed",
        "error",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImportMarkdown() {
    setBackupBusy(true);
    try {
      const { imported, skipped } = await importNotesFromFolder();
      if (imported === 0 && skipped === 0) return;
      await emit("item:saved", {});
      onToast(
        imported > 0
          ? `Imported ${imported} note(s)${skipped > 0 ? ` · ${skipped} skipped` : ""}.`
          : `No new files (${skipped} already imported).`,
        imported > 0 ? "success" : "error",
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Import failed",
        "error",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestore() {
    const ok = window.confirm(
      "Restore will replace your entire local database with the chosen backup file. " +
        "All current data will be overwritten. This cannot be undone.\n\n" +
        "Continue?",
    );
    if (!ok) return;
    setBackupBusy(true);
    try {
      const restored = await importSqliteRestore();
      if (!restored) return;
      setAppSettings(loadSettings());
      onToast("Database restored. Reloading…", "success");
      onDataRestored?.();
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Restore failed",
        "error",
      );
    } finally {
      setBackupBusy(false);
    }
  }

  function saveAll() {
    saveSettings(appSettings);
    applyTheme(appSettings.theme);
    broadcastThemeChange(appSettings.theme);
    saveLlmSettings(llmSettings);
    onToast("Settings saved.", "success");
  }

  function handleThemeChange(theme: ThemePreference) {
    setAppSettings((s) => {
      const next = { ...s, theme };
      saveSettings(next);
      applyTheme(theme);
      broadcastThemeChange(theme);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-pds-text">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-pds-muted hover:text-pds-muted"
        >
          Close
        </button>
      </div>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Appearance
        </h3>
        <p className="text-[11px] text-pds-subtle">
          Default follows your system on first launch. Choose light or dark to
          override.
        </p>
        <ThemeToggle value={appSettings.theme} onChange={handleThemeChange} />
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Subscriptions
        </h3>
        <label className="flex items-center gap-2 text-xs text-pds-muted">
          <input
            type="checkbox"
            checked={appSettings.subscriptionRenewalReminders}
            onChange={(e) =>
              setAppSettings((s) => ({
                ...s,
                subscriptionRenewalReminders: e.target.checked,
              }))
            }
          />
          Desktop notification when a renewal is due within 7 days
        </label>
        <p className="text-[11px] text-pds-subtle">
          Local reminders only — no cloud. One toast per subscription per
          renewal date per day. Click a notification to open Subscriptions.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Focus / timer
        </h3>
        <label className="flex items-center gap-2 text-xs text-pds-muted">
          <input
            type="checkbox"
            checked={appSettings.timerChime}
            onChange={(e) =>
              setAppSettings((s) => ({ ...s, timerChime: e.target.checked }))
            }
          />
          Play chime when a focus or break timer finishes
        </label>
        <p className="text-[11px] text-pds-subtle">
          Chimes only play when the countdown reaches zero (not when you stop
          early). Some browsers require a click or keypress in the app before
          audio works in a background tab.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Keyboard shortcuts
        </h3>
        <ul className="space-y-1.5 text-[11px] text-pds-muted">
          <li>
            <span className="font-medium text-pds-text">Ctrl+K / Cmd+K</span> —
            Command palette (navigation, search, new items)
          </li>
          <li>
            <span className="font-medium text-pds-text">
              {appSettings.captureShortcut}
            </span>{" "}
            — Quick capture window (global)
          </li>
          <li>
            <span className="font-medium text-pds-text">/</span> — Focus inbox
            search (Inbox view)
          </li>
          <li>
            <span className="font-medium text-pds-text">Focus tab</span> — Space
            start/pause, R reset, S skip break, 1/2/3 presets
          </li>
          <li>
            <span className="font-medium text-pds-text">Meetings</span> —
            Ctrl+Enter parse, Ctrl+S save (outside note textarea)
          </li>
          <li>
            <span className="font-medium text-pds-text">Capture</span> — Enter
            save, Esc close, Ctrl+Z undo
          </li>
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Quick capture
        </h3>
        <label className="block text-xs text-pds-muted">
          Global shortcut (e.g. Alt+Shift+Space)
          <input
            value={appSettings.captureShortcut}
            onChange={(e) =>
              setAppSettings((s) => ({
                ...s,
                captureShortcut: e.target.value,
              }))
            }
            className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
          />
        </label>
        <button
          type="button"
          onClick={() => void applyShortcut()}
          className="pds-btn-primary px-3 py-1.5 text-xs"
        >
          Apply shortcut
        </button>
        <p className="text-[11px] text-pds-subtle">
          Avoid bare Alt+Space on Windows (system menu conflict). Fallbacks
          register automatically on first launch.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          Backup &amp; data
        </h3>
        <p className="text-[11px] text-pds-subtle">
          Your data lives in a local SQLite file. Export regularly; restore
          replaces the entire database.
        </p>
        {dbPath && (
          <p className="break-all text-[11px] text-pds-muted">
            <span className="font-medium text-pds-text">Database: </span>
            {dbPath}
          </p>
        )}
        <p className="text-[11px] text-pds-muted">
          Database schema:{" "}
          <span className="font-medium text-pds-text">
            v{schemaVersion ?? "…"}
          </span>
          {schemaVersion !== null && schemaVersion < CURRENT_SCHEMA_VERSION && (
            <span className="text-amber-600 dark:text-amber-400">
              {" "}
              (migrating to v{CURRENT_SCHEMA_VERSION}…)
            </span>
          )}
        </p>
        <p className="text-[11px] text-pds-subtle">
          App updates may migrate your local database automatically. Export a
          backup before major upgrades.
        </p>
        <p className="text-[11px] text-pds-muted">
          Last backup: {formatLastBackup(appSettings.lastBackupAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => void handleExportSqlite()}
            className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted disabled:opacity-50"
          >
            Export SQLite backup
          </button>
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => void handleExportJson()}
            className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => void handleExportIcs()}
            className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted disabled:opacity-50"
          >
            Export calendar (.ics)
          </button>
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => void handleImportMarkdown()}
            className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted disabled:opacity-50"
          >
            Import notes from folder
          </button>
          <button
            type="button"
            disabled={backupBusy}
            onClick={() => void handleRestore()}
            className="rounded border border-red-800/60 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
          >
            Import / restore…
          </button>
        </div>
        <p className="text-[11px] text-red-400/90">
          Restore is destructive: it overwrites your current database with the
          selected file. Export first if unsure.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          LLM refinement
        </h3>
        <p className="text-pds-caption leading-relaxed text-pds-muted">
          Off by default. <strong className="font-medium text-pds-text">Meetings only</strong> — no AI on Focus, inbox, or projects. When enabled, meeting note text is sent to the provider you choose so it can suggest action items. Ollama usually stays on this PC; OpenAI sends notes to the cloud. API keys are stored locally on this device (not encrypted). See{" "}
          <a
            href="https://github.com/Tjjordan3/personal-data-spine/blob/main/SECURITY.md"
            className="text-emerald-700 underline decoration-emerald-700/40 hover:text-emerald-600 dark:text-emerald-400"
            target="_blank"
            rel="noreferrer"
          >
            SECURITY.md
          </a>{" "}
          for details.
        </p>
        <label className="flex items-center gap-2 text-xs text-pds-muted">
          <input
            type="checkbox"
            checked={llmSettings.enabled}
            onChange={(e) =>
              setLlmSettings((s) => ({ ...s, enabled: e.target.checked }))
            }
          />
          Enable LLM refine in Meeting Mode
        </label>
        <label className="block text-xs text-pds-muted">
          Provider
          <select
            value={llmSettings.provider}
            onChange={(e) =>
              setLlmSettings((s) => ({
                ...s,
                provider: e.target.value as LlmSettings["provider"],
              }))
            }
            className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI API</option>
          </select>
        </label>
        {llmSettings.provider === "ollama" ? (
          <>
            <label className="block text-xs text-pds-muted">
              Ollama URL
              <input
                value={llmSettings.ollamaUrl}
                onChange={(e) =>
                  setLlmSettings((s) => ({ ...s, ollamaUrl: e.target.value }))
                }
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
            <label className="block text-xs text-pds-muted">
              Model
              <input
                value={llmSettings.ollamaModel}
                onChange={(e) =>
                  setLlmSettings((s) => ({
                    ...s,
                    ollamaModel: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
          </>
        ) : (
          <>
            <label className="block text-xs text-pds-muted">
              API key
              <input
                type="password"
                value={llmSettings.openaiApiKey}
                onChange={(e) =>
                  setLlmSettings((s) => ({
                    ...s,
                    openaiApiKey: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
            <label className="block text-xs text-pds-muted">
              Model
              <input
                value={llmSettings.openaiModel}
                onChange={(e) =>
                  setLlmSettings((s) => ({
                    ...s,
                    openaiModel: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() =>
            setLlmSettings({ ...DEFAULT_LLM_SETTINGS })
          }
          className="text-[11px] text-pds-muted hover:text-pds-muted"
        >
          Reset LLM defaults
        </button>
      </section>

      <button
        type="button"
        onClick={saveAll}
        className="pds-btn-primary px-3 py-2 text-xs"
      >
        Save all settings
      </button>
    </div>
  );
}
