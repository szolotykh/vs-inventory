/**
 * Interactive CLI for the storage API.
 * Commands are slash-prefixed: /items list, /categories add "Dairy", etc.
 * Run with: bun cli
 */
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  countItems, listItems,
  addItem, editItem, deleteItem,
  listCategories, addCategory, editCategory, deleteCategory,
  listImages, addImage, deleteImage,
  listMetadata, setMetadata, deleteMetadataKey,
} from "../core/operations/index.ts";
import { closeDB } from "../core/data/index.ts";
import { config } from "../core/config.ts";
import type { Item, Category, Image, Metadata } from "../core/models/index.ts";

const rl = readline.createInterface({ input: stdin, output: stdout });

// ANSI color helpers
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  gray:    "\x1b[90m",
};

const ok = (msg: string) => console.log(`  ${c.green}✔${c.reset} ${msg}`);
const err = (msg: string) => console.log(`  ${c.red}✘${c.reset} ${msg}`);
const warn = (msg: string) => console.log(`  ${c.yellow}⚠${c.reset} ${msg}`);
const info = (msg: string) => console.log(`  ${c.dim}${msg}${c.reset}`);

/** Split input on spaces, respecting double-quoted strings */
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
  if (items.length === 0) { info("No items."); return; }
  for (const item of items) {
    const cat = item.categoryId ? ` ${c.gray}[cat: ${item.categoryId.slice(0, 8)}…]${c.reset}` : "";
    console.log(`  ${c.cyan}${item.id.slice(0, 8)}…${c.reset}  ${c.bold}${item.name}${c.reset} ${c.dim}—${c.reset} ${item.description} ${c.yellow}(×${item.count})${c.reset}${cat}`);
  }
}

function printCategories(categories: Category[]) {
  if (categories.length === 0) { info("No categories."); return; }
  for (const cat of categories) {
    console.log(`  ${c.cyan}${cat.id.slice(0, 8)}…${c.reset}  ${c.bold}${cat.name}${c.reset}`);
  }
}

function printImages(images: Image[]) {
  if (images.length === 0) { info("No images."); return; }
  for (const img of images) {
    console.log(`  ${c.cyan}${img.id.slice(0, 8)}…${c.reset}  ${c.bold}${img.filename}${c.reset} ${c.dim}(${img.mimeType}, ${img.size} bytes)${c.reset}`);
  }
}

function printMetadata(entries: Metadata[]) {
  if (entries.length === 0) { info("No metadata."); return; }
  for (const { key, value } of entries) {
    console.log(`  ${c.magenta}${key}${c.reset} ${c.dim}=${c.reset} ${value}`);
  }
}

/** Match an item by full or prefix ID (e.g. "a3f8" matches "a3f8b2c1-...") */
function findById<T extends { id: string }>(list: T[], partial: string): T | undefined {
  return list.find((item) => item.id === partial || item.id.startsWith(partial));
}

const HELP = `
${c.bold}Commands:${c.reset}
  ${c.cyan}/items${c.reset} list [limit [offset]] [$filter=<odata-expr>]  List/filter items
  ${c.cyan}/items${c.reset} add <name> <description> <count> [categoryId]  Create an item
  ${c.cyan}/items${c.reset} update <id> <field>=<value> ...            Update an item
  ${c.cyan}/items${c.reset} delete <id>                                Delete an item

  ${c.cyan}/categories${c.reset} list                                  List all categories
  ${c.cyan}/categories${c.reset} add <name>                            Create a category
  ${c.cyan}/categories${c.reset} update <id> <name>                    Rename a category
  ${c.cyan}/categories${c.reset} delete <id>                           Delete a category

  ${c.cyan}/images${c.reset} list <itemId>                             List images for an item
  ${c.cyan}/images${c.reset} add <itemId> <filePath>                   Upload an image from disk
  ${c.cyan}/images${c.reset} delete <id>                               Delete an image

  ${c.cyan}/metadata${c.reset} list <itemId>                            List metadata for an item
  ${c.cyan}/metadata${c.reset} set <itemId> <key>=<value> ...           Set metadata key/value pairs
  ${c.cyan}/metadata${c.reset} delete <itemId> <key>                    Delete a metadata key

  ${c.cyan}/mcp${c.reset} connect [url]                                Connect to MCP server
  ${c.cyan}/mcp${c.reset} disconnect                                   Disconnect from MCP server
  ${c.cyan}/mcp${c.reset} status                                       Show connection status
  ${c.cyan}/mcp${c.reset} tools list                                   List available MCP tools
  ${c.cyan}/mcp${c.reset} tools call <name> [key=value ...]            Call an MCP tool

  ${c.cyan}/auth${c.reset} genkey                                      Generate a new random API key

  ${c.cyan}/help${c.reset}                                             Show this help
  ${c.cyan}/exit${c.reset}                                             Quit

${c.bold}Notes:${c.reset}
  ${c.dim}- Use quotes for values with spaces: "my item"
  - IDs can be shortened to a unique prefix
  - /items update accepts: name=X description=X count=N categoryId=X|null

  - /mcp connect defaults to http://localhost:<MCP_PORT>/mcp${c.reset}
`.trim();

