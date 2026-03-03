import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  listItems, addItem, editItem, deleteItem,
  listCategories, addCategory, editCategory, deleteCategory,
  closeDB,
} from "../core/db.ts";
import type { Item, Category } from "../core/db.ts";

const rl = readline.createInterface({ input: stdin, output: stdout });

function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of input) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === " " && !inQuotes) {
      if (current) args.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) args.push(current);
  return args;
}

function printItems(items: Item[]) {
  if (items.length === 0) { console.log("  No items."); return; }
  for (const item of items) {
    const cat = item.categoryId ? ` [cat: ${item.categoryId.slice(0, 8)}…]` : "";
    console.log(`  ${item.id.slice(0, 8)}…  ${item.name} — ${item.description} (×${item.count})${cat}`);
  }
}

function printCategories(categories: Category[]) {
  if (categories.length === 0) { console.log("  No categories."); return; }
  for (const cat of categories) {
    console.log(`  ${cat.id.slice(0, 8)}…  ${cat.name}`);
  }
}

function findById<T extends { id: string }>(list: T[], partial: string): T | undefined {
  return list.find((item) => item.id === partial || item.id.startsWith(partial));
}

const HELP = `
Commands:
  /items list                                      List all items
  /items add <name> <description> <count> [catId]  Create an item
  /items update <id> <field>=<value> ...            Update an item
  /items delete <id>                                Delete an item

  /categories list                                  List all categories
  /categories add <name>                            Create a category
  /categories update <id> <name>                    Rename a category
  /categories delete <id>                           Delete a category

  /help                                             Show this help
  /exit                                             Quit

Notes:
  - Use quotes for values with spaces: "my item"
  - IDs can be shortened to a unique prefix
  - /items update accepts: name=X description=X count=N categoryId=X|null
`.trim();

async function handleItems(action: string | undefined, rest: string[]) {
  switch (action) {
    case "list":
      printItems(await listItems());
      break;

    case "add": {
      const [name, description, countStr, categoryId] = rest;
      if (!name || !description || !countStr) { console.log("  Usage: /items add <name> <description> <count> [categoryId]"); return; }
      const count = Number(countStr);
      if (!Number.isInteger(count) || count < 0) { console.log("  count must be a non-negative integer"); return; }
      const item = await addItem({ name, description, count, categoryId });
      console.log(`  Created: ${item.id}`);
      break;
    }

    case "update": {
      const [partial, ...fields] = rest;
      if (!partial || fields.length === 0) { console.log("  Usage: /items update <id> <field>=<value> ..."); return; }
      const items = await listItems();
      const match = findById(items, partial);
      if (!match) { console.log("  Item not found."); return; }
      const data: Record<string, string | number | null> = {};
      for (const f of fields) {
        const eq = f.indexOf("=");
        if (eq === -1) { console.log(`  Invalid field: ${f}`); return; }
        const key = f.slice(0, eq);
        const val = f.slice(eq + 1);
        if (key === "count") { data[key] = Number(val); }
        else if (key === "categoryId" && val === "null") { data[key] = null; }
        else { data[key] = val; }
      }
      const updated = await editItem(match.id, data);
      if (updated) console.log(`  Updated: ${updated.name}`);
      break;
    }

    case "delete": {
      const [partial] = rest;
      if (!partial) { console.log("  Usage: /items delete <id>"); return; }
      const items = await listItems();
      const match = findById(items, partial);
      if (!match) { console.log("  Item not found."); return; }
      await deleteItem(match.id);
      console.log(`  Deleted: ${match.name}`);
      break;
    }

    default:
      console.log("  Unknown action. Try: list, add, update, delete");
  }
}

async function handleCategories(action: string | undefined, rest: string[]) {
  switch (action) {
    case "list":
      printCategories(await listCategories());
      break;

    case "add": {
      const [name] = rest;
      if (!name) { console.log("  Usage: /categories add <name>"); return; }
      const cat = await addCategory({ name });
      console.log(`  Created: ${cat.id}`);
      break;
    }

    case "update": {
      const [partial, ...nameParts] = rest;
      const name = nameParts.join(" ");
      if (!partial || !name) { console.log("  Usage: /categories update <id> <name>"); return; }
      const cats = await listCategories();
      const match = findById(cats, partial);
      if (!match) { console.log("  Category not found."); return; }
      const updated = await editCategory(match.id, { name });
      if (updated) console.log(`  Updated: ${updated.name}`);
      break;
    }

    case "delete": {
      const [partial] = rest;
      if (!partial) { console.log("  Usage: /categories delete <id>"); return; }
      const cats = await listCategories();
      const match = findById(cats, partial);
      if (!match) { console.log("  Category not found."); return; }
      await deleteCategory(match.id);
      console.log(`  Deleted: ${match.name}`);
      break;
    }

    default:
      console.log("  Unknown action. Try: list, add, update, delete");
  }
}

async function main() {
  console.log("Storage CLI — type /help for commands\n");

  while (true) {
    const line = await rl.question("> ");
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.startsWith("/")) {
      console.log("  Commands start with /. Type /help for usage.");
      continue;
    }

    const args = parseArgs(trimmed.slice(1));
    const [resource, action, ...rest] = args;

    try {
      switch (resource) {
        case "items":      await handleItems(action, rest); break;
        case "categories": await handleCategories(action, rest); break;
        case "help":       console.log(HELP); break;
        case "exit":
        case "quit":
          closeDB();
          rl.close();
          process.exit(0);
        default:
          console.log("  Unknown command. Type /help for usage.");
      }
    } catch (err) {
      console.log(`  Error: ${err instanceof Error ? err.message : err}`);
    }
  }
}

main();
