import { describe, it, expect, beforeAll } from "bun:test";
import { get, post, put, del } from "./setup.ts";
import type { Item, Metadata } from "./setup.ts";

describe("metadata", () => {
  let itemId = "";

  beforeAll(async () => {
    const res = await post("/items", { name: "Meta Item", description: "has metadata", count: 1 });
    itemId = (await res.json() as Item).id;
  });

  it("GET /items/:id/metadata returns empty array initially", async () => {
    const res = await get(`/items/${itemId}/metadata`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("PUT /items/:id/metadata sets key/value pairs", async () => {
    const entries = [{ key: "color", value: "red" }, { key: "size", value: "large" }];
    const res = await put(`/items/${itemId}/metadata`, entries);
    expect(res.status).toBe(200);
    const body = await res.json() as Metadata[];
    expect(body).toHaveLength(2);
    expect(body).toContainEqual({ key: "color", value: "red" });
    expect(body).toContainEqual({ key: "size", value: "large" });
  });

  it("GET /items/:id/metadata returns the metadata", async () => {
    const res = await get(`/items/${itemId}/metadata`);
    const body = await res.json() as Metadata[];
    expect(body).toHaveLength(2);
  });

  it("PUT /items/:id/metadata replaces all metadata", async () => {
    const entries = [{ key: "weight", value: "5kg" }];
    const res = await put(`/items/${itemId}/metadata`, entries);
    const body = await res.json() as Metadata[];
    expect(body).toEqual([{ key: "weight", value: "5kg" }]);

    const listRes = await get(`/items/${itemId}/metadata`);
    const all = await listRes.json() as Metadata[];
    expect(all).toHaveLength(1);
    expect(all).toContainEqual({ key: "weight", value: "5kg" });
  });

  it("DELETE /items/:id/metadata/:key deletes a key", async () => {
    const res = await del(`/items/${itemId}/metadata/weight`);
    expect(res.status).toBe(204);

    const listRes = await get(`/items/${itemId}/metadata`);
    expect(await listRes.json()).toEqual([]);
  });

  it("DELETE /items/:id/metadata/:key returns 404 for unknown key", async () => {
    const res = await del(`/items/${itemId}/metadata/nonexistent`);
    expect(res.status).toBe(404);
  });

  it("deleting an item also deletes its metadata", async () => {
    await put(`/items/${itemId}/metadata`, [{ key: "temp", value: "val" }]);
    await del(`/items/${itemId}`);

    const newRes = await post("/items", { name: "New", description: "new", count: 0 });
    const newId = (await newRes.json() as Item).id;
    const metaRes = await get(`/items/${newId}/metadata`);
    expect(await metaRes.json()).toEqual([]);
    await del(`/items/${newId}`);
  });
});
