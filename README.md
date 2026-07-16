# Ecommerce template

Astro 7, Solid, Elysia, and Cloudflare Workers workspace for independently deployed stores. Өрнүүн 48 is the committed reference store.

## Workspace

- `apps/urnuun-48`: minimal Store composition root
- `packages/contracts`: browser-safe runtime contracts
- `packages/kernel`: D1 persistence and Store operations
- `packages/api`: complete Elysia application
- `packages/client`: Eden, TanStack, and persisted browser state
- `packages/admin`: shared Merchant Admin SPA
- `packages/storefront`: default Storefront behavior
- `packages/ui`: accessible components, Solar Icons, and motion
- `packages/integrations`: accepted provider boundaries
- `packages/delivery`: Node-only delivery CLI

## Local development

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Open `http://urnuun-48.shop.localhost:4321`. The local Worker state lives under `apps/urnuun-48/.wrangler`.

## Verification

```sh
pnpm check
pnpm store:delivery -- validate --manifest apps/urnuun-48/delivery.local.yml
```
