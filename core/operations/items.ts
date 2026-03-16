import { rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.ts";
import { getDB } from "../data/db.ts";
import type { Item } from "../models/index.ts";

/** Raw SQLite row — categoryId is NULL rather than omitted */
type ItemRow = { id: string; name: string; description: string; count: number; categoryId: string | null };

/** Convert a SQLite row (NULL categoryId) to an Item (omitted categoryId) */
function rowToItem(row: ItemRow): Item {
  const item: Item = { id: row.id, name: row.name, description: row.description, count: row.count };
  if (row.categoryId !== null) item.categoryId = row.categoryId;
  return item;
}

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
  await Promise.all(images.map((img) => rm(join(config.uploadsDir, img.id), { force: true })));
  return true;
}
