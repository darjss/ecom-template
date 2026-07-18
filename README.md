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
pnpm store:apply --manifest apps/urnuun-48/delivery.local.yml --target urnuun-local
pnpm dev:stores
```

Portless renders `https://urnuun-48.shop.localhost` in the main checkout and prefixes linked worktrees with the sanitized final branch segment. Print the exact URL for this checkout with `pnpm store:delivery origin --store urnuun-48`. The local Worker state lives under `apps/urnuun-48/.wrangler`. Admin requests without a valid Staff session redirect to `/admin/login`.

Run one Store explicitly with `pnpm dev:store --store urnuun-48`. Build it with `pnpm build:store --store urnuun-48`.

Create a real local Staff Owner session against the Store process and its Wrangler D1/KV state with a centralized mode-0600 vars file:

```sh
pnpm store:proof:auth --store urnuun-48 --email owner@example.com --vars /absolute/path/to/.dev.vars
curl --cookie .delivery/proof/urnuun-48/cookies.txt https://urnuun-48.shop.localhost/api/staff
pnpm store:proof:auth --cleanup --store urnuun-48 --vars /absolute/path/to/.dev.vars
```

Pass `--persist-to <absolute-path>` and `--origin <https-origin>` together when another worktree must use the Store process owner's exact Wrangler state and origin. Explicit origins must be a running Portless route for `<worktree?>.<store>.shop.localhost`; other HTTPS hosts are refused before session creation. The ignored mode-0700 `.delivery/proof/<store>/` directory contains a mode-0600 curl jar, browser state, and non-secret handoff. Commands print paths and identity only.

## Delivery shells

```sh
pnpm store:create --slug another-store --name "Another Store"
pnpm store:apply --manifest <path> --target <name>
pnpm store:proof --manifest <path> --target <name>
pnpm store:cleanup --manifest <path> --target <name>
```

`store:create` validates its complete invocation and then fails intentionally until delivery owns a Store-neutral skeleton. Local apply records the selected target, rendered origin, and commit. Proof accepts only the matching running checkout and commit, then records the verified health URL. Cleanup removes only that target's disposable local state and evidence. Remote apply validates committed canary structure before rejecting unavailable remote mutation.

## Verification

```sh
pnpm check
pnpm store:delivery validate --manifest apps/urnuun-48/delivery.local.yml
pnpm store:delivery validate --manifest apps/urnuun-48/delivery.canary.yml
```
