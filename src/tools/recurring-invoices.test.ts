import { beforeEach, describe, expect, it, vi } from "vitest";
import recurringFixture from "../__fixtures__/recurring-invoices.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createRecurringInvoiceTools } from "./recurring-invoices.js";
import { createMockClient } from "./test-helpers.js";

const taxId = "aa11bb22-cc33-4d44-9e55-ff6677889900";
const recurringId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("recurring invoice tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createRecurringInvoiceTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createRecurringInvoiceTools(client);
  });

  it("lists recurring invoices with next-date period", async () => {
    vi.mocked(client.post).mockResolvedValue(recurringFixture.list);
    const result = await tools.merit_list_recurring_invoices.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      dateType: 0,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getperinvoices", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      DateType: 0,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(recurringFixture.list);
  });

  it("requires the period", async () => {
    await expect(tools.merit_list_recurring_invoices.handler({})).rejects.toThrow(/periodStart/);
  });

  it("gets recurring invoice details", async () => {
    vi.mocked(client.post).mockResolvedValue(recurringFixture.detail);
    const result = await tools.merit_get_recurring_invoice.handler({ id: recurringId });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getperinvoice", { Id: recurringId });
    expect(JSON.parse(result.content[0].text)).toEqual(recurringFixture.detail);
  });

  it("creates a recurring invoice without a payer", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_recurring_invoice.handler({
      customer: { name: "Näidis", notTDCustomer: true, countryCode: "EE" },
      startDate: "2026-09-01",
      nextDate: "2026-10-01",
      cycle: 1,
      period: 2,
      invoiceRows: [
        { item: { code: "TEENUS", description: "Rent" }, quantity: 1, price: 50, taxId },
      ],
      taxAmount: [{ taxId, amount: 11 }],
      totalAmount: 50,
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/sendperinvoice",
      expect.objectContaining({
        StartDate: "20260901",
        NextDate: "20261001",
        Cycle: 1,
        Period: 2,
        TotalAmount: 50,
        Payer: undefined,
      }),
    );
  });

  it("creates a recurring invoice with a payer", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_recurring_invoice.handler({
      customer: { id: "3a274294-9c60-4a3d-93f0-1874253f073e" },
      payer: { name: "Payer", notTDCustomer: true, countryCode: "EE" },
      startDate: "2026-09-01",
      nextDate: "2026-10-01",
      endDate: "2027-09-01",
      cycle: 2,
      period: 3,
      invoiceNo: "PER-1",
      invoiceRows: [
        { item: { code: "TEENUS", description: "Rent" }, quantity: 1, price: 50, taxId },
      ],
      taxAmount: [{ taxId, amount: 11 }],
      totalAmount: 50,
      priceInclVat: false,
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/sendperinvoice",
      expect.objectContaining({
        InvoiceNo: "PER-1",
        EndDate: "20270901",
        Cycle: 2,
        Period: 3,
        PriceInclVat: false,
        Payer: expect.objectContaining({ Name: "Payer" }),
      }),
    );
  });

  it("rejects invalid cycle or period", async () => {
    await expect(
      tools.merit_create_recurring_invoice.handler({
        customer: { name: "X" },
        startDate: "2026-09-01",
        nextDate: "2026-10-01",
        cycle: 9,
        period: 2,
        invoiceRows: [
          { item: { code: "TEENUS", description: "Rent" }, quantity: 1, price: 50, taxId },
        ],
        taxAmount: [{ taxId, amount: 11 }],
        totalAmount: 50,
      }),
    ).rejects.toThrow(/cycle/);
  });

  it("lists recurring invoice addresses with empty body", async () => {
    vi.mocked(client.post).mockResolvedValue(recurringFixture.addresses);
    const result = await tools.merit_list_recurring_invoice_addresses.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpershaddress", {});
    expect(JSON.parse(result.content[0].text)).toEqual(recurringFixture.addresses);
  });

  it("sends indication values", async () => {
    vi.mocked(client.post).mockResolvedValue("ok");
    await tools.merit_send_recurring_indication_values.handler({
      artCode: "WATER",
      values: [
        { endValue: 100, address: "Tartu" },
        { quantity: 2, customerId: "3a274294-9c60-4a3d-93f0-1874253f073e" },
      ],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/sendindvalues", {
      ArtCode: "WATER",
      Values: [
        { EndValue: 100, Quantity: undefined, Address: "Tartu", CustomerId: undefined },
        {
          EndValue: undefined,
          Quantity: 2,
          Address: undefined,
          CustomerId: "3a274294-9c60-4a3d-93f0-1874253f073e",
        },
      ],
    });
  });

  it("rejects indication values without artCode", async () => {
    await expect(tools.merit_send_recurring_indication_values.handler({})).rejects.toThrow(
      /artCode/,
    );
  });
});
