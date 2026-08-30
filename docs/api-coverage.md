# API coverage matrix

Hand-curated against the official
[AKTIVA Reference Manual](https://api.merit.ee/connecting-robots/reference-manual/)
and the [roosa-dev `ENDPOINTS` table](https://github.com/roosa-dev/merit-aktiva-mcp/blob/main/src/server.ts)
(MIT — see [README acknowledgements](../README.md#acknowledgements)).

**Policy:** seed the endpoint map; do not fork or depend on roosa-dev. **Official
docs win** on conflicts (see [quirks](#official-wins-quirks)).

Merit has no public OpenAPI spec. This file is one row per shipped or explicitly
deferred `POST` path, not a scrape of every HTML page.

- **Covered:** 77 `merit_` tools (M1–M6)
- **Deferred:** bank import / settlements / payment imports; expense / income /
  prepayments; dimension mutations, create tax, create units (reads already shipped)
- **Out of scope:** Merit Palk (payroll)

Product tracking: GitLab [tracker #218](https://gitlab.com/werkstatt.ee/e-financials-mcp/-/issues/218),
deferred list recorded on [#224](https://gitlab.com/werkstatt.ee/e-financials-mcp/-/issues/224).

## Official pages

- [Sales invoices](https://api.merit.ee/connecting-robots/reference-manual/sales-invoices/)
- [Sales offers](https://api.merit.ee/connecting-robots/reference-manual/sales-offers/)
- [Payments](https://api.merit.ee/connecting-robots/reference-manual/payments/)
- [Purchase invoices](https://api.merit.ee/connecting-robots/reference-manual/purchase-invoices/)
- [Recurring invoices](https://api.merit.ee/connecting-robots/reference-manual/recurring-invoices/)
- [Inventory movements](https://api.merit.ee/connecting-robots/reference-manual/inventory-movements1/)
- [Fixed asset](https://api.merit.ee/connecting-robots/reference-manual/fixed-asset/)
- [Sales prices and discounts](https://api.merit.ee/connecting-robots/reference-manual/sales-prices-and-discounts/)
- [Authentication](https://api.merit.ee/connecting-robots/reference-manual/authentication/)
- [Change log](https://api.merit.ee/merit-aktiva-api/change-log-2/) (expense / income / prepayments, 2025-08-22)

## Covered

| Method | Path | Tool |
| --- | --- | --- |
| `POST` | `/api/v1/getcustomers` | `merit_list_customers` |
| `POST` | `/api/v2/sendcustomer` | `merit_create_customer` |
| `POST` | `/api/v1/updatecustomer` | `merit_update_customer` |
| `POST` | `/api/v2/getcustomergroups` | `merit_list_customer_groups` |
| `POST` | `/api/v2/sendcustomergroup` | `merit_create_customer_group` |
| `POST` | `/api/v1/getvendors` | `merit_list_vendors` |
| `POST` | `/api/v2/sendvendor` | `merit_create_vendor` |
| `POST` | `/api/v2/updatevendor` | `merit_update_vendor` |
| `POST` | `/api/v2/getvendorgroups` | `merit_list_vendor_groups` |
| `POST` | `/api/v2/sendvendorgroup` | `merit_create_vendor_group` |
| `POST` | `/api/v2/getinvoices` | `merit_list_sales_invoices` |
| `POST` | `/api/v2/getinvoices2` | `merit_list_sales_invoices_by_number_or_customer` |
| `POST` | `/api/v2/getinvoice` | `merit_get_sales_invoice` |
| `POST` | `/api/v2/sendinvoice` | `merit_create_sales_invoice` |
| `POST` | `/api/v2/getsalesinvpdf` | `merit_get_sales_invoice_pdf` |
| `POST` | `/api/v2/sendinvoicebyemail` | `merit_email_sales_invoice` |
| `POST` | `/api/v2/sendinvoiceaseinv` | `merit_send_sales_invoice_einvoice` |
| `POST` | `/api/v1/deleteinvoice` | `merit_delete_sales_invoice` |
| `POST` | `/api/v2/getoffers` | `merit_list_sales_offers` |
| `POST` | `/api/v2/getoffer` | `merit_get_sales_offer` |
| `POST` | `/api/v2/sendoffer` | `merit_create_sales_offer` |
| `POST` | `/api/v2/updateoffer` | `merit_update_sales_offer` |
| `POST` | `/api/v2/setofferstatus` | `merit_set_sales_offer_status` |
| `POST` | `/api/v2/offer2inv` | `merit_create_invoice_from_sales_offer` |
| `POST` | `/api/v2/getpayments` | `merit_list_payments` |
| `POST` | `/api/v2/getpaymenttypes` | `merit_list_payment_types` |
| `POST` | `/api/v2/sendpayment` | `merit_create_sales_invoice_payment` |
| `POST` | `/api/v2/sendPaymentV` | `merit_create_purchase_invoice_payment` |
| `POST` | `/api/v2/sendPaymentO` | `merit_create_sales_offer_payment` |
| `POST` | `/api/v1/deletepayment` | `merit_delete_payment` |
| `POST` | `/api/v2/getpurchorders` | `merit_list_purchase_invoices` |
| `POST` | `/api/v2/getpurchorder` | `merit_get_purchase_invoice` |
| `POST` | `/api/v2/GetPOrders` | `merit_list_purchase_orders` |
| `POST` | `/api/v2/sendpurchinvoice` | `merit_create_purchase_invoice` |
| `POST` | `/api/v1/deletepurchinvoice` | `merit_delete_purchase_invoice` |
| `POST` | `/api/v1/getaccounts` | `merit_list_accounts` |
| `POST` | `/api/v1/getglbatches` | `merit_list_gl_batches` |
| `POST` | `/api/v1/getglbatch` | `merit_get_gl_batch` |
| `POST` | `/api/v1/GetGLBatchesFull` | `merit_list_gl_batches_full` |
| `POST` | `/api/v1/sendglbatch` | `merit_create_gl_batch` |
| `POST` | `/api/v1/getitems` | `merit_list_items` |
| `POST` | `/api/v2/getitemgroups` | `merit_list_item_groups` |
| `POST` | `/api/v2/senditems` | `merit_create_items` |
| `POST` | `/api/v1/updateitem` | `merit_update_item` |
| `POST` | `/api/v2/senditemgroups` | `merit_create_item_groups` |
| `POST` | `/api/v1/gettaxes` | `merit_list_taxes` |
| `POST` | `/api/v1/getprojects` | `merit_list_projects` |
| `POST` | `/api/v1/getcostcenters` | `merit_list_cost_centers` |
| `POST` | `/api/v2/getdimensions` | `merit_list_dimensions` |
| `POST` | `/api/v1/getdepartments` | `merit_list_departments` |
| `POST` | `/api/v1/getunits` | `merit_list_units` |
| `POST` | `/api/v1/getbanks` | `merit_list_banks` |
| `POST` | `/api/v2/getaccperiods` | `merit_list_financial_years` |
| `POST` | `/api/v1/getcustdebtrep` | `merit_get_customer_debts_report` |
| `POST` | `/api/v2/getcustpaymrep` | `merit_get_customer_payments_report` (auto-paginated via `/api/v2/getmoredata`) |
| `POST` | `/api/v2/getmoredata` | used internally by `merit_get_customer_payments_report` |
| `POST` | `/api/v1/getprofitrep` | `merit_get_profit_report` |
| `POST` | `/api/v1/getbalancerep` | `merit_get_balance_report` |
| `POST` | `/api/v2/getinventoryreport` | `merit_get_inventory_report` |
| `POST` | `/api/v2/getsalesrep` | `merit_get_sales_report` |
| `POST` | `/api/v2/getpurchrep` | `merit_get_purchase_report` |
| `POST` | `/api/v2/getperinvoices` | `merit_list_recurring_invoices` |
| `POST` | `/api/v2/getperinvoice` | `merit_get_recurring_invoice` |
| `POST` | `/api/v2/sendperinvoice` | `merit_create_recurring_invoice` |
| `POST` | `/api/v2/getpershaddress` | `merit_list_recurring_invoice_addresses` |
| `POST` | `/api/v1/sendindvalues` | `merit_send_recurring_indication_values` |
| `POST` | `/api/v2/getlocations` | `merit_list_locations` |
| `POST` | `/api/v2/getinvmovements` | `merit_list_inventory_movements` |
| `POST` | `/api/v2/SendInvMovement` | `merit_create_inventory_movement` |
| `POST` | `/api/v2/getfalocations` | `merit_list_fixed_asset_locations` |
| `POST` | `/api/v2/getfaresppersons` | `merit_list_fixed_asset_employees` |
| `POST` | `/api/v2/getfixassets` | `merit_list_fixed_assets` |
| `POST` | `/api/v2/sendfixedassets` | `merit_create_fixed_assets` |
| `POST` | `/api/v2/getprices` | `merit_list_prices` |
| `POST` | `/api/v2/getprice` | `merit_get_price` |
| `POST` | `/api/v2/sendprices` | `merit_send_prices` |
| `POST` | `/api/v2/getdiscounts` | `merit_list_discounts` |
| `POST` | `/api/v2/senddiscounts` | `merit_send_discounts` |

## Deferred

Recorded on GitLab [#224](https://gitlab.com/werkstatt.ee/e-financials-mcp/-/issues/224). Not implemented.

| Status | Domain | Official / seed paths (indicative) |
| --- | --- | --- |
| deferred | Bank statement import, settlements, payment imports | bank-import / settlement endpoints in the payments + changelog pages |
| deferred | Expense / income / prepayments | added 2025-08-22 ([change log](https://api.merit.ee/merit-aktiva-api/change-log-2/)) |
| deferred | Dimension mutations | `/api/v2/senddimensions`, `/api/v2/senddimvalues` (`getdimensions` is covered) |
| deferred | Create tax | `/api/v2/sendtax` (`gettaxes` is covered) |
| deferred | Create units | `/api/v2/senduom` (`getunits` is covered) |

## Official-wins quirks

Conflicts where the official manual (or live TestApi) differs from the roosa-dev seed:

| Topic | Seed / guess | What we ship |
| --- | --- | --- |
| `getinvoices2` filters | `InvoiceNo` / `Customer` | `InvNo` / `CustName` / `CustId` |
| Inventory movement list date filter | `DateType` | official wire field `Datetype` |
| Fixed-asset send | conventional spellings | official `InventaryNo`, `FAFroupName`, `SubsidAmount` |
| Customer payments report currency | `CurrencyCode` | official typo `CurrncyCode` |
| `GetPOrders` | generic “purchase invoices” | purchase **orders waiting approval** |
| Sales invoice update | (none in seed) | **cannot update** — delete and recreate; credit = negative qty / `totalAmount` |
| Signing body | docs show pretty-printed JSON | compact `JSON.stringify` is the vector that matches the official example |
| `sendPaymentV` / `sendPaymentO` `PaymentDate` | `yyyymmdd` | official `yyyyMMddHHmm` |
| Recurring list period | 3-month list cap | period = next-invoice date, **max 180 days**; `DateType` 0 = next date, 1 = changed |
| E-invoice send | not in seed table | `/api/v2/sendinvoiceaseinv`; incapable receiver → `api-noeinv` |
