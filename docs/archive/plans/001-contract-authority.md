# Remove stale agent traps and establish contract authority

Base: `f748ab739274ed57e57e115c081a3c68bc249733`

## Why

Agents currently receive contradictory instructions. `docs/agents/polar.md` tells them to configure a removed billing system, `docs/architecture/bootstrap-plan.md` still calls closed issue #31 a review draft, and `CONTEXT.md` says every mutation requires a Revision while final reconciliation rejects general Revision contracts. The repository has many Wayfinder artifacts but no compact index explaining authority and status.

## Scope

- Delete `docs/agents/polar.md`.
- Update the bootstrap plan status to record issue #31 and PR #34 as landed at merge `f748ab739274ed57e57e115c081a3c68bc249733`. Preserve it as historical execution guidance, not current domain authority.
- Correct `CONTEXT.md` so Revision is not a universal requirement. Consequential transitions use atomic current-state predicates and retry idempotency; ordinary Catalog/settings/CMS writes are last-write-wins.
- Review the `Domain Event` glossary entry and ensure it cannot be read as approval for a generic event store. Preserve only legitimate immutable domain facts; the accepted implementation uses compact Audit Events and dedicated financial/inventory ledgers.
- Add `docs/agents/contract-index.md` containing a concise feature-to-authority table. For each major area, name the authoritative current document, supporting research/prototype documents, landed bootstrap seam, and superseded decisions that must not return.
- Link the index from `AGENTS.md` and clarify precedence: final scope reconciliation, then accepted feature contract, then research/prototype/history.

## Boundaries

Do not rewrite Wayfinder contracts, duplicate their details, create a new ADR system, or change source code. Do not weaken issue #33. Keep the index compact enough for an agent to load before feature work.

## Verification

- Search finds no tracked Polar setup instructions or superseded SaaS file references.
- Search finds no claim that bootstrap #31 is in progress or draft.
- `CONTEXT.md` and final reconciliation agree on Revision behavior.
- Every document linked by the new index exists.
- `pnpm format:check`, `pnpm lint`, and `git diff --check` pass.

## Stop conditions

If two accepted contracts still disagree after applying final-reconciliation precedence, stop and report the exact clauses instead of silently choosing one.
