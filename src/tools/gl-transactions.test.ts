import { beforeEach, describe, expect, it, vi } from "vitest";
import glFixture from "../__fixtures__/gl-transactions.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createGlTransactionTools } from "./gl-transactions.js";
import { createMockClient } from "./test-helpers.js";

describe("GL transaction read tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createGlTransactionTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createGlTransactionTools(client);
  });

  it("lists GL batches", async () => {
    vi.mocked(client.post).mockResolvedValue(glFixture.list);
    const result = await tools.merit_list_gl_batches.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      dateType: 0,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getglbatches", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      DateType: 0,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(glFixture.list);
  });

  it("gets a GL batch", async () => {
    vi.mocked(client.post).mockResolvedValue(glFixture.detail);
    const result = await tools.merit_get_gl_batch.handler({
      id: "cccccccc-dddd-4eee-8fff-000000000000",
      addAttachment: false,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getglbatch", {
      Id: "cccccccc-dddd-4eee-8fff-000000000000",
      AddAttachment: false,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(glFixture.detail);
  });

  it("lists full GL batches mapping booleans to 0/1", async () => {
    vi.mocked(client.post).mockResolvedValue(glFixture.list);
    await tools.merit_list_gl_batches_full.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
      withLines: true,
      withCostAlloc: false,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/GetGLBatchesFull", {
      PeriodStart: "20260801",
      PeriodEnd: "20260815",
      WithLines: 1,
      WithCostAlloc: 0,
      DateType: undefined,
    });
  });

  it("maps withLines false and withCostAlloc true", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_gl_batches_full.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
      withLines: false,
      withCostAlloc: true,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/GetGLBatchesFull", {
      PeriodStart: "20260801",
      PeriodEnd: "20260815",
      WithLines: 0,
      WithCostAlloc: 1,
      DateType: undefined,
    });
  });

  it("omits WithLines/WithCostAlloc when flags are unset", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_gl_batches_full.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-15",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/GetGLBatchesFull", {
      PeriodStart: "20260801",
      PeriodEnd: "20260815",
      WithLines: undefined,
      WithCostAlloc: undefined,
      DateType: undefined,
    });
  });

  it("requires period and GUID", async () => {
    await expect(tools.merit_list_gl_batches.handler({})).rejects.toThrow(/periodStart/);
    await expect(tools.merit_get_gl_batch.handler({ id: "x" })).rejects.toThrow(/GUID/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("creates a GL batch", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_gl_batch.handler({
      docNo: "MEMO-MCP",
      batchDate: "2026-08-30",
      entryRows: [
        { accountCode: "1910", debit: 10, memo: "test" },
        { accountCode: "5610", credit: 10, memo: "test" },
      ],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/sendglbatch", {
      DocNo: "MEMO-MCP",
      BatchDate: "20260830",
      CurrencyCode: undefined,
      EntryRow: [
        expect.objectContaining({ AccountCode: "1910", Debit: 10, Memo: "test" }),
        expect.objectContaining({ AccountCode: "5610", Credit: 10 }),
      ],
    });
  });

  it("rejects empty GL entry rows", async () => {
    await expect(
      tools.merit_create_gl_batch.handler({ docNo: "X", batchDate: "2026-08-30", entryRows: [] }),
    ).rejects.toThrow();
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("gl fail"));
    await expect(
      tools.merit_list_gl_batches.handler({ periodStart: "2026-08-01", periodEnd: "2026-08-31" }),
    ).rejects.toThrow("gl fail");
  });
});
