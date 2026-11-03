import { beforeEach, describe, expect, it, vi } from "vitest";
import taxesFixture from "../__fixtures__/taxes.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createTaxTools, TAX_ACTIVE_FILTER } from "./taxes.js";
import { createMockClient } from "./test-helpers.js";

describe("merit_list_taxes", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createTaxTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createTaxTools(client);
  });

  it("POSTs to /api/v1/gettaxes with an empty body", async () => {
    vi.mocked(client.post).mockResolvedValue(taxesFixture.list);
    const result = await tools.merit_list_taxes.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v1/gettaxes", {});
    expect(JSON.parse(result.content[0].text)).toEqual(taxesFixture.list);
  });

  it("accepts missing args", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_taxes.handler(undefined);
    expect(client.post).toHaveBeenCalledWith("/api/v1/gettaxes", {});
  });

  it("treats a null activeFilter like an omitted one", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_taxes.handler({ activeFilter: null });
    expect(client.post).toHaveBeenCalledWith("/api/v1/gettaxes", {});
  });

  it.each([
    ["all", 0],
    ["active", 1],
    ["inactive", 2],
  ] as const)("maps activeFilter %s to NonActive %i", async (activeFilter, nonActive) => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_taxes.handler({ activeFilter });
    expect(client.post).toHaveBeenCalledWith("/api/v1/gettaxes", { NonActive: nonActive });
    expect(TAX_ACTIVE_FILTER[activeFilter]).toBe(nonActive);
  });

  it("returns only what the API sends for the active filter", async () => {
    const activeOnly = taxesFixture.widenedList.filter((t) => !t.NonActive);
    vi.mocked(client.post).mockResolvedValue(activeOnly);
    const result = await tools.merit_list_taxes.handler({ activeFilter: "active" });
    expect(JSON.parse(result.content[0].text)).toEqual(activeOnly);
  });

  it("passes names over 40 characters and TaxPct of 100 or more through unchanged", async () => {
    vi.mocked(client.post).mockResolvedValue(taxesFixture.widenedList);
    const result = await tools.merit_list_taxes.handler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(taxesFixture.widenedList);
    expect(parsed[0].Name.length).toBeGreaterThan(40);
    expect(parsed[0].TaxPct).toBe(125.5);
  });

  it("rejects an unknown activeFilter", async () => {
    await expect(tools.merit_list_taxes.handler({ activeFilter: "yes" })).rejects.toThrow(
      /activeFilter/,
    );
    await expect(tools.merit_list_taxes.handler({ activeFilter: 1 })).rejects.toThrow(
      /activeFilter/,
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it("documents the filter in the input schema", () => {
    expect(tools.merit_list_taxes.inputSchema.properties.activeFilter.enum).toEqual([
      "all",
      "active",
      "inactive",
    ]);
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("boom"));
    await expect(tools.merit_list_taxes.handler({})).rejects.toThrow("boom");
  });
});
