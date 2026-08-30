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

  it("creates and updates items and item groups", async () => {
    vi.mocked(client.post).mockResolvedValue([{ ItemId: "dddddddd-eeee-4fff-8000-111111111111" }]);
    await tools.merit_create_items.handler({
      items: [{ type: 2, usage: 3, code: "MCP1", description: "Test service" }],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/senditems", {
      Items: [
        expect.objectContaining({ Type: 2, Usage: 3, Code: "MCP1", Description: "Test service" }),
      ],
    });

    await tools.merit_update_item.handler({
      id: "dddddddd-eeee-4fff-8000-111111111111",
      description: "Updated",
      salesPrice: 10,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/updateitem", {
      Id: "dddddddd-eeee-4fff-8000-111111111111",
      Code: undefined,
      Description: "Updated",
      SalesPrice: 10,
      ItemGrCode: undefined,
      DiscountPct: undefined,
      EANCode: undefined,
      TaxId: undefined,
    });

    await tools.merit_create_item_groups.handler({
      itemGroups: [{ code: "MCPG", name: "MCP group" }],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/senditemgroups", {
      ItemGroups: [{ Code: "MCPG", Name: "MCP group" }],
    });
  });

  it("rejects invalid item type", async () => {
    await expect(
      tools.merit_create_items.handler({
        items: [{ type: 9, usage: 1, code: "X", description: "Y" }],
      }),
    ).rejects.toThrow(/type/);
    await expect(tools.merit_update_item.handler({})).rejects.toThrow(/id/);
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("items fail"));
    await expect(tools.merit_list_item_groups.handler({})).rejects.toThrow("items fail");
  });
});
