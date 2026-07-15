# Final scope and contract reconciliation

**Decision status:** Founder approved after all Wayfinder child tickets closed.

This document is the final normative amendment for `/to-spec`. It supersedes only the conflicting or overbuilt clauses named below. All other accepted Wayfinder decisions remain in force.

The system serves small independent Stores that usually handle 10–20 Orders per day, should remain comfortable around 50 Orders per day, and may have audiences around 50,000 followers. Prefer the smallest reliable implementation that protects money, inventory, Store isolation, and merchant trust.

## Telegram financial convenience

Telegram Confirm and Reject actions remain a defining Merchant Admin convenience. They do not reproduce web Staff identity, enrollment, role, or session machinery.

Each Store has a founder-maintained private deployment allowlist of Telegram operators. One entry contains an exact numeric Telegram user ID and a short audit label. Changing the allowlist is a founder-controlled configuration and deployment action; Merchant Admin cannot enroll operators or grant Telegram authority. An allowlisted operator is trusted for the Store's Telegram financial actions without a Staff-session or role lookup.

The minimum safety boundary remains:

- authenticate the webhook as Telegram traffic with the Store's webhook secret;
- accept financial callbacks only from an exact allowlisted Telegram user ID;
- use one opaque, bounded action reference created for that Payment message;
- make replay harmless through current-state predicates and scoped D1 idempotency;
- reload the Payment, Order, expected amount, and current state before mutation;
- invoke the same kernel Confirm or Reject command used by web Admin;
- record the configured Telegram operator label and user ID as consequential audit evidence.

One button tap executes the action. There is no Admin enrollment flow, one-time enrollment link, `telegram_bindings` table, Staff-role revalidation, or second confirmation tap. Telegram notifications and all financial actions remain available in web Admin.

This supersedes the enrollment, Staff-binding, role-revalidation, and second-tap clauses in the authentication and interface contracts. It does not weaken webhook authentication, input validation, idempotency, state revalidation, or audit evidence.

## Customer identity remains in v1

Keep the separate Customer Better Auth instance, SMS OTP login, rolling Customer sessions, optional Order history, verified Guest Order linking, anonymous-first Checkout, and private Guest Tracking Links. Customer Auth remains optional for ordinary Checkout. COD may require the accepted OTP proof.

The Customer and Staff authentication namespaces remain isolated. This feature is not deferred.

## Typed CMS documents

Commercial truth remains relational. Catalog Items, Variants, SKUs, prices, inventory, Orders, Payments, Discounts, Customers, Staff, Media Assets, and consequential evidence do not move into generic JSON storage.

Replace the normalized noncommercial CMS table family with one closed two-slot document table:

```text
cms_documents
  kind            closed CMS document kind
  status          draft | published
  schema_version  positive integer
  content_json    canonical validated JSON
  created_at
  updated_at
  published_at
  primary key (kind, status)
```

The closed document kinds are:

- `storefront_identity`
- `theme`
- `homepage`
- `navigation`
- `locations`
- `policies`
- `announcement`
- `ordering_notices`

This is not a generic Pages or extension-property system. Each kind has one named strict TypeScript type and one matching Valibot schema. Use a discriminated schema map keyed by the closed `kind`; reject unknown kinds, unknown schema versions, unknown fields, malformed TypeIDs, unsupported section variants, and invalid bounds on every write and read. No type assertion may substitute for parsing.

Homepage sections, navigation groups and items, social links, Locations, Policies, and Ordering Notices are bounded arrays inside their owning typed document. Theme tokens remain a versioned typed document. Media and Catalog references use canonical TypeIDs and are checked against relational rows when a Draft is saved and again when it is published. Publication rejects missing, archived, cross-kind, cyclic, or otherwise invalid references.

There is at most one Draft and one Published document per kind. Save Draft and Publish use last-write-wins at this operating scale; there are no general optimistic Revision columns, `If-Match` headers, retained CMS history, merge service, or server conflict workflow. Compatible browser-local drafts still restore automatically under the accepted form contract. Publishing validates and replaces the complete Published document, deletes the Draft, then performs the accepted synchronous cache purge.

This replaces the normalized `storefront_identities`, social-link, Theme, Homepage/section, Announcement, Ordering Notice/placement, navigation menu/group/item, Location, and Policy table family. It supersedes earlier CMS expected-Revision and explicit reconciliation clauses. Media Asset metadata and Catalog image relationships remain relational.

## One ephemeral KV namespace per Store

Each Store Deployment Target owns one KV namespace, not separate session and cache namespaces. The stable binding is `EPHEMERAL_KV`.

Logical prefixes isolate:

- Staff and Customer sessions;
- verification and OTP state;
- rate-limit counters;
- Demo Admin state;
- Telegram action references;
- other explicitly disposable short-lived state.

Cloudflare's CDN/Workers Cache owns public storefront caching. D1 owns commerce and durable application truth. KV does not cache Catalog/CMS HTML, stock, Orders, Payments, inventory, durable jobs, or idempotency records.

