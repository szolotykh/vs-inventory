import { Database } from "bun:sqlite";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";

export type Category = { id: string; name: string };
export type Item = { id: string; name: string; description: string; count: number; categoryId?: string };
export type Image = { id: string; itemId: string; filename: string; mimeType: string; size: number };
export type Metadata = { key: string; value: string };

/** Raw SQLite row — categoryId is NULL rather than omitted */
type ItemRow = { id: string; name: string; description: string; count: number; categoryId: string | null };

/** Lazily-initialized singleton connection (path from DB_PATH env or "db.sqlite") */
let _db: Database | null = null;

/** Directory for uploaded image files */
const uploadsDir = () => config.uploadsDir;

function getDB(): Database {
  if (_db) return _db;
  const path = config.dbPath;
  _db = new Database(path, { create: true });
  _db.run("PRAGMA journal_mode = WAL");
  _db.run(`CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  _db.run(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, count INTEGER NOT NULL, categoryId TEXT)`);
  _db.run(`CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, itemId TEXT NOT NULL, filename TEXT NOT NULL, mimeType TEXT NOT NULL, size INTEGER NOT NULL)`);
  _db.run(`CREATE TABLE IF NOT EXISTS metadata (itemId TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (itemId, key))`);
  return _db;
}

/** Close the DB connection and reset the singleton (used by tests for cleanup) */
export function closeDB() {
  _db?.close();
  _db = null;
}

/** Convert a SQLite row (NULL categoryId) to an Item (omitted categoryId) */
function rowToItem(row: ItemRow): Item {
  const item: Item = { id: row.id, name: row.name, description: row.description, count: row.count };
  if (row.categoryId !== null) item.categoryId = row.categoryId;
  return item;
}

// --- Items ---

function buildItemsWhere(opts?: { categoryId?: string; search?: string }): { where: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.categoryId !== undefined) {
    conditions.push("categoryId = ?");
    params.push(opts.categoryId);
  }
  if (opts?.search !== undefined) {
    conditions.push("(name LIKE ? OR description LIKE ?)");
    const pattern = `%${opts.search}%`;
    params.push(pattern, pattern);
  }
  return { where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

export function countItems(opts?: { categoryId?: string; search?: string }): number {
  const { where, params } = buildItemsWhere(opts);
  return (getDB().query(`SELECT COUNT(*) as n FROM items ${where}`).get(...params) as { n: number }).n;
}

export async function listItems(opts?: { limit?: number; offset?: number; categoryId?: string; search?: string }): Promise<Item[]> {
  const db = getDB();
  const offset = opts?.offset ?? 0;
  const { where, params } = buildItemsWhere(opts);

  if (opts?.limit !== undefined) {
    return db.query(`SELECT * FROM items ${where} LIMIT ? OFFSET ?`).all(...params, opts.limit, offset).map((r) => rowToItem(r as ItemRow));
  }
  if (offset > 0) {
    // SQLite requires LIMIT to use OFFSET; -1 means unlimited
    return db.query(`SELECT * FROM items ${where} LIMIT -1 OFFSET ?`).all(...params, offset).map((r) => rowToItem(r as ItemRow));
  }
  if (where) {
    return db.query(`SELECT * FROM items ${where}`).all(...params).map((r) => rowToItem(r as ItemRow));
  }
  return db.query("SELECT * FROM items").all().map((r) => rowToItem(r as ItemRow));
}

export function getItem(id: string): Item | null {
  const row = getDB().query("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | null;
  return row ? rowToItem(row) : null;
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

/** Delete an item and all its associated images (metadata + files) */
export async function deleteItem(id: string): Promise<boolean> {
  const db = getDB();
  const images = db.query("SELECT id FROM images WHERE itemId = ?").all(id) as { id: string }[];
  const result = db.run("DELETE FROM items WHERE id = ?", [id]);
  if (result.changes === 0) return false;
  db.run("DELETE FROM images WHERE itemId = ?", [id]);
  db.run("DELETE FROM metadata WHERE itemId = ?", [id]);
  await Promise.all(images.map((img) => rm(join(uploadsDir(), img.id), { force: true })));
  return true;
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

/** Delete a category and unlink any items that referenced it */
export async function deleteCategory(id: string): Promise<boolean> {
  const db = getDB();
  const existing = db.query("SELECT * FROM categories WHERE id = ?").get(id) as Category | null;
  if (!existing) return false;
  db.run("UPDATE items SET categoryId = NULL WHERE categoryId = ?", [id]);
  db.run("DELETE FROM categories WHERE id = ?", [id]);
  return true;
}

// --- Images ---

export async function listImages(itemId: string): Promise<Image[]> {
  return getDB().query("SELECT * FROM images WHERE itemId = ?").all(itemId) as Image[];
}

export async function getImage(id: string): Promise<Image | null> {
  return (getDB().query("SELECT * FROM images WHERE id = ?").get(id) as Image | null);
}

/** Save image metadata + write file to uploads directory */
export async function addImage(data: { itemId: string; filename: string; mimeType: string }, fileData: Buffer): Promise<Image> {
  const db = getDB();
  const id = crypto.randomUUID();
  const size = fileData.length;
  db.run("INSERT INTO images (id, itemId, filename, mimeType, size) VALUES (?, ?, ?, ?, ?)", [id, data.itemId, data.filename, data.mimeType, size]);
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(join(uploadsDir(), id), fileData);
  return { id, itemId: data.itemId, filename: data.filename, mimeType: data.mimeType, size };
}

/** Load image file contents from uploads directory */
export async function loadImageFile(id: string): Promise<Buffer> {
  return readFile(join(uploadsDir(), id));
}

/** Delete image metadata + file */
export async function deleteImage(id: string): Promise<boolean> {
  const result = getDB().run("DELETE FROM images WHERE id = ?", [id]);
  if (result.changes === 0) return false;
  await rm(join(uploadsDir(), id), { force: true });
  return true;
}

// --- Metadata ---

export function listMetadata(itemId: string): Metadata[] {
  return getDB().query("SELECT key, value FROM metadata WHERE itemId = ?").all(itemId) as Metadata[];
}

/** Replace all metadata for an item with the given key/value pairs */
export function setMetadata(itemId: string, entries: Metadata[]): Metadata[] {
  const db = getDB();
  db.run("DELETE FROM metadata WHERE itemId = ?", [itemId]);
  const stmt = db.prepare("INSERT INTO metadata (itemId, key, value) VALUES (?, ?, ?)");
  for (const { key, value } of entries) {
    stmt.run(itemId, key, value);
  }
  return entries;
}

export function deleteMetadataKey(itemId: string, key: string): boolean {
  const result = getDB().run("DELETE FROM metadata WHERE itemId = ? AND key = ?", [itemId, key]);
  return result.changes > 0;
}
