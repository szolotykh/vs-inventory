import { readStore, writeStore } from "./store.ts";
import type { IMetadataRepository } from "../types.ts";
import type { Metadata } from "../../models/index.ts";

type MetadataRow = { itemId: string; key: string; value: string };

export class FileMetadataRepository implements IMetadataRepository {
  list(itemId: string): Metadata[] {
    return readStore<MetadataRow>("metadata")
      .filter((m) => m.itemId === itemId)
      .map(({ key, value }) => ({ key, value }));
  }

  set(itemId: string, entries: Metadata[]): Metadata[] {
    const all = readStore<MetadataRow>("metadata").filter((m) => m.itemId !== itemId);
    writeStore("metadata", [...all, ...entries.map(({ key, value }) => ({ itemId, key, value }))]);
    return entries;
  }

  deleteKey(itemId: string, key: string): boolean {
    const all = readStore<MetadataRow>("metadata");
    const idx = all.findIndex((m) => m.itemId === itemId && m.key === key);
    if (idx === -1) return false;
    all.splice(idx, 1);
    writeStore("metadata", all);
    return true;
  }

  deleteByItemId(itemId: string): void {
    writeStore("metadata", readStore<MetadataRow>("metadata").filter((m) => m.itemId !== itemId));
  }
}
