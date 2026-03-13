import { z } from "zod";
import { BaseTool } from "../base.ts";
import { listMetadata, setMetadata, deleteMetadataKey } from "../../core/db.ts";

export class ListMetadataTool extends BaseTool {
  name = "list_metadata";
  category = "metadata";
  description = "Storage: list all metadata key/value pairs for an inventory item. Metadata stores arbitrary properties like color, weight, or location. Returns an empty array if no metadata is set.";
  requireUserApproval = false;
  tags = ["storage", "metadata", "list"];
  whenToUse = "When you need to read the custom properties attached to an item";
  whenNotToUse = "When you want to modify metadata (use set_metadata or delete_metadata_key instead)";

  schema = {
    itemId: z.string().describe("Item ID"),
  };

  execute({ itemId }: any) {
    return Promise.resolve({ entries: listMetadata(itemId) });
  }
}

export class SetMetadataTool extends BaseTool {
  name = "set_metadata";
  category = "metadata";
  description = "Storage: set metadata key/value pairs on an inventory item, replacing all existing metadata. Provide the full list of entries to keep. Any keys not included will be deleted.";
  requireUserApproval = false;
  tags = ["storage", "metadata", "set"];
  whenToUse = "When you need to replace all metadata on an item with a new set of key/value pairs";
  whenNotToUse = "When removing only a single key (use delete_metadata_key to avoid overwriting others)";

  schema = {
    itemId: z.string().describe("Item ID"),
    entries: z.array(
      z.object({ key: z.string(), value: z.string() })
    ).describe("Full list of key/value pairs to set (replaces all existing metadata)"),
  };

  execute({ itemId, entries }: any) {
    return Promise.resolve({ entries: setMetadata(itemId, entries) });
  }
}

export class DeleteMetadataKeyTool extends BaseTool {
  name = "delete_metadata_key";
  category = "metadata";
  description = "Storage: delete a single metadata key from an inventory item. Other metadata entries on the item are not affected.";
  requireUserApproval = false;
  tags = ["storage", "metadata", "delete"];
  whenToUse = "When you need to remove one specific metadata key without affecting others";
  whenNotToUse = "When replacing all metadata at once (use set_metadata instead)";

  schema = {
    itemId: z.string().describe("Item ID"),
    key: z.string().describe("Metadata key to delete"),
  };

  execute({ itemId, key }: any) {
    const deleted = deleteMetadataKey(itemId, key);
    if (!deleted) return Promise.resolve({ error: "Key not found" });
    return Promise.resolve({ deleted: true });
  }
}
