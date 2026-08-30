import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritSalesOfferDetail, MeritSalesOfferListItem } from "../types/merit.js";
import {
  guidString,
  optionalBoolean,
  optionalDateType,
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

const offerDocType = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const offerDocStatus = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);
const offerNewStatus = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(7),
]);

const listOffersSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  dateType: optionalDateType,
  unPaid: optionalBoolean,
});

const getOfferSchema = z.object({
  id: guidString,
});

const createOfferSchema = z.object({
  customer: partySchema,
  offerNo: z.string().min(1).max(35),
  docDate: requiredMeritDate,
  expireDate: optionalMeritDate,
  deliveryDate: optionalMeritDate,
  docType: offerDocType.nullish().transform((v) => v ?? undefined),
  docStatus: offerDocStatus.nullish().transform((v) => v ?? undefined),
  refNo: optionalString,
  currencyCode: optionalString,
  departmentCode: optionalString,
  projectCode: optionalString,
  offerRows: z.array(invoiceRowSchema).min(1),
  taxAmount: z.array(taxAmountRowSchema).min(1),
  totalAmount: requiredNumber,
  roundingAmount: optionalNumber,
  contactInfo: optionalString,
  hComment: optionalString,
  fComment: optionalString,
});

const updateOfferSchema = z.object({
  offerNo: z.string().min(1),
  deliveryDate: optionalMeritDate,
  hComment: optionalString,
  fComment: optionalString,
});

const setOfferStatusSchema = z
  .object({
    id: guidString,
    newStatus: offerNewStatus,
    comment: optionalString,
  })
  .refine((args) => args.newStatus !== 5 || Boolean(args.comment), {
    message: "comment is required when newStatus is 5 (comment received)",
    path: ["comment"],
  });

const offerToInvoiceSchema = z.object({
  id: guidString,
});

export function createSalesOfferTools(client: MeritClient) {
  return {
    merit_list_sales_offers: {
      description:
        "List Merit Aktiva sales offers (POST /api/v2/getoffers). periodStart/periodEnd are " +
        "ISO YYYY-MM-DD and may be at most 3 months apart. dateType: 0 = document date, " +
        "1 = changed date. DocType: 1 = quote, 2 = order, 3 = prepayment. DocStatus: 1 = created, " +
        "2 = sent, 3 = approved, 4 = rejected, 5 = comment received, 6 = invoice created, " +
        "7 = canceled.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 3 months after periodStart)",
          },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = filter by document date, 1 = filter by changed date",
          },
          unPaid: { type: "boolean", description: "Only unpaid offers" },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listOffersSchema, params);
        const response = await client.post<MeritSalesOfferListItem[]>("/api/v2/getoffers", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          DateType: args.dateType,
          UnPaid: args.unPaid,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_sales_offer: {
      description:
        "Get one Merit Aktiva sales offer with rows (POST /api/v2/getoffer). id is the offer GUID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Offer GUID (required)" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(getOfferSchema, params);
        const response = await client.post<MeritSalesOfferDetail>("/api/v2/getoffer", {
          Id: args.id,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_sales_offer: {
      description:
        "Create a Merit Aktiva sales offer (POST /api/v2/sendoffer). offerNo, customer, " +
        "offerRows, taxAmount[], and totalAmount (ex-VAT) are required. docType: 1 = quote, " +
        "2 = order, 3 = prepayment. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customer: {
            type: "object",
            description: "Customer object (id of existing, or name+countryCode+notTDCustomer)",
          },
          offerNo: { type: "string", description: "Offer number, max 35 (required)" },
          docDate: { type: "string", description: "Document date YYYY-MM-DD (required)" },
          expireDate: { type: "string", description: "Expiry / due date YYYY-MM-DD" },
          deliveryDate: { type: "string" },
          docType: {
            type: "number",
            enum: [1, 2, 3],
            description: "1 = quote, 2 = order, 3 = prepayment",
          },
          docStatus: { type: "number", enum: [1, 2, 3, 4, 5, 6, 7] },
          refNo: { type: "string" },
          currencyCode: { type: "string" },
          departmentCode: { type: "string" },
          projectCode: { type: "string" },
          offerRows: {
            type: "array",
            description: "Offer lines (required)",
            items: { type: "object" },
          },
          taxAmount: {
            type: "array",
            description: "VAT totals per TaxId (required)",
            items: { type: "object" },
          },
          totalAmount: { type: "number", description: "Amount without VAT (required)" },
          roundingAmount: { type: "number" },
          contactInfo: { type: "string" },
          hComment: { type: "string" },
          fComment: { type: "string" },
        },
        required: ["customer", "offerNo", "docDate", "offerRows", "taxAmount", "totalAmount"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createOfferSchema, params);
        const response = await client.post<unknown>("/api/v2/sendoffer", {
          Customer: toWireParty(args.customer),
          OfferNo: args.offerNo,
          DocDate: args.docDate,
          ExpireDate: args.expireDate,
          DeliveryDate: args.deliveryDate,
          DocType: args.docType,
          DocStatus: args.docStatus,
          RefNo: args.refNo,
          CurrencyCode: args.currencyCode,
          DepartmentCode: args.departmentCode,
          ProjectCode: args.projectCode,
          OfferRow: args.offerRows.map(toWireInvoiceRow),
          TaxAmount: args.taxAmount.map(toWireTaxAmount),
          TotalAmount: args.totalAmount,
          RoundingAmount: args.roundingAmount,
          ContactInfo: args.contactInfo,
          HComment: args.hComment,
          FComment: args.fComment,
        });
        return jsonToolResult(response);
      },
    },

    merit_update_sales_offer: {
      description:
        "Update a Merit Aktiva sales offer (POST /api/v2/updateoffer). offerNo identifies the " +
        "offer; deliveryDate, hComment, and fComment are the writable fields.",
      inputSchema: {
        type: "object" as const,
        properties: {
          offerNo: { type: "string", description: "Offer number (required)" },
          deliveryDate: { type: "string", description: "Delivery date YYYY-MM-DD" },
          hComment: { type: "string" },
          fComment: { type: "string" },
        },
        required: ["offerNo"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(updateOfferSchema, params);
        const response = await client.post<unknown>("/api/v2/updateoffer", {
          OfferNo: args.offerNo,
          DeliveryDate: args.deliveryDate,
          HComment: args.hComment,
          FComment: args.fComment,
        });
        return jsonToolResult(response);
      },
    },

    merit_set_sales_offer_status: {
      description:
        "Change a Merit Aktiva sales offer status (POST /api/v2/setofferstatus). newStatus: " +
        "1 = unsent, 2 = sent, 3 = confirmed, 4 = rejected, 5 = commented (comment required), " +
        "7 = canceled.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Offer GUID (required)" },
          newStatus: {
            type: "number",
            enum: [1, 2, 3, 4, 5, 7],
            description: "1–5 or 7 (required)",
          },
          comment: { type: "string", description: "Required when newStatus is 5" },
        },
        required: ["id", "newStatus"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(setOfferStatusSchema, params);
        const response = await client.post<unknown>("/api/v2/setofferstatus", {
          Id: args.id,
          NewStatus: args.newStatus,
          Comment: args.comment,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_invoice_from_sales_offer: {
      description:
        "Create a sales invoice from a Merit Aktiva sales offer (POST /api/v2/offer2inv). " +
        "id is the offer GUID. Returns InvoiceId / InvoiceNo.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Offer GUID (required)" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(offerToInvoiceSchema, params);
        const response = await client.post<unknown>("/api/v2/offer2inv", { Id: args.id });
        return jsonToolResult(response);
      },
    },
  };
}
