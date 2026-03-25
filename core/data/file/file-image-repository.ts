// -------------------------------------------------------
// file-image-repository.ts
// FileImageRepository — File-based (JSON) implementation of IImageRepository; stores metadata in JSON and binary files on disk.
// -------------------------------------------------------

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../../config.ts";
import { readStore, modifyStore } from "./store.ts";
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
    let image!: Image;
    await modifyStore<Image>("images", (images) => {
      const id = crypto.randomUUID();
      image = { id, itemId: data.itemId, filename: data.filename, mimeType: data.mimeType, size: fileData.length };
      return [...images, image];
    });
    // Write the binary file after releasing the JSON lock — the UUID is already
    // committed to the store so no other writer can claim the same ID.
    await mkdir(config.uploadsDir, { recursive: true });
    await writeFile(join(config.uploadsDir, image.id), fileData);
    return image;
  }

  async loadFile(id: string): Promise<Buffer> {
    return readFile(join(config.uploadsDir, id));
  }

  async delete(id: string): Promise<boolean> {
    let found = false;
    await modifyStore<Image>("images", (images) => {
      const idx = images.findIndex((i) => i.id === id);
      if (idx === -1) return images;
      found = true;
      return images.filter((_, n) => n !== idx);
    });
    if (found) await rm(join(config.uploadsDir, id), { force: true });
    return found;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    const toDelete: string[] = [];
    await modifyStore<Image>("images", (images) => {
      for (const img of images) {
        if (img.itemId === itemId) toDelete.push(img.id);
      }
      return images.filter((i) => i.itemId !== itemId);
    });
    await Promise.all(toDelete.map((id) => rm(join(config.uploadsDir, id), { force: true })));
  }
}
