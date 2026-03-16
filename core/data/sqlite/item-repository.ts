import { getDB } from "./db.ts";
import type { IItemRepository } from "../types.ts";
import type { Item } from "../../models/index.ts";
import { parseODataFilter, toSqlWhere } from "../odata.ts";

/** Raw SQLite row — categoryId is NULL rather than omitted */
type ItemRow = { id: string; name: string; description: string; count: number; categoryId: string | null };

/** Convert a SQLite row (NULL categoryId) to an Item (omitted categoryId) */
function rowToItem(row: ItemRow): Item {
  const item: Item = { id: row.id, name: row.name, description: row.description, count: row.count };
  if (row.categoryId !== null) item.categoryId = row.categoryId;
  return item;
}

function getWhere($filter?: string): { where: string; params: (string | number | null)[] } {
  if (!$filter) return { where: "", params: [] };
  const { clause, params } = toSqlWhere(parseODataFilter($filter));
  return { where: `WHERE ${clause}`, params };
}

export class SqliteItemRepository implements IItemRepository {
  count($filter?: string): number {
    const { where, params } = getWhere($filter);
    return (getDB().query(`SELECT COUNT(*) as n FROM items ${where}`).get(...params) as { n: number }).n;
  }

  async list(opts?: { limit?: number; offset?: number; $filter?: string }): Promise<Item[]> {
    const db = getDB();
    const offset = opts?.offset ?? 0;
    const { where, params } = getWhere(opts?.$filter);
    if (opts?.limit !== undefined) {
      return db.query(`SELECT * FROM items ${where} LIMIT ? OFFSET ?`).all(...params, opts.limit, offset).map((r) => rowToItem(r as ItemRow));
    }
    if (offset > 0) {
      return db.query(`SELECT * FROM items ${where} LIMIT -1 OFFSET ?`).all(...params, offset).map((r) => rowToItem(r as ItemRow));
    }
    if (where) {
      return db.query(`SELECT * FROM items ${where}`).all(...params).map((r) => rowToItem(r as ItemRow));
    }
    return db.query("SELECT * FROM items").all().map((r) => rowToItem(r as ItemRow));
  }

  get(id: string): Item | null {
    const row = getDB().query("SELECT * FROM items WHERE id = ?").get(id) as ItemRow | null;
    return row ? rowToItem(row) : null;
  }

  async add(data: { name: string; description: string; count: number; categoryId?: string }): Promise<Item> {
    const db = getDB();
    const id = crypto.randomUUID();
    const categoryId = data.categoryId ?? null;
    db.run("INSERT INTO items (id, name, description, count, categoryId) VALUES (?, ?, ?, ?, ?)", [id, data.name, data.description, data.count, categoryId]);
    return rowToItem({ id, name: data.name, description: data.description, count: data.count, categoryId });
  }

  async edit(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }): Promise<Item | null> {
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

  async delete(id: string): Promise<boolean> {
    // Only deletes the item row — cascade is handled by operations layer
    const result = getDB().run("DELETE FROM items WHERE id = ?", [id]);
    return result.changes > 0;
  }

  unlinkCategory(categoryId: string): void {
    getDB().run("UPDATE items SET categoryId = NULL WHERE categoryId = ?", [categoryId]);
  }
}
