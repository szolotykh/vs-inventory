import { z } from "zod";
import { BaseTool } from "../base.ts";
import { countItems, listItems, getItem, addItem, editItem, deleteItem } from "../../core/db.ts";

export class ListItemsTool extends BaseTool {
  name = "list_items";
  category = "items";
  description = "Storage: list inventory items with optional pagination, category filter, and text search. Returns a page object with items array, total count, limit, and offset. Omit limit to retrieve all items.";
  requireUserApproval = false;
  tags = ["storage", "items", "list", "search"];
  whenToUse = "When you need to browse, filter, or search inventory items";
  whenNotToUse = "When you know the specific item ID (use get_item instead)";

  schema = {
    limit: z.number().int().min(1).optional().describe("Max items to return"),
    offset: z.number().int().min(0).optional().describe("Number of items to skip"),
    categoryId: z.string().optional().describe("Filter to items in this category"),
    search: z.string().optional().describe("Search term matched against name and description (case-insensitive)"),
  };

  async execute({ limit, offset, categoryId, search }: any) {
    const total = countItems({ categoryId, search });
    const items = await listItems({ limit, offset, categoryId, search });
    return { items, total, limit: limit ?? null, offset: offset ?? 0 };
  }
}

export class GetItemTool extends BaseTool {
  name = "get_item";
  category = "items";
  description = "Storage: get a single inventory item by its ID. Returns the item's name, description, count, and optional category assignment.";
  requireUserApproval = false;
  tags = ["storage", "items", "get"];
  whenToUse = "When you have a specific item ID and need its details";
  whenNotToUse = "When you need to search or filter multiple items (use list_items instead)";

  schema = {
    id: z.string().describe("Item ID"),
  };

  execute({ id }: any) {
    const item = getItem(id);
    if (!item) return Promise.resolve({ error: "Item not found" });
    return Promise.resolve(item);
  }
}

export class CreateItemTool extends BaseTool {
  name = "create_item";
  category = "items";
  description = "Storage: create a new inventory item with name, description, count, and optional category assignment. Count must be a non-negative integer. Returns the created item with its generated ID.";
  requireUserApproval = false;
  tags = ["storage", "items", "create"];
  whenToUse = "When you need to add a new item to the inventory";
  whenNotToUse = "When updating an existing item (use update_item instead)";

  schema = {
    name: z.string().describe("Item name"),
    description: z.string().describe("Item description"),
    count: z.number().int().min(0).describe("Item count (non-negative integer)"),
    categoryId: z.string().optional().describe("Category ID to assign"),
  };

  async execute({ name, description, count, categoryId }: any) {
    return addItem({ name, description, count, categoryId });
  }
}

export class UpdateItemTool extends BaseTool {
  name = "update_item";
  category = "items";
  description = "Storage: update an existing inventory item's name, description, count, or category assignment. Set categoryId to null to remove the category. Only provided fields are changed; omitted fields stay the same.";
  requireUserApproval = false;
  tags = ["storage", "items", "update"];
  whenToUse = "When you need to modify one or more fields on an existing item";
  whenNotToUse = "When creating a new item (use create_item instead)";

  schema = {
    id: z.string().describe("Item ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    count: z.number().int().min(0).optional().describe("New count"),
    categoryId: z.string().nullable().optional().describe("Category ID, or null to remove"),
  };

  async execute({ id, ...data }: any) {
    const item = await editItem(id, data);
    if (!item) return { error: "Item not found" };
    return item;
  }
}

export class DeleteItemTool extends BaseTool {
  name = "delete_item";
  category = "items";
  description = "Storage: delete an inventory item and its associated images and metadata. This action is permanent and cascades to all related data.";
  requireUserApproval = true;
  tags = ["storage", "items", "delete"];
  whenToUse = "When you need to permanently remove an item from the inventory";
  whenNotToUse = "When you just want to update or clear fields on an item (use update_item instead)";

  schema = {
    id: z.string().describe("Item ID"),
  };

  async execute({ id }: any) {
    const deleted = await deleteItem(id);
    if (!deleted) return { error: "Item not found" };
    return { deleted: true };
  }
}
