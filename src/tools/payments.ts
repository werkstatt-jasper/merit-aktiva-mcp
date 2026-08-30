import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritPayment, MeritPaymentType } from "../types/merit.js";
import {
  optionalDateType,
  optionalGuid,
  optionalInt,
  parseToolArgs,
  requiredMeritDate,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listPaymentsSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  paymentType: optionalInt,
  bankId: optionalGuid,
  dateType: optionalDateType,
});

const listPaymentTypesSchema = z.object({
  type: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export function createPaymentTools(client: MeritClient) {
  return {
    merit_list_payments: {
      description:
        "List Merit Aktiva payments for a period (POST /api/v2/getpayments). " +
        "periodStart/periodEnd are ISO YYYY-MM-DD, max 3 months apart. Response Direction: " +
        "1 = customer transactions, 2 = vendor, 3 = other income, 4 = other expenses. " +
        "dateType: 0 = document date, 1 = changed date.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 3 months after periodStart)",
          },
          paymentType: { type: "number", description: "Payment type filter (integer)" },
          bankId: { type: "string", description: "Bank GUID filter" },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = filter by document date, 1 = filter by changed date",
          },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listPaymentsSchema, params);
        const response = await client.post<MeritPayment[]>("/api/v2/getpayments", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          PaymentType: args.paymentType,
          BankId: args.bankId,
          DateType: args.dateType,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_payment_types: {
      description:
        "List Merit Aktiva payment types (POST /api/v2/getpaymenttypes). type is required: " +
        "1 = purchases, 2 = expense reports, 3 = sales.",
      inputSchema: {
        type: "object" as const,
        properties: {
          type: {
            type: "number",
            enum: [1, 2, 3],
            description: "1 = purchases, 2 = expense reports, 3 = sales (required)",
          },
        },
        required: ["type"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listPaymentTypesSchema, params);
        const response = await client.post<MeritPaymentType[]>("/api/v2/getpaymenttypes", {
          Type: args.type,
        });
        return jsonToolResult(response);
      },
    },
  };
}
