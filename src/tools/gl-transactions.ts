import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritGlBatchDetail, MeritGlBatchListItem } from "../types/merit.js";
import {
  guidString,
  optionalBoolean,
  optionalDateType,
  optionalGuid,
  optionalNumber,
  optionalString,
  parseToolArgs,
  requiredMeritDate,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listGlBatchesSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  dateType: optionalDateType,
});

const getGlBatchSchema = z.object({
  id: guidString,
  addAttachment: optionalBoolean,
});

const listGlBatchesFullSchema = z.object({
  periodStart: requiredMeritDate,
  periodEnd: requiredMeritDate,
  withLines: optionalBoolean,
  withCostAlloc: optionalBoolean,
  dateType: optionalDateType,
});

export function createGlTransactionTools(client: MeritClient) {
  return {
    merit_list_gl_batches: {
      description:
        "List Merit Aktiva general-ledger batches (POST /api/v1/getglbatches). " +
        "periodStart/periodEnd are ISO YYYY-MM-DD, max 3 months apart. dateType: 0 = document " +
        "date, 1 = changed date.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 3 months after periodStart)",
          },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = filter by document date, 1 = filter by changed date",
          },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listGlBatchesSchema, params);
        const response = await client.post<MeritGlBatchListItem[]>("/api/v1/getglbatches", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          DateType: args.dateType,
        });
        return jsonToolResult(response);
      },
    },

    merit_get_gl_batch: {
      description:
        "Get one Merit Aktiva GL batch with entries (POST /api/v1/getglbatch). id is the " +
        "batch GUID (GLBId). Set addAttachment to include a file as base64.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "GL batch GUID / GLBId (required)" },
          addAttachment: {
            type: "boolean",
            description: "Include attachment file content as base64",
          },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(getGlBatchSchema, params);
        const response = await client.post<MeritGlBatchDetail>("/api/v1/getglbatch", {
          Id: args.id,
          AddAttachment: args.addAttachment,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_gl_batches_full: {
      description:
        "List Merit Aktiva GL batches with entries and cost allocations in one call " +
        "(POST /api/v1/GetGLBatchesFull). Period max 31 days. withLines/withCostAlloc default " +
        "off when omitted.",
      inputSchema: {
        type: "object" as const,
        properties: {
          periodStart: { type: "string", description: "Period start (YYYY-MM-DD, required)" },
          periodEnd: {
            type: "string",
            description: "Period end (YYYY-MM-DD, required; max 31 days after periodStart)",
          },
          withLines: { type: "boolean", description: "Include entry lines" },
          withCostAlloc: { type: "boolean", description: "Include cost allocations" },
          dateType: {
            type: "number",
            enum: [0, 1],
            description: "0 = filter by document date, 1 = filter by changed date",
          },
        },
        required: ["periodStart", "periodEnd"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listGlBatchesFullSchema, params);
        const response = await client.post<unknown>("/api/v1/GetGLBatchesFull", {
          PeriodStart: args.periodStart,
          PeriodEnd: args.periodEnd,
          WithLines: args.withLines === undefined ? undefined : args.withLines ? 1 : 0,
          WithCostAlloc: args.withCostAlloc === undefined ? undefined : args.withCostAlloc ? 1 : 0,
          DateType: args.dateType,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_gl_batch: {
      description:
        "Create a Merit Aktiva general-ledger batch (POST /api/v1/sendglbatch). entryRows need " +
        "accountCode plus debit and/or credit. batchDate is ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          docNo: { type: "string", description: "Document number, max 35 (required)" },
          batchDate: { type: "string", description: "Batch date YYYY-MM-DD (required)" },
          currencyCode: { type: "string" },
          entryRows: {
            type: "array",
            description: "GL lines (required)",
            items: { type: "object" },
          },
        },
        required: ["docNo", "batchDate", "entryRows"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createGlBatchSchema, params);
        const response = await client.post<unknown>("/api/v1/sendglbatch", {
          DocNo: args.docNo,
          BatchDate: args.batchDate,
          CurrencyCode: args.currencyCode,
          EntryRow: args.entryRows.map((row) => ({
            AccountCode: row.accountCode,
            DepartmentCode: row.departmentCode,
            Debit: row.debit,
            Credit: row.credit,
            ProjectCode: row.projectCode,
            CostCenterCode: row.costCenterCode,
            Memo: row.memo,
            TaxId: row.taxId,
            VatAmount: row.vatAmount,
          })),
        });
        return jsonToolResult(response);
      },
    },
  };
}

const createGlBatchSchema = z.object({
  docNo: z.string().min(1).max(35),
  batchDate: requiredMeritDate,
  currencyCode: optionalString,
  entryRows: z
    .array(
      z.object({
        accountCode: z.string().min(1),
        departmentCode: optionalString,
        debit: optionalNumber,
        credit: optionalNumber,
        projectCode: optionalString,
        costCenterCode: optionalString,
        memo: optionalString,
        taxId: optionalGuid,
        vatAmount: optionalNumber,
      }),
    )
    .min(1),
});
