import { images } from "../data/index.ts";

export function listImages(itemId: string) {
  return images.list(itemId);
}

export function getImage(id: string) {
  return images.get(id);
}

export function addImage(data: { itemId: string; filename: string; mimeType: string }, fileData: Buffer) {
  return images.add(data, fileData);
}

export function loadImageFile(id: string) {
  return images.loadFile(id);
}

export function deleteImage(id: string) {
  return images.delete(id);
}
