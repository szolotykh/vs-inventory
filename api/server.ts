import { listItems, addItem, editItem, deleteItem, listCategories, addCategory, editCategory, deleteCategory } from "../core/db.ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\//, "").split("/");
  const seg0 = parts[0];
  const seg1 = parts[1];

  try {
    // /items
    if (seg0 === "items") {
      if (seg1 === undefined || seg1 === "") {
        if (req.method === "GET") {
          return Response.json(await listItems());
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
  return Bun.serve({ port, fetch: handler });
}
