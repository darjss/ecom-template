# Codebase state review after PRs #73, #74, #75

**Date:** 2026-07-17
**Scope:** current `main` (HEAD `90f506e`), focused on the three merged feature PRs:

| PR | Commit | Subject | Code added (ts/tsx) |
| --- | --- | --- | --- |
| #73 | `0891de4` | Store-local Staff authority | ≈ +2,540 |
| #74 | `765f36c` | Customer SMS OTP sessions | ≈ +1,240 |
| #75 | `90f506e` | Publish and browse default-variant products | ≈ +2,630 |

**Question asked:** is the code aligned with the simple-store goal (independent Stores, 10–20 Orders/day, ~5 Staff), or is there unnecessary code handling edge cases that do not exist?

**Authorities applied:** [`docs/specs/ecommerce-system.md`](../specs/ecommerce-system.md) (issue #33 mirror), [`docs/agents/coding-standards.md`](../agents/coding-standards.md), [`docs/agents/contract-index.md`](../agents/contract-index.md), and the Wayfinder contracts it points to.

---

## Verdict

The architecture is aligned. The over-engineering is local, not structural.

Routes are thin, persistence is feature-private, contracts are Valibot-first, there are no service/repository/controller layers, no factories, no buses, no DI wrappers, and `pnpm knip` reports zero unused files/exports. The feature-slice shape the docs prescribe is exactly what landed.

However, inside that correct shape there is a repeated pattern of **edge-case-first engineering**: several subsystems carry two or three independent mechanisms for one invariant, dead write-only state, and defensive re-reads guarding states that the schema already makes impossible. Measured against the founder's own deletion test ("if deleting a module removes only indirection, delete it"), roughly 700–900 lines of the ~6,400 added have not earned their place yet, and one implementation choice directly contradicts an accepted contract clause.

---

## Finding 1 — Staff session authority: three mechanisms for one invariant, one of them contract-forbidden (high)

**The invariant:** after a role change or revocation, old Staff sessions must not retain authority.

**What the contract says** ([auth-authorization-session-contract.md](../wayfinder/auth-authorization-session-contract.md), restated in [the spec](../specs/ecommerce-system.md#authentication-and-authorization)):

> "A role change or revocation deletes every Staff Auth session for that Staff Member. Staff sessions contain the role snapshot used for authorization… Normal requests validate the revocable KV-backed session and **do not query D1 again solely for role authorization**."

**What the code does — all three of these simultaneously:**

1. **Eager session deletion** — `cleanupStaffUserSessions` in `packages/kernel/src/auth/runtime.ts` lists, deletes, and re-verifies sessions through Better Auth internals after every approve/role-change/revoke/remove.
2. **A cleanup-debt subsystem** for when (1) fails: the `staff_session_cleanup_debts` table ([schema.ts](../packages/kernel/src/db/schema.ts)), `cleanupDebtSelect` SQL builders in [staff/persistence.ts](../packages/kernel/src/staff/persistence.ts), the `retryStaffSessionCleanup` operation, the `POST /api/staff/session-cleanup/retry` route, a client request path ([client/src/staff/request.ts](../packages/client/src/staff/request.ts)), and an Admin `CleanupDebtControl` surfaced through `cleanupRequiredCount`.
3. **A per-request D1 authority re-read** — every Staff request calls `readStaffAuthSession` → `staffQueries.readCurrentSessionAuthority`, which queries `staff_members` to compare `sessionGeneration` and email before authorizing. This is exactly the "redundant D1 role read on every request" the spec says normal authorization must **not** require.

Mechanism 3 alone closes every hole mechanism 1+2 protect against (a surviving stale session is detected and deleted on its next use). Mechanisms 1+2 alone satisfy the contract. Keeping all three is belt, suspenders, and a second belt — for a Store with a handful of Staff members.

**Cost:** the debts table/migration, ~150 lines of persistence, ~90 lines of runtime cleanup, ~60-line retry operation, one route, one client path, one Admin control, plus a D1 read added to every authenticated Staff request forever.

**Also dead:** the `provision` variant of the cleanup-operation enum exists in the schema CHECK, the Valibot picklist, and the `StaffCleanupOperation` type, but no code path ever writes it.

**Decision for the founder (the implementation and your contract currently contradict each other):**

- **Option A (contract-conformant):** delete mechanism 3 (the per-request generation re-read). Keep eager deletion + debt retry as the failure-recovery path. Matches the accepted contract; removes the per-request D1 read.
- **Option B (strongest, simplest at runtime):** keep the generation check as the single enforcement point and delete the debt table, retry endpoint, Admin control, and eager-cleanup verification. Fail-closed on every request, smallest total code — but you must amend the contract clause that forbids the D1 read.
- Either way, one mechanism's worth of code (~200–350 lines) and the dead `provision` variant should go.

---

## Finding 2 — OTP rate limits: D1 does all the work, KV mirror keys are write-only (high, unambiguous dead code)

`applySendLimits` in [`packages/kernel/src/customer/operations.ts`](../packages/kernel/src/customer/operations.ts) enforces the OTP policy (30s cooldown, 5/phone/day, 10/IP/15min — spec story 66) entirely through the D1 `customer_otp_rate_counters`/`customer_otp_rate_admissions` tables via a 7-statement batch in [customer/persistence.ts](../packages/kernel/src/customer/persistence.ts).

Immediately afterwards it also writes three keys into `EPHEMERAL_KV`:

```
customer:otp:cooldown:<hmac>
customer:otp:phone-day:<window>:<hmac>
customer:otp:ip-window:<window>:<hmac>
```

**Nothing reads these keys. Anywhere.** Grep across the repo shows the only occurrences are the three writes. Every OTP send pays three KV writes into a void. (The [final scope reconciliation](../wayfinder/final-scope-reconciliation.md) lists rate-limit counters among the things the one KV namespace holds — so the KV writes look like a vestige of an earlier design where KV enforced the limits; the D1 design won and the mirror was never deleted.)

**Action:** delete the three KV puts (~20 lines) or make KV the actual enforcement and delete the D1 counters — but not both. Deleting the dead writes is the low-risk move; D1 enforcement is also the stronger one (KV is eventually consistent and races under parallel sends).

---

## Finding 3 — 356 lines of hand-rolled Unicode 17 case folding for SKU comparison (medium, disproportionate)

[`packages/kernel/src/catalog/sku-case-fold.ts`](../packages/kernel/src/catalog/sku-case-fold.ts) implements full Unicode 17 case folding from literal range/single/expansion tables — Armenian ligatures, Greek ypogegrammeni, Deseret, Adlam, Warang Citi, Medefaidrin — so that `compactSku` in [sku.ts](../packages/kernel/src/catalog/sku.ts) can compare merchant-typed SKUs.

**Provenance (fairness):** the idea is not invented — [search-contract-research.md](../wayfinder/search-contract-research.md) prescribes `NFKC → full Unicode case fold → NFC` for *search keys*, and notes the prototype only proved `toLocaleLowerCase("mn-MN")`. But that research governs a future search feature; today this table is used **only** for SKU compact equality, where the requirement is merely "tolerate hyphens, slashes, whitespace, and case differences" (spec story 20).

For a Mongolian pantry catalog, SKUs are Cyrillic + Latin + digits + separators. `String.prototype.toLowerCase()` already performs full default Unicode case conversion for every alphabet these merchants will ever type. The 356-line table only changes behavior for inputs like `ß` or `ﬀ` inside a SKU — edge cases that do not exist. It is also a maintenance liability (hand-pinned to Unicode 17; the next Unicode version silently drifts).

**Action:** raise with the founder. Either (a) replace with `toLowerCase()` and record in the search contract that SKU compact uses simple fold (the compact key only needs to be deterministic, not linguistically perfect), or (b) keep full fold but generate the table from Unicode data at build time instead of curating literals, and document why. Do not let the table grow a second consumer before deciding.

---

## Finding 4 — `resolveApplicant`: four queries and an impossible-state throw for a first-login upsert (medium)

[`staff/persistence.ts`](../packages/kernel/src/staff/persistence.ts) `resolveApplicant` runs: find-by-auth-user → insert `onConflictDoNothing` → update-matching-email → find-by-auth-user again → find-by-email → `throw new Error("Applicant resolution did not produce a Staff record")`. It exists to link a Google first-login to a pre-added or pending Staff row, and to survive two concurrent logins of the same account.

One `INSERT … ON CONFLICT(normalized_email) DO UPDATE … RETURNING` (the pattern already used elsewhere in the same file) collapses the race handling into the unique constraint that already exists on `normalized_email`. The final throw guards a state the preceding statements make unreachable.

**Action:** rewrite as a single upsert with `RETURNING`; keep the `identity_conflict` outcome (email owned by a different auth user) as the only branch.

---

## Finding 5 — Defensive post-batch re-reads guarding impossible states (low–medium)

The catalog mutations in [`catalog/persistence.ts`](../packages/kernel/src/catalog/persistence.ts) and [`inventory-persistence.ts`](../packages/kernel/src/catalog/inventory-persistence.ts) follow a house pattern: pre-check in JS → atomic SQL batch with current-state predicates → verify the batch did what it said → re-read and classify on any mismatch. Parts of this are **earned**:

- Re-reading the idempotency record in a `catch` path covers the real D1 failure mode "error returned to client, commit status unknown" — that is spec-mandated retry idempotency and should stay.

Parts guard states the schema and predicates already make impossible:

- `update` re-reads the product and returns `infrastructure` if `product?.sku !== input.sku` — the acceptance predicate requires exactly that SKU in every committed branch, so the mismatch branch is unreachable.
- The `stateEffectsMatch` matrix verifies which side-effect statements ran based on the returned state, to detect a concurrent admin edit mid-batch — D1 batches are atomic; the only true risk is the pre-read being stale, which the predicates already neutralize by matching zero rows.
- `clearCleanupDebt` DELETE … RETURNING, then re-SELECTs "is it really gone" when the delete reports a mismatch.

None of these are wrong; they are the *same* edge case ("the database did not do what the SQL says") re-implemented in five places. That contradicts "confirm invalid internal states were eliminated at their source" — the source here is the predicate + CHECK constraint, which already landed.

**Action:** keep the idempotency re-read (real failure mode, documented above); delete branches that can only fire if SQLite violated its own guarantees. Where a re-read stays because D1 commit semantics genuinely demand it, record that once in the owning contract and stop re-deriving it per call site.

---

## Finding 6 — Write-only placeholder: `background:last-scheduled-at` (low)

[`kernel/src/background/index.ts`](../packages/kernel/src/background/index.ts) writes the scheduled tick to `EPHEMERAL_KV` from both the cron handler and the Workflow ([apps/urnuun-48/src/worker.ts](../apps/urnuun-48/src/worker.ts)). Nothing reads the key — not health, not doctor, not the CLI. As proof that the scheduled/Workflow seam is wired it has served its purpose; as running code it is dead evidence.

**Action:** leave it only if the doctor command (which per spec checks bindings and bounded KV operations) is next in line to consume it; otherwise delete until then. Not urgent.

---

## Finding 7 — The invariant triplication is deliberate but worth naming (low, accepted)

Most invariants exist three times: Valibot contract → operation-level JS pre-check → SQL predicate/CHECK constraint (e.g., publish requires price > 0 and non-empty SKU in `transitionProduct`, again in `transitionPredicate`, again as column CHECKs). This is the accepted house pattern (typed failures for the caller, predicates for atomicity, CHECKs as the source of truth) and I am **not** recommending changing it — but it is why every feature costs ~2× the lines a reader expects, and it should stay a conscious tradeoff rather than an accident.

---

## What is heavy but correctly aligned — do not strip these

- **Idempotency records with canonical request hashes** for catalog/inventory writes — spec §266: "One small D1 idempotency record… exactly-once business effects under repeated delivery." Earned.
- **`catalog_cache_purge_debts` + `committed_but_not_purged` + retry** — spec §310 CMS/caching explicitly mandates this exact closed failure outcome and Admin retry. Earned (the `attemptCount < 1000000` ceiling is ceremony, but harmless).
- **Raw `env.DB.prepare` batches instead of Drizzle for mutations** — the atomic current-state predicates (final-Owner protection, reservation-blocked adjustments) genuinely need them; Drizzle stays for plain reads. Earned by spec story 88.
- **Schema ahead of runtime** (Bundles, reservations, Telegram actor kinds in `audit_events`) — forward schema from accepted contracts, not speculative code. Fine.
- **Audit events on accepted *and rejected* consequential attempts** — spec stories 86/88. Earned.
- **Customer OTP design itself** — challenge table with single-active-challenge replacement, HMAC digests, attempt bounding, generic responses, origin checks. Matches spec stories 62–70 closely. (The `attempts = 4` vs `< 5` dance in `consumeChallenge` is subtle but correct and contained.)

## Also verified clean

- No OTP bypass: the customer Better Auth handler is not publicly mounted; only the four explicit routes exist, and `establish-customer-session` is reachable only in-process after a consumed challenge.
- `pnpm knip`: zero unused files/exports/dependencies.
- No HTTP self-calls, no Result over the wire, no raw rows crossing the browser boundary, no React, no new competing dependencies.

---

## Recommended order of action

1. **Delete the write-only OTP KV mirror** (Finding 2) — zero behavior change, ~20 lines.
2. **Decide Finding 1** (contract vs. implementation contradiction) and delete one session-authority mechanism, including the dead `provision` variant — the largest single simplification, and it removes a per-request D1 read forever.
3. **Collapse `resolveApplicant`** to one upsert (Finding 4).
4. **Raise the SKU case-fold question** (Finding 3) — contract decision, then shrink or justify.
5. **Prune impossible defensive branches** in catalog mutations, keeping the D1-commit-uncertainty re-reads (Finding 5).
6. Defer Finding 6 until doctor lands.

Estimated net effect: −700 to −900 lines, one less table, one less route, one less per-request D1 read — with zero change to any contract-guaranteed behavior.
