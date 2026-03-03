import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { createServer } from "../api/server.ts";
import { closeDB } from "../core/db.ts";

// Must be set before any db function is called (getDB() reads it lazily)
process.env["DB_PATH"] = "./test-db.sqlite";

let baseUrl!: string;
let server!: ReturnType<typeof createServer>;

beforeAll(() => {
  server = createServer(0); // port 0 = OS assigns a free port
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  server.stop(true);
  closeDB();
  await rm("./test-db.sqlite", { force: true });
  await rm("./test-db.sqlite-wal", { force: true });
  await rm("./test-db.sqlite-shm", { force: true });
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
