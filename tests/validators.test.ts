import { describe, it, expect } from "bun:test";
import { StringLengthValidator } from "../core/validators/StringLengthValidator.ts";
import { SafeTextValidator } from "../core/validators/SafeTextValidator.ts";
import { IntegerRangeValidator } from "../core/validators/IntegerRangeValidator.ts";
import { validate, ValidationError } from "../core/validators/index.ts";
import type { FieldSchema } from "../core/validators/index.ts";

// ─── StringLengthValidator ────────────────────────────────────────────────────

describe("StringLengthValidator", () => {
  const v = new StringLengthValidator(2, 10, "field");

  it("passes for string within range", () => {
    expect(v.validate("hello")).toBeNull();
  });

  it("passes for string at min boundary", () => {
    expect(v.validate("ab")).toBeNull();
  });

  it("passes for string at max boundary", () => {
    expect(v.validate("1234567890")).toBeNull();
  });

  it("fails for string below min", () => {
    expect(v.validate("a")).not.toBeNull();
  });

  it("fails for string above max", () => {
    expect(v.validate("12345678901")).not.toBeNull();
  });

  it("passes for empty string when min is 0", () => {
    const v0 = new StringLengthValidator(0, 100, "desc");
    expect(v0.validate("")).toBeNull();
  });

  it("skips non-string values (type checking is separate)", () => {
    expect(v.validate(42)).toBeNull();
    expect(v.validate(null)).toBeNull();
    expect(v.validate(undefined)).toBeNull();
  });

  it("error message includes field name", () => {
    const msg = v.validate("a");
    expect(msg).toContain("field");
  });
});

// ─── SafeTextValidator ────────────────────────────────────────────────────────

describe("SafeTextValidator", () => {
  const v = new SafeTextValidator("field");

  it("passes for normal text", () => {
    expect(v.validate("Hello world")).toBeNull();
  });

  it("passes for text with numbers and punctuation", () => {
    expect(v.validate("Item #42, 3.5mm nozzle")).toBeNull();
  });

  it("fails for HTML tags", () => {
    expect(v.validate("<script>alert(1)</script>")).not.toBeNull();
  });

  it("fails for standalone HTML tag", () => {
    expect(v.validate("<b>bold</b>")).not.toBeNull();
  });

  it("fails for SQL DROP keyword", () => {
    expect(v.validate("'; DROP TABLE items; --")).not.toBeNull();
  });

  it("fails for SQL SELECT keyword", () => {
    expect(v.validate("SELECT * FROM items")).not.toBeNull();
  });

  it("fails for SQL comment --", () => {
    expect(v.validate("name -- comment")).not.toBeNull();
  });

  it("fails for javascript: protocol", () => {
    expect(v.validate("javascript:alert(1)")).not.toBeNull();
  });

  it("fails for inline event handler", () => {
    expect(v.validate("onclick=doSomething()")).not.toBeNull();
  });

  it("skips non-string values", () => {
    expect(v.validate(42)).toBeNull();
    expect(v.validate(null)).toBeNull();
  });

  it("error message includes field name", () => {
    const msg = v.validate("<b>");
    expect(msg).toContain("field");
  });
});

// ─── IntegerRangeValidator ────────────────────────────────────────────────────

describe("IntegerRangeValidator", () => {
  const v = new IntegerRangeValidator(0, 100, "count");

  it("passes for integer within range", () => {
    expect(v.validate(50)).toBeNull();
  });

  it("passes for integer at min boundary", () => {
    expect(v.validate(0)).toBeNull();
  });

  it("passes for integer at max boundary", () => {
    expect(v.validate(100)).toBeNull();
  });

  it("fails for integer below min", () => {
    expect(v.validate(-1)).not.toBeNull();
  });

  it("fails for integer above max", () => {
    expect(v.validate(101)).not.toBeNull();
  });

  it("fails for float", () => {
    expect(v.validate(3.14)).not.toBeNull();
  });

  it("skips non-number values", () => {
    expect(v.validate("50")).toBeNull();
    expect(v.validate(null)).toBeNull();
    expect(v.validate(undefined)).toBeNull();
  });

  it("error message includes field name", () => {
    const msg = v.validate(-1);
    expect(msg).toContain("count");
  });
});

// ─── validate() function ──────────────────────────────────────────────────────

describe("validate()", () => {
  const schema: FieldSchema = {
    name: [new StringLengthValidator(1, 50, "name"), new SafeTextValidator("name")],
    count: [new IntegerRangeValidator(0, 999, "count")],
  };

  it("does not throw for valid data", () => {
    expect(() => validate(schema, { name: "Widget", count: 5 })).not.toThrow();
  });

  it("throws ValidationError for a single failing field", () => {
    expect(() => validate(schema, { name: "", count: 5 })).toThrow(ValidationError);
  });

  it("throws ValidationError for multiple failing fields", () => {
    let error: ValidationError | undefined;
    try {
      validate(schema, { name: "", count: -1 });
    } catch (err) {
      error = err as ValidationError;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(error!.failures.length).toBe(2);
  });

  it("failures include field and message", () => {
    let error: ValidationError | undefined;
    try {
      validate(schema, { name: "", count: 5 });
    } catch (err) {
      error = err as ValidationError;
    }
    expect(error!.failures[0]!.field).toBe("name");
    expect(typeof error!.failures[0]!.message).toBe("string");
  });

  it("stops at first failure per field (no duplicate failures for same field)", () => {
    let error: ValidationError | undefined;
    try {
      validate(schema, { name: "", count: 5 });
    } catch (err) {
      error = err as ValidationError;
    }
    const nameFailures = error!.failures.filter((f) => f.field === "name");
    expect(nameFailures.length).toBe(1);
  });

  it("ignores fields not in schema", () => {
    expect(() => validate(schema, { name: "Widget", count: 5, extra: "ignored" })).not.toThrow();
  });

  it("skips validation for undefined fields not present in data", () => {
    // count undefined — IntegerRangeValidator skips non-numbers
    expect(() => validate(schema, { name: "Widget" })).not.toThrow();
  });

  it("ValidationError message is human-readable", () => {
    let error: ValidationError | undefined;
    try {
      validate(schema, { name: "" });
    } catch (err) {
      error = err as ValidationError;
    }
    expect(error!.message).toContain("name");
  });
});
