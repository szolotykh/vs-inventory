# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime & Package Manager

This project uses [Bun](https://bun.com) as the runtime and package manager (not Node/npm/yarn).

## Commands

```bash
bun install          # Install dependencies
bun start            # Start the API server (port 3000)
bun run index.ts     # Run the entry point directly
bun run <file.ts>    # Run any TypeScript file directly (no build step needed)
```

## Project Structure

- `index.ts` — Entry point; starts server on port 3000
- `core/db.ts` — SQLite persistence layer (bun:sqlite, CRUD helpers)
- `api/server.ts` — HTTP router (Bun.serve fetch handler)
- `db.sqlite` — Runtime database (git-ignored)
- `tsconfig.json` — TypeScript config targeting ESNext with bundler module resolution, strict mode enabled, `noEmit: true` (Bun handles execution directly)
- `package.json` — `"type": "module"` (ESM); dev deps are `@types/bun` and `typescript`

## API Routes

### Items
| Method | Path         | Body                                        | Response       |
|--------|--------------|---------------------------------------------|----------------|
| GET    | /items       | —                                           | Item[]         |
| POST   | /items       | `{ name, description, categoryId? }`        | Item (201)     |
| PUT    | /items/:id   | `{ name?, description?, categoryId? \| null }` | Item        |
| DELETE | /items/:id   | —                                           | 204 No Content |

Item shape: `{ id: string; name: string; description: string; categoryId?: string }`
Set `categoryId: null` in a PUT to remove the item's category.

### Categories
| Method | Path             | Body          | Response          |
|--------|------------------|---------------|-------------------|
| GET    | /categories      | —             | Category[]        |
| POST   | /categories      | `{ name }`    | Category (201)    |
| PUT    | /categories/:id  | `{ name }`    | Category          |
| DELETE | /categories/:id  | —             | 204 No Content    |

Category shape: `{ id: string; name: string }`
Deleting a category unlinks it from all items (their `categoryId` is removed).

## TypeScript Notes

- Module resolution is set to `"bundler"` — import `.ts` extensions are allowed
- `verbatimModuleSyntax` is enabled — use `import type` for type-only imports
- `noUncheckedIndexedAccess` is on — array/object index access returns `T | undefined`
