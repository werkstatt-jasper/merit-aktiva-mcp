import { beforeEach, describe, expect, it, vi } from "vitest";
import accountsFixture from "../__fixtures__/accounts.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createAccountTools } from "./accounts.js";
import { createMockClient } from "./test-helpers.js";

describe("merit_list_accounts", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createAccountTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createAccountTools(client);
  });

  it("POSTs to /api/v1/getaccounts without filters", async () => {
    vi.mocked(client.post).mockResolvedValue(accountsFixture.list);
    const result = await tools.merit_list_accounts.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v1/getaccounts", {
      UsageFilter: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(accountsFixture.list);
  });

  it("passes usageFilter through", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_accounts.handler({ usageFilter: 3 });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getaccounts", { UsageFilter: 3 });
  });

  it("rejects out-of-range usageFilter", async () => {
    await expect(tools.merit_list_accounts.handler({ usageFilter: 4 })).rejects.toThrow(
      /usageFilter/,
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("boom"));
    await expect(tools.merit_list_accounts.handler({})).rejects.toThrow("boom");
  });
});
