import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritFixedAsset, MeritIdNameResult } from "../types/merit.js";
import { optionalNumber, optionalString, parseToolArgs } from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const emptyToolArgs = z.object({});

const deprMethod = z.union([z.literal(1), z.literal(3), z.literal(4)]);

const fixedAssetRowSchema = z.object({
  inventoryNo: z.string().min(1),
  name: z.string().min(1),
  faGroupName: optionalString,
  deprCalcMethod: deprMethod.nullish().transform((v) => v ?? undefined),
  deprPct: optionalNumber,
  departName: optionalString,
  respPersonName: optionalString,
  loc2Name: optionalString,
  comment: optionalString,
  subsidyAmount: optionalNumber,
  gtuCode: optionalString,
  gtuCodes: optionalString,
});

const createFixedAssetsSchema = z.object({
  fixedAssets: z.array(fixedAssetRowSchema).min(1),
});

export function createFixedAssetTools(client: MeritClient) {
  return {
    merit_list_fixed_asset_locations: {
      description:
        "List Merit Aktiva fixed-asset locations (POST /api/v2/getfalocations). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritIdNameResult[]>("/api/v2/getfalocations", {});
        return jsonToolResult(response);
      },
    },

    merit_list_fixed_asset_employees: {
      description:
        "List Merit Aktiva fixed-asset responsible employees (POST /api/v2/getfaresppersons). " +
        "No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritIdNameResult[]>("/api/v2/getfaresppersons", {});
        return jsonToolResult(response);
      },
    },

    merit_list_fixed_assets: {
      description: "List Merit Aktiva fixed assets (POST /api/v2/getfixassets). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritFixedAsset[]>("/api/v2/getfixassets", {});
        return jsonToolResult(response);
      },
    },

    merit_create_fixed_assets: {
      description:
        "Create Merit Aktiva fixed assets (POST /api/v2/sendfixedassets). Each asset needs " +
        "inventoryNo and name. deprCalcMethod: 1 = linear, 3 = residual, 4 = one-copy (PL). " +
        "Wire fields keep Merit's documented spellings (InventaryNo, FAFroupName).",
      inputSchema: {
        type: "object" as const,
        properties: {
          fixedAssets: {
            type: "array",
            description: "Fixed assets to create (required)",
            items: { type: "object" },
          },
        },
        required: ["fixedAssets"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createFixedAssetsSchema, params);
        const response = await client.post<unknown>("/api/v2/sendfixedassets", {
          FixedAssets: args.fixedAssets.map((asset) => ({
            InventaryNo: asset.inventoryNo,
            Name: asset.name,
            FAFroupName: asset.faGroupName,
            DeprCalcMethod: asset.deprCalcMethod,
            DeprPct: asset.deprPct,
            DepartName: asset.departName,
            RespPersonName: asset.respPersonName,
            Loc2name: asset.loc2Name,
            Comment: asset.comment,
            SubsidAmount: asset.subsidyAmount,
            GTUCode: asset.gtuCode,
            GTUCodes: asset.gtuCodes,
          })),
        });
        return jsonToolResult(response);
      },
    },
  };
}
