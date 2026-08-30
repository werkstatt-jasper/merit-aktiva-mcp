import { beforeEach, describe, expect, it, vi } from "vitest";
import faFixture from "../__fixtures__/fixed-assets.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createFixedAssetTools } from "./fixed-assets.js";
import { createMockClient } from "./test-helpers.js";

describe("fixed asset tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createFixedAssetTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createFixedAssetTools(client);
  });

  const emptyBodyCases = [
    ["merit_list_fixed_asset_locations", "/api/v2/getfalocations", faFixture.locations],
    ["merit_list_fixed_asset_employees", "/api/v2/getfaresppersons", faFixture.employees],
    ["merit_list_fixed_assets", "/api/v2/getfixassets", faFixture.assets],
  ] as const;

  it.each(emptyBodyCases)("%s POSTs %s with empty body", async (name, path, fixture) => {
    vi.mocked(client.post).mockResolvedValue(fixture);
    const result = await tools[name].handler({});
    expect(client.post).toHaveBeenCalledWith(path, {});
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it("creates fixed assets with official wire spellings", async () => {
    vi.mocked(client.post).mockResolvedValue([{ InventaryNo: "FA-1" }]);
    await tools.merit_create_fixed_assets.handler({
      fixedAssets: [
        {
          inventoryNo: "FA-1",
          name: "Laptop",
          faGroupName: "IT",
          deprCalcMethod: 1,
          deprPct: 25,
          subsidyAmount: 0,
        },
      ],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendfixedassets", {
      FixedAssets: [
        expect.objectContaining({
          InventaryNo: "FA-1",
          Name: "Laptop",
          FAFroupName: "IT",
          DeprCalcMethod: 1,
          DeprPct: 25,
          SubsidAmount: 0,
        }),
      ],
    });
  });

  it("omits deprCalcMethod when null", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_create_fixed_assets.handler({
      fixedAssets: [{ inventoryNo: "FA-2", name: "Chair", deprCalcMethod: null }],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendfixedassets", {
      FixedAssets: [expect.objectContaining({ InventaryNo: "FA-2", DeprCalcMethod: undefined })],
    });
  });

  it("rejects create without assets", async () => {
    await expect(tools.merit_create_fixed_assets.handler({})).rejects.toThrow(/fixedAssets/);
    await expect(
      tools.merit_create_fixed_assets.handler({
        fixedAssets: [{ inventoryNo: "FA-1", name: "X", deprCalcMethod: 2 }],
      }),
    ).rejects.toThrow(/deprCalcMethod/);
  });
});
