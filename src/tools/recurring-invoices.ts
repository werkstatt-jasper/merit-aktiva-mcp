import { z } from "zod";

import type { MeritClient } from "../client.js";
import type {
  MeritRecurringInvoiceAddress,
  MeritRecurringInvoiceDetail,
  MeritRecurringInvoiceListItem,
} from "../types/merit.js";
import {
  guidString,
  optionalBoolean,
  optionalDateType,
  optionalGuid,
  optionalInt,
  optionalMeritDate,
  optionalNumber,
  optionalString,
  parseToolArgs,
  requiredMeritDate,
  requiredNumber,
} from "../validation/tool-args.js";
import {
  invoiceRowSchema,
  partySchema,
  taxAmountRowSchema,
  toWireInvoiceRow,
  toWireParty,
  toWireTaxAmount,
} from "./invoice-payload.js";
import { jsonToolResult } from "./list-response.js";

const emptyToolArgs = z.object({});

const cycleSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const recurringPeriodSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const listRecurringSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  dateType: optionalDateType,
});

const getRecurringSchema = z.object({
  id: guidString,
});

const createRecurringSchema = z.object({
  customer: partySchema,
  startDate: requiredMeritDate,
  nextDate: requiredMeritDate,
  cycle: cycleSchema,
  period: recurringPeriodSchema,
  invoiceRows: z.array(invoiceRowSchema).min(1),
  taxAmount: z.array(taxAmountRowSchema).min(1),
  totalAmount: requiredNumber,
  invoiceNo: optionalString,
  endDate: optionalMeritDate,
  currencyCode: optionalString,
  currencyRate: optionalNumber,
  code: optionalString,
  departmentCode: optionalString,
  hComment: optionalString,
  fComment: optionalString,
  paymentDay: optionalInt,
  paymentMonth: optionalInt,
  referenceNo: optionalString,
  priceInclVat: optionalBoolean,
  roundingAmount: optionalNumber,
  totalSum: optionalNumber,
  payer: partySchema.nullish().transform((v) => v ?? undefined),
});

const indicationValueSchema = z.object({
  endValue: optionalNumber,
  quantity: optionalNumber,
  address: optionalString,
  customerId: optionalGuid,
});

const sendIndicationSchema = z.object({
  artCode: z.string().min(1).max(100),
  values: z.array(indicationValueSchema).min(1),
});

export function createRecurringInvoiceTools(client: MeritClient) {
  return {
    merit_list_recurring_invoices: {
      description:
        "List Merit Aktiva recurring invoices (POST /api/v2/getperinvoices). The period is the " +
        "next-invoice date and may be at most 180 days. dateType: 0 = next invoice date, " +
        "1 = changed date.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 180 days after periodStart)",
          },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = next invoice date, 1 = changed date",
          },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listRecurringSchema, params);
        const response = await client.post<MeritRecurringInvoiceListItem[]>(
          "/api/v2/getperinvoices",
          {
            PeriodStart: args.periodStart,
            PeriodEnd: args.periodEnd,
            DateType: args.dateType,
          },
        );
        return jsonToolResult(response);
      },
    },

    merit_get_recurring_invoice: {
      description:
        "Get one Merit Aktiva recurring invoice with rows (POST /api/v2/getperinvoice). id is " +
        "the recurring-invoice GUID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Recurring invoice GUID (required)" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(getRecurringSchema, params);
        const response = await client.post<MeritRecurringInvoiceDetail>("/api/v2/getperinvoice", {
          Id: args.id,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_recurring_invoice: {
      description:
        "Create a Merit Aktiva recurring invoice (POST /api/v2/sendperinvoice). cycle: " +
        "1 = month, 2 = quarter, 3 = year, 4 = week. period: 2 = current, 3 = next, " +
        "4 = for the next, 5 = previous, 6 = current less cycles. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customer: { type: "object", description: "Customer object (required)" },
          startDate: { type: "string", description: "Start date YYYY-MM-DD (required)" },
          nextDate: { type: "string", description: "Next invoice date YYYY-MM-DD (required)" },
          cycle: {
            type: "number",
            enum: [1, 2, 3, 4],
            description: "1 = month, 2 = quarter, 3 = year, 4 = week",
          },
          period: {
            type: "number",
            enum: [2, 3, 4, 5, 6],
            description: "Invoice period relative to the cycle",
          },
          invoiceRows: { type: "array", items: { type: "object" } },
          taxAmount: { type: "array", items: { type: "object" } },
          totalAmount: { type: "number" },
          invoiceNo: { type: "string" },
          endDate: { type: "string" },
          currencyCode: { type: "string" },
          payer: { type: "object" },
        },
        required: [
          "customer",
          "startDate",
          "nextDate",
          "cycle",
          "period",
          "invoiceRows",
          "taxAmount",
          "totalAmount",
        ],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createRecurringSchema, params);
        const response = await client.post<unknown>("/api/v2/sendperinvoice", {
          Customer: toWireParty(args.customer),
          StartDate: args.startDate,
          NextDate: args.nextDate,
          Cycle: args.cycle,
          Period: args.period,
          InvoiceRow: args.invoiceRows.map(toWireInvoiceRow),
          TaxAmount: args.taxAmount.map(toWireTaxAmount),
          TotalAmount: args.totalAmount,
          InvoiceNo: args.invoiceNo,
          EndDate: args.endDate,
          CurrencyCode: args.currencyCode,
          CurrencyRate: args.currencyRate,
          Code: args.code,
          DepartmentCode: args.departmentCode,
          HComment: args.hComment,
          FComment: args.fComment,
          PaymentDay: args.paymentDay,
          PaymentMonth: args.paymentMonth,
          ReferenceNo: args.referenceNo,
          PriceInclVat: args.priceInclVat,
          RoundingAmount: args.roundingAmount,
          TotalSum: args.totalSum,
          Payer: args.payer ? toWireParty(args.payer) : undefined,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_recurring_invoice_addresses: {
      description:
        "List client addresses for open Merit Aktiva recurring invoices " +
        "(POST /api/v2/getpershaddress). No filters. Empty when none are open.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritRecurringInvoiceAddress[]>(
          "/api/v2/getpershaddress",
          {},
        );
        return jsonToolResult(response);
      },
    },

    merit_send_recurring_indication_values: {
      description:
        "Send meter / indication values for recurring invoices (POST /api/v1/sendindvalues). " +
        "artCode is the article; each value may set endValue or quantity (quantity wins) plus " +
        "address or customerId.",
      inputSchema: {
        type: "object" as const,
        properties: {
          artCode: { type: "string", description: "Article code (required)" },
          values: {
            type: "array",
            description: "Indication readings (required)",
            items: { type: "object" },
          },
        },
        required: ["artCode", "values"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(sendIndicationSchema, params);
        const response = await client.post<unknown>("/api/v1/sendindvalues", {
          ArtCode: args.artCode,
          Values: args.values.map((value) => ({
            EndValue: value.endValue,
            Quantity: value.quantity,
            Address: value.address,
            CustomerId: value.customerId,
          })),
        });
        return jsonToolResult(response);
      },
    },
  };
}
