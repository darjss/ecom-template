# Workspace and Store delivery contract

**Decision status:** Founder approved for Wayfinder issue #26.

This contract turns the accepted shared-kernel and generated-app ownership model into deterministic development and delivery behavior. It is deliberately sized for independent Stores handling roughly 10–20 Orders per day, comfortable operation around 50 Orders per day, and audiences up to roughly 50,000 followers.

There is no fleet product. The repository contains several independently deployable Store apps because sharing implementation is cheaper and safer than copying it. Every remote operation acts on one named Deployment Target at a time.

## Deliberate simplifications

- One pnpm workspace and lockfile are the source release. Shared packages are consumed from workspace source; v1 does not publish or independently version internal packages.
- One Store app produces one Worker deployment with its own D1, session KV, cache KV, R2, secrets, cache namespace, and optional domain.
- One small manifest-driven command provisions or updates one Deployment Target and journals completed steps. There is no central runtime control plane, deployment database, release service, queue, agent daemon, or cross-Store coordinator.
- Selective delivery means passing explicit target names. There is no changed-app inference, desired-state reconciler, fleet dashboard, rollout percentage, release train, or automatic convergence policy.
- The fictional Reference Store is the only committed baseline and the only synthetic canary. Real prospect identity and deployment manifests remain private.
- Provisioning never performs destructive automatic rollback. Cleanup is a separate explicit operation.
- D1 migrations are forward-only and shared. Application rollback means redeploying an earlier compatible commit, not reversing schema automatically.
- Accepted third-party integrations are statically imported. V1 has no dynamic adapter loading, plugin marketplace, generic adapter registration, adapter-owned Admin injection, or speculative adapter migration framework.

## Workspace ownership

The production workspace begins with only boundaries that isolate distinct runtime concerns:

```text
apps/
  urnuun-48/            fictional Reference Store app
  <merchant-slug>/      one generated app per Store
packages/
  kernel/               commerce, API, auth, schema, migrations, Admin behavior
  ui/                   shared accessible UI primitives and tokens
  delivery/             Node-only manifest, Wrangler, journal, and proof CLI
```

The root owns `pnpm-workspace.yaml`, the single lockfile, pinned tool versions, Vite Plus task configuration, and thin convenience scripts. A new package is added only when an actual runtime or ownership boundary cannot remain clear inside these three packages.

### Dependency rules

- `apps/*` may depend on `@shops/kernel` and `@shops/ui` through `workspace:*`.
- `@shops/kernel` may depend on `@shops/ui` only for shared Admin presentation. Commerce and persistence modules must not import an app.
- `@shops/ui` has no dependency on the kernel or an app.
- `@shops/delivery` is Node-only and must never enter a Worker bundle. Apps invoke it through root tasks rather than importing it at runtime.
- Apps never copy shared schema, migrations, API routes, Admin behavior, checkout behavior, or commerce commands.
- Internal packages use named exports with explicit public entry points. Importing another package's private source path is rejected by workspace checks.
- Store identity is captured from the app's build-owned Store Profile and deployment configuration. It never comes from a caller-controlled header or runtime Store lookup.

Each app owns its Store Profile, Astro storefront composition, static assets, Store-specific seed input, direct integration composition, and deployment identity. Shared packages own all protected commerce truth and cache-safety behavior described in #5.

## Generated Store apps

`pnpm store:create --slug <slug> --name <name>` copies one minimal app skeleton, fills deterministic identifiers, and stops. It fails if the destination exists and does not provision Cloudflare resources.

Generation is a bootstrap operation, not inheritance:

- the generated app becomes ordinary reviewed source;
- rerunning the generator never overwrites or merges an existing app;
- merchant storefront work edits app-owned Astro and Solid files directly;
- upgrading shared behavior changes workspace package source, not generated copies;
- there is no template patch engine, Store subclass, override registry, or code-generation lifecycle.

The generator validates a lowercase stable slug and creates only the files required to typecheck and run locally. Private prospect workflows may add reviewed Store Profile, catalog seed, and storefront work afterward without changing the shared kernel.

## Deployment Targets and environments

A **Deployment Target** is one manifest entry naming one app, one environment kind, and one isolated set of resources. The four supported kinds have fixed meanings:

| Kind | Lifetime and data | Integrations | Delivery behavior |
| --- | --- | --- | --- |
| `local` | Worktree-local disposable state | Local or explicitly enabled development credentials | Runs through Portless and app-local `.wrangler/state/v3`; creates no remote resources |
| `prospect-demo` | Expiring, private, synthetic data only | Synthetic payment and notification paths; no production credentials | Remote isolated resources, noindex, no real money or customer data, explicit expiry cleanup |
| `canary` | Long-lived fictional Reference Store with synthetic data | Production-shaped synthetic configuration | Exactly one remote Өрнүүн 48 target used before consequential Production updates |
| `production` | Long-lived real Store data | Only the Store's accepted real integrations | One isolated target and optional canonical domain |

There is no permanent staging environment. A prospect demo is not promoted to Production. Merchant acceptance provisions a new Production Target and resources from approved inputs.

