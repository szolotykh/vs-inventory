import { describe, expect, test } from "bun:test";
import { parseODataFilter, evaluateFilter, toSqlWhere } from "../core/data/odata.ts";
import type { FilterNode } from "../core/data/odata.ts";

// ─── parseODataFilter ─────────────────────────────────────────────────────────

describe("parseODataFilter", () => {
  test("simple eq string", () => {
    const node = parseODataFilter("name eq 'foo'");
    expect(node).toEqual({ kind: "comparison", field: "name", op: "eq", value: "foo" });
  });

  test("simple eq number", () => {
    const node = parseODataFilter("count eq 5");
    expect(node).toEqual({ kind: "comparison", field: "count", op: "eq", value: 5 });
  });

  test("eq null", () => {
    const node = parseODataFilter("categoryId eq null");
    expect(node).toEqual({ kind: "comparison", field: "categoryId", op: "eq", value: null });
  });

  test("eq true / false", () => {
    expect(parseODataFilter("active eq true")).toEqual({ kind: "comparison", field: "active", op: "eq", value: true });
    expect(parseODataFilter("active eq false")).toEqual({ kind: "comparison", field: "active", op: "eq", value: false });
  });

  test("ne operator", () => {
    const node = parseODataFilter("status ne 'deleted'");
    expect(node).toEqual({ kind: "comparison", field: "status", op: "ne", value: "deleted" });
  });

  test("numeric operators gt ge lt le", () => {
    expect(parseODataFilter("count gt 3")).toMatchObject({ op: "gt", value: 3 });
    expect(parseODataFilter("count ge 3")).toMatchObject({ op: "ge", value: 3 });
    expect(parseODataFilter("count lt 3")).toMatchObject({ op: "lt", value: 3 });
    expect(parseODataFilter("count le 3")).toMatchObject({ op: "le", value: 3 });
  });

  test("and expression", () => {
    const node = parseODataFilter("count gt 1 and count lt 10");
    expect(node).toEqual({
      kind: "logical",
      op: "and",
      left: { kind: "comparison", field: "count", op: "gt", value: 1 },
      right: { kind: "comparison", field: "count", op: "lt", value: 10 },
    });
  });

  test("or expression", () => {
    const node = parseODataFilter("name eq 'a' or name eq 'b'");
    expect(node).toEqual({
      kind: "logical",
      op: "or",
      left: { kind: "comparison", field: "name", op: "eq", value: "a" },
      right: { kind: "comparison", field: "name", op: "eq", value: "b" },
    });
  });

  test("and binds tighter than or", () => {
    // a or b and c  →  a or (b and c)
    const node = parseODataFilter("x eq 1 or y eq 2 and z eq 3") as FilterNode & { kind: "logical" };
    expect(node.kind).toBe("logical");
    expect(node.op).toBe("or");
    expect(node.left).toMatchObject({ op: "eq", value: 1 });
    const right = node.right as FilterNode & { kind: "logical" };
    expect(right.op).toBe("and");
  });

  test("parentheses override precedence", () => {
    // (a or b) and c
    const node = parseODataFilter("(x eq 1 or y eq 2) and z eq 3") as FilterNode & { kind: "logical" };
    expect(node.op).toBe("and");
    const left = node.left as FilterNode & { kind: "logical" };
    expect(left.op).toBe("or");
  });

  test("float value", () => {
    const node = parseODataFilter("price lt 9.99");
    expect(node).toMatchObject({ op: "lt", value: 9.99 });
  });

  test("trims surrounding whitespace", () => {
    expect(() => parseODataFilter("  name eq 'x'  ")).not.toThrow();
  });

  test("throws on unterminated string", () => {
    expect(() => parseODataFilter("name eq 'foo")).toThrow("Unterminated string literal");
  });

  test("throws on unexpected character", () => {
    expect(() => parseODataFilter("name eq @foo")).toThrow();
  });

  test("throws on missing operator", () => {
    expect(() => parseODataFilter("name 'foo'")).toThrow();
  });

  test("throws on keyword used as field", () => {
    expect(() => parseODataFilter("eq eq 'foo'")).toThrow();
  });

  test("throws on trailing tokens", () => {
    expect(() => parseODataFilter("name eq 'foo' extra")).toThrow();
  });
});

// ─── evaluateFilter ───────────────────────────────────────────────────────────

