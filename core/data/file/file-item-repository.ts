// -------------------------------------------------------
// file-item-repository.ts
// FileItemRepository — File-based (JSON) implementation of IItemRepository with OData filter support.
// -------------------------------------------------------

import { readStore, modifyStore } from "./store.ts";
import type { IItemRepository } from "../types.ts";
import type { Item } from "../../models/index.ts";
import { parseODataFilter, evaluateFilter } from "../odata.ts";

export class FileItemRepository implements IItemRepository {
  count($filter?: string): number {
    const items = readStore<Item>("items");
    if (!$filter) return items.length;
    const ast = parseODataFilter($filter);
    return items.filter((i) => evaluateFilter(i as Record<string, unknown>, ast)).length;
  }

  async list(opts?: { limit?: number; offset?: number; $filter?: string }): Promise<Item[]> {
    let items = readStore<Item>("items");
    if (opts?.$filter) {
      const ast = parseODataFilter(opts.$filter);
      items = items.filter((i) => evaluateFilter(i as Record<string, unknown>, ast));
    }
    const offset = opts?.offset ?? 0;
    if (offset > 0) items = items.slice(offset);
    if (opts?.limit !== undefined) items = items.slice(0, opts.limit);
    return items;
  }

  get(id: string): Item | null {
    return readStore<Item>("items").find((i) => i.id === id) ?? null;
  }

  async add(data: { name: string; description: string; count: number; categoryId?: string }): Promise<Item> {
    let item!: Item;
    await modifyStore<Item>("items", (items) => {
      item = { id: crypto.randomUUID(), name: data.name, description: data.description, count: data.count };
      if (data.categoryId !== undefined) item.categoryId = data.categoryId;
      return [...items, item];
    });
    return item;
  }

  async edit(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }): Promise<Item | null> {
    let updated: Item | null = null;
    await modifyStore<Item>("items", (items) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return items;
      const existing = items[idx]!;
      updated = {
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
      return items.map((i, n) => (n === idx ? updated! : i));
    });
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    let found = false;
    await modifyStore<Item>("items", (items) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return items;
      found = true;
      return items.filter((_, n) => n !== idx);
    });
    return found;
  }

  async unlinkCategory(categoryId: string): Promise<void> {
    await modifyStore<Item>("items", (items) => {
      const needsUpdate = items.some((i) => i.categoryId === categoryId);
      if (!needsUpdate) return items;
      return items.map((i) => {
        if (i.categoryId !== categoryId) return i;
        const { categoryId: _removed, ...rest } = i;
        return rest as Item;
      });
    });
  }
}
