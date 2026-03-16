import { metadata } from "../data/index.ts";
import type { Metadata } from "../models/index.ts";

export function listMetadata(itemId: string) {
  return metadata.list(itemId);
}

export function setMetadata(itemId: string, entries: Metadata[]) {
  return metadata.set(itemId, entries);
}

export function deleteMetadataKey(itemId: string, key: string) {
  return metadata.deleteKey(itemId, key);
}
