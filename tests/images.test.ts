import { describe, it, expect, beforeAll } from "bun:test";
import { getBaseUrl, get, post, del } from "./setup.ts";
import type { Item, Image } from "./setup.ts";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("images", () => {
  let itemId = "";
  let imageId = "";

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
    const res = await fetch(`${getBaseUrl()}/items/${itemId}/images`, { method: "POST", body: formData });
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
    const formData = new FormData();
    formData.append("file", new File([pngBytes], "will-be-deleted.png", { type: "image/png" }));
    const uploadRes = await fetch(`${getBaseUrl()}/items/${itemId}/images`, { method: "POST", body: formData });
    const img = await uploadRes.json() as Image;

    await del(`/items/${itemId}`);

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
    const res = await fetch(`${getBaseUrl()}/items/${tempId}/images`, { method: "POST", body: formData });
    expect(res.status).toBe(400);
    await del(`/items/${tempId}`);
  });

  it("POST /items/:id/images without file field returns 400", async () => {
    const tempRes = await post("/items", { name: "NoFile", description: "no file", count: 0 });
    const tempId = (await tempRes.json() as Item).id;
    const formData = new FormData();
    formData.append("other", "not a file");
    const res = await fetch(`${getBaseUrl()}/items/${tempId}/images`, { method: "POST", body: formData });
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

    await fetch(`${getBaseUrl()}/items/${tempId}/images`, { method: "POST", body: form1 });
    await fetch(`${getBaseUrl()}/items/${tempId}/images`, { method: "POST", body: form2 });

    const listRes = await get(`/items/${tempId}/images`);
    const images = await listRes.json() as Image[];
    expect(images).toHaveLength(2);
    const names = images.map((i) => i.filename).sort();
    expect(names).toEqual(["a.png", "b.png"]);

    await del(`/items/${tempId}`);
  });
});
