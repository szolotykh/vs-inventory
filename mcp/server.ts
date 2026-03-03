/**
 * MCP tool definitions for the storage API.
 * Each core CRUD operation is exposed as an MCP tool with zod-validated params.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  listItems, addItem, editItem, deleteItem,
  listCategories, addCategory, editCategory, deleteCategory,
  listImages, addImage, deleteImage,
  listMetadata, setMetadata, deleteMetadataKey,
} from "../core/db.ts";

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "storage", version: "1.0.0" });

  // --- Items ---

  server.tool("list_items", "List all items", {}, async () => {
    const items = await listItems();
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  });

  server.tool("create_item", "Create a new item", {
    name: z.string().describe("Item name"),
    description: z.string().describe("Item description"),
    count: z.number().int().min(0).describe("Item count"),
    categoryId: z.string().optional().describe("Category ID to assign"),
  }, async ({ name, description, count, categoryId }) => {
    const item = await addItem({ name, description, count, categoryId });
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  });

  server.tool("update_item", "Update an existing item", {
    id: z.string().describe("Item ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    count: z.number().int().min(0).optional().describe("New count"),
    categoryId: z.string().nullable().optional().describe("Category ID (null to remove)"),
  }, async ({ id, ...data }) => {
    const item = await editItem(id, data);
    if (!item) return { content: [{ type: "text", text: "Item not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  });

  server.tool("delete_item", "Delete an item", {
    id: z.string().describe("Item ID"),
  }, async ({ id }) => {
    const deleted = await deleteItem(id);
    if (!deleted) return { content: [{ type: "text", text: "Item not found" }], isError: true };
    return { content: [{ type: "text", text: "Item deleted" }] };
  });

  // --- Categories ---

  server.tool("list_categories", "List all categories", {}, async () => {
    const categories = await listCategories();
    return { content: [{ type: "text", text: JSON.stringify(categories, null, 2) }] };
  });

  server.tool("create_category", "Create a new category", {
    name: z.string().describe("Category name"),
  }, async ({ name }) => {
    const category = await addCategory({ name });
    return { content: [{ type: "text", text: JSON.stringify(category, null, 2) }] };
  });

  server.tool("update_category", "Rename a category", {
    id: z.string().describe("Category ID"),
    name: z.string().describe("New name"),
  }, async ({ id, name }) => {
    const category = await editCategory(id, { name });
    if (!category) return { content: [{ type: "text", text: "Category not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(category, null, 2) }] };
  });

  server.tool("delete_category", "Delete a category (unlinks all items)", {
    id: z.string().describe("Category ID"),
  }, async ({ id }) => {
    const deleted = await deleteCategory(id);
    if (!deleted) return { content: [{ type: "text", text: "Category not found" }], isError: true };
    return { content: [{ type: "text", text: "Category deleted" }] };
  });

  // --- Images ---

  server.tool("list_images", "List images for an item", {
    itemId: z.string().describe("Item ID"),
  }, async ({ itemId }) => {
    const images = await listImages(itemId);
    return { content: [{ type: "text", text: JSON.stringify(images, null, 2) }] };
  });

  server.tool("upload_image", "Upload an image from a local file path", {
    itemId: z.string().describe("Item ID to associate the image with"),
    filePath: z.string().describe("Absolute or relative path to the image file"),
  }, async ({ itemId, filePath }) => {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return { content: [{ type: "text", text: "File not found" }], isError: true };
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = filePath.split(/[/\\]/).pop() ?? filePath;
    const image = await addImage({ itemId, filename, mimeType: file.type }, buffer);
    return { content: [{ type: "text", text: JSON.stringify(image, null, 2) }] };
  });

  server.tool("delete_image", "Delete an image", {
    id: z.string().describe("Image ID"),
  }, async ({ id }) => {
    const deleted = await deleteImage(id);
    if (!deleted) return { content: [{ type: "text", text: "Image not found" }], isError: true };
    return { content: [{ type: "text", text: "Image deleted" }] };
  });

  // --- Metadata ---

  server.tool("list_metadata", "List metadata key/value pairs for an item", {
    itemId: z.string().describe("Item ID"),
  }, async ({ itemId }) => {
    const entries = listMetadata(itemId);
    return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
  });

  server.tool("set_metadata", "Set metadata key/value pairs for an item (replaces all)", {
    itemId: z.string().describe("Item ID"),
    entries: z.array(z.object({ key: z.string(), value: z.string() })).describe("Key/value pairs"),
  }, async ({ itemId, entries }) => {
    const result = setMetadata(itemId, entries);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_metadata_key", "Delete a single metadata key from an item", {
    itemId: z.string().describe("Item ID"),
    key: z.string().describe("Metadata key to delete"),
  }, async ({ itemId, key }) => {
    const deleted = deleteMetadataKey(itemId, key);
    if (!deleted) return { content: [{ type: "text", text: "Key not found" }], isError: true };
    return { content: [{ type: "text", text: "Key deleted" }] };
  });

  return server;
}
