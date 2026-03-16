import { getDB } from "./db.ts";
import type { IMetadataRepository } from "../types.ts";
import type { Metadata } from "../../models/index.ts";

export class SqliteMetadataRepository implements IMetadataRepository {
  list(itemId: string): Metadata[] {
    return getDB().query("SELECT key, value FROM metadata WHERE itemId = ?").all(itemId) as Metadata[];
  }

  /** Replace all metadata for an item with the given key/value pairs */
  set(itemId: string, entries: Metadata[]): Metadata[] {
    const db = getDB();
    db.run("DELETE FROM metadata WHERE itemId = ?", [itemId]);
    const stmt = db.prepare("INSERT INTO metadata (itemId, key, value) VALUES (?, ?, ?)");
    for (const { key, value } of entries) {
      stmt.run(itemId, key, value);
    }
    return entries;
  }

  deleteKey(itemId: string, key: string): boolean {
    const result = getDB().run("DELETE FROM metadata WHERE itemId = ? AND key = ?", [itemId, key]);
    return result.changes > 0;
  }

  deleteByItemId(itemId: string): void {
    getDB().run("DELETE FROM metadata WHERE itemId = ?", [itemId]);
  }
}
