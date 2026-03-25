// -------------------------------------------------------
// memory-changelog-repository.ts
// MemoryChangeLogRepository — In-memory implementation of IChangeLogRepository (used by tests).
// -------------------------------------------------------

import type { IChangeLogRepository } from "../types.ts";
import type { ChangeLog, ChangeType, TargetType } from "../../models/index.ts";

export class MemoryChangeLogRepository implements IChangeLogRepository {
  private store: ChangeLog[] = [];

  reset() { this.store = []; }

  count(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType }): number {
    return this.applyFilter(opts).length;
  }

  list(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType; limit?: number; offset?: number }): ChangeLog[] {
    let results = this.applyFilter(opts).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const offset = opts?.offset ?? 0;
    if (offset > 0) results = results.slice(offset);
    if (opts?.limit !== undefined) results = results.slice(0, opts.limit);
    return results;
  }

  get(id: string): ChangeLog | null {
    return this.store.find((c) => c.id === id) ?? null;
  }

  async add(data: Omit<ChangeLog, "id" | "timestamp">): Promise<ChangeLog> {
    const log: ChangeLog = { id: crypto.randomUUID(), ...data, timestamp: new Date().toISOString() };
    this.store.push(log);
    return log;
  }

  private applyFilter(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType }): ChangeLog[] {
    return this.store.filter((c) => {
      if (opts?.targetType && c.targetType !== opts.targetType) return false;
      if (opts?.targetId && c.targetId !== opts.targetId) return false;
      if (opts?.changeType && c.changeType !== opts.changeType) return false;
      return true;
    });
  }
}
