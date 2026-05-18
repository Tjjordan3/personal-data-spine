import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeJsonExport } from "./db/export";
import { resetDatabaseConnection } from "./db/database";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./settings";

function stampBackup(settings: AppSettings): AppSettings {
  const next = { ...settings, lastBackupAt: new Date().toISOString() };
  saveSettings(next);
  return next;
}

export function formatLastBackup(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export async function exportSqliteBackup(
  suggestedName = "personal_spine_backup.db",
): Promise<string | null> {
  const path = await save({
    title: "Export SQLite backup",
    defaultPath: suggestedName,
    filters: [{ name: "SQLite database", extensions: ["db"] }],
  });
  if (!path) return null;
  await invoke("export_database", { destination: path });
  stampBackup(loadSettings());
  return path;
}

export async function exportJsonBackup(
  suggestedName = "personal_spine_export.json",
): Promise<string | null> {
  const path = await save({
    title: "Export JSON data",
    defaultPath: suggestedName,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return null;
  await writeJsonExport(path);
  stampBackup(loadSettings());
  return path;
}

export async function importSqliteRestore(): Promise<boolean> {
  const path = await open({
    title: "Restore from SQLite backup",
    multiple: false,
    filters: [{ name: "SQLite database", extensions: ["db"] }],
  });
  if (!path || Array.isArray(path)) return false;
  await invoke("import_database", { source: path });
  resetDatabaseConnection();
  return true;
}
