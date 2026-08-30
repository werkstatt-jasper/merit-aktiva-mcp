import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritInventoryMovement, MeritLocation } from "../types/merit.js";
import {
  optionalBoolean,
  optionalDateType,
  optionalNumber,
  optionalString,
  parseToolArgs,
  requiredMeritDate,
  requiredNumber,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const emptyToolArgs = z.object({});

const movementType = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const listMovementsSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  withLines: optionalBoolean,
  dateType: optionalDateType,
});

const movementRowSchema = z.object({
  articleCode: z.string().min(1).max(20),
  quantity: requiredNumber,
  uomName: optionalString,
  itemUnitCost: optionalNumber,
  glAccountCode: optionalString,
});

const createMovementSchema = z.object({
  docDate: requiredMeritDate,
  type: movementType,
  rows: z.array(movementRowSchema).min(1),
  docNo: optionalString,
  location1Code: optionalString,
  location2Code: optionalString,
  departmentCode: optionalString,
});

export function createInventoryTools(client: MeritClient) {
  return {
    merit_list_locations: {
      description:
        "List Merit Aktiva stock locations (POST /api/v2/getlocations). No filters. Returns " +
        "Code, Name, and next document numbers per movement type.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritLocation[]>("/api/v2/getlocations", {});
        return jsonToolResult(response);
      },
    },

    merit_list_inventory_movements: {
      description:
        "List Merit Aktiva inventory movements (POST /api/v2/getinvmovements). " +
        "periodStart/periodEnd are ISO YYYY-MM-DD, max 3 months apart. dateType: 0 = document " +
        "date, 1 = changed date. Type: 1 = in, 2 = out, 3 = between stocks.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 3 months after periodStart)",
          },
          withLines: { type: "boolean", description: "Include movement rows" },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = document date, 1 = changed date",
          },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listMovementsSchema, params);
        const response = await client.post<MeritInventoryMovement[]>("/api/v2/getinvmovements", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          WithLines: args.withLines,
          Datetype: args.dateType,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_inventory_movement: {
      description:
        "Create a Merit Aktiva inventory movement (POST /api/v2/SendInvMovement). type: " +
        "1 = in (itemUnitCost required on rows), 2 = out, 3 = between stocks (location2Code is " +
        "the destination). Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          docDate: { type: "string", description: "Document date YYYY-MM-DD (required)" },
          type: {
            type: "number",
            enum: [1, 2, 3],
            description: "1 = in, 2 = out, 3 = between stocks",
          },
          rows: {
            type: "array",
            description: "Movement lines (required)",
            items: { type: "object" },
          },
          docNo: { type: "string" },
          location1Code: { type: "string", description: "Source / stock code" },
          location2Code: { type: "string", description: "Destination stock code (type 3)" },
          departmentCode: { type: "string" },
        },
        required: ["docDate", "type", "rows"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createMovementSchema, params);
        const response = await client.post<unknown>("/api/v2/SendInvMovement", {
          DocDate: args.docDate,
          Type: args.type,
          DocNo: args.docNo,
          Location1Code: args.location1Code,
          Location2Code: args.location2Code,
          DepartmentCode: args.departmentCode,
          Rows: args.rows.map((row) => ({
            ArticleCode: row.articleCode,
            Quantity: row.quantity,
            UOMName: row.uomName,
            ItemUnitCost: row.itemUnitCost,
            GLAccountCode: row.glAccountCode,
          })),
        });
        return jsonToolResult(response);
      },
    },
  };
}
