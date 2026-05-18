export const SETTINGS_KEY = "pds-settings";

export type ThemePreference = "light" | "dark" | "system";

export interface AppSettings {
  captureShortcut: string;
  exportPath: string;
  theme: ThemePreference;
  timerChime: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  captureShortcut: "Alt+Shift+Space",
  exportPath: "",
  theme: "system",
  timerChime: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
