// core/data/memory/category-repository.ts — In-memory implementation of ICategoryRepository (used by tests).
import type { ICategoryRepository } from "../types.ts";
import type { Category } from "../../models/index.ts";

export class MemoryCategoryRepository implements ICategoryRepository {
  private store: Category[] = [];

  reset() { this.store = []; }

  async list(): Promise<Category[]> {
    return [...this.store];
  }

  async get(id: string): Promise<Category | null> {
    return this.store.find((c) => c.id === id) ?? null;
  }

  async add(data: { name: string }): Promise<Category> {
    const cat: Category = { id: crypto.randomUUID(), name: data.name };
    this.store.push(cat);
    return cat;
  }

  async edit(id: string, data: { name: string }): Promise<Category | null> {
    const idx = this.store.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.store[idx]!.name = data.name;
    return { id, name: data.name };
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.store.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.store.splice(idx, 1);
    return true;
  }
}
