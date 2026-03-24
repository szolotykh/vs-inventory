import { describe, it, expect, afterAll } from "bun:test";
import { rm } from "node:fs/promises";
import { get, post, put, del } from "./setup.ts";

// Clear shared file store after this file's tests so subsequent test files start clean.
// Bun runs test files sequentially (alphabetically), and this file (changelog) runs before
// images/items which assume an initially empty store.
afterAll(async () => {
  await rm(process.env["FILE_DB_DIR"] ?? "./test-data", { recursive: true, force: true });
});

type ChangeEntry = { field: string; from: unknown; to: unknown };
type ChangeLog = {
  id: string;
  targetId: string;
  targetType: "item" | "category";
  changeType: "create" | "update" | "delete";
  changes: ChangeEntry[] | null;
  timestamp: string;
};
type PagedChangeLogs = { changelogs: ChangeLog[]; total: number; limit: number | null; offset: number };

describe("changelog", () => {
  describe("item changes", () => {
    it("records create when adding an item", async () => {
      const item = await (await post("/items", { name: "Widget", description: "A widget", count: 5 })).json() as { id: string };
      const res = await get(`/changelogs?targetId=${item.id}&changeType=create`);
      expect(res.status).toBe(200);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);
      expect(page.changelogs[0]!.targetId).toBe(item.id);
      expect(page.changelogs[0]!.targetType).toBe("item");
      expect(page.changelogs[0]!.changeType).toBe("create");
      expect(page.changelogs[0]!.changes).toBeNull();
    });

    it("records update with field diff when editing an item", async () => {
      const item = await (await post("/items", { name: "Gadget", description: "A gadget", count: 3 })).json() as { id: string };
      await put(`/items/${item.id}`, { count: 10, name: "Super Gadget" });

      const res = await get(`/changelogs?targetId=${item.id}&changeType=update`);
      expect(res.status).toBe(200);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);

      const log = page.changelogs[0]!;
      expect(log.changeType).toBe("update");
      expect(Array.isArray(log.changes)).toBe(true);

      const countChange = log.changes!.find((c) => c.field === "count");
      expect(countChange).toBeDefined();
      expect(countChange!.from).toBe(3);
      expect(countChange!.to).toBe(10);

      const nameChange = log.changes!.find((c) => c.field === "name");
      expect(nameChange).toBeDefined();
      expect(nameChange!.from).toBe("Gadget");
      expect(nameChange!.to).toBe("Super Gadget");
    });

    it("records update with empty diff when nothing changed", async () => {
      const item = await (await post("/items", { name: "Same", description: "Same", count: 1 })).json() as { id: string };
      await put(`/items/${item.id}`, { name: "Same" });

      const res = await get(`/changelogs?targetId=${item.id}&changeType=update`);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);
      expect(page.changelogs[0]!.changes).toEqual([]);
    });

    it("records delete when removing an item", async () => {
      const item = await (await post("/items", { name: "Doomed", description: "Will be deleted", count: 0 })).json() as { id: string };
      await del(`/items/${item.id}`);

      const res = await get(`/changelogs?targetId=${item.id}&changeType=delete`);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);
      expect(page.changelogs[0]!.changeType).toBe("delete");
      expect(page.changelogs[0]!.changes).toBeNull();
    });

    it("records categoryId changes when assigning and removing category", async () => {
      const cat = await (await post("/categories", { name: "Electronics" })).json() as { id: string };
      const item = await (await post("/items", { name: "Radio", description: "A radio", count: 2 })).json() as { id: string };

      await put(`/items/${item.id}`, { categoryId: cat.id });
      await put(`/items/${item.id}`, { categoryId: null });

      const res = await get(`/changelogs?targetId=${item.id}&changeType=update`);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(2);

      // Most recent first — null removal
      const removeLog = page.changelogs[0]!;
      const catChange = removeLog.changes!.find((c) => c.field === "categoryId");
      expect(catChange!.from).toBe(cat.id);
      expect(catChange!.to).toBeNull();

      // Second entry — assignment
      const assignLog = page.changelogs[1]!;
      const assignChange = assignLog.changes!.find((c) => c.field === "categoryId");
      expect(assignChange!.from).toBeNull();
      expect(assignChange!.to).toBe(cat.id);
    });
  });

  describe("category changes", () => {
    it("records create when adding a category", async () => {
      const cat = await (await post("/categories", { name: "Tools" })).json() as { id: string };
      const res = await get(`/changelogs?targetId=${cat.id}&changeType=create`);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);
      expect(page.changelogs[0]!.targetType).toBe("category");
      expect(page.changelogs[0]!.changes).toBeNull();
    });

    it("records update with name diff when renaming a category", async () => {
      const cat = await (await post("/categories", { name: "Old Name" })).json() as { id: string };
      await put(`/categories/${cat.id}`, { name: "New Name" });

      const res = await get(`/changelogs?targetId=${cat.id}&changeType=update`);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);
      const nameChange = page.changelogs[0]!.changes!.find((c) => c.field === "name");
      expect(nameChange!.from).toBe("Old Name");
      expect(nameChange!.to).toBe("New Name");
    });

    it("records delete when removing a category", async () => {
      const cat = await (await post("/categories", { name: "Temporary" })).json() as { id: string };
      await del(`/categories/${cat.id}`);

      const res = await get(`/changelogs?targetId=${cat.id}&changeType=delete`);
      const page = await res.json() as PagedChangeLogs;
      expect(page.total).toBe(1);
      expect(page.changelogs[0]!.changeType).toBe("delete");
    });
  });

  describe("GET /changelogs", () => {
    it("filters by targetType=item", async () => {
      const before = await (await get("/changelogs?targetType=item")).json() as PagedChangeLogs;
      await post("/items", { name: "TypeFilter", description: "x", count: 0 });
      await post("/categories", { name: "TypeFilterCat" });

      const after = await (await get("/changelogs?targetType=item")).json() as PagedChangeLogs;
      expect(after.total).toBe(before.total + 1);
    });

    it("filters by targetType=category", async () => {
      const before = await (await get("/changelogs?targetType=category")).json() as PagedChangeLogs;
      await post("/categories", { name: "CatOnly" });
      await post("/items", { name: "ItemOnly", description: "x", count: 0 });

      const after = await (await get("/changelogs?targetType=category")).json() as PagedChangeLogs;
      expect(after.total).toBe(before.total + 1);
    });

    it("supports pagination with limit and offset", async () => {
      // Create 3 items to ensure we have enough entries
      await post("/items", { name: "PagA", description: "x", count: 0 });
      await post("/items", { name: "PagB", description: "x", count: 0 });
      await post("/items", { name: "PagC", description: "x", count: 0 });

      const all = await (await get("/changelogs")).json() as PagedChangeLogs;
      expect(all.total).toBeGreaterThanOrEqual(3);

      const page1 = await (await get("/changelogs?limit=2&offset=0")).json() as PagedChangeLogs;
      expect(page1.changelogs.length).toBe(2);
      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);

      const page2 = await (await get("/changelogs?limit=2&offset=2")).json() as PagedChangeLogs;
      expect(page2.offset).toBe(2);
      // No overlap between pages
      const ids1 = new Set(page1.changelogs.map((c) => c.id));
      for (const entry of page2.changelogs) {
        expect(ids1.has(entry.id)).toBe(false);
      }
    });

    it("returns 400 for invalid limit", async () => {
      const res = await get("/changelogs?limit=0");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid offset", async () => {
      const res = await get("/changelogs?offset=-1");
      expect(res.status).toBe(400);
    });
  });

  describe("GET /changelogs/:id", () => {
    it("returns a single change log by ID", async () => {
      const item = await (await post("/items", { name: "ByID", description: "x", count: 1 })).json() as { id: string };
      const list = await (await get(`/changelogs?targetId=${item.id}`)).json() as PagedChangeLogs;
      const logId = list.changelogs[0]!.id;

      const res = await get(`/changelogs/${logId}`);
      expect(res.status).toBe(200);
      const log = await res.json() as ChangeLog;
      expect(log.id).toBe(logId);
      expect(log.targetId).toBe(item.id);
    });

    it("returns 404 for unknown ID", async () => {
      const res = await get("/changelogs/nonexistent-id");
      expect(res.status).toBe(404);
    });
  });

  describe("changelog entries have correct shape", () => {
    it("each entry has id, targetId, targetType, changeType, changes, timestamp", async () => {
      const item = await (await post("/items", { name: "ShapeTest", description: "x", count: 0 })).json() as { id: string };
      const list = await (await get(`/changelogs?targetId=${item.id}`)).json() as PagedChangeLogs;
      const log = list.changelogs[0]!;

      expect(typeof log.id).toBe("string");
      expect(typeof log.targetId).toBe("string");
      expect(["item", "category"]).toContain(log.targetType);
      expect(["create", "update", "delete"]).toContain(log.changeType);
      expect(typeof log.timestamp).toBe("string");
      // timestamp should be valid ISO 8601
      expect(isNaN(Date.parse(log.timestamp))).toBe(false);
    });
  });
});
