import { FileItemRepository } from "./item-repository.ts";
import { FileCategoryRepository } from "./category-repository.ts";
import { FileImageRepository } from "./image-repository.ts";
import { FileMetadataRepository } from "./metadata-repository.ts";

export const items = new FileItemRepository();
export const categories = new FileCategoryRepository();
export const images = new FileImageRepository();
export const metadata = new FileMetadataRepository();

// No persistent connection to close for file-based storage
export function closeDB() {}
