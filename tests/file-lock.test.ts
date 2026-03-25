/**
 * Unit tests for the file-store locking mechanism (modifyStore).
 *
 * Tests run against a dedicated temp directory that is cleaned up after each
 * test, so they never interfere with the shared test-data store used by the
 * HTTP integration tests.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

// We'll override the config.fileDbDir by pointing process.env before importing store.
// Because store.ts reads config lazily (through getters), we can set the env var
// before each test group and it will be reflected when store functions are called.
const TEST_DIR = "./test-lock-tmp";

// Ensure the env var is in place before the module is first used.
process.env["FILE_DB_DIR"] = TEST_DIR;

// Import after env is set.
import { modifyStore, readStore, LOCK_TIMEOUT_MS, LOCK_RETRY_MS } from "../core/data/file/store.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lockPath(name: string) {
  return join(TEST_DIR, `${name}.lock`);
}

/** Manually create a lock file so modifyStore has to wait or time out. */
function createLock(name: string) {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(lockPath(name), String(process.pid), { flag: "w" });
}

/** Set the mtime of the lock file to a point in the past to make it stale. */
function makeStaleLock(name: string, ageMs: number) {
  const staleTime = new Date(Date.now() - ageMs);
  utimesSync(lockPath(name), staleTime, staleTime);
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

// Restore FILE_DB_DIR so operations.test.ts (which runs after this file
// alphabetically) continues to use ./test-data and its clearStores() works.
afterAll(() => {
  process.env["FILE_DB_DIR"] = "./test-data";
});

// ─── Basic read-modify-write ───────────────────────────────────────────────────

describe("modifyStore — basic behaviour", () => {
  it("writes data that can be read back", async () => {
    await modifyStore<string>("basic", (data) => [...data, "hello"]);
    const result = readStore<string>("basic");
    expect(result).toEqual(["hello"]);
  });

  it("accumulates across multiple sequential calls", async () => {
    await modifyStore<number>("seq", (d) => [...d, 1]);
    await modifyStore<number>("seq", (d) => [...d, 2]);
    await modifyStore<number>("seq", (d) => [...d, 3]);
    expect(readStore<number>("seq")).toEqual([1, 2, 3]);
  });

  it("passes the current store contents to fn", async () => {
    await modifyStore<number>("passthru", () => [10, 20]);
    let seen: number[] = [];
    await modifyStore<number>("passthru", (d) => { seen = d; return d; });
    expect(seen).toEqual([10, 20]);
  });
});

// ─── Concurrent writes are serialized ─────────────────────────────────────────

describe("modifyStore — concurrent serialization", () => {
  it("no writes are lost when N calls run concurrently", async () => {
    const N = 20;
    // Fire all N writes at the same time — each appends a unique number.
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        modifyStore<number>("concurrent", (d) => [...d, i]),
      ),
    );
    const result = readStore<number>("concurrent");
    expect(result.length).toBe(N);
    // Every number 0..N-1 must be present exactly once.
    expect(result.sort((a, b) => a - b)).toEqual(Array.from({ length: N }, (_, i) => i));
  });

  it("interleaved concurrent writes produce correct final state", async () => {
    // Two sets of 10 writers, each incrementing a counter stored as a single-element array.
    await modifyStore<number>("counter", () => [0]);

    const increment = () =>
      modifyStore<number>("counter", ([val = 0]) => [val + 1]);

    await Promise.all(Array.from({ length: 10 }, increment));

    const [count] = readStore<number>("counter");
    expect(count).toBe(10);
  });
});

// ─── Lock is always released ───────────────────────────────────────────────────

describe("modifyStore — lock cleanup", () => {
  it("releases the lock file after a successful write", async () => {
    await modifyStore<number>("cleanup-ok", (d) => [...d, 1]);
    expect(existsSync(lockPath("cleanup-ok"))).toBe(false);
  });

  it("releases the lock file even when fn throws", async () => {
    await expect(
      modifyStore<number>("cleanup-err", () => { throw new Error("boom"); }),
    ).rejects.toThrow("boom");
    expect(existsSync(lockPath("cleanup-err"))).toBe(false);
  });

  it("store is writable again after fn throws", async () => {
    await expect(
      modifyStore<number>("recover", () => { throw new Error("oops"); }),
    ).rejects.toThrow();
    // Should not hang or timeout — lock was released.
    await modifyStore<number>("recover", (d) => [...d, 42]);
    expect(readStore<number>("recover")).toEqual([42]);
  });
});

// ─── Timeout ──────────────────────────────────────────────────────────────────

describe("modifyStore — timeout", () => {
  it("throws when a live lock is held past the timeout", async () => {
    createLock("timeout-test");

    await expect(
      modifyStore<number>("timeout-test", (d) => d, { timeoutMs: 150 }),
    ).rejects.toThrow(/timed out/i);
  });

  it("error message includes the lock file path", async () => {
    createLock("timeout-msg");

    let message = "";
    try {
      await modifyStore<number>("timeout-msg", (d) => d, { timeoutMs: 100 });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("timeout-msg");
  });
});

// ─── Stale lock detection ──────────────────────────────────────────────────────

describe("modifyStore — stale lock", () => {
  it("removes a stale lock and proceeds", async () => {
    createLock("stale");
    // Make the lock file appear older than the timeout.
    makeStaleLock("stale", LOCK_TIMEOUT_MS + 1_000);

    await modifyStore<number>("stale", (d) => [...d, 99]);
    expect(readStore<number>("stale")).toEqual([99]);
  });

  it("does NOT remove a lock that is younger than the timeout", async () => {
    createLock("live-lock");
    // Lock is brand-new — it is younger than the timeout.

    await expect(
      modifyStore<number>("live-lock", (d) => d, { timeoutMs: 100 }),
    ).rejects.toThrow(/timed out/i);

    // The lock file should still be there (we didn't remove it).
    expect(existsSync(lockPath("live-lock"))).toBe(true);
  });
});

// ─── Independent stores don't block each other ────────────────────────────────

describe("modifyStore — store independence", () => {
  it("a lock on store A does not block writes to store B", async () => {
    createLock("store-a");

    // store-b should complete quickly despite store-a being locked.
    const start = Date.now();
    await modifyStore<number>("store-b", (d) => [...d, 1]);
    expect(Date.now() - start).toBeLessThan(500);
    expect(readStore<number>("store-b")).toEqual([1]);
  });

  it("concurrent writes to different stores all succeed", async () => {
    const stores = ["alpha", "beta", "gamma", "delta"];
    await Promise.all(
      stores.map((name) => modifyStore<string>(name, () => [name])),
    );
    for (const name of stores) {
      expect(readStore<string>(name)).toEqual([name]);
    }
  });
});

// ─── Constants are sensible ───────────────────────────────────────────────────

describe("lock constants", () => {
  it("LOCK_TIMEOUT_MS is positive", () => {
    expect(LOCK_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("LOCK_RETRY_MS is positive and less than LOCK_TIMEOUT_MS", () => {
    expect(LOCK_RETRY_MS).toBeGreaterThan(0);
    expect(LOCK_RETRY_MS).toBeLessThan(LOCK_TIMEOUT_MS);
  });
});
