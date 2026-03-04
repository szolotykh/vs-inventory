# storage

A storage management REST API with CLI and MCP server, built with [Bun](https://bun.com) and SQLite (`bun:sqlite`).

## Setup

```bash
bun install
```

## Usage

```bash
bun start        # start the API server (default http://localhost:3000)
bun cli          # interactive CLI (slash-command REPL)
bun mcp          # start MCP server (default http://localhost:8080)
bun test         # run integration tests
```

## Configuration

All settings are centralized in `core/config.ts` and read from environment variables. Copy `.env.dev` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3000` | Port for the REST API server |
| `MCP_PORT` | `8080` | Port for the MCP server |
| `DB_PATH` | `db.sqlite` | Path to the SQLite database file |
| `UPLOADS_DIR` | `./uploads` | Directory for uploaded image files |

## API

### Items

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items` | — | `Item[]` |
| POST | `/items` | `{ name, description, count, categoryId? }` | `Item` 201 |
| PUT | `/items/:id` | `{ name?, description?, count?, categoryId? \| null }` | `Item` |
| DELETE | `/items/:id` | — | 204 |

Set `categoryId: null` in a PUT to remove an item's category. Deleting an item cascades to its images and metadata.

### Categories

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/categories` | — | `Category[]` |
| POST | `/categories` | `{ name }` | `Category` 201 |
| PUT | `/categories/:id` | `{ name }` | `Category` |
| DELETE | `/categories/:id` | — | 204 |

Deleting a category automatically unlinks it from all associated items.

### Images

Images are always associated with an item.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items/:id/images` | — | `Image[]` |
| POST | `/items/:id/images` | `multipart/form-data` with `file` field | `Image` 201 |
| GET | `/items/:id/images/:imageId` | — | Binary image data |
| DELETE | `/items/:id/images/:imageId` | — | 204 |

Only image MIME types (`image/*`) are accepted.

### Metadata

Key/value pairs associated with an item.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items/:id/metadata` | — | `Metadata[]` |
| PUT | `/items/:id/metadata` | `{ entries: [{ key, value }] }` | `Metadata[]` |
| DELETE | `/items/:id/metadata/:key` | — | 204 |

PUT replaces all metadata for the item.

## Data shapes

```ts
type Item     = { id: string; name: string; description: string; count: number; categoryId?: string };
type Category = { id: string; name: string };
type Image    = { id: string; itemId: string; filename: string; mimeType: string; size: number };
type Metadata = { key: string; value: string };
```

## CLI

The interactive CLI uses slash-commands:

```
/items list                              — list all items
/items add "Name" "Description" [count]  — create an item
/items edit <id> name "New Name"         — update a field
/items delete <id>                       — delete an item
/categories list | add | edit | delete   — manage categories
/images list <itemId>                    — list images for an item
/images add <itemId> <filepath>          — upload an image
/images delete <imageId>                 — delete an image
/metadata list <itemId>                  — list metadata
/metadata set <itemId> <key> <value>     — set a key/value pair
/metadata delete <itemId> <key>          — delete a key
/help                                    — show available commands
/exit                                    — quit
```

## MCP Server

The MCP server exposes all CRUD operations as tools via Streamable HTTP transport on `/mcp`. Tools: `list_items`, `add_item`, `edit_item`, `delete_item`, `list_categories`, `add_category`, `edit_category`, `delete_category`, `list_images`, `upload_image`, `delete_image`, `list_metadata`, `set_metadata`, `delete_metadata_key`.

## Examples

```bash
# List items
curl http://localhost:3000/items

# Create a category
curl -X POST http://localhost:3000/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Dairy"}'

# Create an item in that category
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Milk","description":"2% milk","count":10,"categoryId":"<id>"}'

# Upload an image to an item
curl -X POST http://localhost:3000/items/<id>/images \
  -F "file=@photo.jpg"

# Set metadata on an item
curl -X PUT http://localhost:3000/items/<id>/metadata \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"key":"color","value":"red"}]}'
```

## Project structure

```
index.ts              entry point — starts API server
core/
  config.ts           centralized configuration (env vars)
  db.ts               CRUD helpers using bun:sqlite
api/
  server.ts           HTTP router (Bun.serve fetch handler)
mcp/
  server.ts           MCP tool definitions
  index.ts            MCP HTTP entry point (Streamable HTTP transport)
cli/
  index.ts            interactive REPL with /command syntax
tests/
  setup.ts            shared test server setup & helpers
  categories.test.ts  category CRUD tests
  items.test.ts       item CRUD + edge case tests
  images.test.ts      image upload/download/delete tests
  metadata.test.ts    metadata CRUD tests
.env.dev              development env var template
bunfig.toml           Bun config (test preload)
db.sqlite             runtime database (git-ignored)
uploads/              image file storage (git-ignored)
```
