import { createRequire } from "node:module";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { buildAllTools, registerMcpToolHandlers, startStdioServer } from "./server-setup.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export async function startApp(): Promise<void> {
  const allTools = buildAllTools();
  const server = new Server({ name: "merit-aktiva", version }, { capabilities: { tools: {} } });
  registerMcpToolHandlers(server, allTools);
  await startStdioServer(server);
}