async function handleItems(action: string | undefined, rest: string[]) {
  switch (action) {
    case "list": {
      const filterArg = rest.find((a) => a.startsWith("$filter="));
      const positional = rest.filter((a) => !a.startsWith("$filter="));
      const [limitArg, offsetArg] = positional;
      const limit = limitArg !== undefined ? parseInt(limitArg, 10) : undefined;
      const offset = offsetArg !== undefined ? parseInt(offsetArg, 10) : undefined;
      const $filter = filterArg ? filterArg.slice("$filter=".length) : undefined;
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) { err("limit must be a positive integer"); return; }
      if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) { err("offset must be a non-negative integer"); return; }
      const total = countItems($filter);
      const items = await listItems({ limit, offset, $filter });
      printItems(items);
      if (limit !== undefined) {
        info(`Showing ${items.length} of ${total} items (offset ${offset ?? 0})`);
      } else {
        info(`${total} item${total === 1 ? "" : "s"} total`);
      }
      break;
    }

    case "add": {
      const [name, description, countStr, categoryId] = rest;
      if (!name || !description || !countStr) { warn("Usage: /items add <name> <description> <count> [categoryId]"); return; }

      const count = Number(countStr);
      if (!Number.isInteger(count) || count < 0) { err("count must be a non-negative integer"); return; }
      const item = await addItem({ name, description, count, categoryId });
      ok(`Created: ${c.cyan}${item.id}${c.reset}`);
      break;
    }

    case "update": {
      // Accepts key=value pairs, e.g. /items update a3f8 name=Milk count=5
      const [partial, ...fields] = rest;
      if (!partial || fields.length === 0) { warn("Usage: /items update <id> <field>=<value> ..."); return; }
      const items = await listItems();
      const match = findById(items, partial);
      if (!match) { err("Item not found."); return; }
      const data: Record<string, string | number | null> = {};
      for (const f of fields) {
        const eq = f.indexOf("=");
        if (eq === -1) { err(`Invalid field: ${f}`); return; }
        const key = f.slice(0, eq);
        const val = f.slice(eq + 1);
        if (key === "count") { data[key] = Number(val); }
        else if (key === "categoryId" && val === "null") { data[key] = null; }
        else { data[key] = val; }
      }
      const updated = await editItem(match.id, data);
      if (updated) ok(`Updated: ${c.bold}${updated.name}${c.reset}`);
      break;
    }

    case "delete": {
      const [partial] = rest;
      if (!partial) { warn("Usage: /items delete <id>"); return; }
      const items = await listItems();
      const match = findById(items, partial);
      if (!match) { err("Item not found."); return; }
      await deleteItem(match.id);
      ok(`Deleted: ${c.bold}${match.name}${c.reset}`);
      break;
    }

    default:
      warn("Unknown action. Try: list, add, update, delete");
  }
}

