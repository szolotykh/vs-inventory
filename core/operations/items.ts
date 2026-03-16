import { items, images, metadata } from "../data/index.ts";

export function countItems($filter?: string) {
  return items.count($filter);
}

export function listItems(opts?: { limit?: number; offset?: number; $filter?: string }) {
  return items.list(opts);
}

export function getItem(id: string) {
  return items.get(id);
}

export function addItem(data: { name: string; description: string; count: number; categoryId?: string }) {
  return items.add(data);
}

export function editItem(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }) {
  return items.edit(id, data);
}

export async function deleteItem(id: string): Promise<boolean> {
  const deleted = await items.delete(id);
  if (!deleted) return false;
  await images.deleteByItemId(id);
  metadata.deleteByItemId(id);
  return true;
}
