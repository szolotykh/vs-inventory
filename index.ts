import { createServer } from "./api/server.ts";
import { config } from "./core/config.ts";

const server = createServer(config.apiPort);
const protocol = config.tlsCert && config.tlsKey ? "https" : "http";
console.log(`Listening on ${protocol}://localhost:${server.port}`);
