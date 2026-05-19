import { emit } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import {
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  type ThemePreference,
} from "./settings";

export type ResolvedTheme = "light" | "dark";

const MEDIA = "(prefers-color-scheme: dark)";

let themeSyncStarted = false;

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia(MEDIA).matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  return resolved;
}

/** Notify other webviews (e.g. capture window) to re-read settings and apply theme. */
export function broadcastThemeChange(preference: ThemePreference): void {
  void emit("theme:changed", { theme: preference });
}

function startThemeSync(): void {
  if (themeSyncStarted) return;
  themeSyncStarted = true;

  window.addEventListener("storage", (e) => {
    if (e.key === SETTINGS_KEY || e.key === null) {
      applyTheme(loadSettings().theme);
    }
  });

  void listen<{ theme: ThemePreference }>("theme:changed", () => {
    applyTheme(loadSettings().theme);
  });
}

export function initTheme(): ResolvedTheme {
  const settings = loadSettings();
  const resolved = applyTheme(settings.theme);
  startThemeSync();

  const media = window.matchMedia(MEDIA);
  const onChange = () => {
    const current = loadSettings();
    if (current.theme === "system") {
      applyTheme("system");
    }
  };
  media.addEventListener("change", onChange);
  return resolved;
}

export function setThemePreference(preference: ThemePreference): ResolvedTheme {
  const settings = loadSettings();
  saveSettings({ ...settings, theme: preference });
  const resolved = applyTheme(preference);
  broadcastThemeChange(preference);
  return resolved;
}
