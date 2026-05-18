import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:personal_spine.db";

let dbPromise: Promise<Database> | null = null;

export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}
