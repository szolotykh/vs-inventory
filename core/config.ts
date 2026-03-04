/** Centralized configuration — lazily reads environment variables with sensible defaults */

export const config = {
  /** Port for the main API server */
  get apiPort() { return Number(process.env["API_PORT"] ?? 8080); },

  /** Port for the MCP server */
  get mcpPort() { return Number(process.env["MCP_PORT"] ?? 3000); },

  /** Path to the SQLite database file */
  get dbPath() { return process.env["DB_PATH"] ?? "db.sqlite"; },

  /** Directory for uploaded image files */
  get uploadsDir() { return process.env["UPLOADS_DIR"] ?? "./uploads"; },
};
