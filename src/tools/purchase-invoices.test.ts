import { beforeEach, describe, expect, it, vi } from "vitest";
import purchaseFixture from "../__fixtures__/purchase-invoices.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import {
  createPurchaseInvoiceTools,
  DUPLICATE_WINDOW_DAYS,
  SUBMITTED_FOR_APPROVAL_STATUS,
  shiftMeritDate,
} from "./purchase-invoices.js";
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

describe("merit_submit_purchase_invoice_for_approval", () => {
  const taxId = "aa11bb22-cc33-4d44-9e55-ff6677889900";
  const vendorId = "11111111-2222-4333-8444-555555555555";
  const billId = "cccccccc-dddd-4eee-8fff-000000000000";
  const fakePdf = Buffer.from("%PDF-1.4\n% fake test document\n%%EOF\n", "latin1").toString(
    "base64",
  );
  const input = {
    vendor: { id: vendorId },
    billNo: "TEST-042",
    docDate: "2026-08-30",
    invoiceRows: [
      { item: { code: "SERVICE", description: "Test service" }, quantity: 1, price: 80, taxId },
    ],
    taxAmount: [{ taxId, amount: 17.6 }],
    totalAmount: 80,
  };
  let client: MeritClient;
  let tools: ReturnType<typeof createPurchaseInvoiceTools>;

  function mockLists(unconfirmed: unknown, booked: unknown, created: unknown = {}) {
    vi.mocked(client.post).mockImplementation(async (path: string) => {
      if (path === "/api/v2/GetPOrders") return unconfirmed;
      if (path === "/api/v2/getpurchorders") return booked;
      return created;
    });
  }

  function sentToSendPurchOrder() {
    return vi.mocked(client.post).mock.calls.filter(([path]) => path === "/api/v2/sendpurchorder");
  }

  beforeEach(() => {
    client = createMockClient();
    tools = createPurchaseInvoiceTools(client);
  });

  it("checks for duplicates, then posts to sendpurchorder and returns the not-booked status", async () => {
    mockLists([], [], {
      BillId: billId,
      BillNo: "TEST-042",
      VendorId: vendorId,
      RefNo: "777",
      BatchInfo: "ignored",
    });
    const result = await tools.merit_submit_purchase_invoice_for_approval.handler({
      ...input,
      expenseClaim: false,
      attachment: { fileName: "test.pdf", fileContent: fakePdf },
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/GetPOrders", {
      PeriodStart: "20260731",
      PeriodEnd: "20260929",
      DateFilter: 1,
      StatusFilter: 0,
      WithAttachments: false,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpurchorders", {
      PeriodStart: "20260731",
      PeriodEnd: "20260929",
      DateType: 0,
    });
    expect(client.post).toHaveBeenLastCalledWith(
      "/api/v2/sendpurchorder",
      expect.objectContaining({
        Vendor: expect.objectContaining({ Id: vendorId }),
        BillNo: "TEST-042",
        DocDate: "20260830",
        TotalAmount: 80,
        ExpenseClaim: false,
        TransactionDate: undefined,
        Attachment: { FileName: "test.pdf", FileContent: fakePdf },
      }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual({
      BillId: billId,
      BillNo: "TEST-042",
      VendorId: vendorId,
      RefNo: "777",
      Status: SUBMITTED_FOR_APPROVAL_STATUS,
    });
    expect(SUBMITTED_FOR_APPROVAL_STATUS).toBe(
      "Sent to Merit's unconfirmed purchase invoices (Kinnitamata ostuarved). Not booked yet: " +
        "a bookkeeper must confirm it in Merit.",
    );
  });

  it("refuses a second submit for the same vendor id and billNo waiting approval", async () => {
    mockLists(
      [
        {
          PIHId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
          BillNo: " test-042 ",
          VendorId: vendorId.toUpperCase(),
          VendorName: "Example Vendor OÜ",
          DocumentDate: "2026-08-30T00:00:00",
        },
      ],
      [],
    );
    await expect(tools.merit_submit_purchase_invoice_for_approval.handler(input)).rejects.toThrow(
      /Not submitted: vendor bill TEST-042 already exists in Merit as an unconfirmed purchase invoice waiting for approval \(Kinnitamata ostuarved\) \(PIHId bbbbbbbb-cccc-4ddd-8eee-ffffffffffff, BillNo {2}test-042 , vendor Example Vendor OÜ, document date 2026-08-30\)/,
    );
    expect(sentToSendPurchOrder()).toHaveLength(0);
  });

  it("refuses when the same vendor name and billNo is already booked", async () => {
    mockLists(null, [
      { PIHId: "p1", BillNo: "TEST-042", VendorName: "Other Vendor OÜ" },
      { PIHId: "p2", BillNo: "TEST-042", VendorName: "example   vendor oü" },
    ]);
    await expect(
      tools.merit_submit_purchase_invoice_for_approval.handler({
        ...input,
        vendor: { name: "Example Vendor OÜ", vatAccountable: true, countryCode: "EE" },
      }),
    ).rejects.toThrow(
      /as a booked purchase invoice \(PIHId p2, BillNo TEST-042, vendor example {3}vendor oü\)/,
    );
    expect(sentToSendPurchOrder()).toHaveLength(0);
  });

  it("matches expense-claim vendor names and falls back to the vendor id in the message", async () => {
    mockLists([{ PIHId: "e1", BillNo: "TEST-042", ExpVendorName: "Example Vendor OÜ" }], []);
    await expect(
      tools.merit_submit_purchase_invoice_for_approval.handler({
        ...input,
        vendor: { id: vendorId, name: "Example Vendor OÜ" },
      }),
    ).rejects.toThrow(/PIHId e1, BillNo TEST-042, vendor Example Vendor OÜ\)/);

    mockLists([], [{ PIHId: "e2", BillNo: "TEST-042", VendorId: vendorId }]);
    await expect(tools.merit_submit_purchase_invoice_for_approval.handler(input)).rejects.toThrow(
      new RegExp(`vendor ${vendorId}\\)`),
    );

    mockLists([], [{ PIHId: "e3", BillNo: "TEST-042" }]);
    await expect(
      tools.merit_submit_purchase_invoice_for_approval.handler({ ...input, vendor: {} }),
    ).rejects.toThrow(/vendor unknown vendor\)/);
  });

  it("submits when only another vendor or another billNo matches", async () => {
    mockLists(
      [
        { PIHId: "x1", BillNo: "TEST-042", VendorId: "99999999-2222-4333-8444-555555555555" },
        { PIHId: "x2", BillNo: "TEST-043", VendorId: vendorId },
      ],
      "unexpected",
      { BillId: billId },
    );
    await tools.merit_submit_purchase_invoice_for_approval.handler(input);
    mockLists([{ PIHId: "x3", BillNo: "TEST-042", VendorName: "Other" }], [], { BillId: billId });
    await tools.merit_submit_purchase_invoice_for_approval.handler({
      ...input,
      vendor: { name: "Example Vendor OÜ" },
    });
    mockLists([{ PIHId: "x4", BillNo: "TEST-042" }], [], { BillId: billId });
    await tools.merit_submit_purchase_invoice_for_approval.handler(input);
    expect(sentToSendPurchOrder()).toHaveLength(3);
  });

  it("does not submit when the duplicate check fails", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("Merit unavailable"));
    await expect(tools.merit_submit_purchase_invoice_for_approval.handler(input)).rejects.toThrow(
      "Merit unavailable",
    );
    expect(sentToSendPurchOrder()).toHaveLength(0);
  });

  it("validates input before calling Merit", async () => {
    await expect(tools.merit_submit_purchase_invoice_for_approval.handler({})).rejects.toThrow();
    await expect(
      tools.merit_submit_purchase_invoice_for_approval.handler({
        ...input,
        attachment: { fileName: "test.pdf", fileContent: "bm90IGEgcGRm" },
      }),
    ).rejects.toThrow(/not a complete PDF/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("shares the input schema with merit_create_purchase_invoice", () => {
    const submit = tools.merit_submit_purchase_invoice_for_approval.inputSchema;
    const create = tools.merit_create_purchase_invoice.inputSchema;
    const { transactionDate, ...createRest } = create.properties;
    expect(transactionDate).toBeDefined();
    expect(submit.properties).toEqual(createRest);
    expect(submit.required).toEqual(create.required);
    expect(tools.merit_create_purchase_invoice.description).toContain(
      "Books immediately, with no review step. If the company wants a bookkeeper to review " +
        "first, use merit_submit_purchase_invoice_for_approval.",
    );
    expect(tools.merit_list_purchase_orders.description).toContain(
      "merit_submit_purchase_invoice_for_approval",
    );
    expect(tools.merit_submit_purchase_invoice_for_approval.description).toContain(
      `within ${DUPLICATE_WINDOW_DAYS} days`,
    );
  });

  it("shifts Merit dates across month and year ends", () => {
    expect(shiftMeritDate("20260131", 30)).toBe("20260302");
    expect(shiftMeritDate("20260115", -30)).toBe("20251216");
  });
});
