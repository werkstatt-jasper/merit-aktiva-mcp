/**
 * Indicative response shapes for Merit Aktiva read endpoints (PascalCase JSON).
 * Fields follow https://api.merit.ee/connecting-robots/reference-manual/ but
 * are kept loose — Merit adds fields without notice.
 */

export interface MeritCustomer {
  CustomerId?: string;
  Name?: string;
  RegNo?: string;
  VatRegNo?: string;
  Contact?: string;
  PhoneNo?: string;
  Address?: string;
  City?: string;
  CountryCode?: string;
  Email?: string;
  CurrencyCode?: string;
  PaymentDeadLine?: number;
  NotTDCustomer?: boolean;
  ChangedDate?: string;
  [key: string]: unknown;
}

export interface MeritVendor {
  VendorId?: string;
  Name?: string;
  RegNo?: string;
  VatRegNo?: string;
  CountryCode?: string;
  Email?: string;
  CurrencyCode?: string;
  VatAccountable?: boolean;
  ChangedDate?: string;
  [key: string]: unknown;
}

export interface MeritSalesInvoiceListItem {
  SIHId?: string;
  InvoiceNo?: string;
  DocumentDate?: string;
  TransactionDate?: string;
  CustomerId?: string;
  CustomerName?: string;
  CustomerRegNo?: string;
  DueDate?: string;
  CurrencyCode?: string;
  TaxAmount?: number;
  TotalAmount?: number;
  TotalSum?: number;
  PaidAmount?: number;
  Paid?: boolean;
  ChangedDate?: string;
  [key: string]: unknown;
}

export interface MeritSalesInvoiceDetail {
  Header?: Record<string, unknown>;
  Lines?: Array<Record<string, unknown>>;
  Payments?: Array<Record<string, unknown>>;
  Attachment?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MeritAccount {
  AccountId?: string;
  Code?: string;
  Name?: string;
  TaxName?: string;
  NoActive?: boolean;
  IsParent?: boolean;
  [key: string]: unknown;
}

export interface MeritPayment {
  PIHId?: string;
  BankName?: string;
  CounterPartType?: number;
  CounterPartName?: string;
  CounterPartId?: string;
  CurrencyCode?: string;
  DocumentDate?: string;
  DocumentNo?: string;
  Direction?: number;
  Amount?: number;
  ChangedDate?: string;
  [key: string]: unknown;
}

export interface MeritPaymentType {
  Id?: string;
  Name?: string;
  Type?: number;
  [key: string]: unknown;
}

export interface MeritTax {
  Id?: string;
  Code?: string;
  Name?: string;
  NameEN?: string;
  TaxPct?: number;
  [key: string]: unknown;
}

export interface MeritPurchaseInvoiceListItem {
  PIHId?: string;
  BillNo?: string;
  DocumentDate?: string;
  VendorId?: string;
  VendorName?: string;
  TotalAmount?: number;
  TotalSum?: number;
  Paid?: boolean;
  [key: string]: unknown;
}

export interface MeritPurchaseInvoiceDetail {
  Header?: Record<string, unknown>;
  Lines?: Array<Record<string, unknown>>;
  Payments?: Array<Record<string, unknown>>;
  Attachment?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MeritPurchaseOrderListItem {
  PIHId?: string;
  BillNo?: string;
  VendorName?: string;
  Status0?: number;
  [key: string]: unknown;
}

export interface MeritGlBatchListItem {
  GLBId?: string;
  BatchCode?: string;
  No?: string;
  Document?: string;
  BatchDate?: string;
  TotalAmount?: number;
  [key: string]: unknown;
}

export interface MeritGlBatchDetail {
  Header?: Record<string, unknown>;
  Lines?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface MeritItem {
  ItemId?: string;
  Code?: string;
  Name?: string;
  Type?: number;
  Usage?: number;
  [key: string]: unknown;
}

export interface MeritItemGroup {
  Code?: string;
  Name?: string;
  Id?: string;
  [key: string]: unknown;
}

export interface MeritCustomerGroup {
  Id?: string;
  Name?: string;
  Code?: string;
  [key: string]: unknown;
}

export interface MeritVendorGroup {
  Id?: string;
  Name?: string;
  Code?: string;
  [key: string]: unknown;
}

export interface MeritNamedCode {
  Code?: string;
  Name?: string;
  Id?: string;
  [key: string]: unknown;
}

export interface MeritDimension {
  DimId?: number | string;
  Name?: string;
  Type?: number;
  Values?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface MeritBank {
  Id?: string;
  Name?: string;
  IBAN?: string;
  [key: string]: unknown;
}

export interface MeritFinancialYear {
  Id?: string;
  StartDate?: string;
  EndDate?: string;
  [key: string]: unknown;
}

export interface MeritIdNameResult {
  Id?: string;
  Name?: string;
  [key: string]: unknown;
}
