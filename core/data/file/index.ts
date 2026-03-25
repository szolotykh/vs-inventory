import { FileItemRepository } from "./file-item-repository.ts";
import { FileCategoryRepository } from "./file-category-repository.ts";
import { FileImageRepository } from "./file-image-repository.ts";
import { FileMetadataRepository } from "./file-metadata-repository.ts";
import { FileChangeLogRepository } from "./file-changelog-repository.ts";

export const items = new FileItemRepository();
export const categories = new FileCategoryRepository();
export const images = new FileImageRepository();
export const metadata = new FileMetadataRepository();
export const changelog = new FileChangeLogRepository();

// No persistent connection to close for file-based storage
export function closeDB() {}
