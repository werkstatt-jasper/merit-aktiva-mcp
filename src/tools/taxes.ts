import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritTax } from "../types/merit.js";
import { parseToolArgs } from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

/** `activeFilter` values mapped to Merit's `NonActive` request filter. */
export const TAX_ACTIVE_FILTER = {
  all: 0,
  active: 1,
  inactive: 2,
} as const;

const listTaxesSchema = z.object({
  activeFilter: z
    .enum(["all", "active", "inactive"])
    .nullish()
    .transform((v) => v ?? undefined),
});

export function createTaxTools(client: MeritClient) {
  return {
    merit_list_taxes: {
      description:
        "List Merit Aktiva tax (VAT) rates (POST /api/v1/gettaxes). Optional activeFilter: " +
        "all, active (active rates only) or inactive (inactive rates only); omitted = all rates, " +
        "as before. Returns Id (the TaxId GUID used on invoice rows), Code, Name (up to 50 " +
        "characters), TaxPct (can be 100 or more) and, where Merit sends it, NonActive.",
      inputSchema: {
        type: "object" as const,
        properties: {
          activeFilter: {
            type: "string",
            enum: ["all", "active", "inactive"],
            description:
              "all = every rate, active = active rates only, inactive = inactive rates only. " +
              "Omitted = every rate (no filter sent).",
          },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listTaxesSchema, params);
        const body =
          args.activeFilter === undefined
            ? {}
            : { NonActive: TAX_ACTIVE_FILTER[args.activeFilter] };
        const response = await client.post<MeritTax[]>("/api/v1/gettaxes", body);
        return jsonToolResult(response);
      },
    },
  };
}
