import { beforeEach, describe, expect, it, vi } from "vitest";
import accountsFixture from "../__fixtures__/accounts.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import type { MeritAccount } from "../types/merit.js";
import { createAccountTools, withAccountActiveState } from "./accounts.js";
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
    expect(JSON.parse(result.content[0].text)).toEqual(
      accountsFixture.list.map((account) => ({ ...account, IsActive: true })),
    );
  });

  it("keeps the legacy NoActive flag and maps it to IsActive", async () => {
    vi.mocked(client.post).mockResolvedValue([
      { AccountId: "c0ffee00-1234-4abc-9def-001122334499", Code: "9099", NoActive: true },
    ]);
    const result = await tools.merit_list_accounts.handler({});
    expect(JSON.parse(result.content[0].text)).toEqual([
      {
        AccountId: "c0ffee00-1234-4abc-9def-001122334499",
        Code: "9099",
        NoActive: true,
        IsActive: false,
      },
    ]);
  });

  it("keeps the NonActive flag and maps it to IsActive", async () => {
    vi.mocked(client.post).mockResolvedValue(accountsFixture.nonActiveList);
    const result = await tools.merit_list_accounts.handler({});
    const parsed = JSON.parse(result.content[0].text) as MeritAccount[];
    expect(parsed.map((a) => [a.Code, a.NonActive, a.IsActive])).toEqual([
      ["9001", false, true],
      ["9002", true, false],
    ]);
    expect(parsed[1]).toMatchObject(accountsFixture.nonActiveList[1]);
  });

  it("passes non-array responses through unchanged", async () => {
    vi.mocked(client.post).mockResolvedValue(null);
    const result = await tools.merit_list_accounts.handler({});
    expect(JSON.parse(result.content[0].text)).toBeNull();
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

describe("withAccountActiveState", () => {
  it("prefers NonActive over NoActive when both are present", () => {
    expect(withAccountActiveState({ NonActive: true, NoActive: false }).IsActive).toBe(false);
    expect(withAccountActiveState({ NonActive: false, NoActive: true }).IsActive).toBe(true);
  });

  it("falls back to NoActive when NonActive is not a recognised flag", () => {
    expect(withAccountActiveState({ NonActive: "maybe", NoActive: true }).IsActive).toBe(false);
  });

  it("accepts numeric and string flags", () => {
    expect(withAccountActiveState({ NonActive: 1 }).IsActive).toBe(false);
    expect(withAccountActiveState({ NonActive: 0 }).IsActive).toBe(true);
    expect(withAccountActiveState({ NonActive: " TRUE " }).IsActive).toBe(false);
    expect(withAccountActiveState({ NonActive: "1" }).IsActive).toBe(false);
    expect(withAccountActiveState({ NonActive: "false" }).IsActive).toBe(true);
    expect(withAccountActiveState({ NonActive: "0" }).IsActive).toBe(true);
  });

  it("leaves accounts without a flag unchanged", () => {
    const account = { Code: "9003", NonActive: null };
    expect(withAccountActiveState(account)).toBe(account);
    expect(withAccountActiveState({ Code: "9004" })).toEqual({ Code: "9004" });
  });

  it("leaves non-object items unchanged", () => {
    expect(withAccountActiveState(null as unknown as MeritAccount)).toBeNull();
    expect(withAccountActiveState("x" as unknown as MeritAccount)).toBe("x");
  });
});
