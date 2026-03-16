import { readStore, writeStore } from "./store.ts";
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
    const cats = readStore<Category>("categories");
    const cat: Category = { id: crypto.randomUUID(), name: data.name };
    cats.push(cat);
    writeStore("categories", cats);
    return cat;
  }

  async edit(id: string, data: { name: string }): Promise<Category | null> {
    const cats = readStore<Category>("categories");
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    cats[idx]!.name = data.name;
    writeStore("categories", cats);
    return { id, name: data.name };
  }

  async delete(id: string): Promise<boolean> {
    const cats = readStore<Category>("categories");
    const idx = cats.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    cats.splice(idx, 1);
    writeStore("categories", cats);
    return true;
  }
}
