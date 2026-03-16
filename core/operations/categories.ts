import { getDB } from "../data/db.ts";
import type { Category } from "../models/index.ts";

export async function listCategories(): Promise<Category[]> {
  return getDB().query("SELECT * FROM categories").all() as Category[];
}

export async function addCategory(data: { name: string }): Promise<Category> {
  const id = crypto.randomUUID();
  getDB().run("INSERT INTO categories (id, name) VALUES (?, ?)", [id, data.name]);
  return { id, name: data.name };
}

export async function editCategory(id: string, data: { name: string }): Promise<Category | null> {
  const db = getDB();
  const existing = db.query("SELECT * FROM categories WHERE id = ?").get(id) as Category | null;
  if (!existing) return null;
  db.run("UPDATE categories SET name = ? WHERE id = ?", [data.name, id]);
  return { id, name: data.name };
}

/** Delete a category and unlink any items that referenced it */
export async function deleteCategory(id: string): Promise<boolean> {
  const db = getDB();
  const existing = db.query("SELECT * FROM categories WHERE id = ?").get(id) as Category | null;
  if (!existing) return false;
  db.run("UPDATE items SET categoryId = NULL WHERE categoryId = ?", [id]);
  db.run("DELETE FROM categories WHERE id = ?", [id]);
  return true;
}
