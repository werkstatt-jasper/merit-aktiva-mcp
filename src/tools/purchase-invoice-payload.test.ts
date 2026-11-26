import { describe, expect, it } from "vitest";
import { parseToolArgs } from "../validation/tool-args.js";
import {
  createPurchaseInvoiceSchema,
  pdfAttachmentSchema,
  purchaseInvoiceBaseSchema,
  toWirePurchaseInvoice,
} from "./purchase-invoice-payload.js";

const TAX_ID = "aa11bb22-cc33-4d44-9e55-ff6677889900";
const DIM_VALUE_ID = "12345678-aaaa-4bbb-8ccc-1234567890ab";
const FAKE_PDF = Buffer.from("%PDF-1.4\n% fake test document\n%%EOF\n", "latin1").toString(
  "base64",
);

const minimal = {
  vendor: { name: "Example Vendor OÜ", vatAccountable: true, countryCode: "EE" },
  billNo: "TEST-001",
  docDate: "2026-08-30",
  invoiceRows: [
    {
      item: { code: "SERVICE", description: "Test service" },
      quantity: 1,
      price: 80,
      taxId: TAX_ID,
    },
  ],
  taxAmount: [{ taxId: TAX_ID, amount: 17.6 }],
  totalAmount: 80,
};

describe("purchase-invoice payload", () => {
  it("maps every shared field to the Merit wire payload", () => {
    const args = parseToolArgs(createPurchaseInvoiceSchema, {
      ...minimal,
      dueDate: "2026-09-13",
      transactionDate: "2026-08-31",
      refNo: "1234",
      currencyCode: "EUR",
      departmentCode: "DEP1",
      dimensions: [{ dimId: 1, dimValueId: DIM_VALUE_ID, dimCode: "P1" }],
      invoiceRows: [
        {
          ...minimal.invoiceRows[0],
          glAccountCode: "4000",
          departmentCode: "DEP1",
          projectCode: "PRJ1",
          costCenterCode: "CC1",
          dimensions: [{ dimId: 2, dimCode: "X" }],
        },
      ],
      roundingAmount: 0.01,
      hComment: "Before rows",
      fComment: "After rows",
      expenseClaim: true,
      attachment: {
        fileName: " invoice.PDF ",
        fileContent: `${FAKE_PDF.slice(0, 8)}\n${FAKE_PDF.slice(8)}`,
      },
    });
    expect(toWirePurchaseInvoice(args)).toEqual({
      Vendor: {
        Id: undefined,
        Name: "Example Vendor OÜ",
        NotTDCustomer: undefined,
        VatAccountable: true,
        CountryCode: "EE",
        RegNo: undefined,
        VatRegNo: undefined,
        Email: undefined,
        Address: undefined,
        City: undefined,
        CurrencyCode: undefined,
      },
      BillNo: "TEST-001",
      DocDate: "20260830",
      DueDate: "20260913",
      TransactionDate: "20260831",
      RefNo: "1234",
      CurrencyCode: "EUR",
      DepartmentCode: "DEP1",
      Dimensions: [{ DimId: 1, DimValueId: DIM_VALUE_ID, DimCode: "P1" }],
      InvoiceRow: [
        {
          Item: {
            Code: "SERVICE",
            Description: "Test service",
            Type: undefined,
            UOMName: undefined,
          },
          Quantity: 1,
          Price: 80,
          TaxId: TAX_ID,
          DiscountPct: undefined,
          LocationCode: undefined,
          GLAccountCode: "4000",
          DepartmentCode: "DEP1",
          ProjectCode: "PRJ1",
          CostCenterCode: "CC1",
          Dimensions: [{ DimId: 2, DimValueId: undefined, DimCode: "X" }],
        },
      ],
      TaxAmount: [{ TaxId: TAX_ID, Amount: 17.6 }],
      TotalAmount: 80,
      RoundingAmount: 0.01,
      HComment: "Before rows",
      FComment: "After rows",
      ExpenseClaim: true,
      Attachment: { FileName: "invoice.PDF", FileContent: FAKE_PDF },
    });
  });

  it("leaves optional fields out of the JSON body when omitted", () => {
    const args = parseToolArgs(purchaseInvoiceBaseSchema, minimal);
    const body = JSON.parse(JSON.stringify(toWirePurchaseInvoice(args)));
    expect(Object.keys(body).sort()).toEqual(
      ["BillNo", "DocDate", "InvoiceRow", "TaxAmount", "TotalAmount", "Vendor"].sort(),
    );
    expect(Object.keys(body.InvoiceRow[0]).sort()).toEqual(
      ["Item", "Price", "Quantity", "TaxId"].sort(),
    );
  });

  it("trims billNo and rejects a blank bill number", () => {
    const args = parseToolArgs(purchaseInvoiceBaseSchema, { ...minimal, billNo: " TEST-001 " });
    expect(args.billNo).toBe("TEST-001");
    expect(() => parseToolArgs(purchaseInvoiceBaseSchema, { ...minimal, billNo: "   " })).toThrow(
      /billNo/,
    );
  });

  it("does not accept transactionDate on the approval schema", () => {
    const args = parseToolArgs(purchaseInvoiceBaseSchema, {
      ...minimal,
      transactionDate: "2026-08-31",
    });
    expect("transactionDate" in args).toBe(false);
  });
});

describe("PDF attachment validation", () => {
  it("accepts a complete base64 PDF", () => {
    expect(
      parseToolArgs(pdfAttachmentSchema, { fileName: "bill.pdf", fileContent: FAKE_PDF }),
    ).toEqual({ fileName: "bill.pdf", fileContent: FAKE_PDF });
  });

  it("rejects a non-PDF file name", () => {
    expect(() =>
      parseToolArgs(pdfAttachmentSchema, { fileName: "bill.png", fileContent: FAKE_PDF }),
    ).toThrow(/\.pdf/);
  });

  it("rejects content that is not base64", () => {
    expect(() =>
      parseToolArgs(pdfAttachmentSchema, {
        fileName: "bill.pdf",
        fileContent: `data:application/pdf;base64,${FAKE_PDF}`,
      }),
    ).toThrow(/plain base64/);
    expect(() =>
      parseToolArgs(pdfAttachmentSchema, { fileName: "bill.pdf", fileContent: "abc" }),
    ).toThrow(/plain base64/);
  });

  it("rejects base64 that is not a PDF or is truncated", () => {
    const png = Buffer.from("\x89PNG fake image %%EOF", "latin1").toString("base64");
    expect(() =>
      parseToolArgs(pdfAttachmentSchema, { fileName: "bill.pdf", fileContent: png }),
    ).toThrow(/not a complete PDF/);
    const truncated = Buffer.from("%PDF-1.4\n% fake, cut off", "latin1").toString("base64");
    expect(() =>
      parseToolArgs(pdfAttachmentSchema, { fileName: "bill.pdf", fileContent: truncated }),
    ).toThrow(/not a complete PDF/);
  });
});
