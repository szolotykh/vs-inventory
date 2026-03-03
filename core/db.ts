import { Database } from "bun:sqlite";

export type Category = { id: string; name: string };
export type Item = { id: string; name: string; description: string; count: number; categoryId?: string };

type ItemRow = { id: string; name: string; description: string; count: number; categoryId: string | null };

let _db: Database | null = null;

function getDB(): Database {
  if (_db) return _db;
  const path = process.env["DB_PATH"] ?? "db.sqlite";
  _db = new Database(path, { create: true });
  _db.run("PRAGMA journal_mode = WAL");
  _db.run(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  _db.run(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, count INTEGER NOT NULL, categoryId TEXT)`);
  return _db;
}

export function closeDB() {
  _db?.close();
  _db = null;
}

function rowToItem(row: ItemRow): Item {
  const item: Item = { id: row.id, name: row.name, description: row.description, count: row.count };
  if (row.categoryId !== null) item.categoryId = row.categoryId;
  return item;
}

// --- Items ---

export async function listItems(): Promise<Item[]> {
  const db = getDB();
  return db.query("SELECT * FROM items").all().map((r) => rowToItem(r as ItemRow));
}

export async function addItem(data: { name: string; description: string; count: number; categoryId?: string }): Promise<Item> {
  const db = getDB();
  const id = crypto.randomUUID();
  const categoryId = data.categoryId ?? null;
  db.run("INSERT INTO items (id, name, description, count, categoryId) VALUES (?, ?, ?, ?, ?)", [id, data.name, data.description, data.count, categoryId]);
  return rowToItem({ id, name: data.name, description: data.description, count: data.count, categoryId });
}

export async function editItem(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }): Promise<Item | null> {
  const db = getDB();
  const existing = db.query("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | null;
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const description = data.description ?? existing.description;
  const count = data.count ?? existing.count;
  // null explicitly removes category; undefined leaves it unchanged
  let categoryId: string | null;
  if (data.categoryId === null) {
    categoryId = null;
  } else if (data.categoryId !== undefined) {
    categoryId = data.categoryId;
  } else {
    categoryId = existing.categoryId;
  }

  db.run("UPDATE items SET name = ?, description = ?, count = ?, categoryId = ? WHERE id = ?", [name, description, count, categoryId, id]);
  return rowToItem({ id, name, description, count, categoryId });
}

export async function deleteItem(id: string): Promise<boolean> {
  const result = getDB().run("DELETE FROM items WHERE id = ?", [id]);
  return result.changes > 0;
}

// --- Categories ---

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

export async function deleteCategory(id: string): Promise<boolean> {
  const db = getDB();
  const existing = db.query("SELECT * FROM categories WHERE id = ?").get(id) as Category | null;
  if (!existing) return false;
  db.run("UPDATE items SET categoryId = NULL WHERE categoryId = ?", [id]);
  db.run("DELETE FROM categories WHERE id = ?", [id]);
  return true;
}
