# Polar setup for AI agents

Goal: create the billing products in Polar so checkout works, then fill the env vars. Do sandbox first, verify, then repeat on production.

## Option A — Polar MCP server (preferred)

Polar hosts a remote MCP server (streamable HTTP, OAuth login in the browser):

- Sandbox: `https://mcp.polar.sh/mcp/polar-sandbox`
- Production: `https://mcp.polar.sh/mcp/polar-mcp`

Connect (Claude Code):

```bash
claude mcp add --transport http polar-sandbox https://mcp.polar.sh/mcp/polar-sandbox
```

Other clients: `npx mcp-remote https://mcp.polar.sh/mcp/polar-sandbox`.

### Steps (sandbox)

1. Connect to the sandbox MCP server and complete the OAuth login against a sandbox organization (create one at https://sandbox.polar.sh if needed).
2. List the MCP tools and find the product-creation tool (tools mirror the Polar API; look for `products` create/list).
3. For each paid plan in `src/lib/plans.ts` (currently only `pro`, $20/mo), create a product:
   - name: the plan name
   - recurring interval: `month`
   - one fixed price: amount in cents (`2000`), currency `usd`
4. Note the returned product id.
5. Create an organization access token in the sandbox dashboard (Settings → Developers).
6. Create a webhook endpoint in the dashboard pointing at `https://<your-host>/api/auth/polar/webhooks`, format `raw`, and note the secret.

### Fill env vars

Local (`.dev.vars`) and deployed (`wrangler secret put`):

```
POLAR_ACCESS_TOKEN=<org access token>
POLAR_WEBHOOK_SECRET=<webhook secret>
POLAR_SERVER=sandbox
POLAR_PRODUCT_ID_PRO=<product id from step 4>
```

### Verify, then production

- Run the app, sign in, open `/app/billing`, click upgrade — you must land on a sandbox checkout page.
- Repeat steps 1–6 against the production MCP server and dashboard (polar.sh), then set `POLAR_SERVER=production` with production token/secret/product ids.

## Option B — SDK script (no MCP)

`scripts/polar-setup.ts` creates the products from `src/lib/plans.ts` via `@polar-sh/sdk`:

```bash
POLAR_ACCESS_TOKEN=<token> POLAR_SERVER=sandbox pnpm polar:setup
```

It prints the product ids and the exact env var lines to set. Webhook endpoint + secret must still be created in the dashboard (step 6 above).

## Checklist

- [ ] Sandbox org exists, access token created
- [ ] Products created (one per paid plan), ids recorded
- [ ] `POLAR_PRODUCT_ID_*` env vars set
- [ ] Webhook endpoint registered at `/api/auth/polar/webhooks`, secret set
- [ ] Sandbox checkout verified end to end
- [ ] Repeated on production, `POLAR_SERVER=production`
