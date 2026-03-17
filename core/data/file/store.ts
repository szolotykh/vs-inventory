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

// TODO: writeStore has no locking — concurrent writes from multiple processes (e.g. api + mcp
// containers sharing the same data volume) can corrupt JSON files. Add a file lock (e.g. via
// a lock file or atomic write + rename) before this becomes a multi-process deployment concern.
export function writeStore<T>(name: string, data: T[]): void {
  ensureDir();
  writeFileSync(join(config.fileDbDir, `${name}.json`), JSON.stringify(data, null, 2));
}
