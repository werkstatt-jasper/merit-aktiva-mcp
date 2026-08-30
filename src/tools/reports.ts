import { z } from "zod";

import type { MeritClient } from "../client.js";
import {
  optionalBoolean,
  optionalGuid,
  optionalInt,
  optionalMeritDate,
  optionalString,
  parseToolArgs,
  requiredInt,
  requiredMeritDate,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const customerDebtsSchema = z.object({
  customerName: optionalString,
  customerId: optionalGuid,
  overDueDays: optionalInt,
  debtDate: optionalMeritDate,
});

const customerPaymentsSchema = z.object({
  customerName: optionalString,
  customerId: optionalGuid,
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  currencyCode: optionalString,
});

const profitReportSchema = z.object({
  endDate: requiredMeritDate,
  periodCount: requiredInt,
  departmentFilter: optionalString,
});

const balanceReportSchema = z.object({
  endDate: requiredMeritDate,
  periodCount: requiredInt,
});

const inventoryReportSchema = z.object({
  reportDate: requiredMeritDate,
  location: optionalString,
  articleGroups: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? undefined),
  showZero: optionalBoolean,
  withReservations: optionalBoolean,
});

const salesReportSchema = z.object({
  startDate: requiredMeritDate,
  endDate: requiredMeritDate,
  reportType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

const purchaseReportSchema = z.object({
  startDate: requiredMeritDate,
  endDate: requiredMeritDate,
  reportType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export function createReportTools(client: MeritClient) {
  return {
    merit_get_customer_debts_report: {
      description:
        "Customer debts report (POST /api/v1/getcustdebtrep). Provide customerName (empty " +
        "string = all customers) or customerId. overDueDays filters exceeded days; debtDate " +
        "defaults to today when omitted.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customerName: {
            type: "string",
            description: "Customer name; empty string selects all customers",
          },
          customerId: { type: "string", description: "Customer GUID (wire field CustId)" },
          overDueDays: { type: "number", description: "Minimum overdue days" },
          debtDate: { type: "string", description: "As-of date (YYYY-MM-DD)" },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(customerDebtsSchema, params);
        const response = await client.post<unknown>("/api/v1/getcustdebtrep", {
          CustName: args.customerName,
          CustId: args.customerId,
          OverDueDays: args.overDueDays,
          DebtDate: args.debtDate,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_customer_payments_report: {
      description:
        "Customer payments report (POST /api/v2/getcustpaymrep). Paginated via HasMore/Id4More; " +
        "this tool follows getmoredata automatically. periodStart/periodEnd required. Note the " +
        "wire typo CurrncyCode.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customerName: { type: "string", description: "Customer name (wire field CustName)" },
          customerId: { type: "string", description: "Customer GUID (wire field CustId)" },
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: { type: "string", description: "Period end (YYYY-MM-DD, required)" },
          currencyCode: { type: "string", description: "Currency code (wire field CurrncyCode)" },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(customerPaymentsSchema, params);
        const pages = await client.postAllPages<unknown>("/api/v2/getcustpaymrep", {
          CustName: args.customerName,
          CustId: args.customerId,
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          CurrncyCode: args.currencyCode,
        });
        return jsonToolResult(pages);
      },
    },

    merit_get_profit_report: {
      description:
        "Income statement / P&L (POST /api/v1/getprofitrep). endDate is ISO YYYY-MM-DD; " +
        "periodCount is the number of months back. Optional departmentFilter.",
      inputSchema: {
        type: "object" as const,
        properties: {
          endDate: { type: "string", description: "Period end date (YYYY-MM-DD, required)" },
          periodCount: { type: "number", description: "Number of months back (required)" },
          departmentFilter: { type: "string", description: "Department code filter (DepFilter)" },
        },
        required: ["endDate", "periodCount"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(profitReportSchema, params);
        const response = await client.post<unknown>("/api/v1/getprofitrep", {
          EndDate: args.endDate,
          PerCount: args.periodCount,
          DepFilter: args.departmentFilter,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_balance_report: {
      description:
        "Balance sheet / statement of financial position (POST /api/v1/getbalancerep). " +
        "endDate is ISO YYYY-MM-DD; periodCount is the number of months.",
      inputSchema: {
        type: "object" as const,
        properties: {
          endDate: { type: "string", description: "Balance date (YYYY-MM-DD, required)" },
          periodCount: { type: "number", description: "Number of months (required)" },
        },
        required: ["endDate", "periodCount"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(balanceReportSchema, params);
        const response = await client.post<unknown>("/api/v1/getbalancerep", {
          EndDate: args.endDate,
          PerCount: args.periodCount,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_inventory_report: {
      description:
        "Inventory report (POST /api/v2/getinventoryreport). reportDate is ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          reportDate: { type: "string", description: "Report date (YYYY-MM-DD, required)" },
          location: { type: "string", description: "Stock code or name" },
          articleGroups: {
            type: "array",
            items: { type: "string" },
            description: "Item group codes",
          },
          showZero: { type: "boolean", description: "Include zero-quantity rows" },
          withReservations: { type: "boolean", description: "Include reserved quantities" },
        },
        required: ["reportDate"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(inventoryReportSchema, params);
        const response = await client.post<unknown>("/api/v2/getinventoryreport", {
          RepDate: args.reportDate,
          Location: args.location,
          ArticleGroups: args.articleGroups,
          ShowZero: args.showZero,
          WithReservations: args.withReservations,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_sales_report: {
      description:
        "Sales report (POST /api/v2/getsalesrep). reportType: 1 = invoices, 2 = customers, " +
        "3 = articles, 4 = countries, 5 = countries general.",
      inputSchema: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Start date (YYYY-MM-DD, required)" },
          endDate: { type: "string", description: "End date (YYYY-MM-DD, required)" },
          reportType: {
            type: "number",
            enum: [1, 2, 3, 4, 5],
            description: "1 invoices, 2 customers, 3 articles, 4 countries, 5 countries general",
          },
        },
        required: ["startDate", "endDate", "reportType"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(salesReportSchema, params);
        const response = await client.post<unknown>("/api/v2/getsalesrep", {
          StartDate: args.startDate,
          EndDate: args.endDate,
          ReportType: args.reportType,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_purchase_report: {
      description:
        "Purchase report (POST /api/v2/getpurchrep). reportType: 1 = invoices, 2 = vendors, " +
        "3 = articles, 4 = fixed assets.",
      inputSchema: {
        type: "object" as const,
        properties: {
          startDate: { type: "string", description: "Start date (YYYY-MM-DD, required)" },
          endDate: { type: "string", description: "End date (YYYY-MM-DD, required)" },
          reportType: {
            type: "number",
            enum: [1, 2, 3, 4],
            description: "1 invoices, 2 vendors, 3 articles, 4 fixed assets",
          },
        },
        required: ["startDate", "endDate", "reportType"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(purchaseReportSchema, params);
        const response = await client.post<unknown>("/api/v2/getpurchrep", {
          StartDate: args.startDate,
          EndDate: args.endDate,
          ReportType: args.reportType,
        });
        return jsonToolResult(response);
      },
    },
  };
}
