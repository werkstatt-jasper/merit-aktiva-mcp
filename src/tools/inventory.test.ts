import { beforeEach, describe, expect, it, vi } from "vitest";
import inventoryFixture from "../__fixtures__/inventory.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createInventoryTools } from "./inventory.js";
import { createMockClient } from "./test-helpers.js";

describe("inventory tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createInventoryTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createInventoryTools(client);
  });

  it("lists locations with empty body", async () => {
    vi.mocked(client.post).mockResolvedValue(inventoryFixture.locations);
    const result = await tools.merit_list_locations.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getlocations", {});
    expect(JSON.parse(result.content[0].text)).toEqual(inventoryFixture.locations);
  });

  it("lists movements with Datetype wire field", async () => {
    vi.mocked(client.post).mockResolvedValue(inventoryFixture.movements);
    const result = await tools.merit_list_inventory_movements.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      withLines: true,
      dateType: 1,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinvmovements", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      WithLines: true,
      Datetype: 1,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(inventoryFixture.movements);
  });

  it("lists movements without optional filters", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_inventory_movements.handler({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getinvmovements", {
      PeriodStart: "20260801",
      PeriodEnd: "20260831",
      WithLines: undefined,
      Datetype: undefined,
    });
  });

  it("requires the movement period", async () => {
    await expect(tools.merit_list_inventory_movements.handler({})).rejects.toThrow(/periodStart/);
  });

  it("creates an inbound movement", async () => {
    vi.mocked(client.post).mockResolvedValue({});
    await tools.merit_create_inventory_movement.handler({
      docDate: "2026-08-30",
      type: 1,
      location1Code: "LAO",
      rows: [{ articleCode: "KAUP", quantity: 2, itemUnitCost: 5, uomName: "tk" }],
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/SendInvMovement", {
      DocDate: "20260830",
      Type: 1,
      DocNo: undefined,
      Location1Code: "LAO",
      Location2Code: undefined,
      DepartmentCode: undefined,
      Rows: [
        {
          ArticleCode: "KAUP",
          Quantity: 2,
          UOMName: "tk",
          ItemUnitCost: 5,
          GLAccountCode: undefined,
        },
      ],
    });
  });

  it("rejects invalid movement type", async () => {
    await expect(
      tools.merit_create_inventory_movement.handler({
        docDate: "2026-08-30",
        type: 4,
        rows: [{ articleCode: "KAUP", quantity: 1 }],
      }),
    ).rejects.toThrow(/type/);
  });
});
