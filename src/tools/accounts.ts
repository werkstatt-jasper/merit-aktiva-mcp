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

/** Reads a Merit boolean-ish flag (`true`/`false`, `0`/`1`, `"true"`/`"false"`). */
function readFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return undefined;
}

/**
 * Merit documented the account inactive flag as `NoActive` and later as `NonActive`.
 * Accept either and add `IsActive` so callers don't need to know which one the API sent.
 * Original fields are kept unchanged; `IsActive` is only added when a flag was present.
 */
export function withAccountActiveState(account: MeritAccount): MeritAccount {
  if (account === null || typeof account !== "object") return account;
  const inactive = readFlag(account.NonActive) ?? readFlag(account.NoActive);
  if (inactive === undefined) return account;
  return { ...account, IsActive: !inactive };
}

export function createAccountTools(client: MeritClient) {
  return {
    merit_list_accounts: {
      description:
        "List the Merit Aktiva chart of accounts (POST /api/v1/getaccounts). usageFilter: 0 or " +
        "omitted = all accounts, 1 = cost accounts, 2 = cost contra-accounts, 3 = purchase VAT " +
        "accounts. Each account keeps the raw inactive flag Merit returns (NonActive or the older " +
        "NoActive) and adds IsActive (false for inactive accounts, which should usually be " +
        "skipped when posting).",
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
        return jsonToolResult(
          Array.isArray(response) ? response.map(withAccountActiveState) : response,
        );
      },
    },
  };
}
