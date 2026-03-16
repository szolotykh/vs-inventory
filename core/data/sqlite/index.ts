import { SqliteItemRepository } from "./item-repository.ts";
import { SqliteCategoryRepository } from "./category-repository.ts";
import { SqliteImageRepository } from "./image-repository.ts";
import { SqliteMetadataRepository } from "./metadata-repository.ts";

export const items = new SqliteItemRepository();
export const categories = new SqliteCategoryRepository();
export const images = new SqliteImageRepository();
export const metadata = new SqliteMetadataRepository();
export { closeDB } from "./db.ts";
