import "./env.js";

import { describe, expect, it } from "vitest";
import { loadAuthConfig } from "./auth.js";
import { MeritClient } from "./client.js";

// Live-API smoke test. Gated on credentials: milestone issue M14 owns
// obtaining a Merit test company; until then this suite documents itself as
// blocked-on-credentials and skips cleanly.
const hasCredentials = Boolean(
  process.env.MERIT_API_ID?.trim() && process.env.MERIT_API_KEY?.trim(),
);

describe.skipIf(!hasCredentials)("MeritClient live POST", () => {
  const client = new MeritClient(loadAuthConfig);

  it("POST /api/v1/gettaxes returns the tax list", async () => {
    const taxes = await client.post<Array<Record<string, unknown>>>("/api/v1/gettaxes");
    expect(Array.isArray(taxes)).toBe(true);
    // Keys only — never log values.
    if (taxes.length > 0) {
      expect(Object.keys(taxes[0])).toEqual(expect.arrayContaining(["Id", "Code", "Name"]));
    }
  });
});

describe.skipIf(hasCredentials)("MeritClient live POST (no credentials)", () => {
  it("skips when MERIT_API_ID / MERIT_API_KEY are unset (blocked on M14 test company)", () => {
    expect(hasCredentials).toBe(false);
  });
});
