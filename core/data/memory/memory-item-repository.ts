// core/data/memory/item-repository.ts — In-memory implementation of IItemRepository (used by tests).
import type { IItemRepository } from "../types.ts";
import type { Item } from "../../models/index.ts";
import { parseODataFilter, evaluateFilter } from "../odata.ts";

export class MemoryItemRepository implements IItemRepository {
  private store: Item[] = [];

  reset() { this.store = []; }

  count($filter?: string): number {
    if (!$filter) return this.store.length;
    const ast = parseODataFilter($filter);
    return this.store.filter((i) => evaluateFilter(i as Record<string, unknown>, ast)).length;
  }

  async list(opts?: { limit?: number; offset?: number; $filter?: string }): Promise<Item[]> {
    let items = [...this.store];
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
    return this.store.find((i) => i.id === id) ?? null;
  }

  async add(data: { name: string; description: string; count: number; categoryId?: string }): Promise<Item> {
    const item: Item = { id: crypto.randomUUID(), name: data.name, description: data.description, count: data.count };
    if (data.categoryId !== undefined) item.categoryId = data.categoryId;
    this.store.push(item);
    return item;
  }

  async edit(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }): Promise<Item | null> {
    const idx = this.store.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const existing = this.store[idx]!;
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
    this.store[idx] = updated;
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.store.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    this.store.splice(idx, 1);
    return true;
  }

  async unlinkCategory(categoryId: string): Promise<void> {
    for (const item of this.store) {
      if (item.categoryId === categoryId) delete item.categoryId;
    }
  }
}
