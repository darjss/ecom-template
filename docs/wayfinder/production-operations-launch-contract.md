# Production operations, measurement, recovery, and launch contract

**Decision status:** Founder approved for Wayfinder issue #27.

This contract is deliberately sized for independent Stores that usually handle 10–20 Orders per day, should remain comfortable around 50 Orders per day, and may have audiences around 50,000 followers. It protects money, inventory, Store isolation, and merchant trust without building a fleet operations product.

## Deliberate simplifications

- Every Production Store remains one independently deployed Worker with its own D1, KV namespaces, R2 bucket, secrets, domain, PostHog project, logs, and delivery journal.
- Cloudflare dashboards, Workers Logs and traces, D1 metrics and Time Travel, account Audit Logs, Notifications, and the existing per-Store delivery CLI are the operations system.
- The application adds structured logs, one shallow health route, one authenticated diagnostic command, an Admin attention view, and explicit runbooks. It does not add a metrics database, Tail Worker, Logpush pipeline, Analytics Engine dataset, SIEM, central status service, fleet dashboard, pager rotation, incident bot, or custom backup service.
- There is no 24/7 availability promise or formal SLO/error-budget process. The founder and merchant respond during their agreed operating hours, prioritizing uncertain money, overselling, unauthorized access, and inability to fulfill Orders.
- No automatic rollback, automatic D1 restore, automatic provider failover, or automatic cross-Store rollout is allowed. Humans choose one Store and one recovery action at a time.
- Production launch requires concrete browser/API/CLI evidence. Scores, screenshots, dashboards, checklists, and synthetic success never substitute for proving commercial state and provider behavior.

## Operating ownership

The merchant owns daily Order, Payment, inventory, and Fulfillment decisions in web Admin. Owner and Manager roles review financial exceptions. The founder owns deployment, Cloudflare resources, provider configuration assistance, recovery commands, and shared-kernel releases.

During each business day the merchant checks the Admin attention view before fulfilling Orders. The view is a D1 query over existing authoritative state, not a second queue. It shows only conditions requiring a decision, including:

- Payments awaiting manual confirmation or safe provider reconciliation;
- open Refund Obligations;
- Orders blocked from normal progression;
- Inventory Reservations past their expected deadline;
- failed or exhausted Workflow work that can be correlated to an unresolved business state.

Expected pending Orders are not incidents. There is no daily digest, ticket mirroring, or acknowledgement workflow. Telegram may notify the configured merchant roles, but Admin remains the complete operating surface.

## Cloudflare-native observability

### Worker logs and traces

Workers Logs and invocation traces are enabled for every Production Worker. At this scale launch begins with full head sampling. Sampling may be reduced only after measured traffic or cost justifies it; a release must not silently change the rate.

Application logs are structured JSON with a small stable vocabulary:

- severity, event name, outcome, route class, and UTC timestamp;
- Cloudflare Ray ID or generated correlation ID;
- deployed commit and migration head;
- canonical entity IDs when needed to investigate an Order, Payment, Workflow, or Audit Event;
- provider name, operation, normalized error kind, retry disposition, and safe upstream request identifier when available;
- duration for the small number of consequential commands and provider calls.

Logs never include names, email or delivery addresses, free-text notes, OTPs, cookies, authorization headers, tokens, QR payloads, bank details, full provider payloads, raw request bodies, or PostHog distinct IDs. Full normalized customer phone is the one explicit PII exception: restricted server-side Evlog events for Customer Auth, Checkout, Order, Payment, and deliberate support diagnosis may include it because it is the practical complaint lookup identifier. It is absent from generic request logs, browser logs, URLs, public errors, and PostHog. Expected validation and authorization rejections are not logged as infrastructure errors. Payment, inventory, and staff changes remain authoritative in D1 entries and Audit Events; logs are short-lived diagnostic evidence, not a ledger.

Use the Cloudflare dashboard and `wrangler tail` for investigation. D1's built-in metrics and query insights are used when query latency, rows read, rows written, or database size is suspicious. No operational data is copied into another platform merely for longer retention.

