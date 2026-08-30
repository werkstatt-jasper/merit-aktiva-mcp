import { describe, expect, it } from "vitest";
import { jsonToolResult } from "./list-response.js";

describe("jsonToolResult", () => {
  it("wraps a payload as pretty-printed JSON text content", () => {
    const result = jsonToolResult([{ Id: "x" }]);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual([{ Id: "x" }]);
  });
});
