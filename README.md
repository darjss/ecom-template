# Ecommerce template

Astro 7, Solid, Elysia, and Cloudflare Workers workspace for independently deployed Stores. Өрнүүн 48 is the committed Reference Store.

## Workspace

- `apps/urnuun-48`: minimal Store composition root
- `packages/contracts`: browser-safe runtime contracts
- `packages/kernel`: D1 persistence, migrations, Auth, and Store operations
- `packages/api`: complete Elysia application
- `packages/client`: Eden, TanStack, and persisted browser state
- `packages/admin`: authenticated Solid Merchant Admin SPA
- `packages/storefront`: default Storefront behavior
- `packages/ui`: generated Zaidan primitives, Kobalte, Solar Icons, and motion
- `packages/integrations`: validated static provider selection
- `packages/delivery`: Node-only delivery CLI

## Local development

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Portless renders `https://urnuun-48.shop.localhost` in the main checkout and prefixes linked worktrees with the sanitized final branch segment. The local Worker state lives under `apps/urnuun-48/.wrangler`. Admin requests without a valid Staff session redirect to `/admin/login`.

## Delivery

```sh
pnpm store:create --slug another-store --name "Another Store"
pnpm store:seed -- --local
pnpm store:deploy -- --store urnuun-48
pnpm store:proof -- --url https://urnuun-48-proof.amerikvitamin.mn
```

`store:create` validates its invocation and rejects additional Stores while this repository owns one Store. `store:seed` delegates to the canonical Өрнүүн 48 seed script. `store:deploy` deploys the selected Store through Wrangler. `store:proof` curls the deployed Store health endpoint.

## Verification

```sh
pnpm check
pnpm store:delivery --help
```
