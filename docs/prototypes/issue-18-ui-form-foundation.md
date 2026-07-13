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
- scoped JSX accessibility lint: pass with two custom-component label association warnings; live accessibility-tree proof confirmed both Kobalte radios are named, keyboard operable, and clickable through their visible labels
- scoped formatting check: pass
- `pnpm build`: pass
- development curl for variants A/B/C: HTTP 200
- production preview curl for the prototype route: HTTP 404 with plain `Not found`
- production preview curl for `/api/health`: HTTP 200
- navigation and marketing source references to the prototype route: none

The exact `pnpm lint` package script has a pre-existing baseline defect: `vp lint` without a path attempts to invoke missing ESLint. The explicit equivalent `pnpm exec vp lint .` is green; the disposable branch does not alter the unrelated script.

## Browser evidence

Agent-browser exercised all three variants at 390×844 and 1440×900.

- A, B, and C had no horizontal document overflow at either viewport.
- Variant B changed from horizontal mobile section navigation to a desktop side rail.
- Variant C exposed Editor/Preview tabs on mobile and mounted both panes in a desktop split view.
- One live edit survived A → B → C switching, including URL replacement and unresolved conflict choices.
- Invalid submit in B activated the hidden owning section and focused its textarea.
- Invalid submit from C Preview activated Editor and focused the described invalid textarea.
- Field labels, help IDs, error IDs, `aria-invalid`, named conflict radios, keyboard order, visible focus rings, and 44 px touch targets were inspected live.
- A 720 CSS-pixel viewport was used as the 200% reflow proxy for a 1440-wide desktop; it switched to the mobile topology without horizontal overflow.
- The 750 ms draft write produced the approved envelope in localStorage. Reload showed saved time and the explicit Continue/Discard gate. Continue restored values; Discard removed storage.
- Successful authoritative save advanced the revision, cleared localStorage, reset dirty state, disabled save, and announced inline success.
- The stale scenario advanced server revision, auto-merged a server-only price change, required an explicit named radio choice for the true name conflict, retained the choice across variant switching, and resumed with the selected name plus merged price.
- The old-version scenario exposed only explicit discard and never hydrated incompatible values.
- The operational-failure scenario focused a persistent actionable error and retained the draft.
- A fresh browser session completed with no runtime errors or failed network requests.

Representative evidence:

- `issue-18-evidence/screenshots/final-mobile-a.png`
- `issue-18-evidence/screenshots/final-mobile-b.png`
- `issue-18-evidence/screenshots/final-mobile-c-editor.png`
- `issue-18-evidence/screenshots/final-mobile-c-preview.png`
- `issue-18-evidence/screenshots/final-desktop-A.png`
- `issue-18-evidence/screenshots/final-desktop-B-annotated.png`
- `issue-18-evidence/screenshots/final-desktop-C.png`
- `issue-18-evidence/screenshots/mobile-c-invalid-focus.png`
- `issue-18-evidence/screenshots/mobile-recovery-gate.png`
- `issue-18-evidence/screenshots/final-mobile-conflict-choice.png`
- `issue-18-evidence/screenshots/final-reflow-720.png`

## Critique and fix pass

| Before                                                                           | After                                                                                      | Why                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 36 px text, number, and select controls                                          | 44 px minimum controls and select options                                                  | Mobile controls must be reliably thumb reachable                                      |
| 32 px scenario controls and 40 px variant arrows                                 | 44 px minimum targets                                                                      | Prototype controls must meet the same interaction floor as the interface under review |
| Separate floating switcher blocked the category control                          | Switcher moved into the fixed action dock, with a compact mobile label                     | Evaluation chrome must not intercept merchant input                                   |
| Invalid focus selected the first matching hidden development-toolbar control     | Focus selects the first rendered matching field after async navigation                     | B and C now satisfy first-invalid focus in live use                                   |
| Old-version scenario was overwritten by page-hide flushing                       | Scenario seeding suppresses the pending flush before reload                                | Incompatible-version proof is now reproducible                                        |
| Conflict radios had no accessible names and only the small control was clickable | Generated input receives the accessible name and the visible option is a full label target | Conflict choices now work with screen readers, keyboard, pointer, and touch           |

## Limitations

- Prototype code is isolated and intentionally not production-ready.
- Existing auth/profile forms and `src/lib/form.ts` are unchanged.
- Scenario server state uses browser session state only.
- Cross-tab local draft arbitration is not implemented.
- Theme pair validation is a provisioning/generation requirement, not implemented as a runtime browser checker here.

## Verdict

The shared foundation contract is validated. All three compositions run over one form, draft, reconciliation, and accessibility model without leaking the fictional storefront theme into Merchant Admin.

Approved layout policy after founder review:

- Use C as the default product-editor Admin topology because the live storefront preview gives useful context while editing; keep its preview composition app-owned and its commerce controls shared.
- Use B when a product has enough operational sections that focused navigation is more valuable than persistent preview context.
- Use A for short coherent forms where section navigation adds friction.
- Restore a valid draft automatically when it is based on the current server revision. Interrupt only for stale, incompatible, or unreadable drafts.
