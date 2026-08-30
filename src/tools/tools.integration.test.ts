import "../env.js";

import { afterAll, describe, expect, it } from "vitest";
import { loadAuthConfig } from "../auth.js";
import { MeritClient } from "../client.js";
import { buildAllTools } from "../server-setup.js";

const hasCredentials = Boolean(
  process.env.MERIT_API_ID?.trim() && process.env.MERIT_API_KEY?.trim(),
);

function parseJson(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

function firstGuid(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["Id", "SIHId", "InvoiceId", "BillId", "PIHId", "ItemId", "PaymentId"]) {
    if (typeof record[key] === "string") return record[key];
  }
  const header = record.Header;
  if (header && typeof header === "object") {
    const headerId = (header as Record<string, unknown>).SIHId;
    if (typeof headerId === "string") return headerId;
  }
  return undefined;
}

describe.skipIf(!hasCredentials)("M4/M5 live tools", () => {
  const tools = buildAllTools(new MeritClient(loadAuthConfig));
  const stamp = Date.now().toString(36);
  const customerName = `MCP Test ${stamp}`;
  const itemCode = `MCP${stamp}`.slice(0, 20);
  const invoiceNo = `M${stamp}`.slice(0, 35);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const created: { invoiceId?: string; paymentId?: string } = {};

  afterAll(async () => {
    if (created.paymentId) {
      try {
        await tools.merit_delete_payment.handler({ id: created.paymentId });
      } catch {
        // best-effort cleanup
      }
    }
    if (created.invoiceId) {
      try {
        await tools.merit_delete_sales_invoice.handler({ id: created.invoiceId });
      } catch {
        // best-effort cleanup
      }
    }
  });

  it("round-trips create customer → item → invoice → get → cleanup", async () => {
    const taxes = parseJson(await tools.merit_list_taxes.handler({}));
    expect(Array.isArray(taxes)).toBe(true);
    const taxList = taxes as Array<Record<string, unknown>>;
    const vat22 = taxList.find((t) => t.TaxPct === 22) ?? taxList[0];
    expect(typeof vat22?.Id).toBe("string");
    const taxId = String(vat22.Id);
    const taxPct = typeof vat22.TaxPct === "number" ? vat22.TaxPct : 0;
    const net = 10;
    const vat = Math.round(net * (taxPct / 100) * 100) / 100;

    const customer = parseJson(
      await tools.merit_create_customer.handler({
        name: customerName,
        notTDCustomer: true,
        countryCode: "EE",
        email: "mcp-test@example.com",
      }),
    );
    const customerId = firstGuid(customer);
    expect(customerId).toBeDefined();

    const items = parseJson(
      await tools.merit_create_items.handler({
        items: [{ type: 2, usage: 3, code: itemCode, description: `MCP service ${stamp}` }],
      }),
    );
    const createdItem = Array.isArray(items) ? items[0] : items;
    expect(firstGuid(createdItem) ?? itemCode).toBeTruthy();

    const createdInvoice = parseJson(
      await tools.merit_create_sales_invoice.handler({
        customer: { id: customerId, name: customerName, notTDCustomer: true, countryCode: "EE" },
        invoiceNo,
        docDate: today,
        dueDate: today,
        invoiceRows: [
          {
            item: { code: itemCode, description: `MCP service ${stamp}`, type: 2 },
            quantity: 1,
            price: net,
            taxId,
          },
        ],
        taxAmount: [{ taxId, amount: vat }],
        totalAmount: net,
      }),
    );
    created.invoiceId = firstGuid(createdInvoice);

    if (!created.invoiceId) {
      const listed = parseJson(
        await tools.merit_list_sales_invoices_by_number_or_customer.handler({
          invoiceNo,
        }),
      );
      const first = Array.isArray(listed) ? listed[0] : listed;
      created.invoiceId = firstGuid(first);
    }
    expect(created.invoiceId).toBeDefined();

    const detail = parseJson(
      await tools.merit_get_sales_invoice.handler({ id: created.invoiceId }),
    ) as Record<string, unknown>;
    expect(detail.Header ?? detail).toBeTruthy();

    const banks = parseJson(await tools.merit_list_banks.handler({}));
    const bankList = Array.isArray(banks) ? (banks as Array<Record<string, unknown>>) : [];
    const bank = bankList[0];
    if (bank && (typeof bank.Id === "string" || typeof bank.IBAN === "string")) {
      const payment = parseJson(
        await tools.merit_create_sales_invoice_payment.handler({
          customerName,
          invoiceNo,
          paymentDate: today,
          amount: net + vat,
          bankId: typeof bank.Id === "string" ? bank.Id : undefined,
          iban: typeof bank.IBAN === "string" ? bank.IBAN : undefined,
        }),
      );
      created.paymentId = firstGuid(payment);
    }

    if (created.paymentId) {
      await tools.merit_delete_payment.handler({ id: created.paymentId });
      created.paymentId = undefined;
    }

    await tools.merit_delete_sales_invoice.handler({ id: created.invoiceId });
    created.invoiceId = undefined;
  });

  it("smokes M4 read tools (counts only)", async () => {
    const counts: Record<string, number> = {};
    const listCalls: Array<[string, unknown]> = [
      ["merit_list_projects", {}],
      ["merit_list_cost_centers", {}],
      ["merit_list_dimensions", {}],
      ["merit_list_departments", {}],
      ["merit_list_units", {}],
      ["merit_list_banks", {}],
      ["merit_list_financial_years", {}],
      ["merit_list_items", {}],
      ["merit_list_item_groups", {}],
      ["merit_list_purchase_invoices", { periodStart: monthAgo, periodEnd: today }],
      ["merit_list_purchase_orders", { periodStart: monthAgo, periodEnd: today }],
      ["merit_list_gl_batches", { periodStart: monthAgo, periodEnd: today }],
    ];

    for (const [name, args] of listCalls) {
      const parsed = parseJson(await tools[name].handler(args));
      counts[name] = Array.isArray(parsed) ? parsed.length : 1;
    }

    const reports: Array<[string, unknown]> = [
      ["merit_get_customer_debts_report", { customerName: "" }],
      ["merit_get_profit_report", { endDate: today, periodCount: 1 }],
      ["merit_get_balance_report", { endDate: today, periodCount: 1 }],
      ["merit_get_sales_report", { startDate: monthAgo, endDate: today, reportType: 1 }],
      ["merit_get_purchase_report", { startDate: monthAgo, endDate: today, reportType: 1 }],
    ];
    for (const [name, args] of reports) {
      const parsed = parseJson(await tools[name].handler(args));
      counts[name] = parsed == null ? 0 : 1;
    }

    expect(Object.keys(counts).length).toBeGreaterThan(10);
    // Size only — never log payloads.
    expect(Object.values(counts).every((n) => Number.isFinite(n))).toBe(true);
  });
});

describe.skipIf(hasCredentials)("M4/M5 live tools (no credentials)", () => {
  it("skips when MERIT_API_ID / MERIT_API_KEY are unset", () => {
    expect(hasCredentials).toBe(false);
  });
});
