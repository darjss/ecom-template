# PROTOTYPE — prospect-to-demo workflow

This throwaway logic prototype asks whether one resumable, time-bounded workflow can produce a Rozie Store private demo package while keeping every consequential choice human-owned. It models the operating contract, not browser scraping, deployment, Telegram, video, or outreach delivery.

Run it with:

```sh
pnpm prototype:prospect-workflow
```

Drive the happy path with `n` for an agent step and `a` for a review. Try `f`/`r` around a step, `x` at a review, `p` after deployment, and `m sent` before and after all reviews.

## Recommended operating contract

The agent skills are orchestration interfaces over checked-in tooling, not stores of prospect data:

| Skill | Input | Writes under `.private/prospects/<slug>/` | Stops at |
| --- | --- | --- | --- |
| `/prospect-research <slug> <public-profile-url>` | Approved prospect and public URL | `sources.jsonl`, `screenshots/`, `catalog.draft.json`, `brand-brief.md`, journal | Catalog and brand reviews |
| `/prospect-generate <slug>` | Approved catalog and brand brief | `store-profile.json`, `seed.json`, generated app patch, journal | Storefront review |
| `/prospect-demo <slug>` | Approved generated app and expiry | `demo.json`, credentials reference, proof log, journal | Demo-order and Telegram review |
| `/prospect-package <slug>` | Approved demo | `walkthrough.mp4`, `outreach.md`, journal | Video, recipient, and DM-copy reviews |
| `/prospect-record <slug> <status>` | Human-reported event | Tracker row and journal | Never sends a message |
| `/prospect-expire <slug>` | Active demo | Revocation/deletion proof and tracker row | Human-visible cleanup result |

`/prospect-research` invokes `agent-browser` only. It opens the approved profile URL, captures at most the latest 8–12 product references, and records only visible title, description, price, size/color options, media URL, post URL, capture time, and screenshot path. Ambiguous values stay `null` with a reason. It never bypasses login/access controls or infers availability, claims, variants, or prices.

A real `agent-browser` probe of `https://www.instagram.com/roziestore/` on 2026-07-11 resolved the public profile title but exposed only Instagram's login/sign-up wall, not product posts. The accepted failure path must therefore stop collection and ask the founder for an approved accessible source or merchant-supplied export; it must not bypass the wall or claim that catalog evidence was captured.

## Private artifact contract

Everything identifying a prospect or containing outreach state stays below the already-ignored `.private/` root:

```text
.private/
├── prospects.md
├── demo-manifest.json
└── prospects/rozie-store/
    ├── prospect.json
    ├── sources.jsonl
    ├── screenshots/
    ├── catalog.draft.json
    ├── brand-brief.md
    ├── approvals.jsonl
    ├── store-profile.json
    ├── seed.json
    ├── demo.json
    ├── walkthrough.mp4
    ├── outreach.md
    └── journal.jsonl
```

Source rows contain `sourceId`, `profileUrl`, `postUrl`, `capturedAt`, `screenshotPath`, visible fields, and `ambiguities`. Catalog items contain a stable local key, source IDs, title, MNT price or `null`, option groups, image candidates, and an approval state. An approval row contains `gate`, artifact SHA-256, reviewer, decision, timestamp, and optional revision request. Journal rows contain sequence, operation, input digest, result, elapsed seconds, and resumable output paths. No cookies, browser profiles, tokens, customer data, or message history enter these files.

`prospects.md` has one row per prospect: slug, display name, status, owner, last action, next action, follow-up date, demo expiry, and private artifact link. Allowed statuses are `candidate`, `researched`, `demo-ready`, `reviewed`, `sent`, `replied`, `call`, `deposit`, `won`, `rejected`, `follow-up`, and `expired`.

## Reviews and invalidation

Seven approvals bind to exact artifact hashes: catalog, brand interpretation, storefront, synthetic demo order plus Telegram behavior, video, recipient, and final Mongolian DM copy. A changed artifact invalidates its approval and every downstream generated artifact. The agent may suggest a recommendation at each gate but cannot approve it.

`researched` means catalog and brand evidence are approved. `demo-ready` means an isolated deployment exists but is not sendable. `reviewed` means all seven gates passed. Only the founder manually sends; `/prospect-record rozie-store sent` records that external act. Reply/call/deposit/won/rejected/follow-up are human-reported tracker events. Expiry revokes the demo and removes it from Telegram routing.

## Demo and Telegram boundaries

The generated merchant app owns its custom Astro storefront, Store Profile, seed, and deployment identity. It imports the shared kernel; no commerce code is copied. The demo is noindex, absent from sitemaps, expires 10 days after sending, uses fictional prefilled customer and bank data, accepts no real payments, and warns against entering personal information.

`.private/demo-manifest.json` is the repository-local source for active demo routing. Each entry has `prospectSlug`, `deploymentId`, `environment: "prospect-demo"`, expiry, Worker URL, and enabled flag. The GramIO gateway build emits an allowlist only from enabled, unexpired `prospect-demo` entries. Production Store entries are rejected even if malformed input marks them enabled.

Telegram buttons carry a signed opaque, expiring, single-use action reference. The gateway verifies signature and webhook secret, consumes the reference, resolves it through the active-demo allowlist, and calls the demo's audited synthetic command. References contain no order, merchant, or customer fields. The shared bot never routes to a Production Store.

## Time and resume policy

Budget active agent time at 75 minutes per prospect: 12 capture, 5 brand interpretation, 15 generation, 12 deploy/proof, 10 video, 6 outreach, and roughly 7 minutes of review handling. Human waiting time is excluded. At 75 minutes the agent reports the overage and recommends reducing catalog or stopping. At 90 minutes it hard-stops until the founder explicitly re-scopes or abandons the prospect.

Every operation journals its input digest and outputs after each successful step. Resume skips outputs whose digest and proof still match. Changed approved inputs invalidate downstream outputs; failures retain partial resources and restart at the first incomplete operation. There is no destructive automatic rollback. Expiry and explicit cleanup are idempotent, journaled operations.

## Handoff to `/to-spec`

If accepted, `/to-spec` should encode these skill interfaces, schemas, state meanings, approval hashes/invalidation, the 75/90-minute policy, resume journal, app/shared-kernel boundary, noindex synthetic demo rules, and GramIO allowlist/action-reference invariants. This prototype itself must remain on its throwaway branch and must not be merged.
