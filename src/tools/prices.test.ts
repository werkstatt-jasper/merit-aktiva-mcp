import { beforeEach, describe, expect, it, vi } from "vitest";
import pricesFixture from "../__fixtures__/prices.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createPriceTools } from "./prices.js";
import { createMockClient } from "./test-helpers.js";

describe("price and discount tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createPriceTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createPriceTools(client);
  });

  it("lists prices and discounts with empty bodies", async () => {
    vi.mocked(client.post).mockResolvedValueOnce(pricesFixture.prices);
    const prices = await tools.merit_list_prices.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getprices", {});
    expect(JSON.parse(prices.content[0].text)).toEqual(pricesFixture.prices);

    vi.mocked(client.post).mockResolvedValueOnce(pricesFixture.discounts);
    const discounts = await tools.merit_list_discounts.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getdiscounts", {});
    expect(JSON.parse(discounts.content[0].text)).toEqual(pricesFixture.discounts);
  });

  it("gets a price with customerId", async () => {
    vi.mocked(client.post).mockResolvedValue(pricesFixture.quote);
    const result = await tools.merit_get_price.handler({
      itemCode: "TEENUS",
      docDate: "2026-08-30",
      customerId: "3a274294-9c60-4a3d-93f0-1874253f073e",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getprice", {
      ItemCode: "TEENUS",
      DocDate: "20260830",
      CustomerId: "3a274294-9c60-4a3d-93f0-1874253f073e",
      CustName: undefined,
      CustRegno: undefined,
      CurrencyCode: undefined,
      UOMName: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(pricesFixture.quote);
  });

  it("gets a price with custName", async () => {
    vi.mocked(client.post).mockResolvedValue(pricesFixture.quote);
    await tools.merit_get_price.handler({
      itemCode: "TEENUS",
      docDate: "2026-08-30",
      custName: "Näidis",
      custRegNo: "12345678",
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/getprice",
      expect.objectContaining({ CustName: "Näidis", CustRegno: "12345678" }),
    );
  });

  it("requires a customer identifier for get price", async () => {
    await expect(
      tools.merit_get_price.handler({ itemCode: "TEENUS", docDate: "2026-08-30" }),
    ).rejects.toThrow(/custName/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("sends prices", async () => {
    vi.mocked(client.post).mockResolvedValue("OK");
    await tools.merit_send_prices.handler({
      prices: [
        {
          targetGroup: 1,
          targetName: "Näidis",
          itemCode: "TEENUS",
          price: 90,
          discountAllowed: true,
          startDate: "2026-09-01",
          endDate: "2026-12-31",
        },
      ],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendprices", {
      Prices: [
        {
          TargetGroup: 1,
          TargetName: "Näidis",
          ItemCode: "TEENUS",
          Price: 90,
          CurrencyCode: undefined,
          DiscountAllowed: true,
          StartDate: "20260901",
          EndDate: "20261231",
        },
      ],
    });
  });

  it("sends discounts", async () => {
    vi.mocked(client.post).mockResolvedValue("OK");
    await tools.merit_send_discounts.handler({
      discounts: [
        {
          targetGroup: 2,
          targetName: "VIP",
          groupType: 1,
          groupCode: "TEENUS",
          discountPrc: 10,
        },
      ],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/senddiscounts", {
      Discounts: [
        {
          TargetGroup: 2,
          TargetName: "VIP",
          GroupType: 1,
          GroupCode: "TEENUS",
          DiscountPrc: 10,
          StartDate: undefined,
          EndDate: undefined,
        },
      ],
    });
  });

  it("rejects invalid price and discount rows", async () => {
    await expect(tools.merit_send_prices.handler({ prices: [] })).rejects.toThrow();
    await expect(
      tools.merit_send_discounts.handler({
        discounts: [{ targetGroup: 0, groupType: 1, discountPrc: 5 }],
      }),
    ).rejects.toThrow(/targetGroup/);
  });
});
