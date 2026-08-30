import { beforeEach, describe, expect, it, vi } from "vitest";
import itemsFixture from "../__fixtures__/items.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createItemTools } from "./items.js";
import { createMockClient } from "./test-helpers.js";

describe("item read tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createItemTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createItemTools(client);
  });

  it("lists items with filters", async () => {
    vi.mocked(client.post).mockResolvedValue(itemsFixture.list);
    const result = await tools.merit_list_items.handler({
      code: "TEE",
      usage: 3,
      type: 2,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getitems", {
      Id: undefined,
      Code: "TEE",
      Description: undefined,
      LocationCode: undefined,
      Usage: 3,
      Type: 2,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(itemsFixture.list);
  });

  it("lists item groups with empty body", async () => {
    vi.mocked(client.post).mockResolvedValue(itemsFixture.groups);
    const result = await tools.merit_list_item_groups.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getitemgroups", {});
    expect(JSON.parse(result.content[0].text)).toEqual(itemsFixture.groups);
  });

  it("rejects invalid item id", async () => {
    await expect(tools.merit_list_items.handler({ id: "nope" })).rejects.toThrow(/id/);
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("items fail"));
    await expect(tools.merit_list_item_groups.handler({})).rejects.toThrow("items fail");
  });
});
