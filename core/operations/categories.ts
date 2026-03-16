import { categories, items } from "../data/index.ts";

export function listCategories() {
  return categories.list();
}

export function addCategory(data: { name: string }) {
  return categories.add(data);
}

export function editCategory(id: string, data: { name: string }) {
  return categories.edit(id, data);
}

export async function deleteCategory(id: string): Promise<boolean> {
  const existing = await categories.get(id);
  if (!existing) return false;
  items.unlinkCategory(id);
  await categories.delete(id);
  return true;
}
