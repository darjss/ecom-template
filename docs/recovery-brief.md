# Recovery brief

This document mirrors [issue #115](https://github.com/darjss/ecom-template/issues/115), the scope authority. It supersedes #33, #50–#72, and #92–#111, which are closed. Historical contracts live in `docs/archive/` — evidence only, never scope. Update this file and issue #115 together.

## The product

One sellable Mongolian ecommerce Store: mobile-first shopper storefront with distinctive merchant art direction (committed: Өрнүүн 48 pantry direction), and a merchant Admin whose home is the Order inbox. Target scale: 10–20 Orders/day, comfortable at 50.

## Build order

**Slice 1 — the loop (nothing else ships before this works end-to-end in a browser):**
Browse real seeded products → product detail → cart → guest checkout → bank-transfer Order created exactly once → merchant sees it in `/admin/orders` → confirms payment → advances fulfillment → shopper sees status.

**Slice 2+:** discounts, Byl QPay, direct QPay, COD (OTP-gated), cancellations + manual refunds (status + note), Telegram one-tap confirm/reject for allowlisted operator IDs, bundles, personalization, customer OTP + order history, Mongolian FTS5 search + transliteration, flat delivery + pickup, typed CMS (draft/published), canary curl script.

## Simplicity caps (binding)

- One table per concept. **No** ledger/entries/allocation/debt/rotation tables.
- Status + timestamp columns instead of state-history tables. Provider is payment truth; store provider ref + status + confirmedBy/At only.
- Cache purge is synchronous after admin write; log failures. No purge-debt machinery.
- Guest tracking = the Order token in the URL. Customer OTP + order history stays (table stakes), minimal session machinery.
- Every new table needs a one-line justification in its PR.
- Inventory = atomic `onHand`/`reserved` counters. The atomicity is the value; the ledger is not.

## UI law

- Zaidan controls (`pnpm dlx shadcn@latest add @zaidan/<name>` into `packages/ui`). Raw `<input>/<select>/<textarea>` in new UI is a blocker.
- TanStack Form for forms, TanStack Query for remote state. No Tailwind-class string constants shared across files — extract a component.
- Admin is routed; Order inbox is its home. Storefront keeps the pantry direction per DESIGN.md.

## Gates

- Per PR: format, lint, typecheck, build. UI PRs add one desktop + one mobile screenshot taken by the agent in a real browser. API PRs add one real curl.
- Per slice: agent runs a full browser walkthrough of the user journey + full gate suite. One correction pass; a second failure escalates to the human.
- No mocks, stubs, or fakes. Blocked beats fake green.

## DO NOT (learned from the failed run)

- Do not write mechanism-inventory prompts or 500-line briefs; slices are outcome-first, one page max.
- Do not add Cloudflare Workflows, PostHog, event sourcing, audit matrices, capability rotation, or `dismatch` legislation.
- Do not preserve a broken model with fallbacks; break and fix.
- Do not treat "gates green" as "product approved" — those are separate states.
