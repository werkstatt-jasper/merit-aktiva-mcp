import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritItem, MeritItemGroup } from "../types/merit.js";
import {
  optionalGuid,
  optionalInt,
  optionalString,
  parseToolArgs,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listItemsSchema = z.object({
  id: optionalGuid,
  code: optionalString,
  description: optionalString,
  locationCode: optionalString,
  usage: optionalInt,
  type: optionalInt,
});

const emptyToolArgs = z.object({});

export function createItemTools(client: MeritClient) {
  return {
    merit_list_items: {
      description:
        "List/search Merit Aktiva items (POST /api/v1/getitems). id wins over other filters; " +
        "code and description are broad (partial) matches. usage: 1 = sales, 2 = purchases, " +
        "3 = both. type: 1 = stock, 2 = service, 3 = item. locationCode adds inventory qty.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Item GUID (ignores other filters when set)" },
          code: { type: "string", description: "Item code (partial match)" },
          description: { type: "string", description: "Item name/description (partial match)" },
          locationCode: { type: "string", description: "Stock location code (adds on-hand qty)" },
          usage: { type: "number", description: "1 = sales, 2 = purchases, 3 = both" },
          type: { type: "number", description: "1 = stock, 2 = service, 3 = item" },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listItemsSchema, params);
        const response = await client.post<MeritItem | MeritItem[]>("/api/v1/getitems", {
          Id: args.id,
          Code: args.code,
          Description: args.description,
          LocationCode: args.locationCode,
          Usage: args.usage,
          Type: args.type,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_item_groups: {
      description: "List Merit Aktiva item groups (POST /api/v2/getitemgroups). No filters.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritItemGroup[]>("/api/v2/getitemgroups", {});
        return jsonToolResult(response);
      },
    },
  };
}
