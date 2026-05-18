import Database from "@tauri-apps/plugin-sql";
import { ensureCoreSchema } from "./schema";

const DB_URL = "sqlite:personal_spine.db";

let dbPromise: Promise<Database> | null = null;

export async function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL).then(async (db) => {
      await ensureCoreSchema(db);
      return db;
    });
  }
  return dbPromise;
}
