/**
 * Operations layer tests.
 *
 * Tests cascade behaviour in deleteItem and deleteCategory using the file
 * repositories (DATA_SOURCE=file, FILE_DB_DIR=./test-data set by setup.ts).
 * Does NOT use the HTTP server — exercises TypeScript modules directly.
 */

import { describe, expect, test, beforeEach } from "bun:test";
import { rm } from "node:fs/promises";

// Operations under test
import { addItem, getItem, deleteItem, listItems, countItems, editItem } from "../core/operations/items.ts";
import { addCategory, listCategories, deleteCategory } from "../core/operations/categories.ts";
import { listImages } from "../core/operations/images.ts";
import { listMetadata, setMetadata } from "../core/operations/metadata.ts";

// Direct repo access for assertions that span cascade boundaries
import { metadata as metaRepo } from "../core/data/index.ts";

async function clearStores() {
  await rm("./test-data", { recursive: true, force: true });
}

// ─── Items CRUD ───────────────────────────────────────────────────────────────

describe("items — basic CRUD", () => {
  beforeEach(clearStores);

  test("add and get", async () => {
    const item = await addItem({ name: "Hammer", description: "A hammer", count: 3 });
    expect(item.id).toBeTruthy();
    expect(item.name).toBe("Hammer");
    expect(item.count).toBe(3);
    expect(item.categoryId).toBeUndefined();

    const fetched = await getItem(item.id);
    expect(fetched).toEqual(item);
  });

  test("get returns null for unknown id", async () => {
    expect(await getItem("nonexistent")).toBeNull();
  });

  test("list returns all items", async () => {
    await addItem({ name: "A", description: "", count: 1 });
    await addItem({ name: "B", description: "", count: 2 });
    const result = await listItems();
    expect(result.length).toBe(2);
  });

  test("count matches list length", async () => {
    await addItem({ name: "X", description: "", count: 1 });
    await addItem({ name: "Y", description: "", count: 1 });
    expect(countItems()).toBe(2);
  });

  test("edit updates fields", async () => {
    const item = await addItem({ name: "Old", description: "desc", count: 1 });
    const updated = await editItem(item.id, { name: "New", count: 99 });
    expect(updated?.name).toBe("New");
    expect(updated?.count).toBe(99);
    expect(updated?.description).toBe("desc");
  });

  test("edit returns null for unknown id", async () => {
    expect(await editItem("unknown", { name: "X" })).toBeNull();
  });

  test("delete returns true then item is gone", async () => {
    const item = await addItem({ name: "Gone", description: "", count: 1 });
    expect(await deleteItem(item.id)).toBe(true);
    expect(await getItem(item.id)).toBeNull();
  });

  test("delete returns false for unknown id", async () => {
    expect(await deleteItem("unknown")).toBe(false);
  });
});

// ─── deleteItem cascade ───────────────────────────────────────────────────────

describe("deleteItem — cascade", () => {
  beforeEach(clearStores);

  test("deleting an item removes its metadata", async () => {
    const item = await addItem({ name: "Widget", description: "", count: 1 });
    await setMetadata(item.id, [{ key: "color", value: "red" }, { key: "weight", value: "2kg" }]);

    expect(metaRepo.list(item.id).length).toBe(2);

    await deleteItem(item.id);

    expect(metaRepo.list(item.id).length).toBe(0);
  });

  test("deleting one item does not remove metadata of another", async () => {
    const a = await addItem({ name: "A", description: "", count: 1 });
    const b = await addItem({ name: "B", description: "", count: 1 });
    await setMetadata(a.id, [{ key: "k", value: "v" }]);
    await setMetadata(b.id, [{ key: "x", value: "y" }]);

    await deleteItem(a.id);

    expect(metaRepo.list(b.id).length).toBe(1);
  });

  test("images list is empty after deleteItem (no image records to cascade)", async () => {
    const item = await addItem({ name: "Img", description: "", count: 1 });
    await deleteItem(item.id);
    // no images were added, but cascade should not throw
    const imgs = await listImages(item.id);
    expect(imgs.length).toBe(0);
  });
});

// ─── Items $filter ────────────────────────────────────────────────────────────

