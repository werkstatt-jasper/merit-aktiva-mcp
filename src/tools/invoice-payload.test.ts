import { describe, expect, it } from "vitest";
import { parseToolArgs } from "../validation/tool-args.js";
import {
  invoiceRowSchema,
  partySchema,
  taxAmountRowSchema,
  toWireInvoiceRow,
  toWireParty,
  toWireTaxAmount,
} from "./invoice-payload.js";

const TAX_ID = "aa11bb22-cc33-4d44-9e55-ff6677889900";

describe("invoice-payload helpers", () => {
  it("maps invoice rows, tax amounts, and parties to PascalCase wire fields", () => {
    const row = parseToolArgs(invoiceRowSchema, {
      item: { code: "TEENUS", description: "Consult", type: 2, uomName: "tk" },
      quantity: 1,
      price: 100,
      taxId: TAX_ID,
      discountPct: 0,
      locationCode: "1",
      glAccountCode: "3000",
    });
    expect(toWireInvoiceRow(row)).toEqual({
      Item: { Code: "TEENUS", Description: "Consult", Type: 2, UOMName: "tk" },
      Quantity: 1,
      Price: 100,
      TaxId: TAX_ID,
      DiscountPct: 0,
      LocationCode: "1",
      GLAccountCode: "3000",
    });

    const tax = parseToolArgs(taxAmountRowSchema, { taxId: TAX_ID, amount: 22 });
    expect(toWireTaxAmount(tax)).toEqual({ TaxId: TAX_ID, Amount: 22 });

    const party = parseToolArgs(partySchema, {
      id: "3a274294-9c60-4a3d-93f0-1874253f073e",
      name: "Näidis",
      notTDCustomer: false,
      vatAccountable: true,
      countryCode: "EE",
    });
    expect(toWireParty(party)).toEqual({
      Id: "3a274294-9c60-4a3d-93f0-1874253f073e",
      Name: "Näidis",
      NotTDCustomer: false,
      VatAccountable: true,
      CountryCode: "EE",
      RegNo: undefined,
      VatRegNo: undefined,
      Email: undefined,
      Address: undefined,
      City: undefined,
      CurrencyCode: undefined,
    });
  });

  it("rejects invalid nested tax ids", () => {
    expect(() => parseToolArgs(taxAmountRowSchema, { taxId: "nope", amount: 1 })).toThrow(/taxId/);
  });
});
