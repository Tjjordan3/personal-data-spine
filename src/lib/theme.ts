import { loadSettings, saveSettings, type ThemePreference } from "./settings";

export type ResolvedTheme = "light" | "dark";

const MEDIA = "(prefers-color-scheme: dark)";

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

export function initTheme(): ResolvedTheme {
  const settings = loadSettings();
  const resolved = applyTheme(settings.theme);

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
  return applyTheme(preference);
}