### Health and diagnostics

`GET /api/health` is `private, no-store` and performs only an application start check plus a bounded D1 read. It returns `200` with `ok`, commit, and migration head, or `503` with one non-sensitive failure kind. It does not call KV, R2, PostHog, Telegram, SMS, or a payment provider and does not disclose resource IDs or secrets.

`pnpm store:doctor -- --manifest <path> --target <name>` is an authenticated, redacted, non-destructive diagnostic command for one Deployment Target. It verifies:

1. canonical URL, TLS, Worker commit, and migration head;
2. expected binding identities and required secret names, never values;
3. D1 read/write through a disposable diagnostic row that is immediately removed;
4. KV write/read/delete under a reserved diagnostic key;
5. R2 put/head/get/delete under a reserved diagnostic key;
6. cache purge permission against a reserved canary tag;
7. configured provider credential validity through a harmless provider operation when one exists;
8. Telegram bot identity and, only with explicit operator confirmation, a message to the enrolled diagnostic chat;
9. SMS through the configured canary phone only when explicitly requested because it has cost and recipient impact.

A provider without a harmless credential or health operation is proven by its sandbox or merchant-authorized nominal end-to-end transaction during launch, not by inventing a fake health response. Doctor reports `blocked` when credentials, permissions, or provider facilities are unavailable.

### Actionable notifications

Configure only notifications that lead to a named runbook:

- Cloudflare Incident Alerts for the used Workers, D1, KV, R2, DNS, and SSL components;
- Universal SSL failure/expiry notifications for Production zones;
- usage-based billing notifications for Workers, D1 rows, KV, and R2 where the account plan exposes them;
- Cloudflare Health Check status notifications only when the Store's existing plan includes Health Checks; buying Load Balancing or an enterprise plan solely for monitoring is rejected.

Cloudflare's basic plans do not promise a configurable application-error pager. The contract does not hide that gap by building one. Merchant reports, the Admin attention view, provider/Workflow Telegram failures, deployment proof, and Workers Logs are sufficient at this scale. Add an external uptime service only after a real missed outage demonstrates the need.

## Audit access and retention

Owner and Manager can search the Store-local Audit Event timeline by date, actor, action, entity, and outcome and can follow links to the related Order, Payment, inventory, or Staff record. General and Fulfillment Staff see only the histories required by their existing operating screens, not the global Audit Event browser.

Audit Events, Financial Entries, Inventory Entries, Refunds, and Commercial Snapshots are retained for the operating lifetime of the Store. They are not duplicated into Cloudflare logs or PostHog. Export is an explicit founder-assisted CSV or JSON operation for one Store and bounded date range; it is not a scheduled archive pipeline. Cloudflare account Audit Logs remain the evidence for resource, credential, deployment, and D1 Time Travel administration.

## Measurement with PostHog

Every Production Store gets a separate always-enabled PostHog project and project token. Demo, canary, local, and Production data never share a project. PostHog is behavioral measurement only and never commercial truth.

The storefront uses manual capture with autocapture and user identification disabled. It does not create person profiles or send Customer, Staff, Order, Payment, phone, email, address, search free text, personalization, notes, or provider identifiers. Before-send filtering allowlists event names and properties and drops unknown properties.

The v1 event schema is intentionally small:

| Event | Allowed properties |
| --- | --- |
| `product_viewed` | Catalog Item kind, Category slug, has Variants |
| `search_completed` | result-count bucket, normalized match tier; never the query |
| `cart_changed` | add/remove/update, line-count bucket, Cart value bucket |
| `checkout_started` | line-count bucket, value bucket |
| `checkout_blocked` | stable non-sensitive reason code |
| `order_placed` | payment method, delivery kind, value bucket |
| `payment_outcome_observed` | provider kind and stable outcome; emitted from accepted server truth without entity IDs |

Names and property meanings are versioned in source. Rename or meaning changes require a new event/property rather than silently rewriting history. PostHog delivery is best-effort and cannot delay or roll back commerce.

Storefront session replay remains enabled but is privacy-first and bounded:

