import { describe, it, expect } from "bun:test";
import { get, post, put, del } from "./setup.ts";
import type { Category } from "./setup.ts";

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
