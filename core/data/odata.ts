/**
 * Minimal OData $filter parser and evaluator.
 *
 * Supported operators: eq, ne, gt, ge, lt, le
 * Logical:            and, or (left-associative; and binds tighter than or)
 * Grouping:           parentheses
 * Value types:        single-quoted string, integer/float, true, false, null
 * Fields:             any identifier (letters, digits, underscore)
 */

// ─── AST Types ───────────────────────────────────────────────────────────────

export type ComparisonNode = {
  kind: "comparison";
  field: string;
  op: "eq" | "ne" | "gt" | "ge" | "lt" | "le";
  value: string | number | boolean | null;
};

export type LogicalNode = {
  kind: "logical";
  op: "and" | "or";
  left: FilterNode;
  right: FilterNode;
};

export type FilterNode = ComparisonNode | LogicalNode;

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type TokenKind =
  | "ident"
  | "string"
  | "number"
  | "lparen"
  | "rparen"
  | "eof";

type Token = { kind: TokenKind; value: string };

const KEYWORDS = new Set(["eq", "ne", "gt", "ge", "lt", "le", "and", "or", "null", "true", "false"]);

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    // Skip whitespace
    if (expr[i] === " " || expr[i] === "\t" || expr[i] === "\r" || expr[i] === "\n") {
      i++;
      continue;
    }

    // Parentheses
    if (expr[i] === "(") { tokens.push({ kind: "lparen", value: "(" }); i++; continue; }
    if (expr[i] === ")") { tokens.push({ kind: "rparen", value: ")" }); i++; continue; }

    // Single-quoted string
    if (expr[i] === "'") {
      let str = "";
      i++; // skip opening quote
      while (i < expr.length && expr[i] !== "'") {
        str += expr[i];
        i++;
      }
      if (i >= expr.length) throw new Error("Unterminated string literal");
      i++; // skip closing quote
      tokens.push({ kind: "string", value: str });
      continue;
    }

    // Number (optional leading minus is NOT in OData; negative literals not supported)
    if (expr[i] !== undefined && /[0-9]/.test(expr[i]!)) {
      let num = "";
      while (i < expr.length && expr[i] !== undefined && /[0-9.]/.test(expr[i]!)) {
        num += expr[i];
        i++;
      }
      tokens.push({ kind: "number", value: num });
      continue;
    }

    // Identifier or keyword
    if (expr[i] !== undefined && /[a-zA-Z_]/.test(expr[i]!)) {
      let word = "";
      while (i < expr.length && expr[i] !== undefined && /[a-zA-Z0-9_$]/.test(expr[i]!)) {
        word += expr[i];
        i++;
      }
      tokens.push({ kind: "ident", value: word });
      continue;
    }

    throw new Error(`Unexpected character: '${expr[i]}'`);
  }

  tokens.push({ kind: "eof", value: "" });
  return tokens;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? { kind: "eof", value: "" };
  }

  private consume(): Token {
    const t = this.tokens[this.pos] ?? { kind: "eof", value: "" };
    this.pos++;
    return t;
  }

  private expect(kind: TokenKind, value?: string): Token {
    const t = this.consume();
    if (t.kind !== kind || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${value ?? kind} but got '${t.value}'`);
    }
    return t;
  }

  parse(): FilterNode {
    const node = this.parseOr();
    if (this.peek().kind !== "eof") {
      throw new Error(`Unexpected token: '${this.peek().value}'`);
    }
    return node;
  }

  // or_expr → and_expr ('or' and_expr)*
  private parseOr(): FilterNode {
    let left = this.parseAnd();
    while (this.peek().kind === "ident" && this.peek().value === "or") {
      this.consume(); // eat 'or'
      const right = this.parseAnd();
      left = { kind: "logical", op: "or", left, right } satisfies LogicalNode;
    }
    return left;
  }

  // and_expr → primary ('and' primary)*
  private parseAnd(): FilterNode {
    let left = this.parsePrimary();
    while (this.peek().kind === "ident" && this.peek().value === "and") {
      this.consume(); // eat 'and'
      const right = this.parsePrimary();
      left = { kind: "logical", op: "and", left, right } satisfies LogicalNode;
    }
    return left;
  }

  // primary → '(' expr ')' | comparison
  private parsePrimary(): FilterNode {
    if (this.peek().kind === "lparen") {
      this.consume(); // eat '('
      const node = this.parseOr();
      this.expect("rparen");
      return node;
    }
    return this.parseComparison();
  }

  // comparison → IDENT op value
  private parseComparison(): ComparisonNode {
    const fieldTok = this.consume();
    if (fieldTok.kind !== "ident" || KEYWORDS.has(fieldTok.value)) {
      throw new Error(`Expected field identifier, got '${fieldTok.value}'`);
    }
    const field = fieldTok.value;

    const opTok = this.consume();
    if (opTok.kind !== "ident" || !["eq", "ne", "gt", "ge", "lt", "le"].includes(opTok.value)) {
      throw new Error(`Expected comparison operator (eq/ne/gt/ge/lt/le), got '${opTok.value}'`);
    }
    const op = opTok.value as ComparisonNode["op"];

    const value = this.parseValue();
    return { kind: "comparison", field, op, value };
  }

  // value → STRING | NUMBER | 'true' | 'false' | 'null'
  private parseValue(): string | number | boolean | null {
    const t = this.consume();
    if (t.kind === "string") return t.value;
    if (t.kind === "number") return parseFloat(t.value);
    if (t.kind === "ident") {
      if (t.value === "true") return true;
      if (t.value === "false") return false;
      if (t.value === "null") return null;
    }
    throw new Error(`Expected value (string, number, true, false, null), got '${t.value}'`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse an OData $filter expression into an AST. Throws on invalid input. */
export function parseODataFilter(expr: string): FilterNode {
  const tokens = tokenize(expr.trim());
  return new Parser(tokens).parse();
}

/**
 * Evaluate a parsed filter against a plain object.
 * Used by the file-based repository.
 */
export function evaluateFilter(record: Record<string, unknown>, node: FilterNode): boolean {
  if (node.kind === "logical") {
    if (node.op === "and") return evaluateFilter(record, node.left) && evaluateFilter(record, node.right);
    return evaluateFilter(record, node.left) || evaluateFilter(record, node.right);
  }

  // node is ComparisonNode here
  const fieldVal = record[node.field];
  const { op, value } = node;

  if (op === "eq") {
    if (value === null) return fieldVal === undefined || fieldVal === null;
    return fieldVal === value;
  }
  if (op === "ne") {
    if (value === null) return fieldVal !== undefined && fieldVal !== null;
    return fieldVal !== value;
  }
  // Numeric comparisons — only meaningful when both sides are numbers
  if (typeof fieldVal !== "number" || typeof value !== "number") return false;
  if (op === "gt") return fieldVal > value;
  if (op === "ge") return fieldVal >= value;
  if (op === "lt") return fieldVal < value;
  if (op === "le") return fieldVal <= value;

  return false;
}

/**
 * Translate a parsed filter to a SQL WHERE clause fragment.
 * Used by the SQLite repository.
 * Returns { clause: string, params: (string | number | null)[] }
 * where `clause` does NOT include the "WHERE" keyword.
 */
export function toSqlWhere(node: FilterNode): { clause: string; params: (string | number | null)[] } {
  if (node.kind === "logical") {
    const left = toSqlWhere(node.left);
    const right = toSqlWhere(node.right);
    const sqlOp = node.op === "and" ? "AND" : "OR";
    return {
      clause: `(${left.clause} ${sqlOp} ${right.clause})`,
      params: [...left.params, ...right.params],
    };
  }

  // comparison
  const { field, op, value } = node;

  if (op === "eq" && value === null) return { clause: `${field} IS NULL`, params: [] };
  if (op === "ne" && value === null) return { clause: `${field} IS NOT NULL`, params: [] };

  const sqlOp: Record<string, string> = {
    eq: "=", ne: "!=", gt: ">", ge: ">=", lt: "<", le: "<=",
  };

  return {
    clause: `${field} ${sqlOp[op]} ?`,
    params: [value as string | number | null],
  };
}
