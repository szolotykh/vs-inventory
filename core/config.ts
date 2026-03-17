/** Centralized configuration — lazily reads environment variables with sensible defaults */

export const config = {
  /** Port for the main API server */
  get apiPort() { return Number(process.env["API_PORT"] ?? 8080); },

  /** Port for the MCP server */
  get mcpPort() { return Number(process.env["MCP_PORT"] ?? 3000); },

  /** Path to the SQLite database file */
  get dbPath() { return process.env["DB_PATH"] ?? "db.sqlite"; },

  /** Directory for uploaded image files */
  get uploadsDir() { return process.env["UPLOADS_DIR"] ?? "./data/artifacts"; },

  /** Whether API key authentication is required (set ENABLE_AUTH=true to enable) */
  get enableAuth() { return process.env["ENABLE_AUTH"] === "true"; },

  /** API key for authentication (required when enableAuth is true) */
  get apiKey() { return process.env["API_KEY"] ?? ""; },

  /** Path to TLS certificate file (PEM). Set both tlsCert and tlsKey to enable HTTPS */
  get tlsCert() { return process.env["TLS_CERT"] ?? ""; },

  /** Path to TLS private key file (PEM). Set both tlsCert and tlsKey to enable HTTPS */
  get tlsKey() { return process.env["TLS_KEY"] ?? ""; },

  /** Data source: "file" (default) or "sqlite" */
  get dataSource() { return process.env["DATA_SOURCE"] ?? "file"; },

  /** Directory for JSON data files when DATA_SOURCE=file */
  get fileDbDir() { return process.env["FILE_DB_DIR"] ?? "./data"; },
};
