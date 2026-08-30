import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { logger } from "./logger.js";

// biome-ignore lint/suspicious/noExplicitAny: tool handlers use per-tool param shapes
export type ToolHandler = (params: any) => Promise<{
  content: Array<{ type: string; text: string }>;
}>;

export type ToolRecord = Record<
  string,
  {
    description: string;
    inputSchema: object;
    handler: ToolHandler;
  }
>;

/** Placeholder catalog until the read-tools MVP lands (M3). */
export function buildAllTools(): ToolRecord {
  return {};
}

export function registerMcpToolHandlers(
  server: Pick<Server, "setRequestHandler">,
  allTools: ToolRecord,
): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.entries(allTools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolCallStart = performance.now();
    const tool = allTools[name];
    if (!tool) {
      const durationMs = Math.round(performance.now() - toolCallStart);
      logger.warn(
        {
          component: "tool",
          tool: name,
          durationMs,
          outcome: "unknown_tool",
        },
        "mcp tool call",
      );
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await tool.handler(args);
      const durationMs = Math.round(performance.now() - toolCallStart);
      const outcome = "isError" in result && result.isError ? "error" : "ok";
      logger.info(
        {
          component: "tool",
          tool: name,
          durationMs,
          outcome,
        },
        "mcp tool call",
      );
      return result;
    } catch (error) {
      const durationMs = Math.round(performance.now() - toolCallStart);
      logger.info(
        {
          component: "tool",
          tool: name,
          durationMs,
          outcome: "handler_throw",
        },
        "mcp tool call",
      );
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
}

export async function startStdioServer(server: Pick<Server, "connect">): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Merit Aktiva MCP server running on stdio");
}
