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
- `packages/ui`: generated Zaidan primitives, Kobalte, Corvu, Solar Icons, and motion
- `packages/integrations`: validated static provider selection
- `packages/delivery`: Node-only delivery CLI

## Local development

```sh
pnpm install --frozen-lockfile
pnpm store:apply --manifest apps/urnuun-48/delivery.local.yml --target urnuun-local
portless proxy start --port 1355 --https
pnpm dev:stores
```

Open `https://urnuun-48.shop.localhost:1355`. The local Worker state lives under `apps/urnuun-48/.wrangler`. Admin requests without a valid Staff session redirect to `/admin/login`.

Run one Store explicitly with `pnpm dev:store --store urnuun-48`. Build it with `pnpm build:store --store urnuun-48`.

## Delivery shells

```sh
pnpm store:create --slug another-store --name "Another Store"
pnpm store:apply --manifest <path> --target <name>
pnpm store:proof --manifest <path> --target <name>
pnpm store:cleanup --manifest <path> --target <name>
```

Local apply, proof, and cleanup are implemented. Remote mutation validates the complete target invocation, then fails clearly until reviewed provisioning work is added.

## Verification

```sh
pnpm check
pnpm store:delivery validate --manifest apps/urnuun-48/delivery.local.yml
```
