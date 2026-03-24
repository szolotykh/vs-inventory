import { z } from "zod";
import { BaseTool } from "../base.ts";
import { countChangeLogs, listChangeLogs, getChangeLog } from "../../core/operations/changelog.ts";

export class ListChangeLogsTool extends BaseTool {
  name = "list_change_logs";
  category = "changelog";
  description = "Storage: list change log entries tracking create/update/delete operations on items and categories. Supports filtering by target type, target ID, and change type with optional pagination. Returns entries sorted newest-first.";
  requireUserApproval = false;
  tags = ["storage", "changelog", "audit", "history"];
  whenToUse = "When you need to review change history or audit operations on items or categories";
  whenNotToUse = "When you need a specific log entry by ID (use get_change_log instead)";

  schema = {
    targetType: z.enum(["item", "category"]).optional().describe("Filter by target type"),
    targetId: z.string().optional().describe("Filter by the ID of the changed object"),
    changeType: z.enum(["create", "update", "delete"]).optional().describe("Filter by change type"),
    limit: z.number().int().min(1).optional().describe("Max entries to return"),
    offset: z.number().int().min(0).optional().describe("Number of entries to skip"),
  };

  execute({ targetType, targetId, changeType, limit, offset }: any) {
    const opts = { targetType, targetId, changeType, limit, offset };
    const total = countChangeLogs(opts);
    const changelogs = listChangeLogs(opts);
    return Promise.resolve({ changelogs, total, limit: limit ?? null, offset: offset ?? 0 });
  }
}

export class GetChangeLogTool extends BaseTool {
  name = "get_change_log";
  category = "changelog";
  description = "Storage: get a single change log entry by its ID. Returns the full record including target info, change type, field-level diff, and timestamp.";
  requireUserApproval = false;
  tags = ["storage", "changelog", "audit"];
  whenToUse = "When you have a specific change log ID and need its full details";
  whenNotToUse = "When you need to search or filter multiple entries (use list_change_logs instead)";

  schema = {
    id: z.string().describe("Change log entry ID"),
  };

  execute({ id }: any) {
    const log = getChangeLog(id);
    if (!log) return Promise.resolve({ error: "Change log entry not found" });
    return Promise.resolve(log);
  }
}
