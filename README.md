# merit-aktiva-mcp

Open-source [Model Context Protocol](https://modelcontextprotocol.io/) server for the
[Merit Aktiva](https://www.merit.ee/) accounting API (Estonia; also serves
[360 Księgowość](https://360ksiegowosc.pl/) in Poland via `MERIT_BASE_URL`).

Runs as a stdio MCP server. All tool names are prefixed `merit_`.

> Status: read-tools MVP (customers, vendors, sales invoices, accounts, payments, taxes).
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

Read-only MVP surface (each `POST`s to the Merit API with signed query auth):

- `merit_list_customers` — `/api/v1/getcustomers`
- `merit_list_vendors` — `/api/v1/getvendors`
- `merit_list_sales_invoices` — `/api/v2/getinvoices`
- `merit_list_sales_invoices_by_number_or_customer` — `/api/v2/getinvoices2`
- `merit_get_sales_invoice` — `/api/v2/getinvoice`
- `merit_list_accounts` — `/api/v1/getaccounts`
- `merit_list_payments` — `/api/v2/getpayments`
- `merit_list_payment_types` — `/api/v2/getpaymenttypes`
- `merit_list_taxes` — `/api/v1/gettaxes`

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
