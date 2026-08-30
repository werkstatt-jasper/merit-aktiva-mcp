import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritSalesInvoiceDetail, MeritSalesInvoiceListItem } from "../types/merit.js";
import {
  guidString,
  optionalBoolean,
  optionalDateType,
  optionalGuid,
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

const listInvoicesSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  unPaid: optionalBoolean,
  dateType: optionalDateType,
  bankId: optionalGuid,
});

const listInvoicesByNumberOrCustomerSchema = z.object({
  invoiceNo: optionalString,
  customerName: optionalString,
  customerId: optionalGuid,
});

const getInvoiceSchema = z.object({
  id: guidString,
  addAttachment: optionalBoolean,
});

export function createSalesInvoiceTools(client: MeritClient) {
  return {
    merit_list_sales_invoices: {
      description:
        "List Merit Aktiva sales invoices for a period (POST /api/v2/getinvoices). " +
        "periodStart/periodEnd are ISO YYYY-MM-DD and may be at most 3 months apart (Merit " +
        "rejects longer periods). dateType: 0 = document date (default), 1 = changed date.",
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
          bankId: { type: "string", description: "Bank GUID filter" },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listInvoicesSchema, params);
        const response = await client.post<MeritSalesInvoiceListItem[]>("/api/v2/getinvoices", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          UnPaid: args.unPaid,
          DateType: args.dateType,
          BankId: args.bankId,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_sales_invoices_by_number_or_customer: {
      description:
        "List Merit Aktiva sales invoices filtered by invoice number and/or customer " +
        "(POST /api/v2/getinvoices2). Provide invoiceNo, customerName, or customerId; no period " +
        "needed. Useful for finding a specific invoice's GUID (SIHId).",
      inputSchema: {
        type: "object" as const,
        properties: {
          invoiceNo: { type: "string", description: "Invoice number (wire field InvNo)" },
          customerName: { type: "string", description: "Customer name (wire field CustName)" },
          customerId: { type: "string", description: "Customer GUID (wire field CustId)" },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listInvoicesByNumberOrCustomerSchema, params);
        const response = await client.post<MeritSalesInvoiceListItem[]>("/api/v2/getinvoices2", {
          InvNo: args.invoiceNo,
          CustName: args.customerName,
          CustId: args.customerId,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_sales_invoice: {
      description:
        "Get one Merit Aktiva sales invoice with rows and payments (POST /api/v2/getinvoice). " +
        "id is the invoice GUID (SIHId from the list tools). Set addAttachment to include the " +
        "invoice PDF as base64 (large).",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Invoice GUID / SIHId (required)" },
          addAttachment: {
            type: "boolean",
            description: "Include attachment file content as base64",
          },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(getInvoiceSchema, params);
        const response = await client.post<MeritSalesInvoiceDetail>("/api/v2/getinvoice", {
          Id: args.id,
          AddAttachment: args.addAttachment,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_sales_invoice: {
      description:
        "Create a Merit Aktiva sales invoice (POST /api/v2/sendinvoice). Invoices cannot be " +
        "updated — delete and recreate. Credit invoice: use negative quantity and totalAmount. " +
        "customer may be an existing Id or a new record (name + notTDCustomer + countryCode). " +
        "invoiceRows, taxAmount[], and totalAmount (ex-VAT) are required. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customer: {
            type: "object",
            description: "Customer object (id of existing, or name+countryCode+notTDCustomer)",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              notTDCustomer: { type: "boolean" },
              countryCode: { type: "string" },
              regNo: { type: "string" },
              vatRegNo: { type: "string" },
              email: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
              currencyCode: { type: "string" },
            },
          },
          invoiceNo: { type: "string", description: "Invoice number, max 35 (required)" },
          docDate: { type: "string", description: "Document date YYYY-MM-DD (required)" },
          dueDate: { type: "string", description: "Due date YYYY-MM-DD" },
          transactionDate: { type: "string", description: "Transaction date YYYY-MM-DD" },
          refNo: { type: "string" },
          currencyCode: { type: "string" },
          invoiceRows: {
            type: "array",
            description: "Invoice lines (required)",
            items: { type: "object" },
          },
          taxAmount: {
            type: "array",
            description: "VAT totals per TaxId (required)",
            items: { type: "object" },
          },
          totalAmount: { type: "number", description: "Amount without VAT (required)" },
          roundingAmount: { type: "number" },
          hComment: { type: "string" },
          fComment: { type: "string" },
        },
        required: ["customer", "invoiceNo", "docDate", "invoiceRows", "taxAmount", "totalAmount"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createSalesInvoiceSchema, params);
        const response = await client.post<unknown>("/api/v2/sendinvoice", {
          Customer: toWireParty(args.customer),
          InvoiceNo: args.invoiceNo,
          DocDate: args.docDate,
          DueDate: args.dueDate,
          TransactionDate: args.transactionDate,
          RefNo: args.refNo,
          CurrencyCode: args.currencyCode,
          InvoiceRow: args.invoiceRows.map(toWireInvoiceRow),
          TaxAmount: args.taxAmount.map(toWireTaxAmount),
          TotalAmount: args.totalAmount,
          RoundingAmount: args.roundingAmount,
          HComment: args.hComment,
          FComment: args.fComment,
        });
        return jsonToolResult(response);
      },
    },

    merit_delete_sales_invoice: {
      description:
        "DESTRUCTIVE: delete a Merit Aktiva sales invoice (POST /api/v1/deleteinvoice). " +
        "id is the invoice GUID (SIHId). There is no undo.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Invoice GUID / SIHId (required)" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(deleteByIdSchema, params);
        const response = await client.post<unknown>("/api/v1/deleteinvoice", { Id: args.id });
        return jsonToolResult(response);
      },
    },
  };
}

const createSalesInvoiceSchema = z.object({
  customer: partySchema,
  invoiceNo: z.string().min(1).max(35),
  docDate: requiredMeritDate,
  dueDate: optionalMeritDate,
  transactionDate: optionalMeritDate,
  refNo: optionalString,
  currencyCode: optionalString,
  invoiceRows: z.array(invoiceRowSchema).min(1),
  taxAmount: z.array(taxAmountRowSchema).min(1),
  totalAmount: requiredNumber,
  roundingAmount: optionalNumber,
  hComment: optionalString,
  fComment: optionalString,
});

const deleteByIdSchema = z.object({
  id: guidString,
});
