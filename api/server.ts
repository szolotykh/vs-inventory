import {
  countItems, listItems, getItem, addItem, editItem, deleteItem,
  listCategories, addCategory, editCategory, deleteCategory,
  listImages, addImage, loadImageFile, deleteImage,
  listMetadata, setMetadata, deleteMetadataKey,
} from "../core/operations/index.ts";
import type { Metadata } from "../core/models/index.ts";
import { config } from "../core/config.ts";

function checkAuth(req: Request): Response | null {
  if (!config.enableAuth) return null;
  const auth = req.headers.get("Authorization");
  if (auth === `Bearer ${config.apiKey}`) return null;
  return new Response("Unauthorized", { status: 401 });
}

async function handler(req: Request): Promise<Response> {
  const authError = checkAuth(req);
  if (authError) return authError;
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\//, "").split("/");
  const seg0 = parts[0];
  const seg1 = parts[1];
  const seg2 = parts[2];
  const seg3 = parts[3];

  if (seg0 === "health") {
    return Response.json({ status: "ok" });
  }

  try {
    // /items
    if (seg0 === "items") {
      if (seg1 === undefined || seg1 === "") {
        if (req.method === "GET") {
          const limitParam = url.searchParams.get("limit");
          const offsetParam = url.searchParams.get("offset");
          const $filter = url.searchParams.get("$filter") ?? undefined;
          const limit = limitParam !== null ? parseInt(limitParam, 10) : undefined;
          const offset = offsetParam !== null ? parseInt(offsetParam, 10) : undefined;
          if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
            return new Response("limit must be a positive integer", { status: 400 });
          }
          if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
            return new Response("offset must be a non-negative integer", { status: 400 });
          }
          try {
            const total = countItems($filter);
            const result = await listItems({ limit, offset, $filter });
            return Response.json({ items: result, total, limit: limit ?? null, offset: offset ?? 0 });
          } catch (e) {
            return new Response(`Invalid $filter: ${e instanceof Error ? e.message : e}`, { status: 400 });
          }
        }
        if (req.method === "POST") {
          const body = await req.json() as { name: string; description: string; count: number; categoryId?: string };
          if (!Number.isInteger(body.count) || body.count < 0) {
            return new Response("count must be an integer >= 0", { status: 400 });
          }
          const item = await addItem({ name: body.name, description: body.description, count: body.count, categoryId: body.categoryId });
          return Response.json(item, { status: 201 });
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      const id = seg1;

      // /items/:id/images
      if (seg2 === "images") {
        // /items/:id/images/:imageId
        if (seg3) {
          if (req.method === "GET") {
            const images = await listImages(id);
            const image = images.find((img) => img.id === seg3);
            if (!image) return new Response("Not Found", { status: 404 });
            const data = await loadImageFile(seg3);
            return new Response(data, {
              headers: { "Content-Type": image.mimeType, "Content-Disposition": `inline; filename="${image.filename}"` },
            });
          }
          if (req.method === "DELETE") {
            const deleted = await deleteImage(seg3);
            if (!deleted) return new Response("Not Found", { status: 404 });
            return new Response(null, { status: 204 });
          }
          return new Response("Method Not Allowed", { status: 405 });
        }

        // /items/:id/images
        if (req.method === "GET") {
          return Response.json(await listImages(id));
        }
        if (req.method === "POST") {
          const formData = await req.formData();
          const file = formData.get("file");
          if (!(file instanceof File)) return new Response("Missing file field", { status: 400 });
          if (!file.type.startsWith("image/")) return new Response("File must be an image", { status: 400 });
          const buffer = Buffer.from(await file.arrayBuffer());
          const image = await addImage({ itemId: id, filename: file.name, mimeType: file.type }, buffer);
          return Response.json(image, { status: 201 });
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      // /items/:id/metadata
      if (seg2 === "metadata") {
        // /items/:id/metadata/:key
        if (seg3) {
          if (req.method === "DELETE") {
            const deleted = deleteMetadataKey(id, seg3);
            if (!deleted) return new Response("Not Found", { status: 404 });
            return new Response(null, { status: 204 });
          }
          return new Response("Method Not Allowed", { status: 405 });
        }

        // /items/:id/metadata
        if (req.method === "GET") {
          return Response.json(listMetadata(id));
        }
        if (req.method === "PUT") {
          const body = await req.json() as Metadata[];
          const result = setMetadata(id, body);
          return Response.json(result);
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      if (req.method === "GET") {
        const item = getItem(id);
        if (item === null) return new Response("Not Found", { status: 404 });
        return Response.json(item);
      }
      if (req.method === "PUT") {
        const body = await req.json() as { name?: string; description?: string; count?: number; categoryId?: string | null };
        if (body.count !== undefined && (!Number.isInteger(body.count) || body.count < 0)) {
          return new Response("count must be an integer >= 0", { status: 400 });
        }
        const item = await editItem(id, body);
        if (item === null) return new Response("Not Found", { status: 404 });
        return Response.json(item);
      }
      if (req.method === "DELETE") {
        const deleted = await deleteItem(id);
        if (!deleted) return new Response("Not Found", { status: 404 });
        return new Response(null, { status: 204 });
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    // /categories
    if (seg0 === "categories") {
      if (seg1 === undefined || seg1 === "") {
        if (req.method === "GET") {
          return Response.json(await listCategories());
        }
        if (req.method === "POST") {
          const body = await req.json() as { name: string };
          const category = await addCategory({ name: body.name });
          return Response.json(category, { status: 201 });
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      const id = seg1;
      if (req.method === "PUT") {
        const body = await req.json() as { name: string };
        const category = await editCategory(id, { name: body.name });
        if (category === null) return new Response("Not Found", { status: 404 });
        return Response.json(category);
      }
      if (req.method === "DELETE") {
        const deleted = await deleteCategory(id);
        if (!deleted) return new Response("Not Found", { status: 404 });
        return new Response(null, { status: 204 });
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    return new Response("Not Found", { status: 404 });
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
}

export function createServer(port: number) {
  const tls = config.tlsCert && config.tlsKey
    ? { cert: Bun.file(config.tlsCert), key: Bun.file(config.tlsKey) }
    : undefined;
  return Bun.serve({ port, tls, fetch: handler });
}
