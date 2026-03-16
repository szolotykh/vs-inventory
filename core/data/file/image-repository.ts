import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config.ts";
import { readStore, writeStore } from "./store.ts";
import type { IImageRepository } from "../types.ts";
import type { Image } from "../../models/index.ts";

export class FileImageRepository implements IImageRepository {
  async list(itemId: string): Promise<Image[]> {
    return readStore<Image>("images").filter((i) => i.itemId === itemId);
  }

  async get(id: string): Promise<Image | null> {
    return readStore<Image>("images").find((i) => i.id === id) ?? null;
  }

  async add(data: { itemId: string; filename: string; mimeType: string }, fileData: Buffer): Promise<Image> {
    const images = readStore<Image>("images");
    const id = crypto.randomUUID();
    const image: Image = { id, itemId: data.itemId, filename: data.filename, mimeType: data.mimeType, size: fileData.length };
    images.push(image);
    writeStore("images", images);
    await mkdir(config.uploadsDir, { recursive: true });
    await writeFile(join(config.uploadsDir, id), fileData);
    return image;
  }

  async loadFile(id: string): Promise<Buffer> {
    return readFile(join(config.uploadsDir, id));
  }

  async delete(id: string): Promise<boolean> {
    const images = readStore<Image>("images");
    const idx = images.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    images.splice(idx, 1);
    writeStore("images", images);
    await rm(join(config.uploadsDir, id), { force: true });
    return true;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    const images = readStore<Image>("images");
    const toDelete = images.filter((i) => i.itemId === itemId);
    writeStore("images", images.filter((i) => i.itemId !== itemId));
    await Promise.all(toDelete.map((img) => rm(join(config.uploadsDir, img.id), { force: true })));
  }
}
