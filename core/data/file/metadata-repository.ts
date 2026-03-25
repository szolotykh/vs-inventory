import { readStore, modifyStore } from "./store.ts";
import type { IMetadataRepository } from "../types.ts";
import type { Metadata } from "../../models/index.ts";

type MetadataRow = { itemId: string; key: string; value: string };

export class FileMetadataRepository implements IMetadataRepository {
  list(itemId: string): Metadata[] {
    return readStore<MetadataRow>("metadata")
      .filter((m) => m.itemId === itemId)
      .map(({ key, value }) => ({ key, value }));
  }

  async set(itemId: string, entries: Metadata[]): Promise<Metadata[]> {
    await modifyStore<MetadataRow>("metadata", (all) => [
      ...all.filter((m) => m.itemId !== itemId),
      ...entries.map(({ key, value }) => ({ itemId, key, value })),
    ]);
    return entries;
  }

  async deleteKey(itemId: string, key: string): Promise<boolean> {
    let found = false;
    await modifyStore<MetadataRow>("metadata", (all) => {
      const idx = all.findIndex((m) => m.itemId === itemId && m.key === key);
      if (idx === -1) return all;
      found = true;
      return all.filter((_, n) => n !== idx);
    });
    return found;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    await modifyStore<MetadataRow>("metadata", (all) => all.filter((m) => m.itemId !== itemId));
  }
}
