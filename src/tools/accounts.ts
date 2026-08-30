import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritAccount } from "../types/merit.js";
import { parseToolArgs } from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listAccountsSchema = z.object({
  usageFilter: z
    .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
    .nullish()
    .transform((v) => v ?? undefined),
});

export function createAccountTools(client: MeritClient) {
  return {
    merit_list_accounts: {
      description:
        "List the Merit Aktiva chart of accounts (POST /api/v1/getaccounts). usageFilter: 0 or " +
        "omitted = all accounts, 1 = cost accounts, 2 = cost contra-accounts, 3 = purchase VAT " +
        "accounts.",
      inputSchema: {
        type: "object" as const,
        properties: {
          usageFilter: {
            type: "number",
            enum: [0, 1, 2, 3],
            description: "0/omitted = all, 1 = cost, 2 = cost contra, 3 = purchase VAT",
          },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listAccountsSchema, params);
        const response = await client.post<MeritAccount[]>("/api/v1/getaccounts", {
          UsageFilter: args.usageFilter,
        });
        return jsonToolResult(response);
      },
    },
  };
}
