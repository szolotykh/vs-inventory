// -------------------------------------------------------
// memory-image-repository.ts
// MemoryImageRepository — In-memory implementation of IImageRepository (used by tests).
// -------------------------------------------------------

import type { IImageRepository } from "../types.ts";
import type { Image } from "../../models/index.ts";

type ImageEntry = { meta: Image; data: Buffer };

export class MemoryImageRepository implements IImageRepository {
  private store: ImageEntry[] = [];

  reset() { this.store = []; }

  async list(itemId: string): Promise<Image[]> {
    return this.store.filter((e) => e.meta.itemId === itemId).map((e) => e.meta);
  }

  async get(id: string): Promise<Image | null> {
    return this.store.find((e) => e.meta.id === id)?.meta ?? null;
  }

  async add(data: { itemId: string; filename: string; mimeType: string }, fileData: Buffer): Promise<Image> {
    const meta: Image = {
      id: crypto.randomUUID(),
      itemId: data.itemId,
      filename: data.filename,
      mimeType: data.mimeType,
      size: fileData.length,
    };
    this.store.push({ meta, data: fileData });
    return meta;
  }

  async loadFile(id: string): Promise<Buffer> {
    const entry = this.store.find((e) => e.meta.id === id);
    if (!entry) throw new Error(`Image not found: ${id}`);
    return entry.data;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.store.findIndex((e) => e.meta.id === id);
    if (idx === -1) return false;
    this.store.splice(idx, 1);
    return true;
  }

  async deleteByItemId(itemId: string): Promise<void> {
    this.store = this.store.filter((e) => e.meta.itemId !== itemId);
  }
}
