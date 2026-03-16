import { beforeAll, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "../api/server.ts";
import { closeDB } from "../core/data/db.ts";

// Must be set before any db function is called (getDB() reads it lazily)
process.env["DB_PATH"] = "./test-db.sqlite";
process.env["UPLOADS_DIR"] = "./test-uploads";

let baseUrl = "";
let server: ReturnType<typeof createServer>;

export function getBaseUrl() {
  return baseUrl;
}

beforeAll(() => {
  server = createServer(0); // port 0 = OS assigns a free port
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  server.stop(true);
  closeDB();
  const files = ["./test-db.sqlite", "./test-db.sqlite-wal", "./test-db.sqlite-shm"];
  for (const file of files) {
    for (let i = 0; i < 5; i++) {
      try { await rm(file, { force: true }); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
  }
  await rm("./test-uploads", { force: true, recursive: true });
});

// --- Helpers ---

export function get(path: string) {
  return fetch(`${baseUrl}${path}`);
}

export function post(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function put(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function del(path: string) {
  return fetch(`${baseUrl}${path}`, { method: "DELETE" });
}

export type Category = { id: string; name: string };
export type Item = { id: string; name: string; description: string; count: number; categoryId?: string };
export type PagedItems = { items: Item[]; total: number; limit: number | null; offset: number };
export type Image = { id: string; itemId: string; filename: string; mimeType: string; size: number };
export type Metadata = { key: string; value: string };
