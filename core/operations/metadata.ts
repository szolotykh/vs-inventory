import { getDB } from "../data/db.ts";
import type { Metadata } from "../models/index.ts";

export function listMetadata(itemId: string): Metadata[] {
  return getDB().query("SELECT key, value FROM metadata WHERE itemId = ?").all(itemId) as Metadata[];
}

/** Replace all metadata for an item with the given key/value pairs */
export function setMetadata(itemId: string, entries: Metadata[]): Metadata[] {
  const db = getDB();
  db.run("DELETE FROM metadata WHERE itemId = ?", [itemId]);
  const stmt = db.prepare("INSERT INTO metadata (itemId, key, value) VALUES (?, ?, ?)");
  for (const { key, value } of entries) {
    stmt.run(itemId, key, value);
  }
  return entries;
}

export function deleteMetadataKey(itemId: string, key: string): boolean {
  const result = getDB().run("DELETE FROM metadata WHERE itemId = ? AND key = ?", [itemId, key]);
  return result.changes > 0;
}
