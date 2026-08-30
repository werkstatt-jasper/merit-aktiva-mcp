import { z } from "zod";

import type { MeritClient } from "../client.js";
import type { MeritCustomer, MeritCustomerGroup, MeritIdNameResult } from "../types/merit.js";
import {
  guidString,
  optionalBoolean,
  optionalGuid,
  optionalInt,
  optionalMeritDate,
  optionalNumber,
  optionalString,
  parseToolArgs,
} from "../validation/tool-args.js";
import { jsonToolResult } from "./list-response.js";

const listCustomersSchema = z.object({
  id: optionalGuid,
  regNo: optionalString,
  vatRegNo: optionalString,
  name: optionalString,
  changedDate: optionalMeritDate,
  withComments: optionalBoolean,
  commentsFrom: optionalMeritDate,
});

export function createCustomerTools(client: MeritClient) {
  return {
    merit_list_customers: {
      description:
        "List/search Merit Aktiva customers (POST /api/v1/getcustomers). With no filters returns " +
        "all customers — can be very large (Merit may even fail to serialize huge lists), so " +
        "prefer a filter. id wins over all other filters; regNo/vatRegNo match exactly; name " +
        "matches partially. Dates are ISO YYYY-MM-DD.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Customer GUID (ignores other filters when set)" },
          regNo: { type: "string", description: "Registration number (exact match)" },
          vatRegNo: { type: "string", description: "VAT registration number (exact match)" },
          name: { type: "string", description: "Customer name (partial match)" },
          changedDate: {
            type: "string",
            description: "Only rows changed/created on/after this date (YYYY-MM-DD)",
          },
          withComments: { type: "boolean", description: "Include customer comments" },
          commentsFrom: {
            type: "string",
            description: "Only comments on/after this date (YYYY-MM-DD)",
          },
        },
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(listCustomersSchema, params);
        const response = await client.post<MeritCustomer[]>("/api/v1/getcustomers", {
          Id: args.id,
          RegNo: args.regNo,
          VatRegNo: args.vatRegNo,
          Name: args.name,
          ChangedDate: args.changedDate,
          WithComments: args.withComments,
          CommentsFrom: args.commentsFrom,
        });
        return jsonToolResult(response);
      },
    },

    merit_create_customer: {
      description:
        "Create a Merit Aktiva customer (POST /api/v2/sendcustomer). Name must be unique " +
        "(max 150). notTDCustomer is required (true for physical persons / foreign companies " +
        "in EE). countryCode is required (2 chars). Returns { Id, Name }.",
      inputSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string", description: "Unique customer name (required)" },
          notTDCustomer: {
            type: "boolean",
            description: "True for physical persons / foreign companies (EE)",
          },
          countryCode: { type: "string", description: "ISO country code, 2 chars (required)" },
          regNo: { type: "string", description: "Registration number" },
          vatRegNo: { type: "string", description: "VAT registration number" },
          currencyCode: { type: "string", description: "Currency code (e.g. EUR)" },
          paymentDeadLine: { type: "number", description: "Payment deadline in days" },
          overDueCharge: { type: "number", description: "Overdue charge percent" },
          address: { type: "string" },
          city: { type: "string", description: "Required in EE when countryCode is not EE" },
          county: { type: "string" },
          postalCode: { type: "string" },
          phoneNo: { type: "string" },
          email: { type: "string" },
          salesInvLang: { type: "string", description: "Invoice language (ET, EN, RU, FI)" },
          contact: { type: "string" },
          bankAccount: { type: "string" },
        },
        required: ["name", "notTDCustomer", "countryCode"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(createCustomerSchema, params);
        const response = await client.post<MeritIdNameResult>("/api/v2/sendcustomer", {
          Name: args.name,
          NotTDCustomer: args.notTDCustomer,
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
          SalesInvLang: args.salesInvLang,
          Contact: args.contact,
          BankAccount: args.bankAccount,
        });
        return jsonToolResult(response);
      },
    },

    merit_update_customer: {
      description:
        "Update a Merit Aktiva customer (POST /api/v1/updatecustomer). id is required; other " +
        "fields are optional patches.",
      inputSchema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Customer GUID (required)" },
          name: { type: "string" },
          countryCode: { type: "string" },
          address: { type: "string" },
          city: { type: "string" },
          postalCode: { type: "string" },
          phoneNo: { type: "string" },
          email: { type: "string" },
          regNo: { type: "string" },
          vatRegNo: { type: "string" },
          paymentDeadLine: { type: "number" },
          notTDCustomer: { type: "boolean" },
          contact: { type: "string" },
        },
        required: ["id"],
      },
      handler: async (params: unknown) => {
        const args = parseToolArgs(updateCustomerSchema, params);
        const response = await client.post<MeritIdNameResult>("/api/v1/updatecustomer", {
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
          PaymentDeadLine: args.paymentDeadLine,
          NotTDCustomer: args.notTDCustomer,
          Contact: args.contact,
        });
        return jsonToolResult(response);
      },
    },

    merit_list_customer_groups: {
      description:
        "List Merit Aktiva customer groups (POST /api/v2/getcustomergroups). No filters.",
      inputSchema: { type: "object" as const, properties: {} },
      handler: async (params: unknown) => {
        parseToolArgs(emptyToolArgs, params);
        const response = await client.post<MeritCustomerGroup[]>("/api/v2/getcustomergroups", {});
        return jsonToolResult(response);
      },
    },

    merit_create_customer_group: {
      description:
        "Create a Merit Aktiva customer group (POST /api/v2/sendcustomergroup). id (GUID), " +
        "name (max 64), and code (max 20) are required.",
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
        const response = await client.post<MeritCustomerGroup>("/api/v2/sendcustomergroup", {
          Id: args.id,
          Name: args.name,
          Code: args.code,
        });
        return jsonToolResult(response);
      },
    },
  };
}

const createCustomerSchema = z.object({
  name: z.string().min(1).max(150),
  notTDCustomer: z.boolean(),
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
  salesInvLang: optionalString,
  contact: optionalString,
  bankAccount: optionalString,
});

const updateCustomerSchema = z.object({
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
  paymentDeadLine: optionalInt,
  notTDCustomer: optionalBoolean,
  contact: optionalString,
});

const emptyToolArgs = z.object({});

const createGroupSchema = z.object({
  id: guidString,
  name: z.string().min(1).max(64),
  code: z.string().min(1).max(20),
});
