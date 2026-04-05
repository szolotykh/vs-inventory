# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Package Manager

This project uses [Bun](https://bun.com) as the runtime and package manager (not Node/npm/yarn).

## Commands

```bash
bun install          # Install dependencies
bun start            # Start the API server (default port 8080)
bun cli              # Start interactive CLI
bun mcp              # Start MCP server (default port 3000)
bun test             # Run all integration tests
bun run <file.ts>    # Run any TypeScript file directly (no build step needed)
```

## Configuration

All settings live in `core/config.ts` using lazy getters that read from `process.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8080` | REST API server port |
| `MCP_PORT` | `3000` | MCP server port |
| `DB_PATH` | `db.sqlite` | SQLite database file path |
| `UPLOADS_DIR` | `./data/artifacts` | Image file storage directory |
| `ENABLE_AUTH` | `false` | Enable API key authentication for REST API and MCP server |
| `API_KEY` | _(empty)_ | Bearer token required when `ENABLE_AUTH=true` |
| `TLS_CERT` | _(empty)_ | Path to PEM certificate — enables HTTPS on both servers when set with `TLS_KEY` |
| `TLS_KEY` | _(empty)_ | Path to PEM private key — enables HTTPS on both servers when set with `TLS_CERT` |
| `DATA_SOURCE` | `file` | Data source: `file` (JSON files) or `sqlite` |
| `FILE_DB_DIR` | `./data` | Directory for JSON data files when `DATA_SOURCE=file` |

Template env file: `.env.example`

## Project Structure

```
index.ts              — Entry point; starts API server
core/
  config.ts           — Centralized configuration (env vars with defaults)
  models/             — TypeScript types (Item, Category, Image, Metadata, ChangeLog)
  data/
    types.ts          — Repository interfaces (IItemRepository, IChangeLogRepository, …)
    index.ts          — Selects data source (file or sqlite) based on DATA_SOURCE
    sqlite/           — SQLite implementations + schema (getDB creates tables)
    file/             — JSON-file implementations
    memory/           — In-memory implementations (used by tests via resetAll())
  operations/         — Business logic layer; all write operations record changelog entries
api/
  server.ts           — HTTP router (Bun.serve fetch handler)
mcp/
  server.ts           — MCP server; registers all tools from mcp/tools/
  tools/              — One file per resource group (items, categories, images, metadata, changelog)
  base.ts             — BaseTool abstract class
cli/
  index.ts            — Interactive REPL with /command syntax
tests/
  setup.ts            — Shared test server & helpers (preloaded via bunfig.toml)
  categories.test.ts  — Category CRUD tests
  items.test.ts       — Item CRUD + cross-resource + edge case tests
  images.test.ts      — Image upload/download/delete tests
  metadata.test.ts    — Metadata CRUD tests
  changelog.test.ts   — ChangeLog recording + filtering + API tests
  odata.test.ts       — OData filter parser unit tests
  operations.test.ts  — Operations layer cascade/CRUD tests (direct function calls)
```

## Development Workflow

**Every feature or bug fix must follow this checklist:**

1. **Implement** the change across all four layers that apply:
   - `core/operations/` — business logic
   - `api/server.ts` — REST API routes
   - `mcp/tools/` — MCP tool definitions (register in `mcp/server.ts`)
   - `cli/index.ts` — CLI commands (add to `handleX` + `HELP` string + main switch)
2. **Write tests** in `tests/` covering the new behaviour (happy path + edge cases).
3. **Run `bun test`** and confirm all tests pass before finishing.
4. **Update `README.md`** to reflect any changes to the API, MCP tools, CLI commands, or features.

Never ship a feature that touches only some of these layers — keep CLI, API, MCP, and tests in sync.

## API Routes

### Items
| Method | Path         | Body                                           | Response       |
|--------|--------------|------------------------------------------------|----------------|
| GET    | /items       | —                                              | Item[]         |
| POST   | /items       | `{ name, description, count, categoryId? }`    | Item (201)     |
| PUT    | /items/:id   | `{ name?, description?, count?, categoryId? \| null }` | Item   |
| DELETE | /items/:id   | —                                              | 204 No Content |

Item shape: `{ id: string; name: string; description: string; count: number; categoryId?: string }`
Set `categoryId: null` in a PUT to remove the item's category. Deleting an item cascades to images and metadata.

### Categories
| Method | Path             | Body          | Response          |
|--------|------------------|---------------|-------------------|
| GET    | /categories      | —             | Category[]        |
| POST   | /categories      | `{ name }`    | Category (201)    |
| PUT    | /categories/:id  | `{ name }`    | Category          |
| DELETE | /categories/:id  | —             | 204 No Content    |

Category shape: `{ id: string; name: string }`
Deleting a category unlinks it from all items (their `categoryId` is removed).

### Images (nested under items)
| Method | Path                          | Body                         | Response       |
|--------|-------------------------------|------------------------------|----------------|
| GET    | /items/:id/images             | —                            | Image[]        |
| POST   | /items/:id/images             | `multipart/form-data` (file) | Image (201)    |
| GET    | /items/:id/images/:imageId    | —                            | Binary data    |
| DELETE | /items/:id/images/:imageId    | —                            | 204 No Content |

Image shape: `{ id: string; itemId: string; filename: string; mimeType: string; size: number }`
Only `image/*` MIME types accepted. Files stored in `UPLOADS_DIR`.

### Metadata (nested under items)
| Method | Path                          | Body                              | Response       |
|--------|-------------------------------|-----------------------------------|----------------|
| GET    | /items/:id/metadata           | —                                 | Metadata[]     |
| PUT    | /items/:id/metadata           | `{ entries: [{ key, value }] }`   | Metadata[]     |
| DELETE | /items/:id/metadata/:key      | —                                 | 204 No Content |

Metadata shape: `{ key: string; value: string }`
PUT replaces all metadata for the item.

### Change Log
| Method | Path              | Query params                                                       | Response              |
|--------|-------------------|--------------------------------------------------------------------|-----------------------|
| GET    | /changelogs       | `targetType`, `targetId`, `changeType`, `limit`, `offset`          | `{ changelogs, total, limit, offset }` |
| GET    | /changelogs/:id   | —                                                                  | ChangeLog             |

ChangeLog shape: `{ id: string; targetId: string; targetType: "item"|"category"; changeType: "create"|"update"|"delete"; changes: ChangeEntry[]|null; timestamp: string }`
`changes` is `null` for create/delete events and an array of `{ field, from, to }` diffs for update events.
All write operations (add/edit/delete on items and categories) automatically record a changelog entry.

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_items` | List/filter inventory items with pagination and OData `filter` parameter |
| `get_item` | Get a single item by ID |
| `create_item` | Create a new item |
| `update_item` | Update an existing item |
| `delete_item` | Delete an item (cascades to images and metadata) |
| `list_categories` | List all categories |
| `create_category` | Create a category |
| `update_category` | Rename a category |
| `delete_category` | Delete a category (unlinks items) |
| `list_images` | List images for an item |
| `upload_image` | Upload an image file for an item |
| `delete_image` | Delete an image |
| `list_metadata` | List metadata for an item |
| `set_metadata` | Set (replace all) metadata for an item |
| `delete_metadata_key` | Delete a single metadata key |
| `list_change_logs` | List change log entries with optional filters and pagination |
| `get_change_log` | Get a single change log entry by ID |

## CLI Commands

```
/items list [limit [offset]] [$filter=<odata-expr>]
/items add <name> <description> <count> [categoryId]
/items update <id> <field>=<value> ...
/items delete <id>

/categories list
/categories add <name>
/categories update <id> <name>
/categories delete <id>

/images list <itemId>
/images add <itemId> <filePath>
/images delete <id>

/metadata list <itemId>
/metadata set <itemId> <key>=<value> ...
/metadata delete <itemId> <key>

/changelog list [limit [offset]] [targetType=item|category] [changeType=create|update|delete] [targetId=<id>]
/changelog get <id>

/mcp connect [url]
/mcp disconnect
/mcp status
/mcp tools list
/mcp tools call <name> [key=value ...]

/auth genkey
/help
/exit
```

## Testing

Tests live in `tests/`. The shared setup (`tests/setup.ts`) is preloaded via `bunfig.toml` and provides a live HTTP server on a random port plus `get`/`post`/`put`/`del` fetch helpers.

**Key rules:**
- Every new feature needs a corresponding test file or additions to an existing one.
- Always run `bun test` after changes and fix any failures before finishing.
- Test files run sequentially (alphabetically). If a test file creates data in the shared store (`./test-data`), add a local `afterAll` that deletes `process.env["FILE_DB_DIR"]` so subsequent files start clean (see `changelog.test.ts` for the pattern).
- Use delta checks (record count before/after) or filter by specific IDs to avoid sensitivity to data created by other test files.

Test helpers (`get`, `post`, `put`, `del`) wrap `fetch` calls against a live server on a random port (`createServer(0)`).

## File Naming Conventions

Repository files are named after the class they contain, converted to kebab-case. The prefix matches the implementation type:

| Directory       | Prefix    | Example                          | Class                        |
|-----------------|-----------|----------------------------------|------------------------------|
| `data/sqlite/`  | `sqlite-` | `sqlite-item-repository.ts`      | `SqliteItemRepository`       |
| `data/file/`    | `file-`   | `file-category-repository.ts`    | `FileCategoryRepository`     |
| `data/memory/`  | `memory-` | `memory-changelog-repository.ts` | `MemoryChangeLogRepository`  |

When adding a new repository class, derive the file name from the class name — do not use a generic name like `item-repository.ts`.

## File Headers

Every repository file must start with a divider header block followed by a blank line:

```ts
// -------------------------------------------------------
// <filename>.ts
// <ClassName> — <one-line description of what the class does>
// -------------------------------------------------------

import ...
```

- The divider is exactly 55 dashes: `// -------------------------------------------------------`
- Line 2 is the file name (basename only, no path)
- Line 3 is the class name followed by an em dash and a concise description
- A blank line separates the header from the first import

## TypeScript Notes

- Module resolution is set to `"bundler"` — import `.ts` extensions are allowed
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports
- `noUncheckedIndexedAccess` is on — array/object index access returns `T | undefined`
- Strict mode enabled
