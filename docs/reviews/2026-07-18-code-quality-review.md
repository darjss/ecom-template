# Code quality review — elegance and maintainability

**Date:** 2026-07-18
**Scope:** HEAD `42d3791`, sampled across all layers — contracts, kernel (operations/persistence/reader), api routes, client, admin, storefront islands, and the Store app Astro pages. Not exhaustive; a quality judgment on the sampled core.

**Question asked:** is this elegant, nice, maintainable code?

---

## Verdict

Yes, with reservations. The codebase is disciplined and consistent at the boundaries — types, validation, error handling, and layering are in genuinely good shape. The weaknesses are local duplication patterns that compound as features grow: the same shape copy-pasted three times, and error-mapping logic written three different ways. Nothing structural; everything fixable with small refactors.

---

## What is genuinely good

**Guardrail adherence is total.** Across all `packages/*/src` and `apps/*/src`: zero `any`, zero non-null assertions, zero stray inline comments, zero lingering TODOs. The strict-TypeScript posture is not aspirational — it holds.

**Boundary discipline.** Valibot parses at every trust boundary and the output is re-validated against response schemas before leaving the API (`v.parse(BundleMutationResponseSchema, ...)` in `packages/api/src/bundle-routes.ts`). Raw Drizzle rows never escape persistence — DTO mappers like `categoryDto`/`collectionDto`/`tagDto` in `packages/kernel/src/grouping/persistence.ts` convert at the seam. Branded typeid schemas (`typeIdSchema` in `packages/contracts/src/bundle.ts`) make ID mix-ups a compile error.

**Error taxonomy is typed end-to-end.** Operation failures are readonly discriminated unions (`CatalogOperationFailure` in `packages/kernel/src/catalog/operations.ts`), mapped to HTTP exactly once per route module, and carried to the browser as typed envelopes. Better Result is internal only, as specified.

**The SolidJS is correct and accessible.** `packages/storefront/src/ProductVariantSelector.tsx` is the best file sampled: fine-grained `createMemo`/`createSignal` usage, keyed `Show`, `fieldset`/`legend` semantics, `aria-pressed`, `aria-live` price region, `min-h-11` touch targets, `motion-reduce:transition-none`, `tabular-nums` for prices. The variant-overlap selection algorithm (`overlapWithCurrent`) is small and reads well.

**Astro pages are thin.** `apps/urnuun-48/src/pages/products/[slug].astro` does data fetching, parallelizes independent reads with `Promise.all`, applies cache tags, and delegates rendering — proper image markup too (`srcset` pairs for avif/webp, `fetchpriority` on the first image, `decoding="async"`).

**Error mapping, where done well.** `mapFailure` in `packages/api/src/index.ts` (early-return ifs) and the `messages: Record<code, string>` in `bundle-routes.ts` are both clean, exhaustive-by-construction ways to map failure unions.

---

## What hurts

### 1. Triplicated category/collection/tag code — `packages/kernel/src/grouping/persistence.ts` (906 lines)

The largest file in the repo is roughly one-third copy-paste. The same six shapes exist three times with only the table swapped:

- `categoryDto` / `collectionDto` / `tagDto`
- `categoryCatalogItemIds` / `collectionCatalogItemIds` / `tagCatalogItemIds`
- `findCategory` / `findCollection` / `findTag`
- `categorySlugExists` / `collectionSlugExists` / `tagLabelExists`

A single helper parameterized on table + membership table (or a small factory returning the query set per grouping kind) would cut ~300 lines and, more importantly, make the *differences* (collections order by `position`, tags normalize labels with `toLocaleLowerCase("mn")`) visible instead of drowned in repetition. Right now a behavior change to "groupings" requires three synchronized edits — the exact condition under which divergent bugs breed.

### 2. Error mapping written three different ways in one package

The same problem — operation failure union → HTTP status + message — is solved three ways inside `packages/api/src`:

- `mapFailure` (index.ts): clean early-return chain — fine.
- `bundleError` (bundle-routes.ts): exhaustive `Record<code, string>` — fine.
- `catalogError` (index.ts): a **~50-line nested ternary** (`code === "duplicate_slug" ? ... : code === "duplicate_combination" ? ...`) — the worst of the three, and the one covering the most codes.

