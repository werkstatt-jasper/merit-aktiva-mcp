import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritDiscount, MeritPrice, MeritPriceQuote } from "../types/merit.js";
import {
  optionalBoolean,
  optionalGuid,
  optionalMeritDate,
  optionalString,
  parseToolArgs,
  requiredMeritDate,
  requiredNumber,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const emptyToolArgs = z.object({});

const priceTargetGroup = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const discountTargetGroup = z.union([z.literal(1), z.literal(2)]);
const discountGroupType = z.union([z.literal(1), z.literal(2)]);

const getPriceSchema = z
  .object({
    itemCode: z.string().min(1),
    docDate: requiredMeritDate,
    customerId: optionalGuid,
    custName: optionalString,
    custRegNo: optionalString,
    currencyCode: optionalString,
    uomName: optionalString,
  })
  .refine((args) => Boolean(args.customerId || args.custName || args.custRegNo), {
    message: "Provide customerId, custName, or custRegNo",
    path: ["custName"],
  });

const priceRowSchema = z.object({
  targetGroup: priceTargetGroup,
  itemCode: z.string().min(1),
  price: requiredNumber,
  targetName: optionalString,
  currencyCode: optionalString,
  discountAllowed: optionalBoolean,
  startDate: optionalMeritDate,
  endDate: optionalMeritDate,
});

const sendPricesSchema = z.object({
  prices: z.array(priceRowSchema).min(1),
});

const discountRowSchema = z.object({
  targetGroup: discountTargetGroup,
  groupType: discountGroupType,
  discountPrc: requiredNumber,
  targetName: optionalString,
  groupCode: optionalString,
  startDate: optionalMeritDate,
  endDate: optionalMeritDate,
});

const sendDiscountsSchema = z.object({
  discounts: z.array(discountRowSchema).min(1),
});

export function createPriceTools(client: MeritClient) {
  return {
    merit_list_prices: {
      description: "List Merit Aktiva sales prices (POST /api/v2/getprices). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritPrice[]>("/api/v2/getprices", {});
        return jsonToolResult(response);
      },
    },

    merit_get_price: {
      description:
        "Get the valid sales price for a customer on a date (POST /api/v2/getprice). " +
        "itemCode and docDate are required; provide customerId, or custName / custRegNo.",
      inputSchema: {
        type: "object" as const,
        properties: {
          itemCode: { type: "string", description: "Item code (required)" },
          docDate: { type: "string", description: "Document date YYYY-MM-DD (required)" },
          customerId: { type: "string", description: "Customer GUID (wins over name/regNo)" },
          custName: { type: "string" },
          custRegNo: { type: "string" },
          currencyCode: { type: "string" },
          uomName: { type: "string" },
        },
        required: ["itemCode", "docDate"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(getPriceSchema, params);
        const response = await client.post<MeritPriceQuote>("/api/v2/getprice", {
          ItemCode: args.itemCode,
          DocDate: args.docDate,
          CustomerId: args.customerId,
          CustName: args.custName,
          CustRegno: args.custRegNo,
          CurrencyCode: args.currencyCode,
          UOMName: args.uomName,
        });
        return jsonToolResult(response);
      },
    },

    merit_send_prices: {
      description:
        "Create or replace Merit Aktiva sales prices (POST /api/v2/sendprices). targetGroup: " +
        "0 = campaign, 1 = customer, 2 = customer group.",
      inputSchema: {
        type: "object" as const,
        properties: {
          prices: {
            type: "array",
            description: "Price rows (required)",
            items: { type: "object" },
          },
        },
        required: ["prices"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(sendPricesSchema, params);
        const response = await client.post<unknown>("/api/v2/sendprices", {
          Prices: args.prices.map((price) => ({
            TargetGroup: price.targetGroup,
            TargetName: price.targetName,
            ItemCode: price.itemCode,
            Price: price.price,
            CurrencyCode: price.currencyCode,
            DiscountAllowed: price.discountAllowed,
            StartDate: price.startDate,
            EndDate: price.endDate,
          })),
        });
        return jsonToolResult(response);
      },
    },

    merit_list_discounts: {
      description: "List Merit Aktiva sales discounts (POST /api/v2/getdiscounts). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritDiscount[]>("/api/v2/getdiscounts", {});
        return jsonToolResult(response);
      },
    },

    merit_send_discounts: {
      description:
        "Create or replace Merit Aktiva sales discounts (POST /api/v2/senddiscounts). " +
        "targetGroup: 1 = customer, 2 = customer group. groupType: 1 = item, 2 = item group.",
      inputSchema: {
        type: "object" as const,
        properties: {
          discounts: {
            type: "array",
            description: "Discount rows (required)",
            items: { type: "object" },
          },
        },
        required: ["discounts"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(sendDiscountsSchema, params);
        const response = await client.post<unknown>("/api/v2/senddiscounts", {
          Discounts: args.discounts.map((discount) => ({
            TargetGroup: discount.targetGroup,
            TargetName: discount.targetName,
            GroupType: discount.groupType,
            GroupCode: discount.groupCode,
            DiscountPrc: discount.discountPrc,
            StartDate: discount.startDate,
            EndDate: discount.endDate,
          })),
        });
        return jsonToolResult(response);
      },
    },
  };
}
