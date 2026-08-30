import { beforeEach, describe, expect, it, vi } from "vitest";
import refFixture from "../__fixtures__/reference-data.json" with { type: "json" };
import type { MeritClient } from "../client.js";
import { createReferenceDataTools } from "./reference-data.js";
import { createMockClient } from "./test-helpers.js";

describe("reference data read tools", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createReferenceDataTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createReferenceDataTools(client);
  });

  const emptyBodyCases = [
    ["merit_list_projects", "/api/v1/getprojects", refFixture.projects],
    ["merit_list_cost_centers", "/api/v1/getcostcenters", refFixture.costCenters],
    ["merit_list_departments", "/api/v1/getdepartments", refFixture.departments],
    ["merit_list_units", "/api/v1/getunits", refFixture.units],
    ["merit_list_banks", "/api/v1/getbanks", refFixture.banks],
    ["merit_list_financial_years", "/api/v2/getaccperiods", refFixture.years],
  ] as const;

  it.each(emptyBodyCases)("%s POSTs %s with empty body", async (name, path, fixture) => {
    vi.mocked(client.post).mockResolvedValue(fixture);
    const result = await tools[name as keyof typeof tools].handler({});
    expect(client.post).toHaveBeenCalledWith(path, {});
    expect(JSON.parse(result.content[0].text)).toEqual(fixture);
  });

  it("lists dimensions with AllValues", async () => {
    vi.mocked(client.post).mockResolvedValue(refFixture.dimensions);
    const result = await tools.merit_list_dimensions.handler({ allValues: true });
    expect(client.post).toHaveBeenCalledWith("/api/v2/getdimensions", { AllValues: true });
    expect(JSON.parse(result.content[0].text)).toEqual(refFixture.dimensions);
  });

  it("lists dimensions without AllValues when omitted", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_dimensions.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getdimensions", { AllValues: undefined });
  });

  it("propagates API errors", async () => {
    vi.mocked(client.post).mockRejectedValue(new Error("ref fail"));
    await expect(tools.merit_list_projects.handler({})).rejects.toThrow("ref fail");
  });
});
