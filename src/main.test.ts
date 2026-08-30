import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  startStdioServer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./server-setup.js", async () => {
  const mod = await vi.importActual<typeof import("./server-setup.js")>("./server-setup.js");
  return {
    ...mod,
    startStdioServer: hoisted.startStdioServer,
  };
});

vi.mock("./auth.js", () => ({
  loadAuthConfig: vi.fn(() => ({
    apiId: "test-id",
    apiKey: "test-key",
    baseUrl: "https://aktiva.merit.ee",
  })),
}));

const mockSetRequestHandler = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: vi.fn(function MockServer(this: {
    setRequestHandler: typeof mockSetRequestHandler;
    connect: typeof mockConnect;
  }) {
    this.setRequestHandler = mockSetRequestHandler;
    this.connect = mockConnect;
  }),
}));

import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { startApp } from "./main.js";
import * as serverSetup from "./server-setup.js";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../package.json") as { version: string };

describe("startApp", () => {
  beforeEach(() => {
    hoisted.startStdioServer.mockClear();
    mockSetRequestHandler.mockClear();
    vi.mocked(Server).mockClear();
  });

  it("builds tools, registers handlers, and starts stdio server", async () => {
    const spyTools = vi.spyOn(serverSetup, "registerMcpToolHandlers");
    await startApp();

    expect(spyTools).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        merit_list_customers: expect.anything(),
        merit_list_taxes: expect.anything(),
      }),
    );
    spyTools.mockRestore();

    expect(Server).toHaveBeenCalledWith(
      { name: "merit-aktiva", version: packageVersion },
      { capabilities: { tools: {} } },
    );
    expect(mockSetRequestHandler).toHaveBeenCalled();
    expect(hoisted.startStdioServer).toHaveBeenCalledTimes(1);
    const serverArg = hoisted.startStdioServer.mock.calls[0][0];
    expect(serverArg).toEqual(
      expect.objectContaining({
        setRequestHandler: mockSetRequestHandler,
        connect: mockConnect,
      }),
    );
  });
});
