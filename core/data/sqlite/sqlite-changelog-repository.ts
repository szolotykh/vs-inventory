// core/data/sqlite/changelog-repository.ts — SQLite implementation of IChangeLogRepository.
import { getDB } from "./db.ts";
import type { IChangeLogRepository } from "../types.ts";
import type { ChangeLog, ChangeType, TargetType } from "../../models/index.ts";

type Row = { id: string; targetId: string; targetType: string; changeType: string; changes: string | null; timestamp: string };

function rowToChangeLog(row: Row): ChangeLog {
  return {
    id: row.id,
    targetId: row.targetId,
    targetType: row.targetType as TargetType,
    changeType: row.changeType as ChangeType,
    changes: row.changes !== null ? JSON.parse(row.changes) : null,
    timestamp: row.timestamp,
  };
}

function buildWhere(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType }) {
  const conditions: string[] = [];
  const params: string[] = [];
  if (opts?.targetType) { conditions.push("targetType = ?"); params.push(opts.targetType); }
  if (opts?.targetId) { conditions.push("targetId = ?"); params.push(opts.targetId); }
  if (opts?.changeType) { conditions.push("changeType = ?"); params.push(opts.changeType); }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

export class SqliteChangeLogRepository implements IChangeLogRepository {
  count(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType }): number {
    const { where, params } = buildWhere(opts);
    return (getDB().query(`SELECT COUNT(*) as n FROM changelogs ${where}`).get(...params) as { n: number }).n;
  }

  list(opts?: { targetType?: TargetType; targetId?: string; changeType?: ChangeType; limit?: number; offset?: number }): ChangeLog[] {
    const { where, params } = buildWhere(opts);
    const offset = opts?.offset ?? 0;
    const db = getDB();
    let rows: Row[];
    if (opts?.limit !== undefined) {
      rows = db.query(`SELECT * FROM changelogs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, opts.limit, offset) as Row[];
    } else if (offset > 0) {
      rows = db.query(`SELECT * FROM changelogs ${where} ORDER BY timestamp DESC LIMIT -1 OFFSET ?`).all(...params, offset) as Row[];
    } else if (where) {
      rows = db.query(`SELECT * FROM changelogs ${where} ORDER BY timestamp DESC`).all(...params) as Row[];
    } else {
      rows = db.query("SELECT * FROM changelogs ORDER BY timestamp DESC").all() as Row[];
    }
    return rows.map(rowToChangeLog);
  }

  get(id: string): ChangeLog | null {
    const row = getDB().query("SELECT * FROM changelogs WHERE id = ?").get(id) as Row | null;
    return row ? rowToChangeLog(row) : null;
  }

  async add(data: Omit<ChangeLog, "id" | "timestamp">): Promise<ChangeLog> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const changes = data.changes !== null ? JSON.stringify(data.changes) : null;
    getDB().run(
      "INSERT INTO changelogs (id, targetId, targetType, changeType, changes, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [id, data.targetId, data.targetType, data.changeType, changes, timestamp],
    );
    return { id, ...data, timestamp };
  }
}
