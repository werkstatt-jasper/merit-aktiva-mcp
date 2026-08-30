import { beforeEach, describe, expect, it, vi } from "vitest";
import vendorsFixture from "../__fixtures__/vendors.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createMockClient } from "./test-helpers.js";
import { createVendorTools } from "./vendors.js";

describe("merit_list_vendors", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createVendorTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createVendorTools(client);
  });

  it("POSTs to /api/v1/getvendors with PascalCase filters", async () => {
    vi.mocked(client.post).mockResolvedValue(vendorsFixture.list);
    const result = await tools.merit_list_vendors.handler({
      name: "Tarnija",
      changedDate: "2026-06-01",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getvendors", {
      Id: undefined,
      RegNo: undefined,
      VatRegNo: undefined,
      Name: "Tarnija",
      ChangedDate: "20260601",
    });
    expect(JSON.parse(result.content[0].text)).toEqual(vendorsFixture.list);
  });

  it("accepts empty args", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_vendors.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v1/getvendors", {
      Id: undefined,
      RegNo: undefined,
      VatRegNo: undefined,
      Name: undefined,
      ChangedDate: undefined,
    });
  });

  it("rejects invalid filters", async () => {
    await expect(tools.merit_list_vendors.handler({ id: "nope" })).rejects.toThrow(/id/);
    await expect(tools.merit_list_vendors.handler({ changedDate: "2026-13-01" })).rejects.toThrow(
      /changedDate/,
    );
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("network"));
    await expect(tools.merit_list_vendors.handler({})).rejects.toThrow("network");
  });
});
