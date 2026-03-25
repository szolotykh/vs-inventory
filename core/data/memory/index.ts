// core/data/memory/index.ts — Instantiates and exports all in-memory repositories; provides resetAll() for test teardown.
import { MemoryItemRepository } from "./memory-item-repository.ts";
import { MemoryCategoryRepository } from "./memory-category-repository.ts";
import { MemoryImageRepository } from "./memory-image-repository.ts";
import { MemoryMetadataRepository } from "./memory-metadata-repository.ts";
import { MemoryChangeLogRepository } from "./memory-changelog-repository.ts";

export const items = new MemoryItemRepository();
export const categories = new MemoryCategoryRepository();
export const images = new MemoryImageRepository();
export const metadata = new MemoryMetadataRepository();
export const changelog = new MemoryChangeLogRepository();

export function closeDB() {}

export function resetAll() {
  items.reset();
  categories.reset();
  images.reset();
  metadata.reset();
  changelog.reset();
}
