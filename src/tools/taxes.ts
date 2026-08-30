import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritTax } from "../types/merit.js";
import { parseToolArgs } from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const emptyToolArgs = z.object({});

export function createTaxTools(client: MeritClient) {
  return {
    merit_list_taxes: {
      description:
        "List all Merit Aktiva tax (VAT) rates (POST /api/v1/gettaxes). No filters. Returns Id " +
        "(the TaxId GUID used on invoice rows), Code, Name, and TaxPct.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritTax[]>("/api/v1/gettaxes", {});
        return jsonToolResult(response);
      },
    },
  };
}