Worse, both `catalogError` and `bundleError` do a redundant round-trip: `failure.code` → `httpStatus` → back to a coarse envelope `code` by re-testing `httpStatus === 403 ? "forbidden" : ...`. Two lookup tables (`code → { status, envelopeCode, message }`) would make each mapping a single indexed access, exhaustive at compile time, and identical in shape across route modules.

### 3. Operation-layer boilerplate — `packages/kernel/src/catalog/operations.ts`

Every exported operation repeats the same skeleton: `authorize` check → `try` → narrow the persistence union with a hand-written whitelist ternary → `catch { return infrastructure_unavailable }`. The narrowing chains like

```ts
code: result.kind === "not_found" || result.kind === "conflict" || result.kind === "inventory_limit"
  ? result.kind
  : "conflict",
```

are friction points: persistence returns a broad `kind` union and each operation manually re-whitelists it. If persistence returned precisely-typed per-query failure unions, most of these ternaries — and the catch-all "map anything unexpected to infrastructure_unavailable/conflict" branches that can silently mislabel errors — would disappear. A small `withAuthorization(actor, op)` wrapper would remove the repeated authorize/try/catch frame without hiding anything.

### 4. Contract schema duplication — `packages/contracts/src/bundle.ts`

`PersonalizationDefinitionSchema` writes the same seven fields (`id`, `key`, `label`, `position`, `required`, `state`, plus `maxLength`/`values` slots) into three `strictObject` variants — and then `PersonalizationDefinitionDraftSchema` duplicates all three again with `id` optional. Six near-identical object literals for two concepts. Valibot composes fine here: one shared field map spread into per-kind objects, and the draft derivable from the definition shape. Adding a fourth personalization kind currently means editing two places in lockstep.

### 5. Route handler repetition — `packages/api/src/bundle-routes.ts` (and siblings)

Every handler is the same five steps: `safeParse` id → `safeParse` body → `validationError` → `authorize` → call operation → map result. It is consistent and explicit (a virtue given the guardrails), but eight copies of the frame in one file means the interesting part of each route — which schema, which operation — is a small fraction of the text. An Elysia `derive`/guard or a tiny local `withActor`/`parseBody` helper would compress each handler to its essentials. Lower priority than 1–4: the repetition is uniform, so it is boring rather than confusing.

---

## Docs vs code: prescribed-but-unused functional tooling

`docs/agents/coding-standards.md` prescribes a functional shape — "pipelines, readable fluent transformations, and exhaustive `dismatch` expressions", "`es-toolkit` for real generic operations" — that the runtime code does not deliver:

- **`dismatch`** — prescribed twice in the standards, declared in `packages/kernel/package.json` (2.6.0), imported **nowhere**. Dead dependency. Its exact use case (exhaustive matching on failure-code unions) is where the ternary staircases in finding 2 live.
- **`es-toolkit`** — declared in `packages/kernel/package.json` (1.49.0), imported **nowhere**. Dead dependency. Meanwhile the "are these ids unique" concept is hand-rolled eight times across five files: an identical `distinct` helper defined in both `packages/kernel/src/bundles/persistence.ts:36` and `packages/kernel/src/catalog-variants/persistence.ts:132`, plus six inline `new Set(ids).size !== ids.length` repetitions.
- **Result combinators** — zero usage of `.andThen()`, `.mapErr()`, `.orElse()`, or `Result.try`. Result serves only as a tagged return type, assembled by ternaries and unpacked with 39 manual `.isErr()` checks. Contracts code is genuinely functional (`v.pipe` ×110); kernel and api code is imperative code returning functional types.

Decision needed per tool: adopt it where the docs point (making finding 2's fix use `dismatch`, centralizing the distinctness check), or delete the dependency and amend the standards. Either closes the gap; the current middle state is the worst option.

## Suggested order of attack

1. **Grouping persistence triplication** — biggest line-count and divergence risk win.
2. **Unify API error mapping** — one table-driven helper per route module; kill the ternary chain and the status→code round-trip.
3. **Tighten persistence failure unions** so operations stop re-whitelisting.
4. **Compose the personalization contract schemas** — define once, derive the draft.
5. Optionally, compress route handler frames.
6. Resolve `dismatch`/`es-toolkit`: adopt or delete, and unify the eight hand-rolled distinctness checks.

Each is a self-contained refactor with no behavior change.