async function handleCategories(action: string | undefined, rest: string[]) {
  switch (action) {
    case "list":
      printCategories(await listCategories());
      break;

    case "add": {
      const [name] = rest;
      if (!name) { warn("Usage: /categories add <name>"); return; }
      const cat = await addCategory({ name });
      ok(`Created: ${c.cyan}${cat.id}${c.reset}`);
      break;
    }

    case "update": {
      const [partial, ...nameParts] = rest;
      const name = nameParts.join(" ");
      if (!partial || !name) { warn("Usage: /categories update <id> <name>"); return; }
      const cats = await listCategories();
      const match = findById(cats, partial);
      if (!match) { err("Category not found."); return; }
      const updated = await editCategory(match.id, { name });
      if (updated) ok(`Updated: ${c.bold}${updated.name}${c.reset}`);
      break;
    }

    case "delete": {
      const [partial] = rest;
      if (!partial) { warn("Usage: /categories delete <id>"); return; }
      const cats = await listCategories();
      const match = findById(cats, partial);
      if (!match) { err("Category not found."); return; }
      await deleteCategory(match.id);
      ok(`Deleted: ${c.bold}${match.name}${c.reset}`);
      break;
    }

    default:
      warn("Unknown action. Try: list, add, update, delete");
  }
}

async function handleImages(action: string | undefined, rest: string[]) {
  switch (action) {
    case "list": {
      const [partial] = rest;
      if (!partial) { warn("Usage: /images list <itemId>"); return; }
      const items = await listItems();
      const match = findById(items, partial);
      if (!match) { err("Item not found."); return; }
      printImages(await listImages(match.id));
      break;
    }

    case "add": {
      const [partial, filePath] = rest;
      if (!partial || !filePath) { warn("Usage: /images add <itemId> <filePath>"); return; }
      const items = await listItems();
      const match = findById(items, partial);
      if (!match) { err("Item not found."); return; }
      const file = Bun.file(filePath);
      if (!(await file.exists())) { err("File not found."); return; }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = filePath.split(/[/\\]/).pop() ?? filePath;
      const image = await addImage({ itemId: match.id, filename, mimeType: file.type }, buffer);
      ok(`Uploaded: ${c.cyan}${image.id}${c.reset}`);
      break;
    }

    case "delete": {
      const [partial] = rest;
      if (!partial) { warn("Usage: /images delete <id>"); return; }
      const deleted = await deleteImage(partial);
      if (!deleted) err("Image not found.");
      else ok("Deleted.");
      break;
    }

    default:
      warn("Unknown action. Try: list, add, delete");
  }
}

function handleMetadata(action: string | undefined, rest: string[]) {
  switch (action) {
    case "list": {
      const [partial] = rest;
      if (!partial) { warn("Usage: /metadata list <itemId>"); return; }
      printMetadata(listMetadata(partial));
      break;
    }

    case "set": {
      // /metadata set <itemId> key=value ...
      const [partial, ...pairs] = rest;
      if (!partial || pairs.length === 0) { warn("Usage: /metadata set <itemId> <key>=<value> ..."); return; }
      const entries: Metadata[] = [];
      // keep existing entries not being overwritten
      const existing = listMetadata(partial);
      const newKeys = new Set<string>();
      for (const p of pairs) {
        const eq = p.indexOf("=");
        if (eq === -1) { err(`Invalid pair: ${p}`); return; }
        const entry = { key: p.slice(0, eq), value: p.slice(eq + 1) };
        entries.push(entry);
        newKeys.add(entry.key);
      }
      for (const e of existing) {
        if (!newKeys.has(e.key)) entries.push(e);
      }
      setMetadata(partial, entries);
      ok("Metadata updated.");
      printMetadata(entries);
      break;
    }

    case "delete": {
      const [partial, key] = rest;
      if (!partial || !key) { warn("Usage: /metadata delete <itemId> <key>"); return; }
      const deleted = deleteMetadataKey(partial, key);
      if (!deleted) err("Key not found.");
      else ok("Deleted.");
      break;
    }

    default:
      warn("Unknown action. Try: list, set, delete");
  }
}

// --- MCP Client ---

let mcpClient: Client | null = null;
let mcpTransport: StreamableHTTPClientTransport | null = null;

/** Connect to the MCP server via Streamable HTTP */
async function mcpConnect(url?: string): Promise<void> {
  if (mcpClient) { warn("Already connected. Use /mcp disconnect first."); return; }
  const endpoint = url ?? `http://localhost:${config.mcpPort}/mcp`;
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  const client = new Client({ name: "storage-cli", version: "1.0.0" });
  try {
    await client.connect(transport);
  } catch {
    err("Unable to connect. Is the MCP server running?");
    return;
  }
  mcpTransport = transport;
  mcpClient = client;
  ok(`Connected to ${c.blue}${endpoint}${c.reset}`);
}

