import { beforeEach, describe, expect, it, vi } from "vitest";
import customersFixture from "../__fixtures__/customers.json" with { type: "json" };
import { MeritApiError } from "../api-error.js";
import type { MeritClient } from "../client.js";
import { createCustomerTools } from "./customers.js";
import { createMockClient } from "./test-helpers.js";

describe("merit_list_customers", () => {
  let client: MeritClient;
  let tools: ReturnType<typeof createCustomerTools>;

  beforeEach(() => {
    client = createMockClient();
    tools = createCustomerTools(client);
  });

  it("POSTs to /api/v1/getcustomers with PascalCase filters", async () => {
    vi.mocked(client.post).mockResolvedValue(customersFixture.list);
    const result = await tools.merit_list_customers.handler({
      name: "halduse",
      regNo: "12345678",
      withComments: true,
    });
    expect(client.post).toHaveBeenCalledWith("/api/v1/getcustomers", {
      Id: undefined,
      RegNo: "12345678",
      VatRegNo: undefined,
      Name: "halduse",
      ChangedDate: undefined,
      WithComments: true,
      CommentsFrom: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual(customersFixture.list);
  });

  it("converts ISO dates to Merit yyyymmdd", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_customers.handler({
      changedDate: "2026-08-01",
      commentsFrom: "2026-07-15",
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v1/getcustomers",
      expect.objectContaining({ ChangedDate: "20260801", CommentsFrom: "20260715" }),
    );
  });

  it("accepts a GUID id and empty args", async () => {
    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_customers.handler({
      id: "3a274294-9c60-4a3d-93f0-1874253f073e",
    });
    await tools.merit_list_customers.handler(undefined);
    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid dates and GUIDs", async () => {
    await expect(tools.merit_list_customers.handler({ changedDate: "01.08.2026" })).rejects.toThrow(
      /changedDate/,
    );
    await expect(tools.merit_list_customers.handler({ id: "not-a-guid" })).rejects.toThrow(/id/);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("propagates MeritApiError", async () => {
    vi.mocked(client.post).mockRejectedValue(
      new MeritApiError({
        kind: "http",
        message: "boom",
        httpStatus: 500,
        method: "POST",
        url: "https://aktiva.merit.ee/api/v1/getcustomers",
      }),
    );
    await expect(tools.merit_list_customers.handler({})).rejects.toMatchObject({
      httpStatus: 500,
    });
  });
});
