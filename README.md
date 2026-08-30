# merit-aktiva-mcp

Open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for the
[Merit Aktiva](https://www.merit.ee/) accounting API (Estonia; also serves
[360 Księgowość](https://360ksiegowosc.pl/) in Poland via `MERIT_BASE_URL`).

Runs as a stdio MCP server. All tool names are prefixed `merit_`.

> Status: read + write tools for the core accounting surface. Extended domains (offers,
> recurring, inventory movements, e-invoice send) are a later milestone issue.
> Full documentation lands with the milestone's docs issue.

## Quick start

```bash
npm install
npm run build
cp .env.example .env   # fill in MERIT_API_ID / MERIT_API_KEY
npm start              # stdio MCP server
```

Example MCP client config:

```json
{
  "mcpServers": {
    "merit-aktiva": {
      "command": "node",
      "args": ["/path/to/merit-aktiva-mcp/dist/index.js"],
      "env": {
        "MERIT_API_ID": "…",
        "MERIT_API_KEY": "…"
      }
    }
  }
}
```

## Environment

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MERIT_API_ID` | yes | — | Api ID from Merit Aktiva > Settings > API Settings |
| `MERIT_API_KEY` | yes | — | Api Key (HMAC-SHA256 shared secret) |
| `MERIT_BASE_URL` | no | `https://aktiva.merit.ee` | Poland: `https://program.360ksiegowosc.pl` |
| `MERIT_HTTP_MAX_RETRIES` | no | `0` | Extra attempts on 429/5xx/network errors |
| `MERIT_HTTP_RETRY_BASE_MS` | no | `500` | Exponential backoff base delay |
| `MERIT_REQUEST_TIMEOUT_MS` | no | `30000` | Outbound HTTP timeout |
| `LOG_LEVEL` | no | `info` | pino level; logs go to stderr only |

## Tools

Each tool `POST`s to the Merit API with signed query auth:

- `merit_list_customers` — `/api/v1/getcustomers`
- `merit_list_vendors` — `/api/v1/getvendors`
- `merit_list_sales_invoices` — `/api/v2/getinvoices`
- `merit_list_sales_invoices_by_number_or_customer` — `/api/v2/getinvoices2`
- `merit_get_sales_invoice` — `/api/v2/getinvoice`
- `merit_list_accounts` — `/api/v1/getaccounts`
- `merit_list_payments` — `/api/v2/getpayments`
- `merit_list_payment_types` — `/api/v2/getpaymenttypes`
- `merit_list_taxes` — `/api/v1/gettaxes`
- `merit_list_purchase_invoices` — `/api/v2/getpurchorders`
- `merit_get_purchase_invoice` — `/api/v2/getpurchorder`
- `merit_list_purchase_orders` — `/api/v2/GetPOrders`
- `merit_list_gl_batches` — `/api/v1/getglbatches`
- `merit_get_gl_batch` — `/api/v1/getglbatch`
- `merit_list_gl_batches_full` — `/api/v1/GetGLBatchesFull`
- `merit_list_items` — `/api/v1/getitems`
- `merit_list_item_groups` — `/api/v2/getitemgroups`
- `merit_list_projects` — `/api/v1/getprojects`
- `merit_list_cost_centers` — `/api/v1/getcostcenters`
- `merit_list_dimensions` — `/api/v2/getdimensions`
- `merit_list_departments` — `/api/v1/getdepartments`
- `merit_list_units` — `/api/v1/getunits`
- `merit_list_banks` — `/api/v1/getbanks`
- `merit_list_financial_years` — `/api/v2/getaccperiods`
- `merit_get_customer_debts_report` — `/api/v1/getcustdebtrep`
- `merit_get_customer_payments_report` — `/api/v2/getcustpaymrep` (auto-paginated)
- `merit_get_profit_report` — `/api/v1/getprofitrep`
- `merit_get_balance_report` — `/api/v1/getbalancerep`
- `merit_get_inventory_report` — `/api/v2/getinventoryreport`
- `merit_get_sales_report` — `/api/v2/getsalesrep`
- `merit_get_purchase_report` — `/api/v2/getpurchrep`
- `merit_create_customer` — `/api/v2/sendcustomer`
- `merit_update_customer` — `/api/v1/updatecustomer`
- `merit_list_customer_groups` — `/api/v2/getcustomergroups`
- `merit_create_customer_group` — `/api/v2/sendcustomergroup`
- `merit_create_vendor` — `/api/v2/sendvendor`
- `merit_update_vendor` — `/api/v2/updatevendor`
- `merit_list_vendor_groups` — `/api/v2/getvendorgroups`
- `merit_create_vendor_group` — `/api/v2/sendvendorgroup`
- `merit_create_sales_invoice` — `/api/v2/sendinvoice` (no update; delete-and-recreate)
- `merit_delete_sales_invoice` — `/api/v1/deleteinvoice` (destructive)
- `merit_create_purchase_invoice` — `/api/v2/sendpurchinvoice` (books immediately)
- `merit_delete_purchase_invoice` — `/api/v1/deletepurchinvoice` (destructive)
- `merit_create_sales_invoice_payment` — `/api/v2/sendpayment`
- `merit_create_purchase_invoice_payment` — `/api/v2/sendPaymentV`
- `merit_delete_payment` — `/api/v1/deletepayment` (destructive)
- `merit_create_gl_batch` — `/api/v1/sendglbatch`
- `merit_create_items` — `/api/v2/senditems`
- `merit_update_item` — `/api/v1/updateitem`
- `merit_create_item_groups` — `/api/v2/senditemgroups`

Date arguments accept ISO `YYYY-MM-DD` and are converted to Merit's `yyyymmdd` wire
format. Period filters (`periodStart`/`periodEnd`) are capped by Merit at 3 months.

## Development

```bash
npm run lint            # Biome
npm run test:coverage   # Vitest, 100% coverage thresholds
npm run build           # tsc
npm run test:integration  # live API tests; skip cleanly without credentials
```

API reference: [Merit AKTIVA Reference Manual](https://api.merit.ee/connecting-robots/reference-manual/)

## Acknowledgements

The endpoint map (paths, request-body fields, and behavioural quirks) was seeded from
[roosa-dev/merit-aktiva-mcp](https://github.com/roosa-dev/merit-aktiva-mcp)
(`src/server.ts` `ENDPOINTS` table), used under the MIT License:

> MIT License — Copyright (c) 2026 Roosa

This project is an independent implementation (typed schemas, retrying signed client,
test suite) and is not affiliated with Merit Software or roosa-dev.

## License

[MIT](LICENSE) — Copyright (c) 2026 Werkstatt OÜ
