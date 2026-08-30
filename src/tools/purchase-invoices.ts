import { z } from "zod";

import type { MeritClient } from "../client.js";
import type {
  MeritPurchaseInvoiceDetail,
  MeritPurchaseInvoiceListItem,
  MeritPurchaseOrderListItem,
} from "../types/merit.js";
import {
  guidString,
  optionalBoolean,
  optionalDateType,
  optionalInt,
  optionalPurchaseOrderDateFilter,
  parseToolArgs,
  requiredMeritDate,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listPurchaseInvoicesSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  unPaid: optionalBoolean,
  dateType: optionalDateType,
});

const getPurchaseInvoiceSchema = z.object({
  id: guidString,
  skipAttachment: optionalBoolean,
});

const listPurchaseOrdersSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  dateFilter: optionalPurchaseOrderDateFilter,
  statusFilter: optionalInt,
  withAttachments: optionalBoolean,
});

export function createPurchaseInvoiceTools(client: MeritClient) {
  return {
    merit_list_purchase_invoices: {
      description:
        "List Merit Aktiva purchase invoices for a period (POST /api/v2/getpurchorders). " +
        "periodStart/periodEnd are ISO YYYY-MM-DD, max 3 months apart. dateType: 0 = document " +
        "date, 1 = changed date. Distinct from merit_list_purchase_orders (waiting-approval).",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 3 months after periodStart)",
          },
          unPaid: { type: "boolean", description: "Only unpaid invoices" },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = filter by document date, 1 = filter by changed date",
          },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listPurchaseInvoicesSchema, params);
        const response = await client.post<MeritPurchaseInvoiceListItem[]>(
          "/api/v2/getpurchorders",
          {
            PeriodStart: args.periodStart,
            PeriodEnd: args.periodEnd,
            UnPaid: args.unPaid,
            DateType: args.dateType,
          },
        );
        return jsonToolResult(response);
      },
    },

    merit_get_purchase_invoice: {
      description:
        "Get one Merit Aktiva purchase invoice with rows and payments " +
        "(POST /api/v2/getpurchorder). id is the purchase invoice GUID (PIHId). Set " +
        "skipAttachment to omit the PDF (smaller response).",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Purchase invoice GUID / PIHId (required)" },
          skipAttachment: {
            type: "boolean",
            description: "Omit attachment file content",
          },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(getPurchaseInvoiceSchema, params);
        const response = await client.post<MeritPurchaseInvoiceDetail>("/api/v2/getpurchorder", {
          Id: args.id,
          SkipAttachment: args.skipAttachment,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_purchase_orders: {
      description:
        "List Merit Aktiva purchase orders waiting approval (POST /api/v2/GetPOrders). " +
        "Not the same as booked purchase invoices (getpurchorders). dateFilter: 0 = off, " +
        "1 = document date, 2 = created date. statusFilter: 0 = off.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: { type: "string", description: "Period end (YYYY-MM-DD, required)" },
          dateFilter: {
            type: "number",
            enum: [0, 1, 2],
            description: "0 = off, 1 = document date, 2 = created date",
          },
          statusFilter: { type: "number", description: "Status filter; 0 = off" },
          withAttachments: { type: "boolean", description: "Include attachment payloads" },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listPurchaseOrdersSchema, params);
        const response = await client.post<MeritPurchaseOrderListItem[]>("/api/v2/GetPOrders", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          DateFilter: args.dateFilter,
          StatusFilter: args.statusFilter,
          WithAttachments: args.withAttachments,
        });
        return jsonToolResult(response);
      },
    },
  };
}
