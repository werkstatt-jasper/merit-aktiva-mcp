import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { MeritClient } from "./client.js";
import { logger } from "./logger.js";
import { createAccountTools } from "./tools/accounts.js";
import { createCustomerTools } from "./tools/customers.js";
import { createFixedAssetTools } from "./tools/fixed-assets.js";
import { createGlTransactionTools } from "./tools/gl-transactions.js";
import { createInventoryTools } from "./tools/inventory.js";
import { createItemTools } from "./tools/items.js";
import { createPaymentTools } from "./tools/payments.js";
import { createPriceTools } from "./tools/prices.js";
import { createPurchaseInvoiceTools } from "./tools/purchase-invoices.js";
import { createRecurringInvoiceTools } from "./tools/recurring-invoices.js";
import { createReferenceDataTools } from "./tools/reference-data.js";
import { createReportTools } from "./tools/reports.js";
import { createSalesInvoiceTools } from "./tools/sales-invoices.js";
import { createSalesOfferTools } from "./tools/sales-offers.js";
import { createTaxTools } from "./tools/taxes.js";
import { createVendorTools } from "./tools/vendors.js";

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

/** Registers all Merit Aktiva MCP tools. */
export function buildAllTools(client: MeritClient): ToolRecord {
  return {
    ...createCustomerTools(client),
    ...createVendorTools(client),
    ...createSalesInvoiceTools(client),
    ...createAccountTools(client),
    ...createPaymentTools(client),
    ...createTaxTools(client),
    ...createPurchaseInvoiceTools(client),
    ...createGlTransactionTools(client),
    ...createItemTools(client),
    ...createReferenceDataTools(client),
    ...createReportTools(client),
    ...createSalesOfferTools(client),
    ...createRecurringInvoiceTools(client),
    ...createInventoryTools(client),
    ...createFixedAssetTools(client),
    ...createPriceTools(client),
  };
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
