export type ChangeType = "create" | "update" | "delete";
export type TargetType = "item" | "category";
export type ChangeEntry = { field: string; from: unknown; to: unknown };

export type ChangeLog = {
  id: string;
  targetId: string;
  targetType: TargetType;
  changeType: ChangeType;
  changes: ChangeEntry[] | null; // null for create/delete; array for update
  timestamp: string; // ISO 8601
};
