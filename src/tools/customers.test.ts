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

  it("creates and updates customers and groups", async () => {
    vi.mocked(client.post).mockResolvedValue({
      Id: "3a274294-9c60-4a3d-93f0-1874253f073e",
      Name: "X",
    });
    await tools.merit_create_customer.handler({
      name: "MCP Test Customer",
      notTDCustomer: true,
      countryCode: "EE",
      email: "test@example.com",
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v2/sendcustomer",
      expect.objectContaining({
        Name: "MCP Test Customer",
        NotTDCustomer: true,
        CountryCode: "EE",
        Email: "test@example.com",
      }),
    );

    await tools.merit_update_customer.handler({
      id: "3a274294-9c60-4a3d-93f0-1874253f073e",
      email: "new@example.com",
    });
    expect(client.post).toHaveBeenCalledWith(
      "/api/v1/updatecustomer",
      expect.objectContaining({
        Id: "3a274294-9c60-4a3d-93f0-1874253f073e",
        Email: "new@example.com",
      }),
    );

    vi.mocked(client.post).mockResolvedValue([]);
    await tools.merit_list_customer_groups.handler({});
    expect(client.post).toHaveBeenCalledWith("/api/v2/getcustomergroups", {});

    await tools.merit_create_customer_group.handler({
      id: "3a274294-9c60-4a3d-93f0-1874253f073e",
      name: "VIP",
      code: "VIP",
    });
    expect(client.post).toHaveBeenCalledWith("/api/v2/sendcustomergroup", {
      Id: "3a274294-9c60-4a3d-93f0-1874253f073e",
      Name: "VIP",
      Code: "VIP",
    });
  });

  it("rejects create/update without required fields", async () => {
    await expect(tools.merit_create_customer.handler({ name: "X" })).rejects.toThrow(
      /notTDCustomer/,
    );
    await expect(tools.merit_update_customer.handler({})).rejects.toThrow(/id/);
    await expect(
      tools.merit_create_customer_group.handler({ name: "X", code: "Y" }),
    ).rejects.toThrow(/id/);
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
