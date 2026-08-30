import { vi } from "vitest";
import type { MeritClient } from "../client.js";

export function createMockClient(): MeritClient {
  return {
    post: vi.fn(),
    postAllPages: vi.fn(),
    getConfig: vi.fn(),
  } as unknown as MeritClient;
}
