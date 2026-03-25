import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../../config.ts";

/** How long to wait for a lock before giving up (ms). */
export const LOCK_TIMEOUT_MS = 5_000;

/** How long to wait between lock-acquisition retries (ms). */
export const LOCK_RETRY_MS = 50;

function ensureDir() {
  if (!existsSync(config.fileDbDir)) mkdirSync(config.fileDbDir, { recursive: true });
}

export function readStore<T>(name: string): T[] {
  ensureDir();
  const path = join(config.fileDbDir, `${name}.json`);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as T[];
}

function writeStore<T>(name: string, data: T[]): void {
  ensureDir();
  writeFileSync(join(config.fileDbDir, `${name}.json`), JSON.stringify(data, null, 2));
}

/**
 * Acquire an exclusive lock file for the given path.
 *
 * Uses O_EXCL (the "wx" flag) so that only one writer — across any number of
 * OS processes — can create the file at a time.  If the lock is already held
 * we retry every LOCK_RETRY_MS milliseconds.  A lock file that is older than
 * `timeoutMs` is considered stale and removed so a new writer can proceed.
 * Throws if the lock cannot be acquired within `timeoutMs`.
 */
async function acquireLock(lockPath: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      // Atomic exclusive create — EEXIST if another process already holds it.
      writeFileSync(lockPath, String(process.pid), { flag: "wx" });
      return; // lock acquired
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;

      // Check whether the existing lock is stale (older than the timeout).
      try {
        const stat = statSync(lockPath);
        if (Date.now() - stat.mtimeMs > timeoutMs) {
          unlinkSync(lockPath); // remove stale lock and retry immediately
          continue;
        }
      } catch {
        // Lock file disappeared between the EEXIST and statSync — retry.
        continue;
      }

      // Lock is live; wait before retrying.
      await new Promise<void>((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }

  throw new Error(`Timed out acquiring lock: ${lockPath} (waited ${timeoutMs}ms)`);
}

function releaseLock(lockPath: string): void {
  try {
    unlinkSync(lockPath);
  } catch {
    // Already removed — nothing to do.
  }
}

/**
 * Atomically read-modify-write a JSON store file.
 *
 * Acquires an exclusive lock file before reading and releases it after
 * writing, making the operation safe for concurrent access from multiple
 * processes sharing the same data directory (e.g. API + MCP containers
 * mounted on the same volume, or CLI running alongside the API server).
 *
 * @param name      Store name — maps to `<name>.json` (and `<name>.lock`)
 * @param fn        Pure transform: receives current records, returns updated records
 * @param timeoutMs How long to wait for the lock before throwing (default: LOCK_TIMEOUT_MS)
 */
export async function modifyStore<T>(
  name: string,
  fn: (data: T[]) => T[],
  { timeoutMs = LOCK_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<void> {
  ensureDir();
  const lockPath = join(config.fileDbDir, `${name}.lock`);
  await acquireLock(lockPath, timeoutMs);
  try {
    const data = readStore<T>(name);
    const updated = fn(data);
    writeStore(name, updated);
  } finally {
    releaseLock(lockPath); // always release, even if fn throws
  }
}