- sample 10% of anonymous public browsing sessions, with a project billing limit;
- mask all inputs and customer-controlled text in the browser before transmission;
- disable network request/response capture and redact URL query strings;
- stop recording before Checkout, authentication, Order tracking, and every Admin route;
- mark Cart surfaces that can contain Personalization or customer-entered text as no-capture;
- never call `identify` or attach D1 identities.

A Store may lower the sample or pause replay immediately if cost or privacy behavior is uncertain. It may not relax masking to make recordings more interesting. Authoritative revenue, Payment, Refund, and inventory reporting comes from D1 Admin reports, not PostHog funnels.

## Cost ceilings

Before activation, the founder records the Store's expected monthly Cloudflare and PostHog usage cost using current vendor pricing and sets the lowest practical account/project alerts above the expected range. A threshold is an investigation trigger, not an automatic shutdown.

For the first Production Store, review actual usage after 24 hours, 7 days, and the first billing month. Thereafter review monthly and after an audience spike. Investigate request growth, D1 rows read, R2 egress/operations, Workers CPU, Workflow retries, and replay ingestion using vendor dashboards. Raise a threshold only with a written reason. Commerce never stops automatically because an analytics or observability budget is exhausted; PostHog ingestion may stop at its billing limit.

No per-Store metering service or chargeback model is built. If several Stores share one Cloudflare account, the built-in per-Worker, per-database, and per-bucket views identify the source after an account alert.

## Abuse limits

Cloudflare's ordinary DDoS protection remains the volumetric boundary. The application uses one small KV-backed fixed-window limiter only where abuse has direct cost or enables guessing. Approximate KV counters are acceptable because they never decide money or inventory truth.

Starting limits are:

- SMS OTP send: 3 per normalized phone and 10 per IP in 15 minutes, plus 5 per phone per day;
- OTP verification: 5 attempts per challenge, then invalidate it;
- Staff credential attempts: 10 per IP and normalized login in 15 minutes;
- Guest Tracking Link failures: 30 invalid attempts per IP in 15 minutes;
- Checkout placement: 20 attempts per device/IP in 10 minutes.

Responses are generic and include `Retry-After`. There is no global Store request cap: one social post must not disable ordering for everyone, and carrier NAT must not turn a modest audience into false fraud.

Authenticated provider callbacks are bounded by body size, signature/credential verification, unique provider references, and current-state predicates. They are not put behind the customer limiter or a challenge that can prevent payment evidence from arriving. Cloudflare WAF rate-limit rules may reject obvious abuse when already included in the Store's plan, but application safety cannot depend on paid WAF features.

## Recovery contract

### What is recoverable

- **Application code:** redeploy the last recorded schema-compatible commit from the delivery journal.
- **D1:** use Cloudflare Time Travel, which is always on for supported production D1 databases. Delivery records a bookmark before every migration. A restore is founder-authorized, destructive, and never automatic.
- **KV:** session, cache, OTP, and short-lived action data is disposable. Loss means logout, cache refill, or re-enrollment; KV is not backed up.
- **R2:** deletion is irreversible in v1. Production credentials are least-privilege, bulk deletion is absent from the application, and Production cleanup is refused. Merchant source media must be retained outside the Store until launch acceptance; an individual loss is recovered by reviewed re-upload, not a custom replication service.
- **Providers:** external provider truth is not restored by D1 Time Travel. Every restore must reconcile the affected time window before ordering resumes.

### D1 restore runbook

1. Disable all payment methods in `commerce_settings` so new Checkout cannot place payable Orders; preserve cached browsing and Admin access where safe.
2. Record incident time, current commit, migration head, current Time Travel bookmark, and the earliest possibly affected Order/Payment time.
3. Inspect Cloudflare status, Workers Logs, D1 metrics, Audit Events, Financial Entries, Inventory Entries, and provider records. Prefer a forward fix or compatible code redeploy when data is still trustworthy.
4. If restore is required, choose and record the exact bookmark, obtain founder confirmation naming the Store, and run Time Travel restore for that Store only. Preserve the returned previous bookmark.
5. Deploy the schema-compatible commit, run doctor, health, ledger invariants, and the accepted Canary Scenarios that do not contact real customers.
6. Reconcile every provider event and merchant-observed transfer from the restored interval through ordinary commands. Never repair Payment or inventory truth with unaudited table edits.
7. Compare physical stock for affected Stock Items, resolve discrepancies through audited Inventory Entries, then re-enable only proven payment methods.
8. Record the outcome and evidence link in the Store's private operations notes.

