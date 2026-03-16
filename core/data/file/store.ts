import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../../config.ts";

function ensureDir() {
  if (!existsSync(config.fileDbDir)) mkdirSync(config.fileDbDir, { recursive: true });
}

export function readStore<T>(name: string): T[] {
  ensureDir();
  const path = join(config.fileDbDir, `${name}.json`);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as T[];
}

export function writeStore<T>(name: string, data: T[]): void {
  ensureDir();
  writeFileSync(join(config.fileDbDir, `${name}.json`), JSON.stringify(data, null, 2));
}
