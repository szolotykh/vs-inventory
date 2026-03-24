import { categories, items, changelog } from "../data/index.ts";

export function listCategories() {
  return categories.list();
}

export async function addCategory(data: { name: string }) {
  const category = await categories.add(data);
  changelog.add({ targetId: category.id, targetType: "category", changeType: "create", changes: null });
  return category;
}

export async function editCategory(id: string, data: { name: string }) {
  const before = await categories.get(id);
  const after = await categories.edit(id, data);
  if (!after) return null;
  const changes = before && before.name !== after.name
    ? [{ field: "name", from: before.name, to: after.name }]
    : [];
  changelog.add({ targetId: id, targetType: "category", changeType: "update", changes });
  return after;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const existing = await categories.get(id);
  if (!existing) return false;
  items.unlinkCategory(id);
  await categories.delete(id);
  changelog.add({ targetId: id, targetType: "category", changeType: "delete", changes: null });
  return true;
}
