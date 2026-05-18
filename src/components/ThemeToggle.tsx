import { useEffect, useState } from "react";
import { loadSettings, type ThemePreference } from "../lib/settings";
import {
  applyTheme,
  setThemePreference,
  type ResolvedTheme,
} from "../lib/theme";

interface ThemeToggleProps {
  compact?: boolean;
  value?: ThemePreference;
  onChange?: (preference: ThemePreference) => void;
}

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle({ compact, value, onChange }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>(
    () => value ?? loadSettings().theme,
  );

  useEffect(() => {
    if (value) setPreference(value);
  }, [value]);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    applyTheme(loadSettings().theme),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if (loadSettings().theme === "system") {
        setResolved(applyTheme("system"));
      }
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function select(value: ThemePreference) {
    setPreference(value);
    setResolved(setThemePreference(value));
    onChange?.(value);
  }

  if (compact) {
    const next: ThemePreference =
      resolved === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        onClick={() => select(next)}
        className="rounded px-2 py-1 text-xs text-pds-muted hover:text-pds-text"
        title="Toggle light / dark"
      >
        {resolved === "dark" ? "☀" : "☾"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={`rounded px-2.5 py-1 text-xs ${
            preference === opt.value
              ? "bg-pds-accent text-pds-accent-fg"
              : "bg-pds-chip text-pds-chip-fg"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
