# storage

A simple REST API for managing items and categories, built with [Bun](https://bun.com) and SQLite (`bun:sqlite`) for persistence.

## Setup

```bash
bun install
```

## Usage

```bash
bun start        # start the server on http://localhost:3000
bun test         # run integration tests
```

## API

### Items

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/items` | — | `Item[]` |
| POST | `/items` | `{ name, description, count, categoryId? }` | `Item` 201 |
| PUT | `/items/:id` | `{ name?, description?, count?, categoryId? \| null }` | `Item` |
| DELETE | `/items/:id` | — | 204 |

Set `categoryId: null` in a PUT to remove an item's category.

### Categories

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/categories` | — | `Category[]` |
| POST | `/categories` | `{ name }` | `Category` 201 |
| PUT | `/categories/:id` | `{ name }` | `Category` |
| DELETE | `/categories/:id` | — | 204 |

Deleting a category automatically unlinks it from all associated items.

## Data shapes

```ts
type Item     = { id: string; name: string; description: string; count: number; categoryId?: string };
type Category = { id: string; name: string };
```

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

# Update an item
curl -X PUT http://localhost:3000/items/<id> \
  -H "Content-Type: application/json" \
  -d '{"name":"Oat Milk","categoryId":null}'

# Delete an item
curl -X DELETE http://localhost:3000/items/<id>
```

## Project structure

```
index.ts          entry point — starts server on port 3000
core/
  db.ts           CRUD helpers using bun:sqlite
api/
  server.ts       HTTP router (Bun.serve fetch handler)
mcp/              MCP server (future)
cli/              CLI interface (future)
db.sqlite         runtime database (git-ignored)
tests/
  api.test.ts     integration tests
```
