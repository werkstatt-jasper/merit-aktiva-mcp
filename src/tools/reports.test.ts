import { beforeEach, describe, expect, it, vi } from "vitest";
import reportsFixture from "../__fixtures__/reports.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createReportTools } from "./reports.js";
import { createMockClient } from "./test-helpers.js";

describe("report tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createReportTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createReportTools(client);
  });

  it("posts customer debts report with wire field names", async () => {
    vi.mocked(client.post).mockResolvedValue(reportsFixture.debts);
    const result = await tools.merit_get_customer_debts_report.handler({
      customerName: "",
      overDueDays: 5,
      debtDate: "2026-08-01",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getcustdebtrep", {
      CustName: "",
      CustId: undefined,
      OverDueDays: 5,
      DebtDate: "20260801",
    });
    expect(JSON.parse(result.content[0].text)).toEqual(reportsFixture.debts);
  });

  it("uses postAllPages for customer payments report and CurrncyCode typo", async () => {
    vi.mocked(client.postAllPages).mockResolvedValue(reportsFixture.payments);
    const result = await tools.merit_get_customer_payments_report.handler({
      customerId: "3a274294-9c60-4a3d-93f0-1874253f073e",
      periodStart: "2026-06-01",
      periodEnd: "2026-08-31",
      currencyCode: "EUR",
    });
    expect(client.postAllPages).toHaveBeenCalledWith("/api/v2/getcustpaymrep", {
      CustName: undefined,
      CustId: "3a274294-9c60-4a3d-93f0-1874253f073e",
      PeriodStart: "20260601",
      PeriodEnd: "20260831",
      CurrncyCode: "EUR",
    });
    expect(JSON.parse(result.content[0].text)).toEqual(reportsFixture.payments);
  });

  it("posts profit and balance reports", async () => {
    vi.mocked(client.post).mockResolvedValueOnce(reportsFixture.profit);
    await tools.merit_get_profit_report.handler({
      endDate: "2026-08-31",
      periodCount: 3,
      departmentFilter: "D1",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getprofitrep", {
      EndDate: "20260831",
      PerCount: 3,
      DepFilter: "D1",
    });

    vi.mocked(client.post).mockResolvedValueOnce(reportsFixture.balance);
    await tools.merit_get_balance_report.handler({ endDate: "2026-08-31", periodCount: 1 });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getbalancerep", {
      EndDate: "20260831",
      PerCount: 1,
    });
  });

  it("posts inventory, sales, and purchase reports", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_get_inventory_report.handler({
      reportDate: "2026-08-30",
      location: "1",
      articleGroups: ["SRV"],
      showZero: false,
      withReservations: true,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinventoryreport", {
      RepDate: "20260830",
      Location: "1",
      ArticleGroups: ["SRV"],
      ShowZero: false,
      WithReservations: true,
    });

    await tools.merit_get_inventory_report.handler({ reportDate: "2026-08-30" });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinventoryreport", {
      RepDate: "20260830",
      Location: undefined,
      ArticleGroups: undefined,
      ShowZero: undefined,
      WithReservations: undefined,
    });

    await tools.merit_get_inventory_report.handler({
      reportDate: "2026-08-30",
      articleGroups: null,
    });
    expect(client.post).toHaveBeenLastCalledWith(
      "/api/v2/getinventoryreport",
      expect.objectContaining({ ArticleGroups: undefined }),
    );

    await tools.merit_get_sales_report.handler({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      reportType: 1,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getsalesrep", {
      StartDate: "20260801",
      EndDate: "20260831",
      ReportType: 1,
    });

    await tools.merit_get_purchase_report.handler({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      reportType: 2,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getpurchrep", {
      StartDate: "20260801",
      EndDate: "20260831",
      ReportType: 2,
    });
  });

  it("rejects invalid reportType and missing required fields", async () => {
    await expect(
      tools.merit_get_sales_report.handler({
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        reportType: 9,
      }),
    ).rejects.toThrow(/reportType/);
    await expect(tools.merit_get_profit_report.handler({ endDate: "2026-08-31" })).rejects.toThrow(
      /periodCount/,
    );
    await expect(tools.merit_get_customer_payments_report.handler({})).rejects.toThrow(
      /periodStart/,
    );
    expect(client.post).not.toHaveBeenCalled();
    expect(client.postAllPages).not.toHaveBeenCalled();
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("rep fail"));
    await expect(
      tools.merit_get_balance_report.handler({ endDate: "2026-08-31", periodCount: 1 }),
    ).rejects.toThrow("rep fail");
    vi.mocked(client.postAllPages).mockRejectedValue(new Error("page fail"));
    await expect(
      tools.merit_get_customer_payments_report.handler({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
      }),
    ).rejects.toThrow("page fail");
  });
});
