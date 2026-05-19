export const SETTINGS_KEY = "pds-settings";

export type ThemePreference = "light" | "dark" | "system";

export interface AppSettings {
  captureShortcut: string;
  exportPath: string;
  theme: ThemePreference;
  timerChime: boolean;
  /** Windows toast when an active subscription renews within 7 days (local only). */
  subscriptionRenewalReminders: boolean;
  /**
   * Dedupe map: `${itemId}:${renewalDateKey}` → local calendar day (YYYY-MM-DD)
   * when a renewal reminder was last shown.
   */
  subscriptionRenewalNotified?: Record<string, string>;
  /** ISO timestamp of last successful backup (SQLite and/or JSON). */
  lastBackupAt?: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  captureShortcut: "Alt+Shift+Space",
  exportPath: "",
  theme: "system",
  timerChime: true,
  subscriptionRenewalReminders: true,
  subscriptionRenewalNotified: {},
  lastBackupAt: null,
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
