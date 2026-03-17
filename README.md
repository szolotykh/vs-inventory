# Storage

A local storage management service with a REST API, MCP server, and interactive CLI. Built with [Bun](https://bun.sh) and SQLite.

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
docker compose up -d
```

API available at `http://localhost:8080`, MCP server at `http://localhost:3000/mcp`.

Run a single service:

```bash
docker compose up -d api
docker compose up -d mcp
```

### Local development

```bash
bun install
bun start        # REST API on port 8080
bun mcp          # MCP server on port 3000
bun cli          # Interactive CLI
bun test         # Run integration tests
```

## Configuration

### Docker

Copy `.env.example` to `.env`. All variables are optional — defaults work out of the box.

| Variable | Default | Description |
|----------|---------|-------------|
| `API_HOST_PORT` | `8080` | Host port mapped to the API container |
| `MCP_HOST_PORT` | `3000` | Host port mapped to the MCP container |
| `DATA_SOURCE` | `file` | Data source: `file` or `sqlite` |
| `ENABLE_AUTH` | `false` | Enable API key authentication |
| `API_KEY` | _(empty)_ | Bearer token required when `ENABLE_AUTH=true` |
| `TLS_CERT` | _(empty)_ | Path on the **host** to PEM certificate — enables HTTPS when set with `TLS_KEY` |
| `TLS_KEY` | _(empty)_ | Path on the **host** to PEM private key |

### Local

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `8080` | REST API server port |
| `MCP_PORT` | `3000` | MCP server port |
| `DB_PATH` | `db.sqlite` | SQLite database file path |
| `UPLOADS_DIR` | `./data/artifacts` | Image file storage directory |
| `ENABLE_AUTH` | `false` | Enable API key authentication |
| `API_KEY` | _(empty)_ | Bearer token required when `ENABLE_AUTH=true` |
| `TLS_CERT` | _(empty)_ | Path to PEM certificate file — enables HTTPS when set with `TLS_KEY` |
| `TLS_KEY` | _(empty)_ | Path to PEM private key file — enables HTTPS when set with `TLS_CERT` |
| `DATA_SOURCE` | `file` | Data source: `file` (JSON files, default) or `sqlite` |
| `FILE_DB_DIR` | `./data` | Directory for JSON data files when `DATA_SOURCE=file` |

## HTTPS

Set `TLS_CERT` and `TLS_KEY` to paths of PEM-encoded files to enable HTTPS on both the REST API and MCP server.

Generate a self-signed certificate for local testing:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"
```

**With Docker**, point to the host paths — the files are mounted into the containers automatically:

```env
TLS_CERT=./certs/cert.pem
TLS_KEY=./certs/key.pem
```

**Locally**, set the paths in `.env`:

```env
TLS_CERT=/path/to/cert.pem
TLS_KEY=/path/to/key.pem
```

## Authentication

When `ENABLE_AUTH=true`, every request to the REST API and MCP server must include:

```
Authorization: Bearer <API_KEY>
```

To generate a key, use the CLI:

```
/auth genkey
```

Then set the printed key as `API_KEY` in your `.env`.

## Data Persistence (Docker)

Data is stored in a single bind-mounted host directory (`./data` by default), so it persists across restarts, container recreations, and even if the container is deleted. Uploaded images are stored in `data/artifacts/`.

To use a different location, set `DATA_DIR` in your `.env`:

```env
DATA_DIR=/opt/vsinventory/data
```

## REST API

Base URL: `http://localhost:<API_PORT>`

### Items

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items` | — | `{ items, total, limit, offset }` |
| POST | `/items` | `{ name, description, count, categoryId? }` | Item (201) |
| GET | `/items/:id` | — | Item |
| PUT | `/items/:id` | `{ name?, description?, count?, categoryId?\|null }` | Item |
| DELETE | `/items/:id` | — | 204 |

Query params for `GET /items`: `limit`, `offset`, `categoryId`, `search`

Item shape: `{ id, name, description, count, categoryId? }`

Set `categoryId: null` in a PUT to remove the item's category. Deleting an item cascades to its images and metadata.

### Categories

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/categories` | — | Category[] |
| POST | `/categories` | `{ name }` | Category (201) |
| PUT | `/categories/:id` | `{ name }` | Category |
| DELETE | `/categories/:id` | — | 204 |

Category shape: `{ id, name }`

Deleting a category unlinks it from all items (their `categoryId` is cleared).

### Images

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items/:id/images` | — | Image[] |
| POST | `/items/:id/images` | `multipart/form-data` (`file` field) | Image (201) |
| GET | `/items/:id/images/:imageId` | — | Binary data |
| DELETE | `/items/:id/images/:imageId` | — | 204 |

Only `image/*` MIME types accepted. Image shape: `{ id, itemId, filename, mimeType, size }`

### Metadata

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items/:id/metadata` | — | Metadata[] |
| PUT | `/items/:id/metadata` | `{ entries: [{ key, value }] }` | Metadata[] |
| DELETE | `/items/:id/metadata/:key` | — | 204 |

PUT replaces all metadata for the item. Metadata shape: `{ key, value }`

## MCP Server

The MCP server exposes all storage operations as tools via the [Model Context Protocol](https://modelcontextprotocol.io) over Streamable HTTP at `http://localhost:<MCP_PORT>/mcp`.

Available tools: `list_items`, `get_item`, `create_item`, `update_item`, `delete_item`, `list_categories`, `create_category`, `update_category`, `delete_category`, `list_images`, `upload_image`, `delete_image`, `list_metadata`, `set_metadata`, `delete_metadata_key`

## CLI

Run `bun cli` for an interactive REPL. All commands are slash-prefixed.

```
/items list [limit [offset]] [category=<id>]
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

/mcp connect [url]
/mcp disconnect
/mcp status
/mcp tools list
/mcp tools call <name> [key=value ...]

/auth genkey

/help
/exit
```

IDs can be shortened to a unique prefix (e.g. `a3f8` instead of the full UUID).

## Project Structure

```
index.ts              Entry point; starts API server
core/
  config.ts           Centralized configuration (env vars with defaults)
  models/             Shared types: Item, Category, Image, Metadata
  data/
    types.ts          Repository interfaces (IItemRepository, etc.)
    index.ts          Exports active repositories — swap DATA_SOURCE here
    sqlite/           SQLite implementation (default)
    file/             File-based implementation (JSON docs, DATA_SOURCE=file)
  operations/         Business logic and orchestration
api/
  server.ts           HTTP router
mcp/
  server.ts           MCP tool definitions
  index.ts            MCP HTTP entry point (Streamable HTTP transport)
cli/
  index.ts            Interactive REPL
tests/
  setup.ts            Shared test setup
  categories.test.ts
  items.test.ts
  images.test.ts
  metadata.test.ts
```
