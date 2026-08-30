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

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("boom"));
    await expect(
      tools.merit_get_sales_invoice.handler({ id: "9e8d7c6b-5a49-4838-a726-150493827160" }),
    ).rejects.toThrow("boom");
  });
});
