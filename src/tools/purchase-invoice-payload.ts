import { z } from "zod";

import {
  optionalBoolean,
  optionalGuid,
  optionalMeritDate,
  optionalNumber,
  optionalString,
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

/**
 * Shared input schema and wire builder for the two purchase-invoice create endpoints:
 * `sendpurchinvoice` (books immediately) and `sendpurchorder` (waits for approval in Merit).
 * Both tools use these so their fields and validation cannot drift apart.
 */

export const purchaseDimensionSchema = z.object({
  dimId: z.coerce.number().int(),
  dimValueId: optionalGuid,
  dimCode: optionalString,
});

export const purchaseInvoiceRowSchema = invoiceRowSchema.extend({
  departmentCode: optionalString,
  projectCode: optionalString,
  costCenterCode: optionalString,
  dimensions: z.array(purchaseDimensionSchema).optional(),
});

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** PDF attachment. Merit validates attachments and rejects broken files, so check first. */
export const pdfAttachmentSchema = z
  .object({
    fileName: z
      .string()
      .min(1)
      .refine((name) => /\.pdf$/i.test(name.trim()), {
        message: "attachment.fileName must end in .pdf (Merit accepts PDF attachments)",
      }),
    fileContent: z.string().min(1),
  })
  .transform((attachment, ctx) => {
    const content = attachment.fileContent.replace(/\s+/g, "");
    if (content.length % 4 !== 0 || !BASE64_RE.test(content)) {
      ctx.addIssue({
        code: "custom",
        path: ["fileContent"],
        message:
          "attachment.fileContent must be plain base64 (no data: prefix) of the whole PDF file",
      });
      return z.NEVER;
    }
    const bytes = Buffer.from(content, "base64");
    const tail = bytes.subarray(Math.max(0, bytes.length - 2048)).toString("latin1");
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-" || !tail.includes("%%EOF")) {
      ctx.addIssue({
        code: "custom",
        path: ["fileContent"],
        message:
          "attachment.fileContent is not a complete PDF (expected %PDF- header and %%EOF trailer)",
      });
      return z.NEVER;
    }
    return { fileName: attachment.fileName.trim(), fileContent: content };
  });

/** Fields accepted by both `sendpurchinvoice` and `sendpurchorder` (v2). */
export const purchaseInvoiceBaseSchema = z.object({
  vendor: partySchema,
  billNo: z.string().min(1).max(35),
  docDate: requiredMeritDate,
  dueDate: optionalMeritDate,
  refNo: optionalString,
  currencyCode: optionalString,
  departmentCode: optionalString,
  dimensions: z.array(purchaseDimensionSchema).optional(),
  invoiceRows: z.array(purchaseInvoiceRowSchema).min(1),
  taxAmount: z.array(taxAmountRowSchema).min(1),
  totalAmount: requiredNumber,
  roundingAmount: optionalNumber,
  hComment: optionalString,
  fComment: optionalString,
  expenseClaim: optionalBoolean,
  attachment: pdfAttachmentSchema.optional(),
});

/** `sendpurchinvoice` also documents `TransactionDate`; `sendpurchorder` v2 does not. */
export const createPurchaseInvoiceSchema = purchaseInvoiceBaseSchema.extend({
  transactionDate: optionalMeritDate,
});

export type PurchaseInvoiceBaseArgs = z.infer<typeof purchaseInvoiceBaseSchema>;
export type CreatePurchaseInvoiceArgs = z.infer<typeof createPurchaseInvoiceSchema>;

function toWireDimension(dim: z.infer<typeof purchaseDimensionSchema>): Record<string, unknown> {
  return { DimId: dim.dimId, DimValueId: dim.dimValueId, DimCode: dim.dimCode };
}

export function toWirePurchaseInvoiceRow(
  row: z.infer<typeof purchaseInvoiceRowSchema>,
): Record<string, unknown> {
  return {
    ...toWireInvoiceRow(row),
    DepartmentCode: row.departmentCode,
    ProjectCode: row.projectCode,
    CostCenterCode: row.costCenterCode,
    Dimensions: row.dimensions?.map(toWireDimension),
  };
}

/** PascalCase wire payload shared by `sendpurchinvoice` and `sendpurchorder`. */
export function toWirePurchaseInvoice(
  args: PurchaseInvoiceBaseArgs & { transactionDate?: string },
): Record<string, unknown> {
  return {
    Vendor: toWireParty(args.vendor),
    BillNo: args.billNo,
    DocDate: args.docDate,
    DueDate: args.dueDate,
    TransactionDate: args.transactionDate,
    RefNo: args.refNo,
    CurrencyCode: args.currencyCode,
    DepartmentCode: args.departmentCode,
    Dimensions: args.dimensions?.map(toWireDimension),
    InvoiceRow: args.invoiceRows.map(toWirePurchaseInvoiceRow),
    TaxAmount: args.taxAmount.map(toWireTaxAmount),
    TotalAmount: args.totalAmount,
    RoundingAmount: args.roundingAmount,
    HComment: args.hComment,
    FComment: args.fComment,
    ExpenseClaim: args.expenseClaim,
    Attachment: args.attachment
      ? { FileName: args.attachment.fileName, FileContent: args.attachment.fileContent }
      : undefined,
  };
}

const dimensionsJsonSchema = {
  type: "array",
  description: "Dimension values (merit_list_dimensions): dimId plus dimValueId or dimCode",
  items: {
    type: "object",
    properties: {
      dimId: { type: "number" },
      dimValueId: { type: "string" },
      dimCode: { type: "string" },
    },
    required: ["dimId"],
  },
};

/** JSON Schema properties shared by both purchase-invoice create tools. */
export const purchaseInvoiceInputProperties = {
  vendor: {
    type: "object",
    description: "Vendor object (id of existing, or name+countryCode+vatAccountable)",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      vatAccountable: { type: "boolean" },
      countryCode: { type: "string" },
      regNo: { type: "string" },
      vatRegNo: { type: "string" },
      email: { type: "string" },
      address: { type: "string" },
      city: { type: "string" },
      currencyCode: { type: "string" },
    },
  },
  billNo: { type: "string", description: "Vendor bill number, max 35 (required)" },
  docDate: { type: "string", description: "Document date YYYY-MM-DD (required)" },
  dueDate: { type: "string" },
  refNo: { type: "string" },
  currencyCode: { type: "string" },
  departmentCode: { type: "string", description: "Department code (must exist in Merit)" },
  dimensions: dimensionsJsonSchema,
  invoiceRows: {
    type: "array",
    description:
      "Rows: item {code, description}, quantity, price, taxId; optional discountPct, " +
      "locationCode, glAccountCode, departmentCode, projectCode, costCenterCode, dimensions",
    items: { type: "object" },
  },
  taxAmount: { type: "array", items: { type: "object" } },
  totalAmount: { type: "number", description: "Amount without VAT (required)" },
  roundingAmount: { type: "number" },
  hComment: { type: "string" },
  fComment: { type: "string" },
  expenseClaim: {
    type: "boolean",
    description: "true = expense claim presented by an employee, false/omitted = purchase invoice",
  },
  attachment: {
    type: "object",
    description: "Optional PDF: fileName (*.pdf) and fileContent (base64 of the whole file)",
    properties: {
      fileName: { type: "string" },
      fileContent: { type: "string" },
    },
    required: ["fileName", "fileContent"],
  },
};

export const purchaseInvoiceRequired = [
  "vendor",
  "billNo",
  "docDate",
  "invoiceRows",
  "taxAmount",
  "totalAmount",
];
