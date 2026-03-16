# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Package Manager

This project uses [Bun](https://bun.com) as the runtime and package manager (not Node/npm/yarn).

## Commands

```bash
bun install          # Install dependencies
bun start            # Start the API server (default port 3000)
bun cli              # Start interactive CLI
bun mcp              # Start MCP server (default port 8080)
bun test             # Run all integration tests
bun run <file.ts>    # Run any TypeScript file directly (no build step needed)
```

## Configuration

All settings live in `core/config.ts` using lazy getters that read from `process.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3000` | REST API server port |
| `MCP_PORT` | `8080` | MCP server port |
| `DB_PATH` | `db.sqlite` | SQLite database file path |
| `UPLOADS_DIR` | `./uploads` | Image file storage directory |
| `ENABLE_AUTH` | `false` | Enable API key authentication for REST API and MCP server |
| `API_KEY` | _(empty)_ | Bearer token required when `ENABLE_AUTH=true` |

Template env file: `.env.dev`

## Project Structure

```
index.ts              — Entry point; starts API server
core/
  config.ts           — Centralized configuration (env vars with defaults)
  db.ts               — SQLite persistence layer (bun:sqlite, CRUD helpers)
api/
  server.ts           — HTTP router (Bun.serve fetch handler)
mcp/
  server.ts           — MCP tool definitions (zod-validated)
  index.ts            — MCP HTTP entry point (Streamable HTTP transport)
cli/
  index.ts            — Interactive REPL with /command syntax
tests/
  setup.ts            — Shared test server setup & helpers (preloaded via bunfig.toml)
  categories.test.ts  — Category CRUD tests
  items.test.ts       — Item CRUD + cross-resource + edge case tests
  images.test.ts      — Image upload/download/delete tests
  metadata.test.ts    — Metadata CRUD tests
```

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

## Testing

Tests are split across 4 files in `tests/`. Shared setup is in `tests/setup.ts` (preloaded via `bunfig.toml`). Each test file runs in its own Bun worker with a temporary `test-db.sqlite` and `test-uploads/` directory, cleaned up in `afterAll`.

Test helpers (`get`, `post`, `put`, `del`) wrap `fetch` calls against a live server on a random port (`createServer(0)`).

## TypeScript Notes

- Module resolution is set to `"bundler"` — import `.ts` extensions are allowed
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports
- `noUncheckedIndexedAccess` is on — array/object index access returns `T | undefined`
- Strict mode enabled