The Portless and worktree contract from #16 remains authoritative locally: `<merchant-slug>.shop.localhost`, branch-segment worktree prefixes, app-local Wrangler state, host-only cookies, and Google OAuth only on explicitly registered canonical origins.

## Repository manifest interface

The delivery CLI accepts `--manifest <path> --target <name>`. It does not scan a Cloudflare account or discover apps implicitly. A future private repository may supply the same file interface, but this codebase owns only the schema and CLI.

A version-one manifest contains the smallest deterministic input needed for delivery:

```yaml
schemaVersion: 1
targets:
  urnuun-canary:
    kind: canary
    app: "@shops/urnuun-48"
    resourcePrefix: urnuun-canary
    workerName: urnuun-canary
    routes: []
```

The validated schema also permits an expiry for `prospect-demo`, exact canonical routes for `production`, and fixed public runtime values. It contains no secret values. Resource IDs, current D1 bookmark, applied migration names, deployed commit, and proof results are outputs recorded in the journal rather than hand-authored desired state.

Target names, app package names, environment kinds, resource prefixes, Worker names, and existing resource identities are immutable after creation. Changing one requires a new target or explicit decommissioning. Mutable routes and public values may change through a new apply run.

The committed repository includes only the fictional Reference Store's local and canary manifests. Real prospect and Production manifests live under ignored `.private/` storage. Generated Wrangler configuration lives under ignored target state and is never an additional hand-edited source of truth.

## Static integration composition

An app directly imports the accepted integration modules in a typed composition file. Build output therefore contains only known integrations and their requirements. The delivery CLI reads the resulting build-owned requirement description before remote mutation.

Requirements use fixed categories:

- D1, session KV, cache KV, and media R2 bindings;
- optional private Service Bindings already accepted by the Store;
- public runtime values;
- secret names.

Binding names are stable across every app. Secret values are entered with Wrangler or CI secret bindings and never pass through the manifest or journal. Apply verifies required secret names before deployment and pauses with an `awaiting-secrets` result that lists exact missing names.

A known integration translates provider evidence into the shared kernel's canonical Payment, notification, or delivery interfaces. It does not own Order or inventory truth. If an accepted future integration genuinely needs persistence, its schema becomes part of the one reviewed kernel migration stream at that time; v1 does not assemble independent adapter migration streams.

`prospect-demo` and `canary` builds fail if they include production payment, SMS, or Telegram routing. Production builds fail if required real integration configuration is absent.

## Deterministic workspace tasks

Vite Plus uses the ordinary workspace dependency graph. The canonical package selector is `vp run -t <package>#<task>` so app dependencies run in dependency order.

The initial task surface is intentionally small:

- `pnpm dev:stores` — ensure the shared Portless proxy and run all Store dev tasks;
- `pnpm dev:store -- <slug>` — run one app through Portless;
- `pnpm check` — typecheck and lint the workspace;
- `pnpm build:store -- <slug>` — build one app and its workspace dependencies;
- `pnpm store:create -- ...` — bootstrap one app;
- `pnpm store:apply -- --manifest <path> --target <name>` — provision or update one target;
- `pnpm store:proof -- --manifest <path> --target <name>` — rerun non-mutating live proof;
- `pnpm store:cleanup -- --manifest <path> --target <name>` — explicitly remove an eligible demo or partial target.

Build and check tasks may use content caching with declared inputs and outputs. Dev servers and every task that reads or mutates Cloudflare, D1, secrets, journals, or live proof are never cached. Package scripts remain thin; delivery sequencing lives in the typed delivery CLI rather than shell pipelines.

The workspace pins pnpm, Node, Vite Plus, Wrangler, Astro, and migration tooling versions. Remote apply requires a clean checkout and records the exact commit and lockfile digest. Production apply additionally requires an explicit typed target confirmation. It does not require tags, changelogs, artifact registries, or a release branch.

## One resumable apply workflow

`store:apply` validates everything it can before the first mutation, acquires a checkout-local target lock, and performs these ordered steps:

1. validate manifest, target kind, app, clean source, tool versions, and static integration requirements;
2. build the selected app and record source and build digests;
3. create or verify the target D1 database;
4. create or verify session KV;
5. create or verify cache KV;
6. create or verify media R2;
7. render ignored Wrangler configuration from manifest plus verified resource IDs;
8. generate binding types and run the selected app's typecheck;
9. verify required secret names;
10. list pending migrations and record the current D1 Time Travel bookmark;
11. apply the shared migrations;
12. apply the idempotent Store seed when the target has not been seeded;
13. deploy the Worker by content digest;
14. prove the workers.dev deployment and required bindings;
15. attach configured routes, then prove the canonical URL;
16. mark the journal `ready` with commit, migration, deployment, and proof evidence.

Steps that do not apply, such as remote resource creation for `local` or route attachment without routes, are recorded as skipped with a reason. The journal is a small versioned JSON document beside the target's ignored delivery state. Every successful external response is durably written before the next step begins.

