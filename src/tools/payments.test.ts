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

describe("payment write tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createPaymentTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createPaymentTools(client);
  });

  it("creates a sales invoice payment with yyyymmdd date", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_sales_invoice_payment.handler({
      customerName: "Näidis",
      invoiceNo: "MCP-1",
      paymentDate: "2026-08-30",
      amount: 122,
      iban: "EE11",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendpayment", {
      CustomerName: "Näidis",
      InvoiceNo: "MCP-1",
      PaymentDate: "20260830",
      Amount: 122,
      BankId: undefined,
      IBAN: "EE11",
      RefNo: undefined,
      CurrencyCode: undefined,
    });
  });

  it("creates a purchase payment with yyyyMMddHHmm date", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_purchase_invoice_payment.handler({
      vendorName: "Tarnija",
      billNo: "PI-1",
      paymentDate: "2026-08-30T14:05",
      amount: 50,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendPaymentV", {
      VendorName: "Tarnija",
      BillNo: "PI-1",
      PaymentDate: "202608301405",
      Amount: 50,
      BankId: undefined,
      IBAN: undefined,
      RefNo: undefined,
      CurrencyCode: undefined,
    });
  });

  it("creates a sales offer payment with yyyyMMddHHmm date", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_sales_offer_payment.handler({
      customerName: "Näidis",
      offerNo: "OFF-1",
      paymentDate: "2026-08-30T09:15",
      amount: 50,
      currencyRate: 1,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendPaymentO", {
      CustomerName: "Näidis",
      OfferNo: "OFF-1",
      PaymentDate: "202608300915",
      Amount: 50,
      BankId: undefined,
      IBAN: undefined,
      RefNo: undefined,
      CurrencyCode: undefined,
      CurrencyRate: 1,
    });
  });

  it("rejects offer payment without required fields", async () => {
    await expect(tools.merit_create_sales_offer_payment.handler({})).rejects.toThrow(
      /customerName/,
    );
  });

  it("deletes a payment", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_delete_payment.handler({ id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    expect(client.post).toHaveBeenCalledWith("/api/v1/deletepayment", {
      Id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(tools.merit_delete_payment.description).toMatch(/^DESTRUCTIVE/);
  });

  it("rejects missing required payment fields", async () => {
    await expect(tools.merit_create_sales_invoice_payment.handler({})).rejects.toThrow(
      /customerName/,
    );
    await expect(tools.merit_delete_payment.handler({ id: "x" })).rejects.toThrow(/GUID/);
  });
});
