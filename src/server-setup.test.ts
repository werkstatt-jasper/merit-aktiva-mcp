import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolRecord } from "./server-setup.js";
import { buildAllTools, registerMcpToolHandlers, startStdioServer } from "./server-setup.js";

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());

vi.mock("./logger.js", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    fatal: vi.fn(),
  },
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(function MockTransport(this: { x?: number }) {
    this.x = 1;
  }),
}));

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

describe("buildAllTools", () => {
  it("returns the placeholder empty catalog", () => {
    expect(buildAllTools()).toEqual({});
  });
});

describe("registerMcpToolHandlers", () => {
  const setRequestHandler = vi.fn();

  beforeEach(() => {
    setRequestHandler.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerWarn.mockReset();
  });

  function registerWith(tools: ToolRecord) {
    registerMcpToolHandlers({ setRequestHandler }, tools);
    const listFn = setRequestHandler.mock.calls[0][1] as () => Promise<{
      tools: { name: string; description: string; inputSchema: object }[];
    }>;
    const callFn = setRequestHandler.mock.calls[1][1] as (req: {
      params: { name: string; arguments?: Record<string, unknown> };
    }) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
    return { listFn, callFn };
  }

  it("lists an empty catalog", async () => {
    const { listFn } = registerWith({});
    expect(setRequestHandler).toHaveBeenCalledTimes(2);
    await expect(listFn()).resolves.toEqual({ tools: [] });
  });

  it("lists registered tools with metadata", async () => {
    const { listFn } = registerWith({
      merit_ping: {
        description: "Ping",
        inputSchema: { type: "object" },
        handler: async () => ({ content: [{ type: "text", text: "pong" }] }),
      },
    });
    const result = await listFn();
    expect(result.tools).toEqual([
      { name: "merit_ping", description: "Ping", inputSchema: { type: "object" } },
    ]);
  });

  it("throws and warns on unknown tool", async () => {
    const { callFn } = registerWith({});
    await expect(callFn({ params: { name: "nope" } })).rejects.toThrow("Unknown tool: nope");
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ component: "tool", tool: "nope", outcome: "unknown_tool" }),
      "mcp tool call",
    );
  });

  it("invokes the handler and logs ok outcome", async () => {
    const handler = vi.fn(async () => ({ content: [{ type: "text", text: "pong" }] }));
    const { callFn } = registerWith({
      merit_ping: { description: "Ping", inputSchema: {}, handler },
    });

    const result = await callFn({ params: { name: "merit_ping", arguments: { a: 1 } } });
    expect(handler).toHaveBeenCalledWith({ a: 1 });
    expect(result.content[0].text).toBe("pong");
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ component: "tool", tool: "merit_ping", outcome: "ok" }),
      "mcp tool call",
    );
  });

  it("logs error outcome when the handler flags isError", async () => {
    const { callFn } = registerWith({
      merit_fail: {
        description: "Fail",
        inputSchema: {},
        handler: async () => ({
          content: [{ type: "text", text: "bad" }],
          isError: true,
        }),
      },
    });

    const result = await callFn({ params: { name: "merit_fail" } });
    expect(result.isError).toBe(true);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error" }),
      "mcp tool call",
    );
  });

  it("wraps handler throws (Error) into an isError result", async () => {
    const { callFn } = registerWith({
      merit_throw: {
        description: "Throw",
        inputSchema: {},
        handler: async () => {
          throw new Error("boom");
        },
      },
    });

    const result = await callFn({ params: { name: "merit_throw" } });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({ error: "boom" });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "handler_throw" }),
      "mcp tool call",
    );
  });

  it("stringifies non-Error throws", async () => {
    const { callFn } = registerWith({
      merit_throw_raw: {
        description: "Throw raw",
        inputSchema: {},
        handler: async () => {
          throw "raw failure";
        },
      },
    });

    const result = await callFn({ params: { name: "merit_throw_raw" } });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual({ error: "raw failure" });
  });
});

describe("startStdioServer", () => {
  beforeEach(() => {
    vi.mocked(StdioServerTransport).mockClear();
    mockLoggerInfo.mockClear();
  });

  it("connects server to stdio transport and logs", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);

    await startStdioServer({ connect });

    expect(StdioServerTransport).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith("Merit Aktiva MCP server running on stdio");
  });
});
