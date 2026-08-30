import { beforeEach, describe, expect, it, vi } from "vitest";
import purchaseFixture from "../__fixtures__/purchase-invoices.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createPurchaseInvoiceTools } from "./purchase-invoices.js";
import { createMockClient } from "./test-helpers.js";

describe("purchase invoice read tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createPurchaseInvoiceTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createPurchaseInvoiceTools(client);
  });

  it("lists purchase invoices with converted period dates", async () => {
    vi.mocked(client.post).mockResolvedValue(purchaseFixture.list);
    const result = await tools.merit_list_purchase_invoices.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      unPaid: true,
      dateType: 1,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpurchorders", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      UnPaid: true,
      DateType: 1,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(purchaseFixture.list);
  });

  it("requires period on list and rejects invalid dateType", async () => {
    await expect(tools.merit_list_purchase_invoices.handler({})).rejects.toThrow(/periodStart/);
    await expect(
      tools.merit_list_purchase_invoices.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        dateType: 2,
      }),
    ).rejects.toThrow(/dateType/);
  });

  it("gets a purchase invoice by GUID", async () => {
    vi.mocked(client.post).mockResolvedValue(purchaseFixture.detail);
    const result = await tools.merit_get_purchase_invoice.handler({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      skipAttachment: true,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpurchorder", {
      Id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      SkipAttachment: true,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(purchaseFixture.detail);
  });

  it("requires a GUID id for get", async () => {
    await expect(tools.merit_get_purchase_invoice.handler({ id: "nope" })).rejects.toThrow(/GUID/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("lists purchase orders via GetPOrders", async () => {
    vi.mocked(client.post).mockResolvedValue(purchaseFixture.orders);
    const result = await tools.merit_list_purchase_orders.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      dateFilter: 2,
      statusFilter: 0,
      withAttachments: false,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/GetPOrders", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      DateFilter: 2,
      StatusFilter: 0,
      WithAttachments: false,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(purchaseFixture.orders);
  });

  it("rejects invalid purchase-order dateFilter", async () => {
    await expect(
      tools.merit_list_purchase_orders.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        dateFilter: 3,
      }),
    ).rejects.toThrow(/dateFilter/);
  });

  it("creates and deletes a purchase invoice", async () => {
    vi.mocked(client.post).mockResolvedValue({ BillId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    const taxId = "aa11bb22-cc33-4d44-9e55-ff6677889900";
    await tools.merit_create_purchase_invoice.handler({
      vendor: { name: "Tarnija", vatAccountable: true, countryCode: "EE" },
      billNo: "PI-MCP-1",
      docDate: "2026-08-30",
      invoiceRows: [
        { item: { code: "TEENUS", description: "Consult" }, quantity: 1, price: 80, taxId },
      ],
      taxAmount: [{ taxId, amount: 17.6 }],
      totalAmount: 80,
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/sendpurchinvoice",
      expect.objectContaining({
        BillNo: "PI-MCP-1",
        DocDate: "20260830",
        TotalAmount: 80,
      }),
    );

    await tools.merit_delete_purchase_invoice.handler({
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/deletepurchinvoice", {
      Id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(tools.merit_delete_purchase_invoice.description).toMatch(/^DESTRUCTIVE/);
  });

  it("rejects create without required fields", async () => {
    await expect(tools.merit_create_purchase_invoice.handler({})).rejects.toThrow();
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("boom"));
    await expect(
      tools.merit_list_purchase_invoices.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
      }),
    ).rejects.toThrow("boom");
  });
});
