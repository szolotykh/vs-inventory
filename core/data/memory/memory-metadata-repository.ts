// -------------------------------------------------------
// memory-metadata-repository.ts
// MemoryMetadataRepository — In-memory implementation of IMetadataRepository (used by tests).
// -------------------------------------------------------

import type { IMetadataRepository } from "../types.ts";
import type { Metadata } from "../../models/index.ts";

type MetadataRow = { itemId: string; key: string; value: string };

export class MemoryMetadataRepository implements IMetadataRepository {
  private store: MetadataRow[] = [];

  reset() { this.store = []; }

  list(itemId: string): Metadata[] {
    return this.store.filter((m) => m.itemId === itemId).map(({ key, value }) => ({ key, value }));
  }

  async set(itemId: string, entries: Metadata[]): Promise<Metadata[]> {
    this.store = [
      ...this.store.filter((m) => m.itemId !== itemId),
      ...entries.map(({ key, value }) => ({ itemId, key, value })),
    ];
    return entries;
  }

  async deleteKey(itemId: string, key: string): Promise<boolean> {
    const idx = this.store.findIndex((m) => m.itemId === itemId && m.key === key);
    if (idx === -1) return false;
    this.store.splice(idx, 1);
    return true;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    this.store = this.store.filter((m) => m.itemId !== itemId);
  }
}
