/**
 * MCP HTTP entry point — Streamable HTTP transport on /mcp.
 * Each client session gets its own McpServer + transport instance.
 * Run with: bun mcp  (port configurable via MCP_PORT, default 8080)
 */
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.ts";
import { config } from "../core/config.ts";
import type { IncomingMessage } from "node:http";

const port = config.mcpPort;

/** Active sessions keyed by MCP session ID */
const sessions = new Map<string, StreamableHTTPServerTransport>();

/** Read and parse the JSON body from an incoming request */
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString());
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${port}`);

  if (url.pathname !== "/mcp") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    if (req.method === "POST") {
      let body: unknown;
      try { body = await readBody(req); } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }

      // Existing session
      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId)!.handleRequest(req, res, body);
        return;
      }

      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      if (transport.sessionId) sessions.set(transport.sessionId, transport);
      return;
    }

    // GET opens an SSE stream for server-to-client notifications
    if (req.method === "GET") {
      if (!sessionId || !sessions.has(sessionId)) {
        res.writeHead(400);
        res.end("Invalid session");
        return;
      }
      await sessions.get(sessionId)!.handleRequest(req, res);
      return;
    }

    // DELETE tears down a session
    if (req.method === "DELETE") {
      if (sessionId && sessions.has(sessionId)) {
        await sessions.get(sessionId)!.handleRequest(req, res);
        sessions.delete(sessionId);
        return;
      }
      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(405);
    res.end("Method Not Allowed");
  } catch (err) {
    console.error("MCP error:", err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }
});

httpServer.listen(port, () => {
  console.log(`MCP server listening on http://localhost:${port}/mcp`);
});