A destructive restore drill runs on the fictional canary before the first paid Store launches, every six months while Production Stores operate, and before a migration judged capable of deleting or rewriting consequential data. The drill records a canary bookmark, creates a marked synthetic Order and inventory effect, restores, proves the marker's expected presence/absence, reconciles the synthetic state, and proves the canary again. Production data is never copied into the drill and a Production database is never restored merely to practice.

## Human runbooks

### Store or release unavailable

Check Cloudflare component status, health, Worker invocation outcomes, recent deployment evidence, and the failing Ray ID. If the new code is at fault and schema remains compatible, redeploy the recorded previous commit and rerun health plus the affected browser/API proof. Do not restore D1 for an application-only failure. Tell the merchant what is unavailable and whether existing Orders remain operable.

### Payment provider failure or uncertain money

Disable only the affected automated provider in `commerce_settings`; leave transfer or COD available only if the merchant already approved them. Keep the Order and Inventory Reservation in the accepted safe uncertainty state. Compare provider evidence, Financial Entries, callback logs, and Workflow state, then invoke the ordinary reconcile or staff-confirm command. Never infer payment from a timeout, retry Checkout, or force a state with SQL.

### Inventory mismatch or oversell risk

Disable all payment methods to pause new Orders. Finish no affected Fulfillment until the merchant counts the relevant physical Stock Items. Compare Order Line Inventory Demand, Reservations, and Inventory Entries. Correct only through an authorized, reasoned Inventory Entry and resolve affected customers individually. Do not rewrite balances or delete ledger rows.

### Suspected unauthorized access or Store-isolation breach

Pause new Orders, revoke affected Staff sessions, Telegram bindings, API tokens, and provider credentials, then rotate secrets for that Store only. Inspect Staff and financial Audit Events plus Cloudflare account Audit Logs. Verify no other Store resource ID or secret was used. Inform the affected merchant promptly with known facts and required action; do not wait for a formal incident document.

### R2 media loss

Stop the responsible publication or deletion path, identify affected keys from D1 Media records and Cloudflare logs, recover from the merchant-approved source, upload to new immutable keys, publish references, and purge cache tags. Missing media does not justify restoring D1.

Each runbook ends with a short private note containing Store, start/end time, impact, decisions, IDs/bookmarks, customer or merchant communication, and follow-up. There are no severity taxonomies, postmortem templates, incident queues, or fleet-wide status pages.

## Launch gates

### First Production activation for a Store

Activation is blocked until all of the following pass against the exact Production commit, bindings, domain, and migration head:

