import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritCustomer } from "../types/merit.js";
import {
  optionalBoolean,
  optionalGuid,
  optionalMeritDate,
  optionalString,
  parseToolArgs,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listCustomersSchema = z.object({
  id: optionalGuid,
  regNo: optionalString,
  vatRegNo: optionalString,
  name: optionalString,
  changedDate: optionalMeritDate,
  withComments: optionalBoolean,
  commentsFrom: optionalMeritDate,
});

export function createCustomerTools(client: MeritClient) {
  return {
    merit_list_customers: {
      description:
        "List/search Merit Aktiva customers (POST /api/v1/getcustomers). With no filters returns " +
        "all customers — can be very large (Merit may even fail to serialize huge lists), so " +
        "prefer a filter. id wins over all other filters; regNo/vatRegNo match exactly; name " +
        "matches partially. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Customer GUID (ignores other filters when set)" },
          regNo: { type: "string", description: "Registration number (exact match)" },
          vatRegNo: { type: "string", description: "VAT registration number (exact match)" },
          name: { type: "string", description: "Customer name (partial match)" },
          changedDate: {
            type: "string",
            description: "Only rows changed/created on/after this date (YYYY-MM-DD)",
          },
          withComments: { type: "boolean", description: "Include customer comments" },
          commentsFrom: {
            type: "string",
            description: "Only comments on/after this date (YYYY-MM-DD)",
          },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listCustomersSchema, params);
        const response = await client.post<MeritCustomer[]>("/api/v1/getcustomers", {
          Id: args.id,
          RegNo: args.regNo,
          VatRegNo: args.vatRegNo,
          Name: args.name,
          ChangedDate: args.changedDate,
          WithComments: args.withComments,
          CommentsFrom: args.commentsFrom,
        });
        return jsonToolResult(response);
      },
    },
  };
}
