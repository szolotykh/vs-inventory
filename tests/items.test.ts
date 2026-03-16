import { describe, it, expect, beforeAll } from "bun:test";
import { getBaseUrl, get, post, put, del } from "./setup.ts";
import type { Category, Item, PagedItems } from "./setup.ts";

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
    const body = await res.json() as PagedItems;
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBeNull();
    expect(body.offset).toBe(0);
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
    const body = await res.json() as PagedItems;
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("PUT /items/:id updates name and description", async () => {
    const res = await put(`/items/${itemAId}`, { name: "Marker", description: "Red marker" });
    expect(res.status).toBe(200);
    const body = await res.json() as Item;
    expect(body.name).toBe("Marker");
    expect(body.description).toBe("Red marker");
    expect(body.count).toBe(5);
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
    const body = await res.json() as PagedItems;
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.items[0]?.id).toBe(itemBId);
  });

  it("DELETE /items/:id returns 404 for unknown id", async () => {
    const res = await del("/items/nonexistent");
    expect(res.status).toBe(404);
  });
});

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
    const { items } = await res.json() as PagedItems;
    const item = items.find((i) => i.id === itemId);
    expect(item?.categoryId).toBe(catId);
  });

  it("DELETE /categories/:id returns 204 and unlinks items", async () => {
    const res = await del(`/categories/${catId}`);
    expect(res.status).toBe(204);

    const itemsRes = await get("/items");
    const { items } = await itemsRes.json() as PagedItems;
    const item = items.find((i) => i.id === itemId);
    expect(item?.categoryId).toBeUndefined();
  });

  it("deleted category is gone from GET /categories", async () => {
    const res = await get("/categories");
    const cats = await res.json() as Category[];
    expect(cats.find((c) => c.id === catId)).toBeUndefined();
  });
});

describe("pagination", () => {
  let total = 0;

  beforeAll(async () => {
    // capture count before adding test fixtures
    const r = await get("/items");
    total = ((await r.json() as PagedItems).total);
    for (let i = 1; i <= 5; i++) {
      await post("/items", { name: `Page Item ${i}`, description: `Desc ${i}`, count: i });
    }
    total += 5;
  });

  it("GET /items returns all items with correct total and null limit", async () => {
    const res = await get("/items");
    const body = await res.json() as PagedItems;
    expect(body.total).toBe(total);
    expect(body.items).toHaveLength(total);
    expect(body.limit).toBeNull();
    expect(body.offset).toBe(0);
  });

  it("GET /items?limit=2 returns 2 items and correct total", async () => {
    const res = await get("/items?limit=2");
    const body = await res.json() as PagedItems;
    expect(body.total).toBe(total);
    expect(body.items).toHaveLength(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it("GET /items?limit=2&offset=2 returns next 2 items", async () => {
    const res = await get("/items?limit=2&offset=2");
    const body = await res.json() as PagedItems;
    expect(body.total).toBe(total);
    expect(body.items).toHaveLength(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(2);
  });

  it("GET /items?limit=2&offset=total-1 returns 1 item", async () => {
    const res = await get(`/items?limit=2&offset=${total - 1}`);
    const body = await res.json() as PagedItems;
    expect(body.total).toBe(total);
    expect(body.items).toHaveLength(1);
  });

  it("GET /items?offset=N with no limit returns remaining items", async () => {
    const skip = 3;
    const res = await get(`/items?offset=${skip}`);
    const body = await res.json() as PagedItems;
    expect(body.total).toBe(total);
    expect(body.items).toHaveLength(total - skip);
    expect(body.offset).toBe(skip);
    expect(body.limit).toBeNull();
  });

  it("GET /items?limit=0 returns 400", async () => {
    const res = await get("/items?limit=0");
    expect(res.status).toBe(400);
  });

  it("GET /items?limit=-1 returns 400", async () => {
    const res = await get("/items?limit=-1");
    expect(res.status).toBe(400);
  });

  it("GET /items?offset=-1 returns 400", async () => {
    const res = await get("/items?offset=-1");
    expect(res.status).toBe(400);
  });
});


describe("$filter — category equality", () => {
  let catAId = "";
  let catBId = "";

  beforeAll(async () => {
    catAId = (await (await post("/categories", { name: "Filter Cat A" })).json() as Category).id;
    catBId = (await (await post("/categories", { name: "Filter Cat B" })).json() as Category).id;
    await post("/items", { name: "Cat A Item 1", description: "d", count: 1, categoryId: catAId });
    await post("/items", { name: "Cat A Item 2", description: "d", count: 2, categoryId: catAId });
    await post("/items", { name: "Cat B Item 1", description: "d", count: 3, categoryId: catBId });
    await post("/items", { name: "No Cat Item",  description: "d", count: 4 });
  });

  it("categoryId eq 'A' returns only items in that category", async () => {
    const f = encodeURIComponent(`categoryId eq '${catAId}'`);
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((i) => i.categoryId === catAId)).toBe(true);
  });

  it("categoryId eq 'B' returns only items in that category", async () => {
    const f = encodeURIComponent(`categoryId eq '${catBId}'`);
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.categoryId).toBe(catBId);
  });

  it("categoryId eq 'nonexistent' returns empty", async () => {
    const f = encodeURIComponent("categoryId eq 'nonexistent-id'");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.total).toBe(0);
    expect(body.items).toHaveLength(0);
  });

  it("categoryId eq 'A' combined with limit applies both", async () => {
    const f = encodeURIComponent(`categoryId eq '${catAId}'`);
    const body = await (await get(`/items?$filter=${f}&limit=1`)).json() as PagedItems;
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(1);
    expect(body.limit).toBe(1);
    expect(body.items[0]?.categoryId).toBe(catAId);
  });

  it("categoryId eq null returns items with no category", async () => {
    const f = encodeURIComponent("categoryId eq null");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.categoryId === undefined)).toBe(true);
  });

  it("categoryId ne null returns items that have a category", async () => {
    const f = encodeURIComponent("categoryId ne null");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.categoryId !== undefined)).toBe(true);
  });
});


