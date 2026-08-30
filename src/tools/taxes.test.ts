import { beforeEach, describe, expect, it, vi } from "vitest";
import taxesFixture from "../__fixtures__/taxes.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createTaxTools } from "./taxes.js";
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
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("boom"));
    await expect(tools.merit_list_taxes.handler({})).rejects.toThrow("boom");
  });
});
