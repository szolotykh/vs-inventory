import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.ts";
import { getDB } from "../data/db.ts";
import type { Image } from "../models/index.ts";

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
  await mkdir(config.uploadsDir, { recursive: true });
  await writeFile(join(config.uploadsDir, id), fileData);
  return { id, itemId: data.itemId, filename: data.filename, mimeType: data.mimeType, size };
}

/** Load image file contents from uploads directory */
export async function loadImageFile(id: string): Promise<Buffer> {
  return readFile(join(config.uploadsDir, id));
}

/** Delete image metadata + file */
export async function deleteImage(id: string): Promise<boolean> {
  const result = getDB().run("DELETE FROM images WHERE id = ?", [id]);
  if (result.changes === 0) return false;
  await rm(join(config.uploadsDir, id), { force: true });
  return true;
}
