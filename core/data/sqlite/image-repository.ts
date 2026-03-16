import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config.ts";
import { getDB } from "./db.ts";
import type { IImageRepository } from "../types.ts";
import type { Image } from "../../models/index.ts";

export class SqliteImageRepository implements IImageRepository {
  async list(itemId: string): Promise<Image[]> {
    return getDB().query("SELECT * FROM images WHERE itemId = ?").all(itemId) as Image[];
  }

  async get(id: string): Promise<Image | null> {
    return (getDB().query("SELECT * FROM images WHERE id = ?").get(id) as Image | null);
  }

  /** Save image metadata + write file to uploads directory */
  async add(data: { itemId: string; filename: string; mimeType: string }, fileData: Buffer): Promise<Image> {
    const db = getDB();
    const id = crypto.randomUUID();
    const size = fileData.length;
    db.run("INSERT INTO images (id, itemId, filename, mimeType, size) VALUES (?, ?, ?, ?, ?)", [id, data.itemId, data.filename, data.mimeType, size]);
    await mkdir(config.uploadsDir, { recursive: true });
    await writeFile(join(config.uploadsDir, id), fileData);
    return { id, itemId: data.itemId, filename: data.filename, mimeType: data.mimeType, size };
  }

  async loadFile(id: string): Promise<Buffer> {
    return readFile(join(config.uploadsDir, id));
  }

  async delete(id: string): Promise<boolean> {
    const result = getDB().run("DELETE FROM images WHERE id = ?", [id]);
    if (result.changes === 0) return false;
    await rm(join(config.uploadsDir, id), { force: true });
    return true;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    const imgs = getDB().query("SELECT id FROM images WHERE itemId = ?").all(itemId) as { id: string }[];
    getDB().run("DELETE FROM images WHERE itemId = ?", [itemId]);
    await Promise.all(imgs.map((img) => rm(join(config.uploadsDir, img.id), { force: true })));
  }
}
