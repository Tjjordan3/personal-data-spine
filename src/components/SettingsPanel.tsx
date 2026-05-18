import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_LLM_SETTINGS,
  loadLlmSettings,
  saveLlmSettings,
  type LlmSettings,
} from "../lib/meeting/llmRefiner";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
  type ThemePreference,
} from "../lib/settings";
import { applyTheme } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

interface SettingsPanelProps {
  onClose: () => void;
  onToast: (message: string, kind: "success" | "error") => void;
}

export function SettingsPanel({ onClose, onToast }: SettingsPanelProps) {
  const [appSettings, setAppSettings] = useState<AppSettings>(() =>
    loadSettings(),
  );
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(() =>
    loadLlmSettings(),
  );
  const [dbPath, setDbPath] = useState("");

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

  async function exportDatabase() {
    const destination =
      appSettings.exportPath.trim() ||
      `${dbPath.replace(/personal_spine\.db$/i, "")}personal_spine_backup.db`;
    try {
      await invoke("export_database", { destination });
      onToast(`Database exported to ${destination}`, "success");
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Export failed",
        "error",
      );
    }
  }

  function saveAll() {
    saveSettings(appSettings);
    applyTheme(appSettings.theme);
    saveLlmSettings(llmSettings);
    onToast("Settings saved.", "success");
  }

  function handleThemeChange(theme: ThemePreference) {
    setAppSettings((s) => ({ ...s, theme }));
    applyTheme(theme);
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
          className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900"
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
          Database
        </h3>
        <button
          type="button"
          onClick={() => void loadDbPath()}
          className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted"
        >
          Show DB path
        </button>
        {dbPath && (
          <p className="break-all text-[11px] text-pds-muted">{dbPath}</p>
        )}
        <label className="block text-xs text-pds-muted">
          Export destination path
          <input
            value={appSettings.exportPath}
            onChange={(e) =>
              setAppSettings((s) => ({ ...s, exportPath: e.target.value }))
            }
            placeholder="C:\Users\you\Desktop\personal_spine_backup.db"
            className="mt-1 w-full rounded border border-pds-border bg-pds-input px-2 py-1.5 text-sm text-pds-text"
          />
        </label>
        <button
          type="button"
          onClick={() => void exportDatabase()}
          className="rounded border border-pds-border px-3 py-1.5 text-xs text-pds-muted"
        >
          Export backup
        </button>
      </section>

      <section className="space-y-2 rounded-lg border border-pds-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-pds-muted">
          LLM refinement
        </h3>
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
        className="rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white"
      >
        Save all settings
      </button>
    </div>
  );
}
