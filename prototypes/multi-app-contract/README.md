# PROTOTYPE — shared-kernel multi-app contract

This disposable prototype asks whether one merchant-owned app can stay thin while importing commerce API, schema, admin, cache, and provisioning behavior from a shared kernel. It also asks whether provisioning can resume safely after a real Cloudflare command fails, without automatic rollback hiding partially-created resources.

Run from the repository root:

```bash
pnpm --dir prototypes/multi-app-contract prototype
```

The command provisions real remote D1, KV, R2, and Worker resources. Every resource starts with `wf5-prototype-`. State and generated Wrangler configuration live under `apps/rozie-store/.generated/`, which is intentionally ignored. Stop at any point and rerun the command to resume from the first incomplete step.

The prototype never rolls resources back automatically. Choose cleanup in the terminal and type the full resource prefix to delete the Worker, R2 bucket, KV namespaces, and D1 database explicitly.

## Proposed ownership

| Owner | Contract |
| --- | --- |
| `apps/rozie-store` | Store Profile, custom storefront entrypoint, generated Wrangler configuration, deployment identity |
| `packages/commerce-kernel` | Elysia/Eden API contract, Drizzle schema and ordered migrations, admin capabilities, cache invariants, provisioning state machine |
| workspace root | Cross-app task names and shared tool versions |

## Proposed override points

A generated app may replace storefront composition, assets, typography, navigation presentation, merchandising rhythm, public locations, contact content, and Store Profile values. It may not override price, inventory, checkout, payment, order, role, migration, or cache-safety behavior.

## Failure contract

Each successful step is journaled before the next begins. A failed command records the error and leaves all successful resources intact. Restarting retries the first incomplete step. Cleanup is explicit, resumable manual work rather than destructive automatic rollback.
