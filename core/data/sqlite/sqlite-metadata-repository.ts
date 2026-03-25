// -------------------------------------------------------
// sqlite-metadata-repository.ts
// SqliteMetadataRepository — SQLite implementation of IMetadataRepository.
// -------------------------------------------------------

import { getDB } from "./db.ts";
import type { IMetadataRepository } from "../types.ts";
import type { Metadata } from "../../models/index.ts";

export class SqliteMetadataRepository implements IMetadataRepository {
  list(itemId: string): Metadata[] {
    return getDB().query("SELECT key, value FROM metadata WHERE itemId = ?").all(itemId) as Metadata[];
  }

  /** Replace all metadata for an item with the given key/value pairs */
  async set(itemId: string, entries: Metadata[]): Promise<Metadata[]> {
    const db = getDB();
    db.run("DELETE FROM metadata WHERE itemId = ?", [itemId]);
    const stmt = db.prepare("INSERT INTO metadata (itemId, key, value) VALUES (?, ?, ?)");
    for (const { key, value } of entries) {
      stmt.run(itemId, key, value);
    }
    return entries;
  }

  async deleteKey(itemId: string, key: string): Promise<boolean> {
    const result = getDB().run("DELETE FROM metadata WHERE itemId = ? AND key = ?", [itemId, key]);
    return result.changes > 0;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    getDB().run("DELETE FROM metadata WHERE itemId = ?", [itemId]);
  }
}
