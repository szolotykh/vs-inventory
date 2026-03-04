import { createServer } from "./api/server.ts";
import { config } from "./core/config.ts";

const server = createServer(config.apiPort);
console.log(`Listening on http://localhost:${server.port}`);
