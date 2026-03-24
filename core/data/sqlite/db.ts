import { Database } from "bun:sqlite";
import { config } from "../../config.ts";

let _db: Database | null = null;

export function getDB(): Database {
  if (_db) return _db;
  const path = config.dbPath;
  _db = new Database(path, { create: true });
  _db.run("PRAGMA journal_mode = WAL");
  _db.run(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  _db.run(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, count INTEGER NOT NULL, categoryId TEXT)`);
  _db.run(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, itemId TEXT NOT NULL, filename TEXT NOT NULL, mimeType TEXT NOT NULL, size INTEGER NOT NULL)`);
  _db.run(`CREATE TABLE IF NOT EXISTS metadata (itemId TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (itemId, key))`);
  _db.run(`CREATE TABLE IF NOT EXISTS changelogs (id TEXT PRIMARY KEY, targetId TEXT NOT NULL, targetType TEXT NOT NULL, changeType TEXT NOT NULL, changes TEXT, timestamp TEXT NOT NULL)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_changelogs_targetId ON changelogs (targetId)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_changelogs_targetType ON changelogs (targetType)`);
  return _db;
}

/** Close the DB connection and reset the singleton (used by tests for cleanup) */
export function closeDB() {
  _db?.close();
  _db = null;
}
