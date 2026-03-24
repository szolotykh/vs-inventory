/**
 * MCP server — registers all tools from class definitions.
 * Each tool lives in mcp/tools/ and extends BaseTool.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BaseTool } from "./base.ts";
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
    const result = await tool.execute(args) as Record<string, unknown>;
    if ("error" in result) {
      return { content: [{ type: "text" as const, text: String(result.error) }], isError: true };
    }
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "storage", version: "1.0.0" });
  for (const tool of TOOLS) registerTool(server, tool);
  return server;
}
