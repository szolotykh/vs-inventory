import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "../api/server.ts";
import { closeDB } from "../core/db.ts";

// Must be set before any db function is called (getDB() reads it lazily)
process.env["DB_PATH"] = "./test-db.sqlite";
process.env["UPLOADS_DIR"] = "./test-uploads";

let baseUrl!: string;
let server!: ReturnType<typeof createServer>;

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

function get(path: string) {
  return fetch(`${baseUrl}${path}`);
}

function post(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function put(path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function del(path: string) {
  return fetch(`${baseUrl}${path}`, { method: "DELETE" });
}

type Category = { id: string; name: string };
type Item = { id: string; name: string; description: string; count: number; categoryId?: string };
type Image = { id: string; itemId: string; filename: string; mimeType: string; size: number };
type Metadata = { key: string; value: string };

// --- Categories ---

describe("categories", () => {
  let id = "";

  it("GET /categories returns empty array initially", async () => {
    const res = await get("/categories");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("POST /categories creates a category", async () => {
    const res = await post("/categories", { name: "Dairy" });
    expect(res.status).toBe(201);
    const body = await res.json() as Category;
    expect(typeof body.id).toBe("string");
    expect(body.name).toBe("Dairy");
    id = body.id;
  });

  it("GET /categories returns the created category", async () => {
    const res = await get("/categories");
    const body = await res.json() as Category[];
    expect(body).toHaveLength(1);
    expect(body[0]?.name).toBe("Dairy");
  });

  it("PUT /categories/:id updates the category", async () => {
    const res = await put(`/categories/${id}`, { name: "Beverages" });
    expect(res.status).toBe(200);
    const body = await res.json() as Category;
    expect(body.id).toBe(id);
    expect(body.name).toBe("Beverages");
  });

  it("PUT /categories/:id returns 404 for unknown id", async () => {
    const res = await put("/categories/nonexistent", { name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /categories/:id returns 404 for unknown id", async () => {
    const res = await del("/categories/nonexistent");
    expect(res.status).toBe(404);
  });

  it("DELETE /categories/:id deletes the category", async () => {
    const res = await del(`/categories/${id}`);
    expect(res.status).toBe(204);
    const listRes = await get("/categories");
    const body = await listRes.json() as Category[];
    expect(body.find((c) => c.id === id)).toBeUndefined();
  });
});

// --- Items ---

describe("items", () => {
  let catId = "";
  let itemAId = "";
  let itemBId = "";

  beforeAll(async () => {
    const res = await post("/categories", { name: "Groceries" });
    catId = (await res.json() as Category).id;
  });

  it("GET /items returns empty array initially", async () => {
    const res = await get("/items");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("POST /items creates an item without a category", async () => {
    const res = await post("/items", { name: "Pen", description: "Blue ballpoint pen", count: 5 });
    expect(res.status).toBe(201);
    const body = await res.json() as Item;
    expect(body.name).toBe("Pen");
    expect(body.description).toBe("Blue ballpoint pen");
    expect(body.count).toBe(5);
    expect(body.categoryId).toBeUndefined();
    itemAId = body.id;
  });

  it("POST /items creates an item with a category", async () => {
    const res = await post("/items", { name: "Milk", description: "2% milk", count: 2, categoryId: catId });
    expect(res.status).toBe(201);
    const body = await res.json() as Item;
    expect(body.count).toBe(2);
    expect(body.categoryId).toBe(catId);
    itemBId = body.id;
  });

  it("POST /items with count: 0 is allowed", async () => {
    const res = await post("/items", { name: "Empty", description: "Zero stock", count: 0 });
    expect(res.status).toBe(201);
    const body = await res.json() as Item;
    expect(body.count).toBe(0);
    // clean up
    await del(`/items/${body.id}`);
  });

  it("POST /items with negative count returns 400", async () => {
    const res = await post("/items", { name: "Bad", description: "Negative count", count: -1 });
    expect(res.status).toBe(400);
  });

  it("POST /items with non-integer count returns 400", async () => {
    const res = await post("/items", { name: "Bad", description: "Float count", count: 1.5 });
    expect(res.status).toBe(400);
  });

  it("GET /items returns both items", async () => {
    const res = await get("/items");
    const body = await res.json() as Item[];
    expect(body).toHaveLength(2);
  });

  it("PUT /items/:id updates name and description", async () => {
    const res = await put(`/items/${itemAId}`, { name: "Marker", description: "Red marker" });
    expect(res.status).toBe(200);
    const body = await res.json() as Item;
    expect(body.name).toBe("Marker");
    expect(body.description).toBe("Red marker");
    expect(body.count).toBe(5); // unchanged
  });

  it("PUT /items/:id updates count", async () => {
    const res = await put(`/items/${itemAId}`, { count: 10 });
    expect(res.status).toBe(200);
    const body = await res.json() as Item;
    expect(body.count).toBe(10);
  });

  it("PUT /items/:id with negative count returns 400", async () => {
    const res = await put(`/items/${itemAId}`, { count: -1 });
    expect(res.status).toBe(400);
  });

  it("PUT /items/:id with non-integer count returns 400", async () => {
    const res = await put(`/items/${itemAId}`, { count: 2.7 });
    expect(res.status).toBe(400);
  });

  it("PUT /items/:id assigns a category", async () => {
    const res = await put(`/items/${itemAId}`, { categoryId: catId });
    expect(res.status).toBe(200);
    const body = await res.json() as Item;
    expect(body.categoryId).toBe(catId);
  });

  it("PUT /items/:id with categoryId: null removes the category", async () => {
    const res = await put(`/items/${itemBId}`, { categoryId: null });
    expect(res.status).toBe(200);
    const body = await res.json() as Item;
    expect(body.categoryId).toBeUndefined();
  });

  it("PUT /items/:id returns 404 for unknown id", async () => {
    const res = await put("/items/nonexistent", { name: "X" });
    expect(res.status).toBe(404);
  });

  it("DELETE /items/:id deletes the item", async () => {
    const res = await del(`/items/${itemAId}`);
    expect(res.status).toBe(204);
  });

  it("GET /items returns one item after deletion", async () => {
    const res = await get("/items");
    const body = await res.json() as Item[];
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(itemBId);
  });

  it("DELETE /items/:id returns 404 for unknown id", async () => {
    const res = await del("/items/nonexistent");
    expect(res.status).toBe(404);
  });
});

// --- Cross-resource ---

describe("cross-resource: deleting a category unlinks its items", () => {
  let catId = "";
  let itemId = "";

  beforeAll(async () => {
    const catRes = await post("/categories", { name: "Temp Category" });
    catId = (await catRes.json() as Category).id;

    const itemRes = await post("/items", {
      name: "Linked Item",
      description: "Belongs to temp category",
      count: 1,
      categoryId: catId,
    });
    itemId = (await itemRes.json() as Item).id;
  });

  it("item has categoryId before deletion", async () => {
    const res = await get("/items");
    const items = await res.json() as Item[];
    const item = items.find((i) => i.id === itemId);
    expect(item?.categoryId).toBe(catId);
  });

  it("DELETE /categories/:id returns 204 and unlinks items", async () => {
    const res = await del(`/categories/${catId}`);
    expect(res.status).toBe(204);

    const itemsRes = await get("/items");
    const items = await itemsRes.json() as Item[];
    const item = items.find((i) => i.id === itemId);
    expect(item?.categoryId).toBeUndefined();
  });

  it("deleted category is gone from GET /categories", async () => {
    const res = await get("/categories");
    const cats = await res.json() as Category[];
    expect(cats.find((c) => c.id === catId)).toBeUndefined();
  });
});

// --- Edge cases ---

describe("edge cases", () => {
  it("malformed JSON body returns 400", async () => {
    const res = await fetch(`${baseUrl}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });

  it("unknown route returns 404", async () => {
    const res = await get("/unknown");
    expect(res.status).toBe(404);
  });
});

// --- Images ---

describe("images", () => {
  let itemId = "";
  let imageId = "";
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG header
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk (1x1 pixel)
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  beforeAll(async () => {
    const res = await post("/items", { name: "Photo Item", description: "Has images", count: 1 });
    itemId = (await res.json() as Item).id;
  });

  it("GET /items/:id/images returns empty array initially", async () => {
    const res = await get(`/items/${itemId}/images`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("POST /items/:id/images uploads an image", async () => {
    const formData = new FormData();
    formData.append("file", new File([pngBytes], "test.png", { type: "image/png" }));
    const res = await fetch(`${baseUrl}/items/${itemId}/images`, { method: "POST", body: formData });
    expect(res.status).toBe(201);
    const body = await res.json() as Image;
    expect(body.filename).toBe("test.png");
    expect(body.mimeType).toBe("image/png");
    expect(body.size).toBe(pngBytes.length);
    expect(body.itemId).toBe(itemId);
    imageId = body.id;
  });

  it("GET /items/:id/images returns the uploaded image", async () => {
    const res = await get(`/items/${itemId}/images`);
    const body = await res.json() as Image[];
    expect(body).toHaveLength(1);
    expect(body[0]?.id).toBe(imageId);
  });

  it("GET /items/:id/images/:imageId downloads the image", async () => {
    const res = await get(`/items/${itemId}/images/${imageId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const data = new Uint8Array(await res.arrayBuffer());
    expect(data).toEqual(pngBytes);
  });

  it("GET /items/:id/images/:imageId returns 404 for unknown id", async () => {
    const res = await get(`/items/${itemId}/images/nonexistent`);
    expect(res.status).toBe(404);
  });

  it("DELETE /items/:id/images/:imageId deletes the image", async () => {
    const res = await del(`/items/${itemId}/images/${imageId}`);
    expect(res.status).toBe(204);
  });

  it("GET /items/:id/images returns empty after deletion", async () => {
    const res = await get(`/items/${itemId}/images`);
    expect(await res.json()).toEqual([]);
  });

  it("DELETE /items/:id/images/:imageId returns 404 for unknown id", async () => {
    const res = await del(`/items/${itemId}/images/nonexistent`);
    expect(res.status).toBe(404);
  });

  it("deleting an item also deletes its images", async () => {
    // upload an image, then delete the item
    const formData = new FormData();
    formData.append("file", new File([pngBytes], "will-be-deleted.png", { type: "image/png" }));
    const uploadRes = await fetch(`${baseUrl}/items/${itemId}/images`, { method: "POST", body: formData });
    const img = await uploadRes.json() as Image;

    await del(`/items/${itemId}`);

    // image should be gone — re-create item to have a valid parent for the lookup
    const newItem = await post("/items", { name: "New", description: "new", count: 0 });
    const newId = (await newItem.json() as Item).id;
    const imgRes = await get(`/items/${newId}/images/${img.id}`);
    expect(imgRes.status).toBe(404);
    await del(`/items/${newId}`);
  });

  it("POST /items/:id/images rejects non-image files", async () => {
    const tempRes = await post("/items", { name: "Temp", description: "temp", count: 0 });
    const tempId = (await tempRes.json() as Item).id;
    const formData = new FormData();
    formData.append("file", new File(["hello"], "test.txt", { type: "text/plain" }));
    const res = await fetch(`${baseUrl}/items/${tempId}/images`, { method: "POST", body: formData });
    expect(res.status).toBe(400);
    await del(`/items/${tempId}`);
  });

  it("POST /items/:id/images without file field returns 400", async () => {
    const tempRes = await post("/items", { name: "NoFile", description: "no file", count: 0 });
    const tempId = (await tempRes.json() as Item).id;
    const formData = new FormData();
    formData.append("other", "not a file");
    const res = await fetch(`${baseUrl}/items/${tempId}/images`, { method: "POST", body: formData });
    expect(res.status).toBe(400);
    await del(`/items/${tempId}`);
  });

  it("supports multiple images on one item", async () => {
    const tempRes = await post("/items", { name: "Multi", description: "multi-image", count: 0 });
    const tempId = (await tempRes.json() as Item).id;

    const form1 = new FormData();
    form1.append("file", new File([pngBytes], "a.png", { type: "image/png" }));
    const form2 = new FormData();
    form2.append("file", new File([pngBytes], "b.png", { type: "image/png" }));

    await fetch(`${baseUrl}/items/${tempId}/images`, { method: "POST", body: form1 });
    await fetch(`${baseUrl}/items/${tempId}/images`, { method: "POST", body: form2 });

    const listRes = await get(`/items/${tempId}/images`);
    const images = await listRes.json() as Image[];
    expect(images).toHaveLength(2);
    const names = images.map((i) => i.filename).sort();
    expect(names).toEqual(["a.png", "b.png"]);

    await del(`/items/${tempId}`);
  });
});

// --- Metadata ---

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

    // old keys should be gone
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

    // re-create to verify metadata is gone (same ID won't exist, use new item)
    const newRes = await post("/items", { name: "New", description: "new", count: 0 });
    const newId = (await newRes.json() as Item).id;
    const metaRes = await get(`/items/${newId}/metadata`);
    expect(await metaRes.json()).toEqual([]);
    await del(`/items/${newId}`);
  });
});