On restart, the CLI validates the manifest digest and re-verifies completed external facts before skipping them. A missing resource, changed immutable identity, ambiguous same-name resource, changed source digest after deployment began, or inconsistent migration history stops with a precise recovery instruction. It never guesses ownership.

A failed step records the redacted command, time, error, and retry count. Already-created resources remain. Rerunning starts at the first incomplete or no-longer-valid step. The workflow uses ordinary Cloudflare idempotency and deterministic resource names; it does not introduce a remote lock or coordinator. Concurrent remote apply for the same target is unsupported and rejected operationally.

## Schema evolution and rollback

The kernel owns one ordered Drizzle schema and one committed migration stream. Apps point Wrangler directly at that stream; they do not copy or reorder it. Schema generation runs only from the kernel, and workspace checks fail when the committed migration output is stale.

Before applying remote migrations, delivery records:

- the exact pending migration names;
- the currently applied migration names;
- the current D1 Time Travel bookmark;
- the app commit and build digest intended to follow them.

D1 already backs up migration application and rolls back a failing individual migration. The recorded bookmark is incident evidence and a manual disaster-recovery option, not an automatic application rollback mechanism.

Consequential changes use a forward-only expand/contract sequence:

1. add a backward-compatible schema shape;
2. deploy code that can operate with the old and expanded shape;
3. perform any bounded resumable data movement through an explicit delivery task;
4. deploy code that uses the new shape;
5. remove the old shape only in a later reviewed migration after every affected Production Target has been manually confirmed on compatible code.

At this Store count, confirmation is a journal/report check, not a fleet service. An application incident redeploys a previously recorded compatible commit. Time Travel restore or corrective SQL is a separate founder-authorized recovery action and is never triggered by deploy failure.

## Canary, selective Production delivery, and drift

A consequential kernel or migration update follows a short human-driven sequence:

1. run workspace checks;
2. apply the Өрнүүн 48 canary target;
3. run its eight accepted synthetic Canary Scenarios plus browser/API proof;
4. observe the result and explicitly choose Production target names;
5. apply those targets one at a time and stop on the first failure.

This is the entire phased rollout. There are no percentages, cohorts, health windows, automatic promotion, or automatic rollback. A storefront-only change may target its one Store directly after normal checks when it cannot affect shared commerce or schema behavior.

Workspace source and `workspace:*` dependencies prevent package-version drift. The journal makes deployment drift visible by reporting each target's deployed commit, lockfile digest, migration head, and last proof time. A read-only report compares explicitly named manifests; it does not poll continuously or mutate anything. Convergence is a founder decision to apply a commit to selected Stores, not a platform invariant.

Manual edits to generated Wrangler files, copied migrations, uncommitted remote deploys, and deploying a source digest different from the journal are unsupported. The next apply reports the mismatch and requires an explicit adopt-or-redeploy decision rather than silently overwriting it.

## Cleanup and recovery

Cleanup is never part of apply failure handling.

- `prospect-demo` cleanup is idempotent and requires typing the full resource prefix. It disables routes and Worker access before deleting storage, then journals each deletion.
- Partial targets created by a failed first apply use the same explicit prefix-confirmed cleanup.
- The normal cleanup command refuses `production`. Production decommissioning is a separately reviewed manual runbook so a convenient demo command cannot delete real commerce data.
- Canary reset uses ordinary synthetic scenario reset commands; deleting and recreating the canary requires explicit manual approval.
- Local reset deletes only the selected app's worktree-local Wrangler state after confirmation.

If cleanup itself fails, its journal resumes at the first undeleted resource. Resource absence counts as already complete. No cleanup command searches by broad account prefix or touches a resource whose recorded ID and deterministic name do not both match.

## Required implementation proof

Implementation is not complete until actual commands demonstrate:

- two Store apps build from shared kernel and UI source without copied protected modules;
- concurrent main-checkout and linked-worktree local development preserves the #16 isolation contract;
- a real disposable demo apply creates isolated D1, KV, R2, Worker, types, migrations, seed, deploy, and proof;
- an injected real command failure leaves resources intact and resumes without replaying completed mutations;
- missing secrets pause before deploy without recording values;
- changed immutable manifest identity and generated-config drift fail closed;
- the Reference Store canary runs the eight accepted synthetic scenarios;
- an expand migration permits redeploying the previously recorded compatible Worker commit;
- explicit demo cleanup resumes after failure and cannot target Production;
- the final Worker and D1 evidence identifies the same commit and migration head as the journal.

Proof uses actual Wrangler, D1, KV, R2, Workers, curl, TypeScript harnesses, and agent-browser. Missing credentials or Cloudflare access are reported as blocked rather than replaced with mocks, stubs, or a fake control plane.

## Primary references

- [Vite Plus workspace tasks](https://viteplus.dev/guide/run)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare D1 Time Travel and bookmarks](https://developers.cloudflare.com/d1/reference/time-travel/)
- Accepted shared-kernel prototype resolution in issue #5
- Accepted prospect workflow in issue #13
- Accepted Portless/worktree contract in issue #16
- Accepted Reference Store and Canary Scenarios in issue #28
