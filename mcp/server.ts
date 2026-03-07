/**
 * MCP tool definitions for the storage API.
 * Each core CRUD operation is exposed as an MCP tool with zod-validated params.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  countItems, listItems, getItem, addItem, editItem, deleteItem,
  listCategories, addCategory, editCategory, deleteCategory,
  listImages, addImage, deleteImage,
  listMetadata, setMetadata, deleteMetadataKey,
} from "../core/db.ts";

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "storage", version: "1.0.0" });

  // --- Items ---

  server.tool("list_items", "Storage: list inventory items with optional pagination, category filter, and text search. Returns a page object with items array, total count, limit, and offset. Omit limit to retrieve all items.", {
    limit: z.number().int().min(1).optional().describe("Max items to return"),
    offset: z.number().int().min(0).optional().describe("Number of items to skip"),
    categoryId: z.string().optional().describe("Filter to items in this category"),
    search: z.string().optional().describe("Search term matched against name and description (case-insensitive)"),
  }, async ({ limit, offset, categoryId, search }) => {
    const total = countItems({ categoryId, search });
    const items = await listItems({ limit, offset, categoryId, search });
    return { content: [{ type: "text", text: JSON.stringify({ items, total, limit: limit ?? null, offset: offset ?? 0 }, null, 2) }] };
  });

  server.tool("get_item", "Storage: get a single inventory item by its ID. Returns the item's name, description, count, and optional category assignment. Returns an error if the item ID does not exist.", {
    id: z.string().describe("Item ID"),
  }, ({ id }) => {
    const item = getItem(id);
    if (!item) return { content: [{ type: "text", text: "Item not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  });

  server.tool("create_item", "Storage: create a new inventory item with name, description, count, and optional category assignment. Count must be a non-negative integer. Returns the created item with its generated ID.", {
    name: z.string().describe("Item name"),
    description: z.string().describe("Item description"),
    count: z.number().int().min(0).describe("Item count"),
    categoryId: z.string().optional().describe("Category ID to assign"),
  }, async ({ name, description, count, categoryId }) => {
    const item = await addItem({ name, description, count, categoryId });
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  });

  server.tool("update_item", "Storage: update an existing inventory item's name, description, count, or category assignment. Set categoryId to null to remove the category. Only provided fields are changed; omitted fields stay the same.", {
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

  server.tool("delete_item", "Storage: delete an inventory item and its associated images and metadata. This action is permanent and cascades to all related data. Returns an error if the item ID does not exist.", {
    id: z.string().describe("Item ID"),
  }, async ({ id }) => {
    const deleted = await deleteItem(id);
    if (!deleted) return { content: [{ type: "text", text: "Item not found" }], isError: true };
    return { content: [{ type: "text", text: "Item deleted" }] };
  });

  // --- Categories ---

  server.tool("list_categories", "Storage: list all categories used to organize inventory items. Each category has an id and name. Categories group related items together for easier browsing.", {}, async () => {
    const categories = await listCategories();
    return { content: [{ type: "text", text: JSON.stringify(categories, null, 2) }] };
  });

  server.tool("create_category", "Storage: create a new category for organizing inventory items. Items can then be assigned to this category by setting their categoryId. Returns the created category with its generated ID.", {
    name: z.string().describe("Category name"),
  }, async ({ name }) => {
    const category = await addCategory({ name });
    return { content: [{ type: "text", text: JSON.stringify(category, null, 2) }] };
  });

  server.tool("update_category", "Storage: rename an existing category. All items assigned to this category keep their assignment. Only the display name is changed; the ID stays the same.", {
    id: z.string().describe("Category ID"),
    name: z.string().describe("New name"),
  }, async ({ id, name }) => {
    const category = await editCategory(id, { name });
    if (!category) return { content: [{ type: "text", text: "Category not found" }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(category, null, 2) }] };
  });

  server.tool("delete_category", "Storage: delete a category and unlink all items assigned to it. Items are not deleted, only their category reference is removed. Returns an error if the category ID does not exist.", {
    id: z.string().describe("Category ID"),
  }, async ({ id }) => {
    const deleted = await deleteCategory(id);
    if (!deleted) return { content: [{ type: "text", text: "Category not found" }], isError: true };
    return { content: [{ type: "text", text: "Category deleted" }] };
  });

  // --- Images ---

  server.tool("list_images", "Storage: list all images attached to an inventory item. Returns metadata including filename, MIME type, and size in bytes. Does not return the image binary data itself.", {
    itemId: z.string().describe("Item ID"),
  }, async ({ itemId }) => {
    const images = await listImages(itemId);
    return { content: [{ type: "text", text: JSON.stringify(images, null, 2) }] };
  });

  server.tool("upload_image", "Storage: upload an image file and attach it to an inventory item. Only image MIME types (image/*) are accepted. The file is read from the local filesystem and stored in the uploads directory.", {
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

  server.tool("delete_image", "Storage: delete an image and remove its file from disk. The image metadata is also removed from the database. Returns an error if the image ID does not exist.", {
    id: z.string().describe("Image ID"),
  }, async ({ id }) => {
    const deleted = await deleteImage(id);
    if (!deleted) return { content: [{ type: "text", text: "Image not found" }], isError: true };
    return { content: [{ type: "text", text: "Image deleted" }] };
  });

  // --- Metadata ---

  server.tool("list_metadata", "Storage: list all metadata key/value pairs for an inventory item. Metadata stores arbitrary properties like color, weight, or location. Returns an empty array if no metadata is set.", {
    itemId: z.string().describe("Item ID"),
  }, async ({ itemId }) => {
    const entries = listMetadata(itemId);
    return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
  });

  server.tool("set_metadata", "Storage: set metadata key/value pairs on an inventory item, replacing all existing metadata. Provide the full list of entries to keep. Any keys not included will be deleted.", {
    itemId: z.string().describe("Item ID"),
    entries: z.array(z.object({ key: z.string(), value: z.string() })).describe("Key/value pairs"),
  }, async ({ itemId, entries }) => {
    const result = setMetadata(itemId, entries);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("delete_metadata_key", "Storage: delete a single metadata key from an inventory item. Other metadata entries on the item are not affected. Returns an error if the key does not exist.", {
    itemId: z.string().describe("Item ID"),
    key: z.string().describe("Metadata key to delete"),
  }, async ({ itemId, key }) => {
    const deleted = deleteMetadataKey(itemId, key);
    if (!deleted) return { content: [{ type: "text", text: "Key not found" }], isError: true };
    return { content: [{ type: "text", text: "Key deleted" }] };
  });

  return server;
}
