import type { Item, Category, Image, Metadata, ChangeLog, ChangeType, TargetType } from "../models/index.ts";

export interface IItemRepository {
  count($filter?: string): number;
  list(opts?: { limit?: number; offset?: number; $filter?: string }): Promise<Item[]>;
  get(id: string): Item | null;
  add(data: { name: string; description: string; count: number; categoryId?: string }): Promise<Item>;
  edit(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }): Promise<Item | null>;
  delete(id: string): Promise<boolean>;
  unlinkCategory(categoryId: string): void;
}

export interface ICategoryRepository {
  list(): Promise<Category[]>;
  get(id: string): Promise<Category | null>;
  add(data: { name: string }): Promise<Category>;
  edit(id: string, data: { name: string }): Promise<Category | null>;
  delete(id: string): Promise<boolean>;
}

export interface IImageRepository {
  list(itemId: string): Promise<Image[]>;
  get(id: string): Promise<Image | null>;
  add(data: { itemId: string; filename: string; mimeType: string }, fileData: Buffer): Promise<Image>;
  loadFile(id: string): Promise<Buffer>;
  delete(id: string): Promise<boolean>;
  deleteByItemId(itemId: string): Promise<void>;
}

export interface IMetadataRepository {
  list(itemId: string): Metadata[];
  set(itemId: string, entries: Metadata[]): Metadata[];
  deleteKey(itemId: string, key: string): boolean;
  deleteByItemId(itemId: string): void;
}

export interface IChangeLogRepository {
  count(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType }): number;
  list(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType; limit?: number; offset?: number }): ChangeLog[];
  get(id: string): ChangeLog | null;
  add(data: Omit<ChangeLog, "id" | "timestamp">): ChangeLog;
}
