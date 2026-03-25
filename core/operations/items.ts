import { items, images, metadata, changelog } from "../data/index.ts";
import type { Item, ChangeEntry } from "../models/index.ts";
import { validate } from "../validators/index.ts";
import { itemCreateSchema, itemUpdateSchema } from "../models/item.ts";

function computeItemDiff(before: Item, after: Item): ChangeEntry[] {
  const changes: ChangeEntry[] = [];
  const fields = ["name", "description", "count", "categoryId"] as const;
  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

export function countItems($filter?: string) {
  return items.count($filter);
}

export function listItems(opts?: { limit?: number; offset?: number; $filter?: string }) {
  return items.list(opts);
}

export function getItem(id: string) {
  return items.get(id);
}

export async function addItem(data: { name: string; description: string; count: number; categoryId?: string }) {
  validate(itemCreateSchema, data as Record<string, unknown>);
  const item = await items.add(data);
  changelog.add({ targetId: item.id, targetType: "item", changeType: "create", changes: null });
  return item;
}

export async function editItem(id: string, data: { name?: string; description?: string; count?: number; categoryId?: string | null }) {
  validate(itemUpdateSchema, data as Record<string, unknown>);
  const before = items.get(id);
  const after = await items.edit(id, data);
  if (!after) return null;
  const changes = computeItemDiff(before!, after);
  changelog.add({ targetId: id, targetType: "item", changeType: "update", changes });
  return after;
}

export async function deleteItem(id: string): Promise<boolean> {
  const deleted = await items.delete(id);
  if (!deleted) return false;
  changelog.add({ targetId: id, targetType: "item", changeType: "delete", changes: null });
  await images.deleteByItemId(id);
  metadata.deleteByItemId(id);
  return true;
}
