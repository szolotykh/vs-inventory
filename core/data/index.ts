import { config } from "../config.ts";
import * as sqlite from "./sqlite/index.ts";
import * as file from "./file/index.ts";

const src = config.dataSource === "file" ? file : sqlite;

export const items = src.items;
export const categories = src.categories;
export const images = src.images;
export const metadata = src.metadata;
export const changelog = src.changelog;
export const closeDB = src.closeDB;
