import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritItem, MeritItemGroup } from "../types/merit.js";
import {
  guidString,
  optionalGuid,
  optionalInt,
  optionalNumber,
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

    merit_create_items: {
      description:
        "Create Merit Aktiva items (POST /api/v2/senditems). Each item needs type (1 stock, 2 " +
        "service, 3 item), usage (1 sales, 2 purchases, 3 both), code, and description. " +
        "uomName is required for stock items. Returns [{ ItemId, Code }].",
      inputSchema: {
        type: "object" as const,
        properties: {
          items: {
            type: "array",
            description: "Items to create (required)",
            items: { type: "object" },
          },
        },
        required: ["items"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createItemsSchema, params);
        const response = await client.post<unknown>("/api/v2/senditems", {
          Items: args.items.map((item) => ({
            Type: item.type,
            Usage: item.usage,
            Code: item.code,
            Description: item.description,
            UOMName: item.uomName,
            EANCode: item.eanCode,
            TaxId: item.taxId,
            ItemGrCode: item.itemGrCode,
            SalesAccCode: item.salesAccCode,
            PurchaseAccCode: item.purchaseAccCode,
          })),
        });
        return jsonToolResult(response);
      },
    },

    merit_update_item: {
      description:
        "Update a Merit Aktiva item (POST /api/v1/updateitem). id is required; other fields are " +
        "optional patches.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Item GUID (required)" },
          code: { type: "string" },
          description: { type: "string" },
          salesPrice: { type: "number" },
          itemGrCode: { type: "string" },
          discountPct: { type: "number" },
          eanCode: { type: "string" },
          taxId: { type: "string" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(updateItemSchema, params);
        const response = await client.post<unknown>("/api/v1/updateitem", {
          Id: args.id,
          Code: args.code,
          Description: args.description,
          SalesPrice: args.salesPrice,
          ItemGrCode: args.itemGrCode,
          DiscountPct: args.discountPct,
          EANCode: args.eanCode,
          TaxId: args.taxId,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_item_groups: {
      description:
        "Create Merit Aktiva item groups (POST /api/v2/senditemgroups). Each group needs code " +
        "and name.",
      inputSchema: {
        type: "object" as const,
        properties: {
          itemGroups: {
            type: "array",
            description: "Groups to create (required)",
            items: { type: "object" },
          },
        },
        required: ["itemGroups"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createItemGroupsSchema, params);
        const response = await client.post<unknown>("/api/v2/senditemgroups", {
          ItemGroups: args.itemGroups.map((group) => ({
            Code: group.code,
            Name: group.name,
          })),
        });
        return jsonToolResult(response);
      },
    },
  };
}

const createItemsSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        usage: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        code: z.string().min(1).max(20),
        description: z.string().min(1).max(100),
        uomName: optionalString,
        eanCode: optionalString,
        taxId: optionalGuid,
        itemGrCode: optionalString,
        salesAccCode: optionalString,
        purchaseAccCode: optionalString,
      }),
    )
    .min(1),
});

const updateItemSchema = z.object({
  id: guidString,
  code: optionalString,
  description: optionalString,
  salesPrice: optionalNumber,
  itemGrCode: optionalString,
  discountPct: optionalNumber,
  eanCode: optionalString,
  taxId: optionalGuid,
});

const createItemGroupsSchema = z.object({
  itemGroups: z
    .array(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
      }),
    )
    .min(1),
});
