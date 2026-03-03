# Copilot Instructions

## Runtime & Package Manager

This project uses **Bun** (not Node/npm/yarn) as both runtime and package manager. SQLite is provided by Bun's built-in `bun:sqlite` — no external database dependencies.

## Commands

```bash
bun install        # Install dependencies
bun start          # Start API server on port 3000
bun test           # Run all tests
bun test --filter "creates an item"  # Run a single test by name
```

There is no build step — Bun runs TypeScript directly.

## Architecture

Organized into four top-level modules:

- **`core/`** — Shared data layer. `db.ts` uses **bun:sqlite** for SQLite persistence (WAL mode). Exports typed CRUD functions (`listItems`, `addItem`, `editItem`, etc.) and `closeDB()` for cleanup. DB path is configurable via `DB_PATH` env var (defaults to `db.sqlite`).
- **`api/`** — HTTP REST API. `server.ts` is a frameworkless router — a single `handler(req)` parses URL segments and dispatches to `core/` CRUD helpers. Exports `createServer()` wrapping `Bun.serve()`.
- **`mcp/`** — MCP server (future).
- **`cli/`** — CLI interface (future).

Entry point: `index.ts` (root) → `api/server.ts` → `core/db.ts` → `db.sqlite`.

SQLite rows use `NULL` for absent `categoryId`; the `rowToItem` helper in `db.ts` converts `NULL` to an omitted property so the API never returns `null` for `categoryId`.

### API Resources

Two resources — **Items** and **Categories** — with a one-to-many relationship (items have an optional `categoryId`). Deleting a category unlinks all its items.

`count` on Items must be a non-negative integer (validated in `server.ts`).

Setting `categoryId: null` in a PUT explicitly removes the category; `undefined`/omitted leaves it unchanged.

## Testing

Tests are integration tests in `tests/api.test.ts` using `bun:test`. They spin up a real server on a random port (`createServer(0)`) with a temporary `test-db.sqlite` (cleaned up via `closeDB()` + file removal in `afterAll`).

Test helpers (`get`, `post`, `put`, `del`) wrap `fetch` calls against the live server.

## TypeScript Conventions

- `verbatimModuleSyntax` — use `import type` for type-only imports
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`; handle accordingly
- Import `.ts` extensions directly (bundler module resolution)
- Strict mode enabled
