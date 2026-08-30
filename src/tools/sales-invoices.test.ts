import { beforeEach, describe, expect, it, vi } from "vitest";
import invoicesFixture from "../__fixtures__/sales-invoices.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createSalesInvoiceTools } from "./sales-invoices.js";
import { createMockClient } from "./test-helpers.js";

describe("merit_list_sales_invoices", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createSalesInvoiceTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createSalesInvoiceTools(client);
  });

  it("POSTs to /api/v2/getinvoices with converted period dates", async () => {
    vi.mocked(client.post).mockResolvedValue(invoicesFixture.list);
    const result = await tools.merit_list_sales_invoices.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      unPaid: true,
      dateType: 0,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinvoices", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      UnPaid: true,
      DateType: 0,
      BankId: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(invoicesFixture.list);
  });

  it("requires periodStart and periodEnd", async () => {
    await expect(tools.merit_list_sales_invoices.handler({})).rejects.toThrow(/periodStart/);
    await expect(
      tools.merit_list_sales_invoices.handler({ periodStart: "2026-08-01" }),
    ).rejects.toThrow(/periodEnd/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("rejects invalid dateType", async () => {
    await expect(
      tools.merit_list_sales_invoices.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        dateType: 2,
      }),
    ).rejects.toThrow(/dateType/);
  });
});

describe("merit_list_sales_invoices_by_number_or_customer", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createSalesInvoiceTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createSalesInvoiceTools(client);
  });

  it("POSTs to /api/v2/getinvoices2 with InvNo/CustName/CustId wire fields", async () => {
    vi.mocked(client.post).mockResolvedValue(invoicesFixture.list);
    const result = await tools.merit_list_sales_invoices_by_number_or_customer.handler({
      invoiceNo: "1001",
      customerName: "Näidis",
      customerId: "3a274294-9c60-4a3d-93f0-1874253f073e",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinvoices2", {
      InvNo: "1001",
      CustName: "Näidis",
      CustId: "3a274294-9c60-4a3d-93f0-1874253f073e",
    });
    expect(JSON.parse(result.content[0].text)).toEqual(invoicesFixture.list);
  });

  it("allows empty filters", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_sales_invoices_by_number_or_customer.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinvoices2", {
      InvNo: undefined,
      CustName: undefined,
      CustId: undefined,
    });
  });

  it("rejects an invalid customerId", async () => {
    await expect(
      tools.merit_list_sales_invoices_by_number_or_customer.handler({ customerId: "xyz" }),
    ).rejects.toThrow(/customerId/);
  });
});

describe("merit_get_sales_invoice", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createSalesInvoiceTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createSalesInvoiceTools(client);
  });

  it("POSTs to /api/v2/getinvoice with Id and AddAttachment", async () => {
    vi.mocked(client.post).mockResolvedValue(invoicesFixture.detail);
    const result = await tools.merit_get_sales_invoice.handler({
      id: "9e8d7c6b-5a49-4838-a726-150493827160",
      addAttachment: false,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinvoice", {
      Id: "9e8d7c6b-5a49-4838-a726-150493827160",
      AddAttachment: false,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(invoicesFixture.detail);
  });

  it("requires a GUID id", async () => {
    await expect(tools.merit_get_sales_invoice.handler({})).rejects.toThrow(/id/);
    await expect(tools.merit_get_sales_invoice.handler({ id: "1001" })).rejects.toThrow(/GUID/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("creates a sales invoice with nested wire fields", async () => {
    vi.mocked(client.post).mockResolvedValue({ InvoiceNo: "MCP-1" });
    const taxId = "aa11bb22-cc33-4d44-9e55-ff6677889900";
    await tools.merit_create_sales_invoice.handler({
      customer: { name: "Näidis", notTDCustomer: true, countryCode: "EE" },
      invoiceNo: "MCP-1",
      docDate: "2026-08-30",
      dueDate: "2026-09-13",
      invoiceRows: [
        {
          item: { code: "TEENUS", description: "Consult" },
          quantity: 1,
          price: 100,
          taxId,
        },
      ],
      taxAmount: [{ taxId, amount: 22 }],
      totalAmount: 100,
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/sendinvoice",
      expect.objectContaining({
        InvoiceNo: "MCP-1",
        DocDate: "20260830",
        DueDate: "20260913",
        TotalAmount: 100,
        InvoiceRow: [
          expect.objectContaining({
            Item: expect.objectContaining({ Code: "TEENUS" }),
            Quantity: 1,
            Price: 100,
            TaxId: taxId,
          }),
        ],
        TaxAmount: [{ TaxId: taxId, Amount: 22 }],
      }),
    );
  });

  it("deletes a sales invoice", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_delete_sales_invoice.handler({
      id: "9e8d7c6b-5a49-4838-a726-150493827160",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/deleteinvoice", {
      Id: "9e8d7c6b-5a49-4838-a726-150493827160",
    });
    expect(tools.merit_delete_sales_invoice.description).toMatch(/^DESTRUCTIVE/);
  });

  it("rejects create without required nested fields", async () => {
    await expect(tools.merit_create_sales_invoice.handler({ invoiceNo: "1" })).rejects.toThrow();
    await expect(tools.merit_delete_sales_invoice.handler({})).rejects.toThrow(/id/);
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("boom"));
    await expect(
      tools.merit_get_sales_invoice.handler({ id: "9e8d7c6b-5a49-4838-a726-150493827160" }),
    ).rejects.toThrow("boom");
  });
});