describe("evaluateFilter", () => {
  const item = { name: "Widget", count: 5, categoryId: "cat1" };

  test("eq string match", () => {
    expect(evaluateFilter(item, parseODataFilter("name eq 'Widget'"))).toBe(true);
  });

  test("eq string no match", () => {
    expect(evaluateFilter(item, parseODataFilter("name eq 'Other'"))).toBe(false);
  });

  test("eq number match", () => {
    expect(evaluateFilter(item, parseODataFilter("count eq 5"))).toBe(true);
  });

  test("ne string", () => {
    expect(evaluateFilter(item, parseODataFilter("name ne 'Other'"))).toBe(true);
    expect(evaluateFilter(item, parseODataFilter("name ne 'Widget'"))).toBe(false);
  });

  test("eq null — field absent", () => {
    const rec = { name: "X" };
    expect(evaluateFilter(rec, parseODataFilter("categoryId eq null"))).toBe(true);
  });

  test("eq null — field present", () => {
    expect(evaluateFilter(item, parseODataFilter("categoryId eq null"))).toBe(false);
  });

  test("ne null — field present", () => {
    expect(evaluateFilter(item, parseODataFilter("categoryId ne null"))).toBe(true);
  });

  test("ne null — field absent", () => {
    expect(evaluateFilter({ name: "X" }, parseODataFilter("categoryId ne null"))).toBe(false);
  });

  test("gt / ge / lt / le", () => {
    expect(evaluateFilter(item, parseODataFilter("count gt 4"))).toBe(true);
    expect(evaluateFilter(item, parseODataFilter("count gt 5"))).toBe(false);
    expect(evaluateFilter(item, parseODataFilter("count ge 5"))).toBe(true);
    expect(evaluateFilter(item, parseODataFilter("count lt 6"))).toBe(true);
    expect(evaluateFilter(item, parseODataFilter("count lt 5"))).toBe(false);
    expect(evaluateFilter(item, parseODataFilter("count le 5"))).toBe(true);
  });

  test("numeric compare on non-number returns false", () => {
    expect(evaluateFilter(item, parseODataFilter("name gt 3"))).toBe(false);
  });

  test("and — both true", () => {
    expect(evaluateFilter(item, parseODataFilter("count gt 4 and name eq 'Widget'"))).toBe(true);
  });

  test("and — one false", () => {
    expect(evaluateFilter(item, parseODataFilter("count gt 4 and name eq 'Other'"))).toBe(false);
  });

  test("or — one true", () => {
    expect(evaluateFilter(item, parseODataFilter("count gt 100 or name eq 'Widget'"))).toBe(true);
  });

  test("or — both false", () => {
    expect(evaluateFilter(item, parseODataFilter("count gt 100 or name eq 'Other'"))).toBe(false);
  });

  test("nested parens", () => {
    expect(evaluateFilter(item, parseODataFilter("(count gt 4 and name eq 'Widget') or categoryId eq 'x'"))).toBe(true);
  });
});

// ─── toSqlWhere ───────────────────────────────────────────────────────────────

describe("toSqlWhere", () => {
  test("eq string", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("name eq 'foo'"));
    expect(clause).toBe("name = ?");
    expect(params).toEqual(["foo"]);
  });

  test("eq number", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("count eq 5"));
    expect(clause).toBe("count = ?");
    expect(params).toEqual([5]);
  });

  test("eq null → IS NULL", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("categoryId eq null"));
    expect(clause).toBe("categoryId IS NULL");
    expect(params).toEqual([]);
  });

  test("ne null → IS NOT NULL", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("categoryId ne null"));
    expect(clause).toBe("categoryId IS NOT NULL");
    expect(params).toEqual([]);
  });

  test("ne string", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("status ne 'deleted'"));
    expect(clause).toBe("status != ?");
    expect(params).toEqual(["deleted"]);
  });

  test("gt / ge / lt / le operators", () => {
    expect(toSqlWhere(parseODataFilter("count gt 3")).clause).toBe("count > ?");
    expect(toSqlWhere(parseODataFilter("count ge 3")).clause).toBe("count >= ?");
    expect(toSqlWhere(parseODataFilter("count lt 3")).clause).toBe("count < ?");
    expect(toSqlWhere(parseODataFilter("count le 3")).clause).toBe("count <= ?");
  });

  test("and wraps in parentheses", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("count gt 1 and count lt 10"));
    expect(clause).toBe("(count > ? AND count < ?)");
    expect(params).toEqual([1, 10]);
  });

  test("or wraps in parentheses", () => {
    const { clause, params } = toSqlWhere(parseODataFilter("name eq 'a' or name eq 'b'"));
    expect(clause).toBe("(name = ? OR name = ?)");
    expect(params).toEqual(["a", "b"]);
  });

  test("nested logical collects all params in order", () => {
    const { clause, params } = toSqlWhere(
      parseODataFilter("categoryId eq 'x' and count gt 2 and count lt 8")
    );
    expect(params).toEqual(["x", 2, 8]);
    expect(clause).toContain("categoryId = ?");
    expect(clause).toContain("count > ?");
    expect(clause).toContain("count < ?");
  });
});
