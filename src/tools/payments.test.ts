import { beforeEach, describe, expect, it, vi } from "vitest";
import paymentsFixture from "../__fixtures__/payments.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createPaymentTools } from "./payments.js";
import { createMockClient } from "./test-helpers.js";

describe("merit_list_payments", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createPaymentTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createPaymentTools(client);
  });

  it("POSTs to /api/v2/getpayments with converted period dates", async () => {
    vi.mocked(client.post).mockResolvedValue(paymentsFixture.list);
    const result = await tools.merit_list_payments.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      paymentType: 1,
      bankId: "deadbeef-0001-4a2b-8c3d-445566778899",
      dateType: 1,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpayments", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      PaymentType: 1,
      BankId: "deadbeef-0001-4a2b-8c3d-445566778899",
      DateType: 1,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(paymentsFixture.list);
  });

  it("requires the period", async () => {
    await expect(tools.merit_list_payments.handler({})).rejects.toThrow(/periodStart/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("rejects a non-integer paymentType", async () => {
    await expect(
      tools.merit_list_payments.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        paymentType: 1.5,
      }),
    ).rejects.toThrow(/paymentType/);
  });
});

describe("merit_list_payment_types", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createPaymentTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createPaymentTools(client);
  });

  it("POSTs to /api/v2/getpaymenttypes with Type", async () => {
    vi.mocked(client.post).mockResolvedValue(paymentsFixture.types);
    const result = await tools.merit_list_payment_types.handler({ type: 3 });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpaymenttypes", { Type: 3 });
    expect(JSON.parse(result.content[0].text)).toEqual(paymentsFixture.types);
  });

  it("requires type 1, 2, or 3", async () => {
    await expect(tools.merit_list_payment_types.handler({})).rejects.toThrow(/type/);
    await expect(tools.merit_list_payment_types.handler({ type: 4 })).rejects.toThrow(/type/);
    expect(client.post).not.toHaveBeenCalled();
  });
});
