import { SqliteItemRepository } from "./sqlite-item-repository.ts";
import { SqliteCategoryRepository } from "./sqlite-category-repository.ts";
import { SqliteImageRepository } from "./sqlite-image-repository.ts";
import { SqliteMetadataRepository } from "./sqlite-metadata-repository.ts";
import { SqliteChangeLogRepository } from "./sqlite-changelog-repository.ts";

export const items = new SqliteItemRepository();
export const categories = new SqliteCategoryRepository();
export const images = new SqliteImageRepository();
export const metadata = new SqliteMetadataRepository();
export const changelog = new SqliteChangeLogRepository();
export { closeDB } from "./db.ts";
