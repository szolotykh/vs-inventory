/**
 * MCP server — registers all tools from class definitions.
 * Each tool lives in mcp/tools/ and extends BaseTool.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BaseTool } from "./base.ts";
import { ValidationError } from "../core/validators/index.ts";
import { ListItemsTool, GetItemTool, CreateItemTool, UpdateItemTool, DeleteItemTool } from "./tools/items.ts";
import { ListCategoriesTool, CreateCategoryTool, UpdateCategoryTool, DeleteCategoryTool } from "./tools/categories.ts";
import { ListImagesTool, UploadImageTool, DeleteImageTool } from "./tools/images.ts";
import { ListMetadataTool, SetMetadataTool, DeleteMetadataKeyTool } from "./tools/metadata.ts";
import { ListChangeLogsTool, GetChangeLogTool } from "./tools/changelog.ts";

const TOOLS: BaseTool[] = [
  new ListItemsTool(),
  new GetItemTool(),
  new CreateItemTool(),
  new UpdateItemTool(),
  new DeleteItemTool(),
  new ListCategoriesTool(),
  new CreateCategoryTool(),
  new UpdateCategoryTool(),
  new DeleteCategoryTool(),
  new ListImagesTool(),
  new UploadImageTool(),
  new DeleteImageTool(),
  new ListMetadataTool(),
  new SetMetadataTool(),
  new DeleteMetadataKeyTool(),
  new ListChangeLogsTool(),
  new GetChangeLogTool(),
];

function registerTool(server: McpServer, tool: BaseTool) {
  server.tool(tool.name, tool.description, tool.schema, async (args) => {
    try {
      const result = await tool.execute(args) as Record<string, unknown>;
      if ("error" in result) {
        return { content: [{ type: "text" as const, text: String(result.error) }], isError: true };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      if (err instanceof ValidationError) {
        const msg = `Validation failed: ${err.failures.map((f) => `${f.field}: ${f.message}`).join("; ")}`;
        return { content: [{ type: "text" as const, text: msg }], isError: true };
      }
      throw err;
    }
  });
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "storage", version: "1.0.0" });
  for (const tool of TOOLS) registerTool(server, tool);
  return server;
}