1. **Identity and isolation:** delivery journal matches Worker, D1, both KV namespaces, R2, routes, secrets, and PostHog project for this Store; another Store's credentials and IDs cannot access them.
2. **Merchant readiness:** Owner access, Manager recovery contact, physical stock opening balances, delivery/pickup settings, policies, domain, and enabled payment methods are explicitly approved.
3. **Provider proof:** doctor passes safe checks; each enabled payment method completes its real sandbox or merchant-authorized nominal journey through Order placement, evidence, duplicate-delivery handling, confirmation/rejection, Reservation consequence, and Refund recording where applicable. Missing provider facilities block that method, not the whole Store when another approved method is safe.
4. **Commerce proof:** the eight fictional Reference Store Canary Scenarios pass on canary, then Production browser/API proof covers Variant selection, live availability, Cart, stale price/stock rejection, anonymous Checkout, enabled Customer login, Guest Tracking, Admin Payment action, Fulfillment, cancellation, Refund Obligation, and concurrent stock contention without contacting a real customer.
5. **Cache and privacy:** the accepted cache response matrix and purge proof pass; no sensitive route is shared-cached; logs and PostHog payload inspection contain no prohibited data; replay stops before sensitive routes.
6. **Recovery:** pre-migration bookmark exists, the canary restore drill is current, previous compatible commit is recorded, Production cleanup refusal is proven, and the four money/inventory/access runbooks have named operators.
7. **Abuse and cost:** starting limits return correct generic responses and `Retry-After`; Cloudflare notifications and PostHog billing limit are active; expected cost and review dates are recorded.
8. **Accessibility:** representative Home, listing/search, Product, Cart, Checkout, tracking, login, and core Admin Order/Payment/Fulfillment flows have no unresolved WCAG 2.2 Level A or AA failure. Automated scans assist but do not decide conformance. A human verifies keyboard-only completion, visible focus, logical focus order, no traps, labels/instructions/errors, status announcements, contrast, target size, reflow at 320 CSS pixels, 200% zoom, reduced motion, and one screen-reader pass through purchase and fulfillment. Record tested pages, browsers, assistive technology, date, and findings; do not use a Lighthouse accessibility score as the gate.
9. **SEO:** Production alone is indexable; demo/canary hosts remain `noindex`. Canonical URLs, robots.txt, XML sitemap, titles/descriptions, status codes, internal links, social metadata, and initial-HTML JSON-LD match visible published facts. Rich Results validation has no blocking error for the intended markup. As required by the cache contract, Product markup omits stock-derived availability. Search Console ownership and sitemap submission are prepared, but indexing speed is not a launch promise.
10. **Performance:** from ULN or an equivalent Mongolia-like path, final-schema cold HTML is at most 1.5 s p75 and 2.0 s p95, warm HTML is below 50 ms p75 and 100 ms p95, and batched live availability is at most 350 ms p95. A mobile browser pass on key Storefront pages meets the Core Web Vitals “good” thresholds at p75 where a valid sample exists: LCP at most 2.5 s, INP at most 200 ms, and CLS at most 0.1. Before real field volume exists, record repeatable lab evidence rather than inventing a field percentile. There is no aggregate Lighthouse score gate.

A failed item remains red or explicitly blocked; it is never replaced with a stub, mock provider, or checklist assertion.

### Shared-kernel release

A shared commerce, schema, auth, cache, provider, or shared Admin change follows the accepted delivery contract:

1. clean source, pinned tools, typecheck, lint, and build;
2. migration compatibility and current canary Time Travel bookmark;
3. deploy the fictional canary;
4. run all eight Canary Scenarios plus affected browser/API/CLI, accessibility, cache, privacy, and performance proof;
5. inspect canary Worker logs, D1 state, Payment and inventory ledgers, and delivery journal;
6. choose one Production Store, apply it, rerun health and affected proof, then continue one Store at a time;
7. stop on the first unexplained failure or consequential regression.

There is no percentage rollout, fixed soak ceremony, release train, automatic promotion, or fleet convergence target. Observe only long enough to complete the real provider or Workflow behavior affected by the release. A Store-owned storefront-only change may deploy directly to that Store when it cannot affect shared commercial, identity, schema, cache, or provider behavior.

## Primary references

- [Cloudflare Workers observability](https://developers.cloudflare.com/workers/observability/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare account Audit Logs for D1](https://developers.cloudflare.com/d1/observability/audit-logs/)
- [Cloudflare Notifications](https://developers.cloudflare.com/notifications/notification-available/)
- [R2 object deletion](https://developers.cloudflare.com/r2/objects/delete-objects/)
- [PostHog replay privacy controls](https://posthog.com/docs/session-replay/privacy)
- [PostHog replay sampling and billing limits](https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record)
- [W3C WCAG 2.2 conformance](https://www.w3.org/WAI/WCAG22/Understanding/conformance)
- [W3C WCAG-EM overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
- [Web Vitals thresholds](https://web.dev/articles/vitals)
- [Google ecommerce URL guidance](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites)
- [Google ecommerce structured-data guidance](https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce)
