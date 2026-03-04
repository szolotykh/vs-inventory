# Copilot Instructions

## Runtime & Package Manager

This project uses **Bun** (not Node/npm/yarn) as both runtime and package manager. SQLite is provided by Bun's built-in `bun:sqlite` — no external database dependencies.

## Commands

```bash
bun install        # Install dependencies
bun start          # Start API server (default port 3000)
bun cli            # Start interactive CLI
bun mcp            # Start MCP server (default port 8080)
bun test           # Run all tests (48 tests across 4 files)
bun test --filter "creates an item"  # Run a single test by name
```

There is no build step — Bun runs TypeScript directly.

## Configuration

All settings are centralized in `core/config.ts` using lazy getters that read from `process.env`. Template env file: `.env.dev`.

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3000` | REST API server port |
| `MCP_PORT` | `8080` | MCP server port |
| `DB_PATH` | `db.sqlite` | SQLite database file path |
| `UPLOADS_DIR` | `./uploads` | Image file storage directory |

## Architecture

Organized into four top-level modules:

- **`core/`** — Shared data layer. `config.ts` centralizes all env-based configuration. `db.ts` uses **bun:sqlite** for SQLite persistence (WAL mode). Exports typed CRUD functions for items, categories, images, and metadata, plus `closeDB()` for cleanup.
- **`api/`** — HTTP REST API. `server.ts` is a frameworkless router — a single `handler(req)` parses URL segments and dispatches to `core/` CRUD helpers. Exports `createServer()` wrapping `Bun.serve()`.
- **`mcp/`** — MCP server. `server.ts` defines tools with zod-validated params. `index.ts` serves them via Streamable HTTP transport with stateful session management.
- **`cli/`** — Interactive CLI. `index.ts` runs a REPL with `/command` syntax (e.g., `/items list`, `/metadata set <id> key value`). Supports quoted strings and ID prefix matching.

Entry point: `index.ts` (root) → `api/server.ts` → `core/db.ts` → `db.sqlite`.

SQLite rows use `NULL` for absent `categoryId`; the `rowToItem` helper in `db.ts` converts `NULL` to an omitted property so the API never returns `null` for `categoryId`.

### API Resources

Four resources:

- **Items** — CRUD with `count` (non-negative integer, validated in `server.ts`). Setting `categoryId: null` in a PUT explicitly removes the category; `undefined`/omitted leaves it unchanged. Deleting an item cascades to its images and metadata.
- **Categories** — CRUD with one-to-many relationship to items. Deleting a category unlinks all its items.
- **Images** — Nested under items (`/items/:id/images`). Upload via multipart/form-data, only `image/*` MIME types accepted. Files stored in `UPLOADS_DIR`.
- **Metadata** — Nested under items (`/items/:id/metadata`). Key/value pairs. PUT replaces all metadata for the item.

## Testing

Tests are split across 4 files in `tests/`:
- `categories.test.ts` — category CRUD (7 tests)
- `items.test.ts` — item CRUD, cross-resource, edge cases (22 tests)
- `images.test.ts` — image upload/download/delete (12 tests)
- `metadata.test.ts` — metadata CRUD (7 tests)

Shared setup is in `tests/setup.ts`, preloaded via `bunfig.toml`. Each test file runs in its own Bun worker with a temporary `test-db.sqlite` and `test-uploads/` directory, cleaned up in `afterAll`. Test helpers (`get`, `post`, `put`, `del`) wrap `fetch` calls against a live server on a random port (`createServer(0)`).

## TypeScript Conventions

- `verbatimModuleSyntax` — use `import type` for type-only imports
- `noUncheckedIndexedAccess` — array/object index access returns `T | undefined`; handle accordingly
- Import `.ts` extensions directly (bundler module resolution)
- Strict mode enabled
