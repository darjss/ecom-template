# Issue 18 UI and form foundation prototype

## Status

Disposable decision artifact. This branch must not be merged as implementation. Browser verdict is pending the sole browser lease.

Route in development: `/prototype/ui-form-foundation?variant=A|B|C`

## Question tested

Can one shared accessible Zaidan/Kobalte, TanStack Form, Valibot, local-draft, and optimistic-revision contract support a consistent mobile-first Merchant Admin while allowing merchant-specific storefront composition?

## Approved contract

- Shared UI owns accessible Kobalte/Zaidan primitives, form adapters, focus/error semantics, and accessibility invariants.
- Merchant Admin uses one locked semantic-token and composition vocabulary.
- Merchant storefronts may own bounded scoped brand tokens and composition, but not focus behavior, error association, disabled semantics, touch-target minimums, reduced-motion behavior, keyboard interaction, or commerce truth.
- `createMerchantForm` exposes TanStack Form rather than replacing it. Forms provide Valibot schemas, typed field IDs, reconciliation descriptors, identity, schema version, initial revision, and a typed save callback.
- Save returns either a typed saved record or a typed revision conflict. Operational failures remain separate and retain the draft.
- Validation runs on blur, revalidates an invalid field on change, validates all fields on save, navigates through an async form-owned callback when needed, then focuses the first invalid control.
- Credential forms never opt into local draft persistence.

## Draft envelope and lifecycle

Stable key identity: store, form, and entity. The envelope contains:

- identity
- schema version
- base revision and values
- draft values
- saved time

Draft values are persisted after 750 ms idle and flushed on page hide. Metadata is validated before version comparison; same-version values are then validated through the form schema before hydration. Incompatible or malformed drafts are never coerced, deleted silently, or exposed to TanStack Form.

A compatible draft opens an explicit Continue/Discard recovery gate. Same-revision drafts restore directly. Stale drafts use typed three-way reconciliation. Non-conflicting draft changes merge automatically; every true conflict requires an explicit server/draft choice before editing resumes. Authoritative save still uses optimistic revision validation.

Successful save refreshes base values and revision, resets dirty state, and clears the draft. localStorage failure degrades to in-memory editing with explicit warning while server save remains available. Compatible drafts do not expire by age. Same-browser concurrent-tab arbitration is unsupported in this prototype.

## Variants

- **A, Guided document:** one continuous mobile-first document with semantic fieldsets and completion guidance.
- **B, Focused sections:** one section at a time, compact horizontal navigation on mobile and a side rail on larger screens.
- **C, Storefront preview:** Editor/Preview tabs on mobile and simultaneous split view on larger screens. A fictional Өрнүү storefront uses scoped tokens and composition without changing Admin controls or behavior.

All variants use one live form and scenario instance. URL switching changes composition without losing values, validation, revisions, draft state, or unresolved conflicts.

## Scenario lab

The route includes explicitly labeled browser-only controls for:

- external staff revision changes
- next-save operational failure
- incompatible draft version
- malformed draft values
- scenario reset

The lab exercises client interface transitions only. It makes no backend persistence, locking, or concurrency-correctness claim.

## Zaidan update workflow

Checkbox, select, textarea, and radio-group were added through the configured Zaidan CLI. Generated `base.css` was not hand-edited. Generated Lucide barrel imports conflicted with the repository workerd rule, so a separate reviewed compatibility commit normalized only those imports to `lucide-solid/icons/<name>` deep paths. This normalization is mandatory after generation until upstream output is workerd-safe.

## Terminal evidence

- `pnpm typecheck`: pass
- `pnpm exec vp lint .`: pass
- scoped prototype lint: pass
- scoped JSX accessibility lint: pass with no findings
- scoped formatting check: pass
- `pnpm build`: pass
- development curl for variants A/B/C: HTTP 200
- production preview curl for the prototype route: HTTP 404 with plain `Not found`
- production preview curl for `/api/health`: HTTP 200
- navigation and marketing source references to the prototype route: none

The exact `pnpm lint` package script has a pre-existing baseline defect: `vp lint` without a path attempts to invoke missing ESLint. The explicit equivalent `pnpm exec vp lint .` is green; the disposable branch does not alter the unrelated script.

## Browser evidence

Pending. Required matrix:

- A/B/C at 390×844 and 1440×900
- normal edit/save
- reload recovery
- incompatible-version discard
- stale three-way reconciliation
- validation navigation and focus
- optimistic revision rejection
- keyboard operation, visible focus, 200% zoom/reflow, touch targets, unobscured content, and console errors
- at least one critique-and-fix pass

## Limitations

- Prototype code is isolated and intentionally not production-ready.
- Existing auth/profile forms and `src/lib/form.ts` are unchanged.
- Scenario server state uses browser session state only.
- Cross-tab local draft arbitration is not implemented.
- Theme pair validation is a provisioning/generation requirement, not implemented as a runtime browser checker here.

## Verdict

Pending browser review.
