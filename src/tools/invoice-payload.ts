import { z } from "zod";

import {
  guidString,
  optionalGuid,
  optionalInt,
  optionalNumber,
  optionalString,
  requiredNumber,
} from "../validation/tool-args.js";

export const invoiceItemSchema = z.object({
  code: z.string().min(1),
  description: z.string().min(1),
  type: optionalInt,
  uomName: optionalString,
});

export const invoiceRowSchema = z.object({
  item: invoiceItemSchema,
  quantity: requiredNumber,
  price: requiredNumber,
  taxId: guidString,
  discountPct: optionalNumber,
  locationCode: optionalString,
  glAccountCode: optionalString,
});

export const taxAmountRowSchema = z.object({
  taxId: guidString,
  amount: requiredNumber,
});

export const partySchema = z.object({
  id: optionalGuid,
  name: optionalString,
  notTDCustomer: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
  vatAccountable: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
  countryCode: optionalString,
  regNo: optionalString,
  vatRegNo: optionalString,
  email: optionalString,
  address: optionalString,
  city: optionalString,
  currencyCode: optionalString,
});

export function toWireInvoiceRow(row: z.infer<typeof invoiceRowSchema>): Record<string, unknown> {
  return {
    Item: {
      Code: row.item.code,
      Description: row.item.description,
      Type: row.item.type,
      UOMName: row.item.uomName,
    },
    Quantity: row.quantity,
    Price: row.price,
    TaxId: row.taxId,
    DiscountPct: row.discountPct,
    LocationCode: row.locationCode,
    GLAccountCode: row.glAccountCode,
  };
}

export function toWireTaxAmount(row: z.infer<typeof taxAmountRowSchema>): Record<string, unknown> {
  return { TaxId: row.taxId, Amount: row.amount };
}

export function toWireParty(party: z.infer<typeof partySchema>): Record<string, unknown> {
  return {
    Id: party.id,
    Name: party.name,
    NotTDCustomer: party.notTDCustomer,
    VatAccountable: party.vatAccountable,
    CountryCode: party.countryCode,
    RegNo: party.regNo,
    VatRegNo: party.vatRegNo,
    Email: party.email,
    Address: party.address,
    City: party.city,
    CurrencyCode: party.currencyCode,
  };
}
