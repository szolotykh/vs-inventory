import { createServer } from "./api/server.ts";

const server = createServer(3000);
console.log(`Listening on http://localhost:${server.port}`);
