import { changelog } from "../data/index.ts";
import type { ChangeType, TargetType } from "../models/index.ts";

export function countChangeLogs(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType }) {
  return changelog.count(opts);
}

export function listChangeLogs(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType; limit?: number; offset?: number }) {
  return changelog.list(opts);
}

export function getChangeLog(id: string) {
  return changelog.get(id);
}