/** Disconnect from the MCP server */
async function mcpDisconnect(): Promise<void> {
  if (!mcpClient) { warn("Not connected."); return; }
  await mcpClient.close();
  mcpClient = null;
  mcpTransport = null;
  ok("Disconnected.");
}

async function handleMcp(action: string | undefined, rest: string[]) {
  switch (action) {
    case "connect":
      await mcpConnect(rest[0]);
      break;

    case "disconnect":
      await mcpDisconnect();
      break;

    case "status":
      console.log(mcpClient
        ? `  ${c.green}●${c.reset} Connected`
        : `  ${c.red}●${c.reset} Not connected`);
      break;

    case "tools": {
      const subAction = rest[0];
      if (!mcpClient) { warn("Not connected. Use /mcp connect first."); return; }

      if (subAction === "list" || !subAction) {
        const result = await mcpClient.listTools();
        if (result.tools.length === 0) { info("No tools available."); return; }
        for (const tool of result.tools) {
          const params = tool.inputSchema?.properties
            ? Object.keys(tool.inputSchema.properties as Record<string, unknown>).join(", ")
            : "";
          console.log(`  ${c.cyan}${tool.name}${c.reset}${params ? ` ${c.dim}(${params})${c.reset}` : ""}`);
          if (tool.description) console.log(`    ${c.dim}${tool.description}${c.reset}`);
        }
        break;
      }

      if (subAction === "call") {
        const [, toolName, ...argParts] = rest;
        if (!toolName) { warn("Usage: /mcp tools call <name> [key=value ...]"); return; }
        // Parse key=value pairs into an object, or try JSON if first arg starts with {
        const args: Record<string, unknown> = {};
        if (argParts.length === 1 && argParts[0]!.startsWith("{")) {
          try { Object.assign(args, JSON.parse(argParts[0]!)); } catch {
            err("Invalid JSON argument."); return;
          }
        } else {
          for (const part of argParts) {
            const eq = part.indexOf("=");
            if (eq === -1) { err(`Invalid argument: ${part}. Use key=value format.`); return; }
            const key = part.slice(0, eq);
            const val = part.slice(eq + 1);
            // Try to parse numbers and booleans
            if (val === "true") args[key] = true;
            else if (val === "false") args[key] = false;
            else if (val === "null") args[key] = null;
            else if (!isNaN(Number(val)) && val !== "") args[key] = Number(val);
            else args[key] = val;
          }
        }
        const result = await mcpClient.callTool({ name: toolName, arguments: args });
        for (const content of result.content as Array<{ type: string; text?: string }>) {
          if (content.type === "text" && content.text) console.log(`  ${content.text}`);
        }
        break;
      }

      warn("Unknown sub-action. Try: list, call");
      break;
    }

    default:
      warn("Unknown action. Try: connect, disconnect, status, tools");
  }
}

function handleAuth(action: string | undefined) {
  switch (action) {
    case "genkey": {
      const key = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      console.log(`  ${c.bold}Generated API key:${c.reset}`);
      console.log(`  ${c.yellow}${key}${c.reset}`);
      info('Set API_KEY=<key> and ENABLE_AUTH=true in your .env to activate.');
      break;
    }
    default:
      warn("Unknown action. Try: genkey");
  }
}

async function main() {
  console.log(`${c.bold}Storage CLI${c.reset} ${c.dim}— type /help for commands${c.reset}\n`);

  while (true) {
    const line = await rl.question(`${c.green}>${c.reset} `);
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.startsWith("/")) {
      warn("Commands start with /. Type /help for usage.");
      continue;
    }

    const args = parseArgs(trimmed.slice(1));
    const [resource, action, ...rest] = args;

    try {
      switch (resource) {
        case "items":      await handleItems(action, rest); break;
        case "categories": await handleCategories(action, rest); break;
        case "images":     await handleImages(action, rest); break;
        case "metadata":   handleMetadata(action, rest); break;
        case "mcp":        await handleMcp(action, rest); break;
        case "auth":       handleAuth(action); break;
        case "help":       console.log(HELP); break;
        case "exit":
        case "quit":
          if (mcpClient) await mcpDisconnect();
          closeDB();
          rl.close();
          process.exit(0);
        default:
          warn("Unknown command. Type /help for usage.");
      }
    } catch (e) {
      err(`${e instanceof Error ? e.message : e}`);
    }
  }
}

main();
