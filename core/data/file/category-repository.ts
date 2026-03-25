import { readStore, modifyStore } from "./store.ts";
import type { ICategoryRepository } from "../types.ts";
import type { Category } from "../../models/index.ts";

export class FileCategoryRepository implements ICategoryRepository {
  async list(): Promise<Category[]> {
    return readStore<Category>("categories");
  }

  async get(id: string): Promise<Category | null> {
    return readStore<Category>("categories").find((c) => c.id === id) ?? null;
  }

  async add(data: { name: string }): Promise<Category> {
    let cat!: Category;
    await modifyStore<Category>("categories", (cats) => {
      cat = { id: crypto.randomUUID(), name: data.name };
      return [...cats, cat];
    });
    return cat;
  }

  async edit(id: string, data: { name: string }): Promise<Category | null> {
    let found = false;
    await modifyStore<Category>("categories", (cats) => {
      const idx = cats.findIndex((c) => c.id === id);
      if (idx === -1) return cats;
      found = true;
      return cats.map((c, n) => (n === idx ? { id, name: data.name } : c));
    });
    return found ? { id, name: data.name } : null;
  }

  async delete(id: string): Promise<boolean> {
    let found = false;
    await modifyStore<Category>("categories", (cats) => {
      const idx = cats.findIndex((c) => c.id === id);
      if (idx === -1) return cats;
      found = true;
      return cats.filter((_, n) => n !== idx);
    });
    return found;
  }
}