describe("items — $filter", () => {
  beforeEach(clearStores);

  test("filter by exact name", async () => {
    await addItem({ name: "Apple", description: "", count: 1 });
    await addItem({ name: "Banana", description: "", count: 2 });
    const result = await listItems({ $filter: "name eq 'Apple'" });
    expect(result.length).toBe(1);
    expect(result[0]!.name).toBe("Apple");
  });

  test("filter by count gt", async () => {
    await addItem({ name: "Few", description: "", count: 2 });
    await addItem({ name: "Many", description: "", count: 10 });
    const result = await listItems({ $filter: "count gt 5" });
    expect(result.length).toBe(1);
    expect(result[0]!.name).toBe("Many");
  });

  test("filter by categoryId eq null", async () => {
    const cat = await addCategory({ name: "Tools" });
    await addItem({ name: "NoCat", description: "", count: 1 });
    await addItem({ name: "WithCat", description: "", count: 1, categoryId: cat.id });

    const result = await listItems({ $filter: "categoryId eq null" });
    expect(result.every((i) => i.categoryId === undefined)).toBe(true);
  });

  test("filter by categoryId eq '<id>'", async () => {
    const cat = await addCategory({ name: "Tools" });
    await addItem({ name: "NoCat", description: "", count: 1 });
    await addItem({ name: "InCat", description: "", count: 1, categoryId: cat.id });

    const result = await listItems({ $filter: `categoryId eq '${cat.id}'` });
    expect(result.length).toBe(1);
    expect(result[0]!.name).toBe("InCat");
  });

  test("count respects $filter", async () => {
    await addItem({ name: "A", description: "", count: 1 });
    await addItem({ name: "B", description: "", count: 20 });
    expect(countItems("count gt 10")).toBe(1);
  });

  test("invalid $filter throws", async () => {
    await expect(listItems({ $filter: "name @@ 'bad'" })).rejects.toThrow();
  });
});

// ─── Items pagination ─────────────────────────────────────────────────────────

describe("items — pagination", () => {
  beforeEach(clearStores);

  test("limit restricts results", async () => {
    for (let i = 0; i < 5; i++) await addItem({ name: `Item${i}`, description: "", count: i });
    const result = await listItems({ limit: 3 });
    expect(result.length).toBe(3);
  });

  test("offset skips items", async () => {
    for (let i = 0; i < 5; i++) await addItem({ name: `Item${i}`, description: "", count: i });
    const result = await listItems({ offset: 3 });
    expect(result.length).toBe(2);
  });

  test("limit + offset", async () => {
    for (let i = 0; i < 5; i++) await addItem({ name: `Item${i}`, description: "", count: i });
    const result = await listItems({ limit: 2, offset: 2 });
    expect(result.length).toBe(2);
  });
});

// ─── Categories CRUD ──────────────────────────────────────────────────────────

describe("categories — basic CRUD", () => {
  beforeEach(clearStores);

  test("add and list", async () => {
    const cat = await addCategory({ name: "Electronics" });
    expect(cat.id).toBeTruthy();
    expect(cat.name).toBe("Electronics");

    const all = await listCategories();
    expect(all.length).toBe(1);
    expect(all[0]).toEqual(cat);
  });

  test("delete non-existent returns false", async () => {
    expect(await deleteCategory("ghost")).toBe(false);
  });

  test("delete existing returns true", async () => {
    const cat = await addCategory({ name: "Temp" });
    expect(await deleteCategory(cat.id)).toBe(true);
    expect(await listCategories()).toHaveLength(0);
  });
});

// ─── deleteCategory cascade ───────────────────────────────────────────────────

describe("deleteCategory — cascade unlinks items", () => {
  beforeEach(clearStores);

  test("deleting a category clears categoryId on linked items", async () => {
    const cat = await addCategory({ name: "Tools" });
    const item = await addItem({ name: "Wrench", description: "", count: 1, categoryId: cat.id });

    await deleteCategory(cat.id);

    const fetched = await getItem(item.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.categoryId).toBeUndefined();
  });

  test("items not in the deleted category keep their categoryId", async () => {
    const catA = await addCategory({ name: "A" });
    const catB = await addCategory({ name: "B" });
    const inA = await addItem({ name: "InA", description: "", count: 1, categoryId: catA.id });
    const inB = await addItem({ name: "InB", description: "", count: 1, categoryId: catB.id });

    await deleteCategory(catA.id);

    expect((await getItem(inA.id))!.categoryId).toBeUndefined();
    expect((await getItem(inB.id))!.categoryId).toBe(catB.id);
  });

  test("deleted category no longer appears in list", async () => {
    const cat = await addCategory({ name: "Transient" });
    await deleteCategory(cat.id);
    const all = await listCategories();
    expect(all.find((c) => c.id === cat.id)).toBeUndefined();
  });
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe("metadata — CRUD", () => {
  beforeEach(clearStores);

  test("set and list metadata", async () => {
    const item = await addItem({ name: "X", description: "", count: 1 });
    const entries = await setMetadata(item.id, [{ key: "color", value: "blue" }]);
    expect(entries).toEqual([{ key: "color", value: "blue" }]);

    const listed = await listMetadata(item.id);
    expect(listed).toEqual([{ key: "color", value: "blue" }]);
  });

  test("set replaces all metadata", async () => {
    const item = await addItem({ name: "Y", description: "", count: 1 });
    await setMetadata(item.id, [{ key: "a", value: "1" }, { key: "b", value: "2" }]);
    await setMetadata(item.id, [{ key: "c", value: "3" }]);

    const listed = await listMetadata(item.id);
    expect(listed).toEqual([{ key: "c", value: "3" }]);
  });

  test("empty metadata for unknown item", async () => {
    const listed = await listMetadata("nobody");
    expect(listed).toEqual([]);
  });
});
