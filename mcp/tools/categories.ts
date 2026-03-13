import { z } from "zod";
import { BaseTool } from "../base.ts";
import { listCategories, addCategory, editCategory, deleteCategory } from "../../core/db.ts";

export class ListCategoriesTool extends BaseTool {
  name = "list_categories";
  category = "categories";
  description = "Storage: list all categories used to organize inventory items. Each category has an id and name.";
  requireUserApproval = false;
  tags = ["storage", "categories", "list"];
  whenToUse = "When you need to see all available categories or find a category ID";
  whenNotToUse = "When you already have the category ID you need";

  schema = {} as Record<string, z.ZodTypeAny>;

  async execute(_args: any) {
    return { categories: await listCategories() };
  }
}

export class CreateCategoryTool extends BaseTool {
  name = "create_category";
  category = "categories";
  description = "Storage: create a new category for organizing inventory items. Items can then be assigned to this category by setting their categoryId. Returns the created category with its generated ID.";
  requireUserApproval = false;
  tags = ["storage", "categories", "create"];
  whenToUse = "When you need to add a new category to organize items under";
  whenNotToUse = "When renaming an existing category (use update_category instead)";

  schema = {
    name: z.string().describe("Category name"),
  };

  async execute({ name }: any) {
    return addCategory({ name });
  }
}

export class UpdateCategoryTool extends BaseTool {
  name = "update_category";
  category = "categories";
  description = "Storage: rename an existing category. All items assigned to this category keep their assignment. Only the display name changes; the ID stays the same.";
  requireUserApproval = false;
  tags = ["storage", "categories", "update"];
  whenToUse = "When you need to rename a category";
  whenNotToUse = "When creating a new category (use create_category instead)";

  schema = {
    id: z.string().describe("Category ID"),
    name: z.string().describe("New category name"),
  };

  async execute({ id, name }: any) {
    const category = await editCategory(id, { name });
    if (!category) return { error: "Category not found" };
    return category;
  }
}

export class DeleteCategoryTool extends BaseTool {
  name = "delete_category";
  category = "categories";
  description = "Storage: delete a category and unlink all items assigned to it. Items are not deleted, only their category reference is removed.";
  requireUserApproval = true;
  tags = ["storage", "categories", "delete"];
  whenToUse = "When you need to permanently remove a category";
  whenNotToUse = "When you just want to rename a category (use update_category instead)";

  schema = {
    id: z.string().describe("Category ID"),
  };

  async execute({ id }: any) {
    const deleted = await deleteCategory(id);
    if (!deleted) return { error: "Category not found" };
    return { deleted: true };
  }
}
