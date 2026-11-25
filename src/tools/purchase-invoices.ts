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
import {
  createPurchaseInvoiceSchema,
  type PurchaseInvoiceBaseArgs,
  purchaseInvoiceBaseSchema,
  purchaseInvoiceInputProperties,
  purchaseInvoiceRequired,
  toWirePurchaseInvoice,
} from "./purchase-invoice-payload.js";

/** Status line returned by merit_submit_purchase_invoice_for_approval. */
export const SUBMITTED_FOR_APPROVAL_STATUS =
  "Sent to Merit's unconfirmed purchase invoices (Kinnitamata ostuarved). Not booked yet: " +
  "a bookkeeper must confirm it in Merit.";

/** Days before and after docDate searched by the duplicate guard. */
export const DUPLICATE_WINDOW_DAYS = 30;

interface MeritPurchaseCreateResult {
  BillId?: string;
  BillNo?: string;
  VendorId?: string;
  RefNo?: string;
  [key: string]: unknown;
}

/** Shift a Merit `yyyymmdd` date by whole days (UTC, no DST issues). */
export function shiftMeritDate(meritDate: string, days: number): string {
  const date = new Date(
    Date.UTC(
      Number(meritDate.slice(0, 4)),
      Number(meritDate.slice(4, 6)) - 1,
      Number(meritDate.slice(6, 8)) + days,
    ),
  );
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

/** Merit uses this GUID when GetPOrders has no VendorId. It is not a vendor. */
const NIL_GUID = "00000000-0000-0000-0000-000000000000";

function normalizeGuid(value: unknown): string {
  const id = normalize(value);
  return id === NIL_GUID ? "" : id;
}

/**
 * Same vendor if a vendor GUID matches, or the vendor name matches (case-insensitive).
 * GetPOrders leaves VendorId empty and puts the vendor in ReceiverId / ReceiverName.
 * A nil GUID matches nothing. A vendor given with neither id nor name matches on billNo alone.
 */
function isSameVendor(vendor: PurchaseInvoiceBaseArgs["vendor"], row: Record<string, unknown>) {
  const vendorId = normalizeGuid(vendor.id);
  const vendorName = normalize(vendor.name);
  if (!vendorId && !vendorName) return true;
  const rowIds = [row.VendorId, row.ReceiverId].map(normalizeGuid).filter(Boolean);
  if (vendorId && rowIds.includes(vendorId)) return true;
  return (
    vendorName !== "" &&
    [row.VendorName, row.ExpVendorName, row.ReceiverName].some(
      (value) => normalize(value) === vendorName,
    )
  );
}

function displayVendor(row: Record<string, unknown>): string {
  for (const value of [row.VendorName, row.ExpVendorName, row.ReceiverName]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const value of [row.VendorId, row.ReceiverId]) {
    if (normalizeGuid(value)) return String(value).trim();
  }
  return "unknown vendor";
}

/** Human-readable existing-document line for the duplicate guard. */
export function describeMatch(kind: string, row: Record<string, unknown>): string {
  const date = row.DocumentDate ? `, document date ${String(row.DocumentDate).slice(0, 10)}` : "";
  const billNo = String(row.BillNo ?? "").trim();
  return `${kind} (PIHId ${row.PIHId}, BillNo ${billNo}, vendor ${displayVendor(row)}${date})`;
}

/**
 * Duplicate guard for merit_submit_purchase_invoice_for_approval. Looks for the same vendor and
 * billNo among unconfirmed purchase invoices (GetPOrders, by document date; vendor is ReceiverId
 * / ReceiverName because VendorId is empty) and booked purchase invoices (getpurchorders, by
 * document date) within DUPLICATE_WINDOW_DAYS of docDate.
 * Returns a description of the first match, or undefined. API errors propagate (fail closed).
 */
export async function findExistingPurchaseDocument(
  client: MeritClient,
  args: PurchaseInvoiceBaseArgs,
): Promise<string | undefined> {
  const periodStart = shiftMeritDate(args.docDate, -DUPLICATE_WINDOW_DAYS);
  const periodEnd = shiftMeritDate(args.docDate, DUPLICATE_WINDOW_DAYS);
  const [unconfirmed, booked] = await Promise.all([
    client.post<MeritPurchaseOrderListItem[]>("/api/v2/GetPOrders", {
      PeriodStart: periodStart,
      PeriodEnd: periodEnd,
      DateFilter: 1,
      StatusFilter: 0,
      WithAttachments: false,
    }),
    client.post<MeritPurchaseInvoiceListItem[]>("/api/v2/getpurchorders", {
      PeriodStart: periodStart,
      PeriodEnd: periodEnd,
      DateType: 0,
    }),
  ]);
  const billNo = normalize(args.billNo);
  const matches = (row: Record<string, unknown>) =>
    normalize(row.BillNo) === billNo && isSameVendor(args.vendor, row);
  const pending = (Array.isArray(unconfirmed) ? unconfirmed : []).find(matches);
  if (pending) {
    return describeMatch(
      "an unconfirmed purchase invoice waiting for approval (Kinnitamata ostuarved)",
      pending,
    );
  }
  const done = (Array.isArray(booked) ? booked : []).find(matches);
  return done ? describeMatch("a booked purchase invoice", done) : undefined;
}

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
        "List Merit Aktiva purchase invoices waiting for confirmation (POST /api/v2/GetPOrders), " +
        "including ones submitted with merit_submit_purchase_invoice_for_approval. Merit calls " +
        "them purchase orders (Kinnitamata ostuarved). Not the same as booked purchase invoices " +
        "(getpurchorders). dateFilter: 0 = off, " +
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

    merit_create_purchase_invoice: {
      description:
        "Create a booked Merit Aktiva purchase invoice (POST /api/v2/sendpurchinvoice). Books " +
        "immediately, with no review step. If the company wants a bookkeeper to review first, " +
        "use merit_submit_purchase_invoice_for_approval. vendor is existing Id or new record. " +
        "invoiceRows, taxAmount[], and totalAmount (ex-VAT) are required. Optional attachment " +
        "is a PDF as base64.",
      inputSchema: {
        type: "object" as const,
        properties: {
          ...purchaseInvoiceInputProperties,
          transactionDate: { type: "string", description: "Transaction date YYYY-MM-DD" },
        },
        required: purchaseInvoiceRequired,
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createPurchaseInvoiceSchema, params);
        const response = await client.post<unknown>(
          "/api/v2/sendpurchinvoice",
          toWirePurchaseInvoice(args),
        );
        return jsonToolResult(response);
      },
    },

    merit_submit_purchase_invoice_for_approval: {
      description:
        "Submit a Merit Aktiva purchase invoice for approval (POST /api/v2/sendpurchorder). " +
        "It goes to Merit's unconfirmed purchase invoices (Kinnitamata ostuarved) and is not " +
        "booked: a bookkeeper must confirm it in Merit, which this API cannot do. Same fields " +
        "as merit_create_purchase_invoice (no transactionDate). Refuses to submit when the " +
        "same vendor and billNo already exist as an unconfirmed or booked purchase invoice " +
        `within ${DUPLICATE_WINDOW_DAYS} days of docDate.`,
      inputSchema: {
        type: "object" as const,
        properties: purchaseInvoiceInputProperties,
        required: purchaseInvoiceRequired,
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(purchaseInvoiceBaseSchema, params);
        const existing = await findExistingPurchaseDocument(client, args);
        if (existing) {
          throw new Error(
            `Not submitted: vendor bill ${args.billNo} already exists in Merit as ${existing}. ` +
              "Submitting it again would create a duplicate. Check the existing document with " +
              "merit_get_purchase_invoice or merit_list_purchase_orders.",
          );
        }
        const response = await client.post<MeritPurchaseCreateResult | null>(
          "/api/v2/sendpurchorder",
          toWirePurchaseInvoice(args),
        );
        return jsonToolResult({
          BillId: response?.BillId,
          BillNo: response?.BillNo,
          VendorId: response?.VendorId,
          RefNo: response?.RefNo,
          Status: SUBMITTED_FOR_APPROVAL_STATUS,
        });
      },
    },

    merit_delete_purchase_invoice: {
      description:
        "DESTRUCTIVE: delete a Merit Aktiva purchase invoice (POST /api/v1/deletepurchinvoice). " +
        "id is the purchase invoice GUID (PIHId). There is no undo.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Purchase invoice GUID / PIHId (required)" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(deleteByIdSchema, params);
        const response = await client.post<unknown>("/api/v1/deletepurchinvoice", { Id: args.id });
        return jsonToolResult(response);
      },
    },
  };
}

const deleteByIdSchema = z.object({
  id: guidString,
});
