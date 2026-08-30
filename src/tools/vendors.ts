import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritVendor } from "../types/merit.js";
import {
  optionalGuid,
  optionalMeritDate,
  optionalString,
  parseToolArgs,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listVendorsSchema = z.object({
  id: optionalGuid,
  regNo: optionalString,
  vatRegNo: optionalString,
  name: optionalString,
  changedDate: optionalMeritDate,
});

export function createVendorTools(client: MeritClient) {
  return {
    merit_list_vendors: {
      description:
        "List/search Merit Aktiva vendors (POST /api/v1/getvendors). With no filters returns all " +
        "vendors — can be very large, so prefer a filter. id wins over other filters; " +
        "regNo/vatRegNo match exactly; name matches partially. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Vendor GUID (ignores other filters when set)" },
          regNo: { type: "string", description: "Registration number (exact match)" },
          vatRegNo: { type: "string", description: "VAT registration number (exact match)" },
          name: { type: "string", description: "Vendor name (partial match)" },
          changedDate: {
            type: "string",
            description: "Only rows changed/created on/after this date (YYYY-MM-DD)",
          },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listVendorsSchema, params);
        const response = await client.post<MeritVendor[]>("/api/v1/getvendors", {
          Id: args.id,
          RegNo: args.regNo,
          VatRegNo: args.vatRegNo,
          Name: args.name,
          ChangedDate: args.changedDate,
        });
        return jsonToolResult(response);
      },
    },
  };
}
