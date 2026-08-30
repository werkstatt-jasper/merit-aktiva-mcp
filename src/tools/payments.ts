import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritPayment, MeritPaymentType } from "../types/merit.js";
import {
  guidString,
  optionalDateType,
  optionalGuid,
  optionalInt,
  optionalString,
  parseToolArgs,
  requiredMeritDate,
  requiredMeritDateTime,
  requiredNumber,
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

    merit_create_sales_invoice_payment: {
      description:
        "Record a payment against a sales invoice (POST /api/v2/sendpayment). Identify the " +
        "invoice with customerName + invoiceNo. Provide bankId or IBAN (IBAN must match a " +
        "payment method). paymentDate is ISO YYYY-MM-DD. Partial payments are allowed. " +
        "Offer payments are deferred to M6.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customerName: { type: "string", description: "Customer name (required)" },
          invoiceNo: { type: "string", description: "Sales invoice number (required)" },
          paymentDate: { type: "string", description: "Payment date YYYY-MM-DD (required)" },
          amount: { type: "number", description: "Payment amount (required)" },
          bankId: { type: "string", description: "Bank / payment-method GUID" },
          iban: { type: "string", description: "IBAN of a known payment method" },
          refNo: { type: "string" },
          currencyCode: { type: "string", description: "Required if not local currency" },
        },
        required: ["customerName", "invoiceNo", "paymentDate", "amount"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createSalesPaymentSchema, params);
        const response = await client.post<unknown>("/api/v2/sendpayment", {
          CustomerName: args.customerName,
          InvoiceNo: args.invoiceNo,
          PaymentDate: args.paymentDate,
          Amount: args.amount,
          BankId: args.bankId,
          IBAN: args.iban,
          RefNo: args.refNo,
          CurrencyCode: args.currencyCode,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_purchase_invoice_payment: {
      description:
        "Record a payment for a purchase invoice (POST /api/v2/sendPaymentV). Identify the " +
        "bill with vendorName + billNo. paymentDate is ISO date or datetime and is sent as " +
        "yyyyMMddHHmm (Merit's documented format for this endpoint).",
      inputSchema: {
        type: "object" as const,
        properties: {
          vendorName: { type: "string", description: "Vendor name (required)" },
          billNo: { type: "string", description: "Vendor bill number (required)" },
          paymentDate: {
            type: "string",
            description: "ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm (required)",
          },
          amount: { type: "number", description: "Payment amount (required)" },
          bankId: { type: "string" },
          iban: { type: "string" },
          refNo: { type: "string" },
          currencyCode: { type: "string" },
        },
        required: ["vendorName", "billNo", "paymentDate", "amount"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createPurchasePaymentSchema, params);
        const response = await client.post<unknown>("/api/v2/sendPaymentV", {
          VendorName: args.vendorName,
          BillNo: args.billNo,
          PaymentDate: args.paymentDate,
          Amount: args.amount,
          BankId: args.bankId,
          IBAN: args.iban,
          RefNo: args.refNo,
          CurrencyCode: args.currencyCode,
        });
        return jsonToolResult(response);
      },
    },

    merit_delete_payment: {
      description:
        "DESTRUCTIVE: delete a Merit Aktiva payment (POST /api/v1/deletepayment). id is the " +
        "payment GUID. There is no undo.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Payment GUID (required)" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(deleteByIdSchema, params);
        const response = await client.post<unknown>("/api/v1/deletepayment", { Id: args.id });
        return jsonToolResult(response);
      },
    },
  };
}

const createSalesPaymentSchema = z.object({
  customerName: z.string().min(1),
  invoiceNo: z.string().min(1),
  paymentDate: requiredMeritDate,
  amount: requiredNumber,
  bankId: optionalGuid,
  iban: optionalString,
  refNo: optionalString,
  currencyCode: optionalString,
});

const createPurchasePaymentSchema = z.object({
  vendorName: z.string().min(1),
  billNo: z.string().min(1),
  paymentDate: requiredMeritDateTime,
  amount: requiredNumber,
  bankId: optionalGuid,
  iban: optionalString,
  refNo: optionalString,
  currencyCode: optionalString,
});

const deleteByIdSchema = z.object({
  id: guidString,
});