describe("$filter — numeric comparisons", () => {
  beforeAll(async () => {
    await post("/items", { name: "Num Item 1", description: "d", count: 10 });
    await post("/items", { name: "Num Item 2", description: "d", count: 20 });
    await post("/items", { name: "Num Item 3", description: "d", count: 30 });
  });

  it("count gt 15 returns items with count > 15", async () => {
    const f = encodeURIComponent("count gt 15");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count > 15)).toBe(true);
    expect(body.items.some((i) => i.count === 20)).toBe(true);
    expect(body.items.some((i) => i.count === 30)).toBe(true);
  });

  it("count lt 20 returns items with count < 20", async () => {
    const f = encodeURIComponent("count lt 20");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count < 20)).toBe(true);
  });

  it("count ge 20 returns items with count >= 20", async () => {
    const f = encodeURIComponent("count ge 20");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count >= 20)).toBe(true);
    expect(body.items.some((i) => i.count === 20)).toBe(true);
  });

  it("count le 20 returns items with count <= 20", async () => {
    const f = encodeURIComponent("count le 20");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count <= 20)).toBe(true);
    expect(body.items.some((i) => i.count === 20)).toBe(true);
  });

  it("count eq 30 returns exactly items with count 30", async () => {
    const f = encodeURIComponent("count eq 30");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count === 30)).toBe(true);
  });

  it("count ne 20 excludes items with count 20", async () => {
    const f = encodeURIComponent("count ne 20");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count !== 20)).toBe(true);
  });
});


describe("$filter — logical operators", () => {
  let catId = "";

  beforeAll(async () => {
    catId = (await (await post("/categories", { name: "Logic Cat" })).json() as Category).id;
    await post("/items", { name: "Logic Item 1", description: "d", count: 5,  categoryId: catId });
    await post("/items", { name: "Logic Item 2", description: "d", count: 15, categoryId: catId });
    await post("/items", { name: "Logic Item 3", description: "d", count: 25 });
  });

  it("count gt 4 and count lt 20 returns items in range", async () => {
    const f = encodeURIComponent("count gt 4 and count lt 20");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count > 4 && i.count < 20)).toBe(true);
  });

  it("count lt 10 or count gt 20 returns items outside middle range", async () => {
    const f = encodeURIComponent("count lt 10 or count gt 20");
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.count < 10 || i.count > 20)).toBe(true);
  });

  it("categoryId eq 'X' and count gt 10 combines category and numeric filter", async () => {
    const f = encodeURIComponent(`categoryId eq '${catId}' and count gt 10`);
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => i.categoryId === catId && i.count > 10)).toBe(true);
    expect(body.total).toBe(1);
  });

  it("parentheses group correctly", async () => {
    const f = encodeURIComponent(`(count gt 10 and count lt 20) or count gt 24`);
    const body = await (await get(`/items?$filter=${f}`)).json() as PagedItems;
    expect(body.items.every((i) => (i.count > 10 && i.count < 20) || i.count > 24)).toBe(true);
  });
});


describe("$filter — invalid expressions", () => {
  it("malformed $filter returns 400", async () => {
    const f = encodeURIComponent("count gt");
    const res = await get(`/items?$filter=${f}`);
    expect(res.status).toBe(400);
  });

  it("unknown operator returns 400", async () => {
    const f = encodeURIComponent("count === 5");
    const res = await get(`/items?$filter=${f}`);
    expect(res.status).toBe(400);
  });
});


describe("edge cases", () => {
  it("malformed JSON body returns 400", async () => {
    const res = await fetch(`${getBaseUrl()}/items`, {
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
