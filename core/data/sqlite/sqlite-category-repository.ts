// -------------------------------------------------------
// sqlite-category-repository.ts
// SqliteCategoryRepository — SQLite implementation of ICategoryRepository.
// -------------------------------------------------------

import { getDB } from "./db.ts";
import type { ICategoryRepository } from "../types.ts";
import type { Category } from "../../models/index.ts";

export class SqliteCategoryRepository implements ICategoryRepository {
  async list(): Promise<Category[]> {
    return getDB().query("SELECT * FROM categories").all() as Category[];
  }

  async get(id: string): Promise<Category | null> {
    return getDB().query("SELECT * FROM categories WHERE id = ?").get(id) as Category | null;
  }

  async add(data: { name: string }): Promise<Category> {
    const id = crypto.randomUUID();
    getDB().run("INSERT INTO categories (id, name) VALUES (?, ?)", [id, data.name]);
    return { id, name: data.name };
  }

  async edit(id: string, data: { name: string }): Promise<Category | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    getDB().run("UPDATE categories SET name = ? WHERE id = ?", [data.name, id]);
    return { id, name: data.name };
  }

  async delete(id: string): Promise<boolean> {
    const result = getDB().run("DELETE FROM categories WHERE id = ?", [id]);
    return result.changes > 0;
  }
}
