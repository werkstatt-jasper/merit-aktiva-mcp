import { z } from "zod";

import type { MeritClient } from "../client.js";
import type {
  MeritBank,
  MeritDimension,
  MeritFinancialYear,
  MeritNamedCode,
} from "../types/merit.js";
import { optionalBoolean, parseToolArgs } from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const emptyToolArgs = z.object({});

const listDimensionsSchema = z.object({
  allValues: optionalBoolean,
});

export function createReferenceDataTools(client: MeritClient) {
  return {
    merit_list_projects: {
      description:
        "List Merit Aktiva projects (POST /api/v1/getprojects). No filters. Returns Code, Name, " +
        "EndDate.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritNamedCode[]>("/api/v1/getprojects", {});
        return jsonToolResult(response);
      },
    },

    merit_list_cost_centers: {
      description: "List Merit Aktiva cost centers (POST /api/v1/getcostcenters). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritNamedCode[]>("/api/v1/getcostcenters", {});
        return jsonToolResult(response);
      },
    },

    merit_list_dimensions: {
      description:
        "List Merit Aktiva dimensions and their values (POST /api/v2/getdimensions). Set " +
        "allValues to include inactive/ended values.",
      inputSchema: {
        type: "object" as const,
        properties: {
          allValues: { type: "boolean", description: "Include all dimension values" },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listDimensionsSchema, params);
        const response = await client.post<MeritDimension[]>("/api/v2/getdimensions", {
          AllValues: args.allValues,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_departments: {
      description: "List Merit Aktiva departments (POST /api/v1/getdepartments). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritNamedCode[]>("/api/v1/getdepartments", {});
        return jsonToolResult(response);
      },
    },

    merit_list_units: {
      description: "List Merit Aktiva units of measure (POST /api/v1/getunits). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritNamedCode[]>("/api/v1/getunits", {});
        return jsonToolResult(response);
      },
    },

    merit_list_banks: {
      description: "List Merit Aktiva banks / payment methods (POST /api/v1/getbanks). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritBank[]>("/api/v1/getbanks", {});
        return jsonToolResult(response);
      },
    },

    merit_list_financial_years: {
      description:
        "List Merit Aktiva accounting periods / financial years (POST /api/v2/getaccperiods). " +
        "No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritFinancialYear[]>("/api/v2/getaccperiods", {});
        return jsonToolResult(response);
      },
    },
  };
}
