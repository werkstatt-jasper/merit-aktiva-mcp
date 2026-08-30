import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritIdNameResult, MeritVendor, MeritVendorGroup } from "../types/merit.js";
import {
  guidString,
  optionalGuid,
  optionalInt,
  optionalMeritDate,
  optionalNumber,
  optionalString,
  parseToolArgs,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listVendorsSchema = z.object({
  id: optionalGuid,
  regNo: optionalString,
  vatRegNo: optionalString,
  name: optionalString,
  changedDate: optionalMeritDate,
});

export function createVendorTools(client: MeritClient) {
  return {
    merit_list_vendors: {
      description:
        "List/search Merit Aktiva vendors (POST /api/v1/getvendors). With no filters returns all " +
        "vendors — can be very large, so prefer a filter. id wins over other filters; " +
        "regNo/vatRegNo match exactly; name matches partially. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Vendor GUID (ignores other filters when set)" },
          regNo: { type: "string", description: "Registration number (exact match)" },
          vatRegNo: { type: "string", description: "VAT registration number (exact match)" },
          name: { type: "string", description: "Vendor name (partial match)" },
          changedDate: {
            type: "string",
            description: "Only rows changed/created on/after this date (YYYY-MM-DD)",
          },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listVendorsSchema, params);
        const response = await client.post<MeritVendor[]>("/api/v1/getvendors", {
          Id: args.id,
          RegNo: args.regNo,
          VatRegNo: args.vatRegNo,
          Name: args.name,
          ChangedDate: args.changedDate,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_vendor: {
      description:
        "Create a Merit Aktiva vendor (POST /api/v2/sendvendor). Name must be unique (max 150). " +
        "vatAccountable and countryCode are required. Returns { Id, Name }.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Unique vendor name (required)" },
          vatAccountable: { type: "boolean", description: "VAT-registered vendor (required)" },
          countryCode: { type: "string", description: "ISO country code, 2 chars (required)" },
          regNo: { type: "string" },
          vatRegNo: { type: "string" },
          currencyCode: { type: "string" },
          paymentDeadLine: { type: "number" },
          overDueCharge: { type: "number" },
          address: { type: "string" },
          city: { type: "string" },
          county: { type: "string" },
          postalCode: { type: "string" },
          phoneNo: { type: "string" },
          email: { type: "string" },
          vendorType: { type: "number", description: "1 = vendor, 3 = reporting entity" },
          bankAccount: { type: "string" },
          swiftBic: { type: "string", description: "SWIFT/BIC (wire field SWIFT_BIC)" },
        },
        required: ["name", "vatAccountable", "countryCode"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createVendorSchema, params);
        const response = await client.post<MeritIdNameResult>("/api/v2/sendvendor", {
          Name: args.name,
          VatAccountable: args.vatAccountable,
          CountryCode: args.countryCode,
          RegNo: args.regNo,
          VatRegNo: args.vatRegNo,
          CurrencyCode: args.currencyCode,
          PaymentDeadLine: args.paymentDeadLine,
          OverDueCharge: args.overDueCharge,
          Address: args.address,
          City: args.city,
          County: args.county,
          PostalCode: args.postalCode,
          PhoneNo: args.phoneNo,
          Email: args.email,
          VendorType: args.vendorType,
          BankAccount: args.bankAccount,
          SWIFT_BIC: args.swiftBic,
        });
        return jsonToolResult(response);
      },
    },

    merit_update_vendor: {
      description:
        "Update a Merit Aktiva vendor (POST /api/v2/updatevendor). id is required; other fields " +
        "are optional patches. v2 supports Dimensions.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Vendor GUID (required)" },
          name: { type: "string" },
          countryCode: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          phoneNo: { type: "string" },
          email: { type: "string" },
          regNo: { type: "string" },
          vatRegNo: { type: "string" },
          vatAccountable: { type: "boolean" },
          paymentDeadLine: { type: "number" },
          bankAccount: { type: "string" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(updateVendorSchema, params);
        const response = await client.post<MeritIdNameResult>("/api/v2/updatevendor", {
          Id: args.id,
          Name: args.name,
          CountryCode: args.countryCode,
          Address: args.address,
          City: args.city,
          PostalCode: args.postalCode,
          PhoneNo: args.phoneNo,
          Email: args.email,
          RegNo: args.regNo,
          VatRegNo: args.vatRegNo,
          VatAccountable: args.vatAccountable,
          PaymentDeadLine: args.paymentDeadLine,
          BankAccount: args.bankAccount,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_vendor_groups: {
      description: "List Merit Aktiva vendor groups (POST /api/v2/getvendorgroups). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritVendorGroup[]>("/api/v2/getvendorgroups", {});
        return jsonToolResult(response);
      },
    },

    merit_create_vendor_group: {
      description:
        "Create a Merit Aktiva vendor group (POST /api/v2/sendvendorgroup). id (GUID), name " +
        "(max 64), and code (max 20) are required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "New group GUID (required)" },
          name: { type: "string", description: "Group name, max 64 (required)" },
          code: { type: "string", description: "Group code, max 20 (required)" },
        },
        required: ["id", "name", "code"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createGroupSchema, params);
        const response = await client.post<MeritVendorGroup>("/api/v2/sendvendorgroup", {
          Id: args.id,
          Name: args.name,
          Code: args.code,
        });
        return jsonToolResult(response);
      },
    },
  };
}

const createVendorSchema = z.object({
  name: z.string().min(1).max(150),
  vatAccountable: z.boolean(),
  countryCode: z.string().length(2),
  regNo: optionalString,
  vatRegNo: optionalString,
  currencyCode: optionalString,
  paymentDeadLine: optionalInt,
  overDueCharge: optionalNumber,
  address: optionalString,
  city: optionalString,
  county: optionalString,
  postalCode: optionalString,
  phoneNo: optionalString,
  email: optionalString,
  vendorType: optionalInt,
  bankAccount: optionalString,
  swiftBic: optionalString,
});

const updateVendorSchema = z.object({
  id: guidString,
  name: optionalString,
  countryCode: optionalString,
  address: optionalString,
  city: optionalString,
  postalCode: optionalString,
  phoneNo: optionalString,
  email: optionalString,
  regNo: optionalString,
  vatRegNo: optionalString,
  vatAccountable: z
    .boolean()
    .nullish()
    .transform((v) => v ?? undefined),
  paymentDeadLine: optionalInt,
  bankAccount: optionalString,
});

const emptyToolArgs = z.object({});

const createGroupSchema = z.object({
  id: guidString,
  name: z.string().min(1).max(64),
  code: z.string().min(1).max(20),
});
