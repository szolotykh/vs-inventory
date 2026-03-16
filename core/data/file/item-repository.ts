import { readStore, writeStore } from "./store.ts";
import type { IItemRepository } from "../types.ts";
import type { Item } from "../../models/index.ts";

function filter(items: Item[], opts?: { categoryId?: string; search?: string }): Item[] {
  let result = items;
  if (opts?.categoryId !== undefined) result = result.filter((i) => i.categoryId === opts.categoryId);
  if (opts?.search !== undefined) {
    const s = opts.search.toLowerCase();
    result = result.filter((i) => i.name.toLowerCase().includes(s) || i.description.toLowerCase().includes(s));
  }
  return result;
}

export class FileItemRepository implements IItemRepository {
  count(opts?: { categoryId?: string; search?: string }): number {
    return filter(readStore<Item>("items"), opts).length;
  }

  async list(opts?: { limit?: number; offset?: number; categoryId?: string; search?: string }): Promise<Item[]> {
    let items = filter(readStore<Item>("items"), opts);
    const offset = opts?.offset ?? 0;
    if (offset > 0) items = items.slice(offset);
    if (opts?.limit !== undefined) items = items.slice(0, opts.limit);
    return items;
  }

  get(id: string): Item | null {
    return readStore<Item>("items").find((i) => i.id === id) ?? null;
  }

  async add(data: { name: string; description: string; count: number; categoryId?: string }): Promise<Item> {
    const items = readStore<Item>("items");
    const item: Item = { id: crypto.randomUUID(), name: data.name, description: data.description, count: data.count };
    if (data.categoryId !== undefined) item.categoryId = data.categoryId;
    items.push(item);
    writeStore("items", items);
    return item;
  }

  async edit(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }): Promise<Item | null> {
    const items = readStore<Item>("items");
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const existing = items[idx]!;
    const updated: Item = {
      id: existing.id,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      count: data.count ?? existing.count,
    };
    if (data.categoryId === null) {
      // omit categoryId — removes it
    } else if (data.categoryId !== undefined) {
      updated.categoryId = data.categoryId;
    } else if (existing.categoryId !== undefined) {
      updated.categoryId = existing.categoryId;
    }
    items[idx] = updated;
    writeStore("items", items);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const items = readStore<Item>("items");
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    writeStore("items", items);
    return true;
  }

  unlinkCategory(categoryId: string): void {
    const items = readStore<Item>("items");
    let changed = false;
    for (const item of items) {
      if (item.categoryId === categoryId) {
        delete item.categoryId;
        changed = true;
      }
    }
    if (changed) writeStore("items", items);
  }
}