Provisioning, Wrangler templates, generated binding types, delivery journals, `store:doctor`, cleanup, and live proof create and verify one KV resource. This supersedes the `session KV` plus `cache KV` clauses in the provisioning and operations contracts.

## Proportional operations and launch proof

Keep Cloudflare-native logs, D1 metrics and Time Travel, account notifications, compact Admin attention states, the five human runbooks, a separate privacy-first PostHog project per Production Store, the seven-event allowlist, and masked sampled session replay. Session replay remains easy-to-operate product evidence and retains all accepted privacy boundaries: no network capture, no identification, masked input, redacted query strings, and no recording on Checkout, auth, tracking, or Admin.

Reduce ceremony as follows.

### Diagnostic command

`store:doctor` verifies only:

- canonical URL, TLS, deployed commit, and migration head;
- expected binding identities and required secret names without values;
- bounded D1 read/write;
- one `EPHEMERAL_KV` write/read/delete;
- bounded R2 put/head/get/delete;
- cache-purge permission against a reserved tag.

It does not probe payment providers, send Telegram messages, or send SMS. Those integrations are proven through real sandbox or merchant-authorized launch journeys.

### Canary and Production proof

A consequential shared-kernel release runs the complete eight-scenario Reference Store canary suite once for that commit. Applying the same proven commit to a Production Store requires only Store-specific proof of deployment identity, bindings, migration head, canonical host, cache/privacy boundary, enabled provider journey, and one representative storefront-to-Admin Order path. Do not repeat the complete synthetic canary suite independently for every Production Store.

Store-owned storefront changes rerun only the affected Storefront, accessibility, SEO, cache, and performance proof. They do not rerun unrelated payment, inventory, auth, or recovery scenarios.

### Accessibility

The shared kernel and Merchant Admin receive the full WCAG 2.2 AA browser, keyboard, zoom, reflow, reduced-motion, and representative screen-reader proof on canary for consequential shared releases. Each Store activation proves its custom Home, listing/search, Product, Cart, and Checkout composition plus Theme contrast and one representative purchase path. It does not repeat every unchanged shared Admin flow.

### Recovery drills

Run the destructive D1 Time Travel restore drill on the fictional canary before the first Production Store launches and before a migration intended to delete or rewrite consequential data. Remove the fixed six-month drill ceremony. A real recovery defect or materially changed restore procedure may justify another drill.

All other accepted recovery rules remain: Production restores are human-authorized, Store-local, provider-reconciled, and never automatic.

## Later-ticket precedence corrections

The following final decisions resolve stale clauses in earlier artifacts:

- V1 Staff roles are exactly `owner`, `manager`, and `staff`; there is no Fulfillment Staff role.
- COD placement performs its accepted immediate inventory effect and creates an Awaiting Confirmation cash Payment. There is no `AcceptCodOrder` command or route. Authorized cash collection uses the ordinary Payment confirmation command.
- Live availability uses `GET /api/catalog/availability?variantIds=...`, is batched, and is `private, no-store`.
- Ordinary Catalog, settings, and typed CMS Draft writes are last-write-wins. General aggregate Revision columns and expected-Revision HTTP contracts are absent. Consequential state transitions retain atomic current-state predicates and idempotency where retries occur.
- Cloudflare Workflow may coordinate payment expiry, provider inspection, notifications, and repair, but D1 remains the only commerce truth. The accepted schema has no generic job table, outbox, notification-delivery table, or Failed Notifications subsystem.
- A committed commerce mutation followed by failed Workflow creation returns an explicit retryable partial outcome when the request observes the failure. Retrying the original idempotent command may start missing work. A bounded scheduled reconciliation pass detects overdue authoritative Payment, Reservation, and unresolved business state and idempotently starts or repairs required Workflow work.
- Notification failure never changes commerce state. Workflow retries and Cloudflare Workflow visibility are sufficient in v1; Admin attention is driven only by unresolved authoritative business state, not by a duplicate notification queue.

## Decisions explicitly retained

The following reviewed scope remains intentional rather than accidental complexity:

- Telegram financial Confirm and Reject actions under the simplified founder allowlist;
- separate Staff and Customer authentication namespaces;
- both Byl and direct QPay adapters, with exactly one manually configured per Store;
- privacy-masked sampled PostHog session replay;
- one independently deployed Worker, D1, KV, R2, secrets, and custom Store app per Store;
- relational money, inventory, Payment, Order, SKU, Discount, identity, and evidence models;
- anonymous-first Checkout, Guest Tracking Links, atomic inventory safety, idempotent external commands, and checkout revalidation;
- one fictional Reference Store canary, resumable provisioning, and one-Store-at-a-time human delivery.

## `/to-spec` handoff rule

The specification must apply this reconciliation before copying any earlier contract. When an earlier artifact conflicts with this document, this document wins. The specification should describe one coherent current contract and omit superseded alternatives rather than preserving historical contradictions.