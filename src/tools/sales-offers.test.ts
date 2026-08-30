import { beforeEach, describe, expect, it, vi } from "vitest";
import offersFixture from "../__fixtures__/sales-offers.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createSalesOfferTools } from "./sales-offers.js";
import { createMockClient } from "./test-helpers.js";

const taxId = "aa11bb22-cc33-4d44-9e55-ff6677889900";
const offerId = "11111111-2222-4333-8444-555555555555";

describe("sales offer tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createSalesOfferTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createSalesOfferTools(client);
  });

  it("lists offers with converted period dates", async () => {
    vi.mocked(client.post).mockResolvedValue(offersFixture.list);
    const result = await tools.merit_list_sales_offers.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      dateType: 0,
      unPaid: true,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getoffers", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      DateType: 0,
      UnPaid: true,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(offersFixture.list);
  });

  it("requires periodStart/periodEnd and rejects invalid dateType", async () => {
    await expect(tools.merit_list_sales_offers.handler({})).rejects.toThrow(/periodStart/);
    await expect(
      tools.merit_list_sales_offers.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        dateType: 2,
      }),
    ).rejects.toThrow(/dateType/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("gets one offer by GUID", async () => {
    vi.mocked(client.post).mockResolvedValue(offersFixture.detail);
    const result = await tools.merit_get_sales_offer.handler({ id: offerId });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getoffer", { Id: offerId });
    expect(JSON.parse(result.content[0].text)).toEqual(offersFixture.detail);
  });

  it("requires a GUID for get", async () => {
    await expect(tools.merit_get_sales_offer.handler({})).rejects.toThrow(/id/);
    await expect(tools.merit_get_sales_offer.handler({ id: "OFF-1" })).rejects.toThrow(/GUID/);
  });

  it("creates an offer with nested wire fields", async () => {
    vi.mocked(client.post).mockResolvedValue({ OfferNo: "OFF-1" });
    await tools.merit_create_sales_offer.handler({
      customer: { name: "Näidis", notTDCustomer: true, countryCode: "EE" },
      offerNo: "OFF-1",
      docDate: "2026-08-30",
      expireDate: "2026-09-13",
      deliveryDate: "2026-09-01",
      docType: 1,
      docStatus: 1,
      offerRows: [
        { item: { code: "TEENUS", description: "Consult" }, quantity: 1, price: 100, taxId },
      ],
      taxAmount: [{ taxId, amount: 22 }],
      totalAmount: 100,
      hComment: "header",
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/sendoffer",
      expect.objectContaining({
        OfferNo: "OFF-1",
        DocDate: "20260830",
        ExpireDate: "20260913",
        DeliveryDate: "20260901",
        DocType: 1,
        DocStatus: 1,
        TotalAmount: 100,
        HComment: "header",
        OfferRow: [expect.objectContaining({ TaxId: taxId, Quantity: 1 })],
        TaxAmount: [{ TaxId: taxId, Amount: 22 }],
      }),
    );
  });

  it("rejects create without required fields", async () => {
    await expect(tools.merit_create_sales_offer.handler({ offerNo: "1" })).rejects.toThrow();
  });

  it("updates an offer", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_update_sales_offer.handler({
      offerNo: "OFF-1",
      deliveryDate: "2026-09-02",
      hComment: "updated",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/updateoffer", {
      OfferNo: "OFF-1",
      DeliveryDate: "20260902",
      HComment: "updated",
      FComment: undefined,
    });
  });

  it("requires offerNo to update", async () => {
    await expect(tools.merit_update_sales_offer.handler({})).rejects.toThrow(/offerNo/);
  });

  it("sets offer status without comment", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_set_sales_offer_status.handler({ id: offerId, newStatus: 2 });
    expect(client.post).toHaveBeenCalledWith("/api/v2/setofferstatus", {
      Id: offerId,
      NewStatus: 2,
      Comment: undefined,
    });
  });

  it("requires comment when newStatus is 5", async () => {
    await expect(
      tools.merit_set_sales_offer_status.handler({ id: offerId, newStatus: 5 }),
    ).rejects.toThrow(/comment/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("sets status 5 with a comment", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_set_sales_offer_status.handler({
      id: offerId,
      newStatus: 5,
      comment: "please revise",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/setofferstatus", {
      Id: offerId,
      NewStatus: 5,
      Comment: "please revise",
    });
  });

  it("rejects invalid newStatus", async () => {
    await expect(
      tools.merit_set_sales_offer_status.handler({ id: offerId, newStatus: 6 }),
    ).rejects.toThrow(/newStatus/);
  });

  it("creates an invoice from an offer", async () => {
    vi.mocked(client.post).mockResolvedValue({ InvoiceNo: "1002" });
    const result = await tools.merit_create_invoice_from_sales_offer.handler({ id: offerId });
    expect(client.post).toHaveBeenCalledWith("/api/v2/offer2inv", { Id: offerId });
    expect(JSON.parse(result.content[0].text)).toEqual({ InvoiceNo: "1002" });
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("offer fail"));
    await expect(tools.merit_get_sales_offer.handler({ id: offerId })).rejects.toThrow(
      "offer fail",
    );
  });
});
