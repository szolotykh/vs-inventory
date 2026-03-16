import { z } from "zod";
import { BaseTool } from "../base.ts";
import { listImages, addImage, deleteImage } from "../../core/operations/images.ts";

export class ListImagesTool extends BaseTool {
  name = "list_images";
  category = "images";
  description = "Storage: list all images attached to an inventory item. Returns metadata including filename, MIME type, and size in bytes. Does not return image binary data.";
  requireUserApproval = false;
  tags = ["storage", "images", "list"];
  whenToUse = "When you need to see what images are attached to an item";
  whenNotToUse = "When you need the actual image binary data (use the REST API GET /items/:id/images/:imageId instead)";

  schema = {
    itemId: z.string().describe("Item ID"),
  };

  async execute({ itemId }: any) {
    return { images: await listImages(itemId) };
  }
}

export class UploadImageTool extends BaseTool {
  name = "upload_image";
  category = "images";
  description = "Storage: upload an image file from the local filesystem and attach it to an inventory item. Only image MIME types (image/*) are accepted.";
  requireUserApproval = false;
  tags = ["storage", "images", "upload"];
  whenToUse = "When you need to attach an image file from disk to an inventory item";
  whenNotToUse = "When the image is not a valid image MIME type or does not exist on disk";

  schema = {
    itemId: z.string().describe("Item ID to associate the image with"),
    filePath: z.string().describe("Absolute or relative path to the image file"),
  };

  async execute({ itemId, filePath }: any) {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return { error: "File not found" };
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = filePath.split(/[/\\]/).pop() ?? filePath;
    return addImage({ itemId, filename, mimeType: file.type }, buffer);
  }
}

export class DeleteImageTool extends BaseTool {
  name = "delete_image";
  category = "images";
  description = "Storage: delete an image and remove its file from disk. The image metadata is also removed from the database.";
  requireUserApproval = true;
  tags = ["storage", "images", "delete"];
  whenToUse = "When you need to permanently remove an image from an item";
  whenNotToUse = "When you just want to list images (use list_images instead)";

  schema = {
    id: z.string().describe("Image ID"),
  };

  async execute({ id }: any) {
    const deleted = await deleteImage(id);
    if (!deleted) return { error: "Image not found" };
    return { deleted: true };
  }
}
