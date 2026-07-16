# Reusable Mongolian ecommerce system

**Status:** Founder-approved implementation specification. This artifact mirrors [issue #33](https://github.com/darjss/ecom-template/issues/33); update both together.

## Problem Statement

Small independent Mongolian merchants need fast, trustworthy ecommerce without buying a generic SaaS storefront, operating enterprise infrastructure, or commissioning a separate commerce system for every shop. Their shoppers are mobile-first, expect Mongolian language and MNT pricing, and need familiar catalog, search, Cart, Checkout, payment, delivery, and Order-tracking behavior. Merchants need one dependable Admin and practical Telegram conveniences while retaining a storefront that feels designed for their own brand.

PR #34 merged the approved bootstrap at `f748ab739274ed57e57e115c081a3c68bc249733` and closed #31. The superseded SaaS starter is gone; the nine-package workspace and production-shaped runtime seams are now the baseline. The remaining problem is to extend that baseline into the complete commerce system, remote Reference Store canary, and direct Store delivery workflow without rebuilding landed foundations or pretending intentionally unavailable boundaries are already implemented.

The target is intentionally modest: an independent Store usually handles 10–20 Orders per day, should remain comfortable around 50 Orders per day, and may serve an audience around 50,000 followers. The product must protect Store isolation, authorization, validation, atomic money and inventory truth, retry idempotency, recoverability, and compact evidence without introducing a control plane, distributed coordination, or enterprise ceremony.

## Solution

Extend the merged pnpm workspace rather than recreate it. The landed Өрнүүн 48 app and nine shared packages already establish Store composition, Astro/Solid/Elysia/Eden runtime wiring, direct Cloudflare bindings, D1 migrations, Staff gating, persisted Cart state, cache classification, local delivery shells, and repository gates. This specification adds domain behavior through those seams.

Each eventual Store still owns one Astro/Cloudflare Worker, D1 database, one `EPHEMERAL_KV` namespace, R2 bucket, secrets, domain, logs, analytics project, and delivery journal. Shared packages own contracts, commerce behavior, APIs, browser state, Admin, default Storefront behavior, accessible UI, integrations, and delivery tooling. A Store app stays a small composition root for deployment identity, Store Profile, static provider choice, assets, seed input, and route-level Storefront presentation.

Use Astro SSR for complete public presentation, Solid islands for commerce interaction, Elysia/Eden for the typed browser API, D1 for durable commerce truth, Cloudflare Workflows for durable external coordination, and Cloudflare CDN caching for anonymous stock-free Storefront HTML. Live availability is fetched separately and Checkout always recalculates current truth. Better Result remains internal to kernel and integration operations; HTTP exposes meaningful statuses and validated route-specific envelopes.

Provide anonymous-first Checkout, optional Customer SMS OTP and Order history, private Guest Tracking Links, deterministic search, atomic Variant and Bundle inventory, QPay through either Byl or direct QPay, bank transfer, COD, audited Payment and Fulfillment operations, a small typed CMS, media delivery, custom-built Store presentations, and a shared Merchant Admin. Telegram provides founder-allowlisted one-tap transfer confirmation and rejection without becoming Staff identity or financial truth.

Private prospect demos and outreach are intentionally separated into #36, which is blocked by this specification.

## User Stories

### Shopper discovery and Storefront

1. As a Mongolian shopper, I want the Storefront in Mongolian with integer-MNT prices, so that the Store feels local and understandable.
2. As a mobile shopper, I want the Storefront to load quickly on Mongolia-like networks, so that I can browse without waiting for application JavaScript.
3. As a shopper, I want each merchant Storefront to have distinctive art direction, so that it feels like the merchant rather than a generic template.
4. As a shopper, I want products, prices, navigation, search, and purchasing controls to remain familiar, so that visual identity never obstructs buying.
5. As a shopper, I want to browse active Categories and Collections, so that I can discover relevant Products and Bundles.
6. As a shopper, I want archived or Draft Catalog Items excluded from public pages, so that I only see purchasable or intentionally visible merchandise.
7. As a shopper, I want Product pages to present Variant options clearly, so that I can choose only combinations the merchant actually sells.
8. As a shopper, I want a Product without visible options to behave like a normal Product, so that its required Default Variant remains an internal detail.
9. As a shopper, I want Bundle pages to explain their fixed contents and one Bundle price, so that I understand the offer without seeing component inventory mechanics.
10. As a shopper, I want contextual images and useful alt text, so that product media remains understandable and accessible.
11. As a shopper, I want public Locations, policies, navigation, notices, and trust content to be current, so that I can make an informed purchase.
12. As a shopper, I want canonical URLs and predictable browser navigation, so that pages can be shared, refreshed, and revisited safely.
13. As a shopper, I want route transitions and Cart feedback to feel polished without delaying input, so that the Store feels responsive.
14. As a shopper who prefers reduced motion, I want spatial movement removed while state feedback remains clear, so that the Store remains comfortable to use.
15. As a keyboard or assistive-technology user, I want WCAG 2.2 AA behavior, visible focus, valid labels, announcements, reflow, and contrast, so that I can complete the same purchase journey.

### Search and availability

16. As a shopper, I want search to expand from the Store header, so that finding products is immediate and conventional.
17. As a shopper, I want native Mongolian Cyrillic search, so that I can search using the catalog’s language.
18. As a shopper, I want deterministic Latin transliteration recovery, so that I can find Mongolian products when typing Latin characters.
19. As a shopper, I want low-confidence transliteration ambiguity shown honestly, so that the system does not silently select the wrong Product.
20. As a shopper, I want exact SKU lookup to tolerate hyphens, slashes, whitespace, and case differences, so that printed SKU references remain useful.
21. As a shopper, I want Variant SKU matches to open their Product and Bundle SKU matches to open their Bundle, so that search results use the right customer-facing identity.
22. As a shopper, I want Product and Bundle results ranked before bounded Category and Collection shortcuts, so that merchandise remains primary.
23. As a shopper, I want search filters and numbered pages reflected in the URL, so that results survive refresh, sharing, and browser history.
24. As a shopper, I want autocomplete requests cancelled when I keep typing, so that stale results do not replace current intent.
25. As a shopper, I want published Catalog Items to remain visible even when unavailable, so that I can understand the catalog without being promised stock.
26. As a shopper, I want purchasing disabled until fresh Variant or Bundle availability is known, so that cached presentation does not pretend to be inventory truth.
27. As a shopper, I want stale or failed availability checks to fail closed, so that I cannot submit a purchase from uncertain UI state.
28. As a shopper, I want Variant changes to refresh current price and availability, so that the selected purchase state is accurate.
29. As a shopper, I want search and availability responses to remain private and uncached, so that live sellability does not become stale shared data.

### Cart, quote, and Checkout

30. As a shopper, I want my Cart retained on my device, so that I can continue shopping without creating a server account.
31. As a shopper, I want stale Cart labels and prices treated only as intent, so that the server remains authoritative.
32. As a shopper, I want quantities and Personalization validated before placement, so that invalid Order Lines cannot enter commerce truth.
33. As a shopper, I want text, single-select, and checkbox Personalization where configured, so that I can provide bounded non-commercial choices.
34. As a shopper, I want a current server quote before placement, so that I can review Products, Discounts, delivery fee, and total.
35. As a shopper, I want Checkout to reject every commercial change, even a cheaper one, with current corrective facts, so that I explicitly accept what is being ordered.
36. As a shopper, I want harmless copy or image changes not to block placement, so that non-commercial edits do not create unnecessary friction.
37. As a shopper, I want anonymous Checkout for automated payment and bank transfer, so that creating a Customer identity is optional.
38. As a shopper, I want COD offered only when enabled and after OTP verification, so that the merchant can control COD risk.
39. As a shopper, I want Delivery or Pickup quoted from current Store settings and active Locations, so that the fee and destination are clear.
40. As a shopper, I want free Delivery applied from the configured post-Discount merchandise threshold, so that the total is deterministic.
41. As a shopper, I want submitted Discount codes validated by the server, so that the Cart cannot invent eligibility or value.
42. As a shopper, I want the best eligible automatic Discount when I do not submit a valid code, so that the available automatic benefit is applied consistently.
43. As a shopper, I want one deliberate submit to create at most one Order across retries, so that a network problem cannot duplicate my purchase.
44. As a shopper, I want the same idempotency key with changed intent rejected, so that accidental key reuse cannot return an unrelated Order.
45. As a shopper, I want complete Bundle component demand checked atomically, so that a Bundle is never partially promised.
46. As a shopper, I want concurrent final-stock attempts to allow only one complete winner, so that inventory never becomes negative.
47. As a shopper, I want successful placement to preserve immutable product, option, Personalization, price, Discount, delivery, and contact facts, so that later edits do not rewrite my Order.

### Payment and tracking

48. As a shopper, I want an enabled automated payment option to present the provider’s QR, redirect, or approval action, so that I can pay the exact Order amount.
49. As a shopper, I want an unconfirmed automated attempt to be switchable to full-amount bank transfer, so that a failed payment app flow does not require a duplicate Order.
50. As a shopper, I want switching payment methods to preserve the Order and reservation while leaving only one collectible attempt, so that I cannot be charged twice.
51. As a shopper, I want automated payment confirmation to require authenticated exact Store, Order, currency, amount, and provider evidence, so that mismatched evidence cannot complete my Order.
52. As a shopper, I want uncertain provider status to retain the reservation rather than cancel prematurely, so that a real payment is not separated from its goods.
53. As a shopper, I want an automated attempt closed before its deadline releases inventory, so that late collection cannot occur after stock is returned.
54. As a shopper, I want late or contradictory provider success quarantined for reconciliation, so that it never silently resurrects an expired Order.
55. As a bank-transfer shopper, I want my Payment to wait for authorized confirmation or rejection without an automatic deadline, so that the merchant can inspect the transfer.
56. As a COD shopper, I want placement to consume inventory immediately while cash remains Awaiting Confirmation, so that fulfillment can start without an extra acceptance command.
57. As a guest shopper, I want one private read-only tracking capability for my Order, so that I can see progress without creating a Customer identity.
58. As a guest shopper, I want the tracking capability hidden from referrers, third parties, logs, and shared caches, so that possession remains narrow authority.
59. As a guest shopper, I want tracking to expire 30 days after terminal Order state, so that the capability does not remain open indefinitely.
60. As an authenticated Customer, I want Store-local Order history, so that I can revisit Orders placed under my verified phone.
61. As a newly verified Customer, I want eligible prior Guest Orders with the exact verified phone linked idempotently, so that my history becomes useful without rewriting recipient snapshots.

### Customer authentication

62. As a shopper, I want Customer Auth to remain separate from Staff Auth, so that Customer credentials can never enter Merchant Admin.
63. As a shopper, I want a four-digit OTP that expires after five minutes and one successful use, so that phone verification is bounded.
64. As a shopper, I want a replacement OTP to invalidate the previous code, so that multiple live challenges cannot conflict.
65. As a shopper, I want at most five verification attempts per challenge, so that guessing is constrained.
66. As a shopper, I want a 30-second resend cooldown, at most five sends per phone per day, and at most ten sends per IP per 15 minutes, so that SMS abuse is limited.
67. As a shopper, I want generic OTP responses, so that Customer existence is not disclosed.
68. As a shopper, I want a rolling 30-day Customer session and logout, so that optional history is convenient without permanent access.
69. As a shopper, I want anonymous Checkout to continue during an SMS gateway outage, so that optional identity does not block ordinary commerce.
70. As a Customer, I want identity isolated to this Store even when another Store has the same phone, so that merchants never share Customer records.

### Merchant operations

71. As a Staff Member, I want one shared responsive Merchant Admin, so that normal Store work is consistent across merchants.
72. As a Staff Member, I want Catalog Items, Categories, Collections, Tags, images, Variants, Bundles, and Personalization managed through bounded forms, so that invalid catalog states are prevented.
73. As a Staff Member, I want Product and Bundle publication to enforce SKU, price, Variant, component, and reference invariants, so that only coherent merchandise becomes public.
74. As a Staff Member, I want archived Catalog entities reactivated only under their original identity and SKU, so that historical references remain trustworthy.
75. As a Staff Member, I want inventory changed only through reasoned Inventory Entries, so that current balances reconcile to an immutable ledger.
76. As a Staff Member, I want adjustments that would put on-hand below active reservations rejected with the blockers, so that stock is never corrected by invalidating promises silently.
77. As a Staff Member, I want Discount Rules configured as bounded automatic or code-based percentage or fixed-MNT policies, so that promotions remain explainable.
78. As a Staff Member, I want Orders filtered and opened with complete Commercial Snapshots, Payment, reservation, and Fulfillment state, so that I can act from authoritative facts.
79. As a Staff Member, I want fulfillment started, readied, handed off or picked up, completed, failed, and returned through mode-valid transitions, so that operational progress cannot skip invariants.
80. As a Staff Member, I want whole-Order Cancellation before the accepted boundary, so that inventory and Discount effects are compensated atomically.
81. As a Staff Member, I want returned Delivery to permit the narrow post-handoff Cancellation path only after physical return, so that stock is never restored at Delivery Failed.
82. As a Manager, I want to confirm or reject transfer and COD cash Payments, so that financial truth requires authorized human evidence.
83. As a Manager, I want to record partial or full manual Refunds with reason and reference, so that returned money is preserved without pretending provider execution is automated.
84. As a Manager, I want paid Cancellation to create a Refund Obligation, so that confirmed money cannot disappear from operational attention.
85. As a Staff Member, I want an attention view derived from unresolved authoritative business state, so that I can prioritize real decisions without a duplicate task queue.
86. As an Owner or Manager, I want searchable consequential Audit Events and links to financial and inventory ledgers, so that actions can be explained compactly.
87. As a Staff Member, I want ordinary writes to use simple last-write-wins behavior, so that small-Store operations do not carry unnecessary revision workflows.
88. As a Staff Member, I want consequential transitions protected by atomic current-state predicates and idempotency, so that simplicity does not weaken money or inventory safety.

### Staff authority and Telegram

89. As a Store founder, I want the first Owner created only through an authenticated provisioning command, so that no public first-login bootstrap can seize a Store.
90. As a Google-authenticated applicant, I want an awaiting-approval result rather than an Admin session, so that verified email alone never grants authority.
91. As an Owner, I want to approve, role-change, revoke, or remove Staff Members, so that Store authority remains explicit.
92. As an Owner, I want the final active Owner protected from demotion, revocation, or deletion, so that the Store cannot lose all administrative authority accidentally.
93. As an Owner, I want role changes and revocation to delete all affected Staff sessions, so that old role snapshots cannot retain access.
94. As an Owner, I want exactly Owner, Manager, and Staff roles, so that authorization remains understandable.
95. As a Manager, I want every normal Store operation except Staff/auth authority, so that daily management does not require Owner access.
96. As a Staff Member, I want Catalog, CMS, inventory, Discount, Order, and non-financial Fulfillment authority without financial or identity authority, so that least privilege matches daily work.
97. As a founder-approved Telegram operator, I want one-tap transfer confirmation or rejection, so that urgent financial actions remain convenient.
98. As a Store founder, I want Telegram operators configured by exact numeric ID and short audit label in deployment configuration, so that Merchant Admin cannot grant Telegram authority.
99. As a merchant, I want Telegram actions to authenticate the webhook, consume one bounded opaque action reference, re-read current Payment facts, and invoke the same kernel command as Admin, so that Telegram is never alternate financial truth.
100.  As an auditor, I want the Telegram operator label and numeric ID recorded as consequential financial evidence without a Staff foreign key, so that the action remains attributable under its real authority model.
101.  As a merchant, I want every Telegram capability available in web Admin, so that chat delivery failure never blocks Store operations.

### CMS, custom presentation, and media

102. As a merchant, I want editable Store identity, fixed Homepage content, navigation, Locations, policies, Announcement, and Ordering Notices, so that ordinary public content changes do not require deployment.
103. As a merchant, I want exactly one Draft and one Published typed document per closed CMS kind, so that content remains simple and recoverable.
104. As a merchant, I want strict schema-version and unknown-field validation on every CMS read and write, so that malformed JSON cannot become trusted content.
105. As a merchant, I want complete-document Draft save and publication, so that Homepage content and navigation remain coherent.
106. As a merchant, I want publication to validate relational Media and Catalog references and reject missing, archived, cyclic, or invalid references, so that public pages cannot contain broken identities.
107. As a merchant, I want publication to replace the Published document, delete the Draft, and synchronously purge relevant cache tags, so that public content changes predictably.
108. As a merchant, I want an explicit partial outcome when publication commits but cache purging fails, so that committed truth is not misreported as rolled back.
109. As a merchant, I want compatible browser-local form drafts restored automatically, so that ordinary interruption does not discard work.
110. As a merchant, I want a private no-store preview using the actual custom Storefront renderer, so that content changes can be reviewed in context.
111. As a merchant, I want each Store's Theme, approved fonts, layout, and art direction owned by reviewed build-time source and DESIGN.md rather than a generic Admin theme studio, so that bespoke presentation stays intentional.
112. As a developer, I want custom Store presentations to compose shared headless Search, availability, Variant, Cart, Checkout, payment, and tracking primitives, so that styling can vary without forking behavior.
113. As a merchant, I want images uploaded as immutable JPEG, PNG, or WebP objects and resized on demand, so that media delivery is simple without a derivative pipeline.
114. As a merchant, I want contextual alt text owned by each usage rather than the reusable file, so that the same Media Asset can be described correctly in context.
115. As a merchant, I want automatic canonical metadata, sitemaps, social metadata, and safe structured data from Published facts, so that basic SEO requires no expert panel.

### Delivery, canary, and operations

116. As a developer, I want shared headless commerce behavior separated from Store presentation, so that merchant-specific design can style and compose Search, Cart, Checkout, payment, and tracking without forking pricing, inventory, state, or authorization.
117. As a developer, I want fixed package ownership and mechanically enforced dependency direction, so that agents cannot create hidden coupling or duplicate protected behavior.
118. As a developer, I want one direct in-process Storefront read seam on cache misses, so that Astro SSR does not call its own HTTP API.
119. As a developer, I want one complete Elysia application as the Eden type source, so that browser transport contracts remain producer-derived.
120. As a developer, I want Store identity captured by deployment composition and bound resources rather than request data, so that cross-Store selection is impossible inside one Worker.
121. As a developer, I want every external and persisted value parsed before trust, so that TypeScript assertions never substitute for runtime contracts.
122. As a delivery operator, I want one manifest-driven apply command for one named Deployment Target, so that provisioning remains deterministic and reviewable.
123. As a delivery operator, I want successful external steps journaled before continuing, so that an interrupted apply resumes at the first incomplete or invalid step.
124. As a delivery operator, I want partial resources retained on failure and cleanup kept explicit, so that automatic rollback cannot destroy useful evidence or data.
125. As a delivery operator, I want manifests to contain no secrets and apply to pause with exact missing secret names, so that credentials never enter repository state or journals.
126. As a delivery operator, I want one forward-only migration stream, pre-migration Time Travel bookmarks, and expand/contract evolution, so that schema changes remain recoverable.
127. As a delivery operator, I want Production cleanup refused by the ordinary cleanup command, so that a non-Production convenience cannot delete a real Store.
128. As a delivery operator, I want Store doctor to verify identity, bindings, bounded D1/KV/R2 operations, and cache purge permission without contacting customers or providers, so that diagnostics are safe.
129. As a founder, I want Өрнүүн 48 to be the only committed fictional canary, so that real merchant identity never becomes shared fixture data.
130. As a founder, I want the eight canonical Canary Scenarios to exercise normal commands and APIs, so that canary proof uses the same implementation as Production.
131. As a founder, I want a consequential shared release proved completely once on canary and then applied to chosen Production Stores one at a time, so that rollout is safe without fleet machinery.
132. As a merchant, I want Worker logs, D1 metrics, Time Travel, Cloudflare notifications, compact runbooks, and actionable Admin state, so that the Store can be operated without a custom observability platform.
133. As a merchant, I want a separate privacy-first PostHog project with a seven-event allowlist and masked sampled replay, so that product behavior can be learned without sending commercial truth or direct PII.
134. As a customer, I want Checkout, auth, tracking, and Admin excluded from replay and network capture, so that sensitive interactions are not recorded.
135. As a founder, I want destructive restore drills on the fictional canary before first Production launch and before destructive migrations, so that recovery is proven proportionally.

## Implementation Decisions

### Product scope and invariants

- V1 is Mongolian and MNT only. Money is non-negative integer MNT; quantities are bounded integers. There is no multi-currency, fractional quantity, dynamic tax, split tender, line cancellation, exchange, general return workflow, or automated refund execution.
- One Store is one independently deployed application and resource set. No Store table, tenancy column, Store request header, Store route parameter, host-based Store lookup, cross-Store identity, shared merchant database, or central commerce runtime exists.
- The shared kernel is the only owner of price, Discount, inventory, Checkout, Order, Payment, Refund, and Fulfillment truth. Store apps replace presentation, not commerce behavior.
- Products always contain at least one Variant. Products without customer-selectable options use one Default Variant. Variant and Bundle SKUs are unique in one permanent Store namespace and cannot be reassigned after publication or archival.
- Bundles are separate Catalog Items with one SKU and price, fixed Variant components, and no independent inventory. Bundle demand expands into component Variant quantities; nested Bundles are excluded.
- Personalization is bounded text, single-select, or checkbox data. It never changes SKU, price, quantity, or Inventory Demand.
- Categories are acyclic navigation taxonomy, Collections are ordered manual merchandising groups, and Tags are flat labels. Dynamic Collection rules are excluded.
- Catalog Item, Variant, grouping, Discount, Order, Payment, reservation, and Fulfillment transitions follow the accepted closed state models. Reactivation preserves original identities; consequential transitions use atomic current-state predicates.
- Ordinary Catalog, settings, and CMS writes are last-write-wins. General Revision columns, expected-Revision contracts, `If-Match`, retained CMS history, and server merge workflows are absent.

### Landed bootstrap baseline and extension boundary

- Merge `f748ab739274ed57e57e115c081a3c68bc249733` is baseline, not repeat work: minimal Өрнүүн 48 plus `contracts`, `kernel`, `api`, `client`, `admin`, `storefront`, `ui`, `integrations`, and Node-only `delivery`, with enforced dependency direction.
- Astro 7 pages/assets, Solid islands/Admin, Worker `/api` dispatch to `aot: false` Elysia, Eden/Valibot requests, QueryClient defaults, direct Storefront reads, and bounded background entry are landed seams to deepen.
- Server owners already import generated D1, `EPHEMERAL_KV`, R2, Workflow, and SMS binding shapes directly from `cloudflare:workers`. Continue direct ownership; add no binding factories or DI wrappers.
- `/api/health` already probes only D1 through Elysia/Drizzle. Keep KV, R2, providers, Telegram, SMS, and PostHog out; add deployed commit and migration head to satisfy Production operations.
- Staff runtime is landed: Admin requires Store-local Staff Auth plus a matching active `staff_members` row with non-null role. Extend it with accepted authority/session behavior, never Google-email-only access. Customer has generated tables only; implement OTP/session/history/Guest-linking runtime in that namespace, not parallel schema.
- The landed Cart is Valibot-parsed Solid `createStore` state persisted with Solid Primitives. Extend its line contract/interactions without changing its owner or trusting it as server truth.
- Preserve the landed Portless contract: no-port `https://<store>.shop.localhost` canonically, and readable `https://<worktree-or-worker>.<store>.shop.localhost` origins for concurrent work. Store processes consume the validated `PORTLESS_URL` supplied by Portless rather than reconstructing an origin. Keep plain pnpm plus delivery-CLI orchestration; add no Vite Plus, hard-coded ports, or second runner.
- Preserve the deny-first cache classifier: only exact anonymous successful HTML allowlist responses retain CDN policy; all others lose public cache metadata. Extend routes, canonicalization, tags, and purge without weakening the fallback.
- Delivery commands, manifests, local apply/proof/cleanup, and local/canary manifests are landed. `store:create` honestly rejects pending a Store-neutral skeleton; remote canary/Production operations honestly reject pending real Cloudflare delivery. Extend these shells in place and keep them fail-closed until implemented.
- Preserve package ownership and forbid private imports, cycles, HTTP self-calls, raw-row browser contracts, Store-local backend forks, and concrete providers in `kernel`.
- Do not rebuild the graph, dispatcher, backend shape, direct bindings, migration stream, Staff gate, Cart owner, request/Query boundary, Portless model, pnpm/CI toolchain, cache classifier, generated auth namespaces, or delivery command surface. Extend them with commerce, the small CMS, Search, Customer runtime, headless Storefront primitives, complete Admin, providers/Workflow, purge, Store generation, remote delivery, and operations.

### Runtime contracts and error flow

- Valibot owns HTTP, form, environment, CMS, persisted JSON, provider, and browser-storage contracts. Unknown fields or versions fail; types are inferred. TypeIDs are parsed by expected prefix at HTTP and persistence boundaries, while Store ownership derives from bound D1.
- Raw Drizzle rows remain persistence-private; browser DTOs are deliberate projections. Kernel and integration operations use Better Result for expected tagged failures and convert throwing SDK behavior once at the integration boundary.
- Elysia maps Results once to route DTOs or the closed `ApiErrorEnvelope` using meaningful 400/401/403/404/409/422/429/503/500 statuses. Results never cross HTTP or enter Query data.
- The client validates both response paths and throws the exact route error union. Reusable current Solid Query `useQuery`, `useMutation`, and `useQueries` configurations preserve that typing. Global handling owns common network, service, rate-limit, expired-session, and contract failures; rich domain failures remain local.
- Mutations invalidate authoritative queries rather than patching browser cache truth.

### Backend and HTTP interfaces

- Preserve and deepen the landed Store backend initialized from Store Profile and static provider definition. Its only external entrypoints remain the complete Elysia app, direct in-process Storefront reader, and bounded scheduled/Workflow work.
- Preserve the landed Astro request dispatcher that sends `/api` to Elysia and pages/assets to Astro. Astro SSR uses the direct reader and never Eden or HTTP self-calls.
- Public API includes private/no-store Catalog search and `GET /api/catalog/availability?variantIds=...` with at most 50 unique canonical Variant IDs. Availability is advisory and does not expose raw inventory balances.
- Checkout provides current quote, idempotent Order placement, and the narrow QPay-to-bank-transfer switch. Placement requires an idempotency key retained across transport retries.
- Customer APIs expose separate Customer Auth, Customer Order history, and one-Order Guest Tracking. Anonymous automated-payment Orders receive a separate short-lived action capability for switching payment method; tracking authority cannot mutate.
- Admin uses intention-revealing resource routes for Catalog, Bundles, Discounts, inventory, Orders, Payments, Refunds, Fulfillment, CMS, media, Staff, audit, and attention state. Actor identity and role always derive from the Staff session.
- Automated-payment and Telegram callbacks use fixed Store-local paths because providers are selected at build time. Callback evidence is authenticated, normalized, idempotent, and passed to the same private kernel commands used by Admin and background work.
- All auth, Checkout, Customer, tracking, Payment, Order, inventory, callback, preview, and Admin responses are private/no-store. Error and redirect responses are never shared-cached.

### Browser state and presentation

- Query owns remote state, TanStack Form owns forms, URLs own shareable navigation, Solid stores/context own Cart/session/UI state, and Solid Primitives owns compatible Cart/draft persistence.
- Public pages use Astro SSR plus Solid islands; Admin is an authenticated Astro shell around the shared Solid SPA. `client` and `storefront` expose headless Search, availability, Variant, Cart, Checkout, payment, and tracking primitives that own shared state, contracts, errors, accessibility, and navigation safety. Shared presentations remain polished defaults, while Store apps compose and style those primitives through reviewed Astro routes without copying their logic.
- Zaidan/Kobalte/Corvu are the primitive foundation; Solar Icons is the sole icon family. Astro View Transitions and Motion provide non-blocking feedback with reduced-motion alternatives.
- Compatible local drafts restore automatically; invalid drafts require explicit handling. Concurrent-tab arbitration is outside v1.

### Catalog search

- Search uses one Store-local contentful D1 FTS5 projection plus one indexed compact SKU registry. Raw FTS SQL is contained to one server-only persistence seam and one ordered custom migration; dynamic values are parameterized.
- Search indexes Published Products and Bundles, useful Variant option text, brand text metadata, Categories, Collections, and Tags. It excludes unpublished entities and all stock quantities.
- Normalization is versioned and uses compatibility normalization, full Unicode case folding, canonical composition, separator-to-space mapping, whitespace collapse, and deterministic Mongolian transliteration.
- Search executes exact compact SKU, native Cyrillic, strict transliteration, strict ASCII, and bounded basic fallback tiers. Results disclose matched source, field, confidence, and multiple-low-confidence ambiguity.
- Public results use one `CatalogItemSearchResult` discriminated as Product or Bundle. Variant SKU resolves to Product; Bundle SKU resolves to Bundle. Category and Collection shortcuts are separate result kinds.
- Relevance leads deterministic ranking; request-time current sellability may break ties but raw stock cannot be indexed, returned, or outrank relevance.
- Search uses one-based numbered pages, bounded page sizes, `limit + 1` for `hasNext`, URL-owned query/filter/page state, and no unnecessary totals.
- Fuzzy edit-distance fallback stays disabled unless a 10,000-item proof reaches the accepted recovery, false-positive, size, query-plan, and Mongolia-latency thresholds.

### Checkout, Discounts, inventory, and snapshots

- Cart is local-only intent and never an inventory hold. Quote and placement resolve current Catalog, Variants, Bundles, Personalization, Discounts, delivery, pricing, and inventory.
- Placement rejects a changed selection, eligibility, price, Discount, Delivery Option, fee, or total and returns current safe facts. It independently rejects insufficient inventory.
- Successful placement atomically creates the Placed Order, immutable Order Lines and Commercial Snapshots, Discount claim and allocation, one normalized set of reservation items or COD consumption facts, initial Payment when required, Fulfillment, compact ledger evidence, idempotency result, and required Audit Events.
- Zero-total Orders create no Payment and consume the complete reservation immediately.
- Exactly one Discount Rule applies. A submitted valid code wins; otherwise the eligible automatic rule with the greatest reduction wins. Fixed and percentage reductions are bounded, never reduce Delivery fees, and allocate deterministically in integer MNT.
- Discount redemption capacity is claimed atomically. Cancellation of an Order with no confirmed Payment writes a compensating release; confirmation followed by Cancellation or Refund does not restore capacity.
- Each Variant owns one Stock Item. Available Quantity is on-hand minus active reserved quantity and can never be negative. No warehouse, location inventory, batch, waitlist, partial reservation, or Durable Object inventory exists.
- Stock balances change only with immutable Inventory Entries. Bundle operations write component Variant entries. Restoration and correction are explicit compensating facts.
- Delivery is one Store-wide Ulaanbaatar fee with optional free threshold, or free Pickup at an active public Location. Merchant staff handle out-of-area exceptions operationally.

### Payments, Fulfillment, and reliability

- Each Order may retain multiple Payment attempts but has at most one active collectible attempt. Payment history and confirmation truth are immutable; late or conflicting evidence is retained for reconciliation rather than applied blindly.
- Both Byl invoice and direct QPay adapters ship. Exactly one is statically selected and configured per Store with merchant-owned credentials. Admin and provisioning do not dynamically switch providers.
- The provider seam can begin exact-amount collection, inspect authenticated status, close an unpaid attempt, and parse a webhook. The kernel owns amount validation, state transition, inventory effect, and evidence.
- Automated attempts use a fixed 15-minute hold; expiry releases stock only after authenticated closure. If `confirmed|closed` is unproved after its effective deadline, only Owner/Manager `releaseUncertainPayment` may atomically set terminal `released_unresolved`, cancel unpaid Order, release reservation/Discount claim, block replacements, and audit actor/reason/command/inspections/provider evidence without asserting closure. Later exact authenticated money adds confirmation and equal Refund Obligation but cannot change state/Order/stock; quarantine other evidence. No generic force path.
- Safe automated-to-transfer switch atomically sets old attempt terminal `superseded`, preserves provider evidence/deadline/history, creates one full-amount `awaiting_confirmation` transfer, makes hold indefinite, and quarantines late evidence without changing Order/reservation/active attempt.
- Bank transfer and COD start Awaiting Confirmation. Bank transfer holds the reservation until authorized confirmation, rejection, or Cancellation. COD requires verified phone, belongs to the Customer, consumes inventory during placement, and allows Fulfillment before cash confirmation.
- Confirmed money uses immutable Financial Entries. Refunds are manual immutable Order-level amount/reason/reference facts; v1 has no line/item/delivery allocation or line-level Refund API. Cumulative Refunds cannot exceed confirmed money.
- Order, Payment, Fulfillment, and reservation states remain orthogonal. Derived UI labels never become stored combined truth.
- Cancellation is whole-Order. It releases active reservation or restores consumed inventory, cancels eligible Fulfillment, and creates a Refund Obligation when confirmed money remains unrefunded. Delivery Failed does not restore inventory; verified Returned enables the narrow post-handoff path.
- One small D1 idempotency record stores operation scope, key, canonical request hash, result identity, and time. D1 uniqueness, current-state predicates, provider-reference uniqueness, and idempotency guarantee exactly-once business effects under repeated delivery.
- D1 is the only commerce truth. KV never owns idempotency, stock, Orders, Payments, durable work, or cacheable Catalog/CMS representation.

### Background work and external failure

- Every Store owns one statically registered Cloudflare Workflow accepting a small tagged task union for payment lifecycle, notification delivery, and reconciliation. Workflow steps call idempotent provider operations and kernel commands; Workflow state is never commerce truth.
- `waitUntil` is restricted to short non-critical analytics and cleanup. There is no Queue, generic job table, command bus, outbox, notification-delivery table, Failed Notifications subsystem, lease runner, or Durable Object coordinator in v1.
- A committed mutation followed by failed Workflow creation returns an explicit retryable partial outcome when observed. Retrying the original idempotent command may start the missing work.
- A bounded scheduled reconciliation pass scans overdue authoritative Payment, reservation, and unresolved business state and idempotently starts or repairs Workflow work.
- Notification failure never changes commerce state. Workflow retry and visibility are sufficient; exhausted delivery emits restricted diagnostics and leaves all advertised actions available in Admin.

### Authentication and authorization

- Each Store runs separate Staff and Customer Better Auth instances with different paths, table namespaces, cookie prefixes, KV prefixes, secrets, users, sessions, and verification records. Cookies are secure, HttpOnly, SameSite Lax, and host-only.
- Staff Auth uses Google OAuth. A verified Google email must match an active Staff record with role. The first Owner is created manually by an authenticated provisioning command; no public bootstrap or first-login-wins flow exists.
- Stored/wire roles are exactly `owner | manager | staff`; Owner/Manager/Staff are display labels. `owner` manages identity/auth; `owner` and `manager` have financial authority; `staff` manages Catalog, CMS, Discounts, inventory, Orders, and non-financial Fulfillment.
- Staff sessions are revocable rolling 14-day sessions using a role snapshot. Role change or revocation deletes all sessions. Normal authorization does not require a redundant D1 role read on every request.
- The landed Customer artifacts are generated schema only. Implement Customer runtime in the existing Store-local namespace with SMS OTP and rolling 30-day sessions. Checkout remains anonymous-first except COD; the shared SMS Gateway owns delivery only, while OTP truth and limits stay in the Store.
- Guest Tracking is one-Order/read-only, high-entropy, non-recoverably stored, mutation-ineligible. Expiry: issue+90 days or terminal Order+30 days, first wins. Nonterminal rotation presents/revokes current valid capability, restarts 90 days, never extends terminal expiry. Exact-phone auto-link covers unclaimed Orders ≤30 days old; older linking also presents that Order's valid capability in authenticated session.
- Telegram financial actions authenticate the Store webhook, exact numeric operator allowlist, update replay state, one opaque bounded action reference, current Payment/Order/amount state, and scoped D1 idempotency.
- Telegram authority has no Staff identity, enrollment, role lookup, permission administration, or second confirmation tap. Financial evidence uses actor kind `telegram_operator` with configured label and numeric user ID.

### D1 schema and persistence

- Every Store owns one D1 database with no repeated Store key. The schema uses canonical TypeID strings, integer MNT, integer quantities, UTC millisecond timestamps, closed text states, foreign keys, checks, and indexes tied to known access paths.
- Relational tables own Catalog, SKU, Variant, grouping, Discount, Order, Payment, Fulfillment, Customer, Staff, inventory, media identity, idempotency, and consequential audit truth.
- Order Lines store bounded immutable option, Personalization, and Bundle-component display snapshots as strictly validated JSON. Inventory Demand is expanded once into relational Reservation Items at placement rather than duplicated in a second Order-Line demand table. Discount adjustments and allocations remain relational because commands query and reconcile them independently.
- Payment rows own current expected, confirmed, and refunded balances. Append-only Payment Entries store normalized deltas and evidence without repeating resulting balances. Stock Items own current on-hand and reserved balances. Append-only Inventory Entries store deltas and evidence without repeating resulting balances. Reconciliation sums entries against current rows. Audit Events record only consequential authorization, publication, cancellation, fulfillment, provider, and recovery decisions that are not already ledger facts.
- Noncommercial CMS uses one `cms_documents` table keyed by closed `kind` and `draft|published` status. Kinds are `storefront_identity`, `homepage`, `navigation`, `locations`, `policies`, `announcement`, and `ordering_notices`; there is no runtime Theme document.
- Every CMS kind has one named strict TypeScript type and Valibot schema. Canonical JSON is parsed on every write and read. Media and Catalog references remain canonical relational identities validated during Draft save and Publish. Homepage content uses one fixed shared field shape and reference set rather than an ordered section-builder schema.
- Media Asset metadata remains minimal: identity, immutable object key, declared content type, and creation time. Dimensions, digest, derivatives, provenance, and orphan state are absent from Production D1.
- Better Auth schema is generated for both namespaced instances when plugin configuration changes. Application schema and auth schema share one immutable forward migration stream.
- D1 batches preserve each accepted atomic transaction group. Conditional consequential updates must affect exactly one expected row or return an already-resolved result/typed conflict.

### CMS, caching, custom presentation, and SEO

- The Store Profile is a closed build-time capability ceiling containing stable Store key, Mongolian locale, MNT currency, presentation entrypoint, approved fonts, supported capabilities, static adapter choices, and deployment purpose. It contains no secrets, resource IDs, merchant content, runtime Theme document, or arbitrary extension data.
- D1 owns current merchant settings and the seven closed CMS document kinds. Publication does not require deployment; Storefront code, Store Profile capability ceiling, provider wiring, approved font catalog, DESIGN.md, and app-owned art direction do.
- Homepage content, navigation, Locations, policies, announcements, notices, and identity use bounded typed structures. Homepage content supplies fixed copy, media, and Catalog references to the custom renderer rather than arbitrary ordered sections. Constrained Markdown permits ordinary prose formatting and safe links but excludes raw HTML, scripts, styles, iframes, tables, arbitrary components, and inline Markdown images.
- Store presentation is a reviewed custom build. Apps compose shared headless commerce primitives and may own layout, typography, color, density, imagery, and merchandising rhythm. There is no runtime Theme editor, section registry, slot system, arbitrary CSS, arbitrary layout document, or runtime Google Fonts.
- Authenticated Admin uploads size-limited JPEG, PNG, or WebP bytes unchanged to immutable random R2 keys. Store media is served through bounded on-demand resizing and edge caching.
- Anonymous successful Storefront HTML on an explicit allowlist is cached by Cloudflare with the default key, browser revalidation, a two-week edge TTL, and broad semantic tags. Cacheable responses never set cookies or vary by Cart, session, Customer, or Staff.
- Cached HTML and JSON-LD include complete non-stock presentation but omit stock quantity, sellability, and stock-derived availability. The Solid purchase island begins disabled and fetches current availability.
- Catalog/CMS commands commit D1, then synchronously purge fixed broad Store tags with a least-privilege token; callers never supply zone, host, tag, or token. Purge failure returns closed `committed_but_not_purged` with committed document ID/kind; Admin reloads committed truth and offers purge retry.
- Canonical route redirects prevent duplicate cache keys. Every non-allowlisted route is deny-first private/no-store and has edge-cache headers removed.
- SEO is generated from Published facts: canonical URLs, titles, descriptions, social metadata, sitemap, robots behavior, and applicable Product, Organization, Breadcrumb, and Location structured data. Merchant-defined arbitrary metadata, scripts, canonicals, and robots values are excluded.
- Production is indexable only after activation. Canary remains noindex; Cart, Checkout, auth, Customer, tracking, Payment, Order, and Admin surfaces are never indexed.

### Delivery and environments

- Supported target kinds are worktree-local disposable `local`, long-lived fictional `canary`, and real `production`. There is no permanent staging. Issue #36 may add `prospect-demo` only after this delivery path is complete.
- Local delivery preserves no-port HTTPS `https://<store>.shop.localhost` and readable `https://<worktree-or-worker>.<store>.shop.localhost`, consuming validated `PORTLESS_URL` instead of reconstructing origins. Keep app/worktree-local Wrangler state, host validation, host-only cookies, and registered canonical Google OAuth origins; wildcard callbacks and an OAuth proxy are excluded.
- Store generation copies one minimal app skeleton once and never updates existing apps through template inheritance or patch machinery.
- A versioned manifest names one app and one Deployment Target without secrets. Immutable target identity changes require a new target or explicit decommissioning.
- Local apply/proof/cleanup are landed. Remote delivery extends the same direct CLI with ordered Store-specific steps for source and manifest validation, build, integrations, D1/KV/R2/Workflow resources, generated bindings, required secrets, migrations, seed, deployment, routes, and proof. Successful consequential steps journal resource identities and observed facts before continuing. Remote apply requires a clean exact source commit and lockfile digest.
- Resume revalidates only safety-critical facts: target identity, resource existence, source commit, lockfile digest, migration head, and any previously completed consequential output. It continues at the first incomplete step. Ambiguous externally changed identity or migration state fails closed with direct manual remediation instructions.
- The CLI is not a generic provisioning engine. V1 has no target lock service, desired-state reconciler, automatic drift adoption, per-artifact digest graph, or automatic rollback. Cleanup remains an explicit resumable command and failure retains partial resources.
- One ordered migration stream is forward-only. Delivery records migration names, current head, Time Travel bookmark, source commit, and lockfile digest before mutation. Application rollback redeploys a previously recorded schema-compatible commit; D1 restore is separate and human-authorized.
- The complete shared-kernel release is proved on the Reference Store once per commit. Production rollout chooses explicit Store targets and applies them one at a time. Store-owned presentation changes rerun only affected Storefront, accessibility, SEO, cache, and performance proof.
- Cleanup is explicit, prefix-confirmed, resumable, and refused for Production. No operation scans broadly by account prefix or guesses resource ownership.

### Reference Store

- Өрнүүн 48 is the sole committed fictional Store and synthetic canary. It uses the accepted Pantry Shelf art direction, fictional identity, `WF29` namespace, nine Products, two Bundles, bounded Categories/Collections/Tags, two Discount modes, Variant price/stock edges, all Personalization kinds, and fourteen reviewed generated WebP assets.
- Committed seed data contains only Store/CMS/Catalog/configuration and legitimate opening Inventory Entries. Orders, Customers, Payments, Refunds, Fulfillment, sessions, and tracking capabilities are created only through ordinary scenario commands.
- The eight stable scenarios are search tiers, Bundle reservation, cached HTML with live stock, guest automated-payment-to-transfer, Customer COD Pickup, Cancellation and Refund, Customer Guest linking, and concurrent stock race.
- Fixture identifiers, copy, addresses, contacts, Payment references, people, and media remain unmistakably synthetic. Reserved `WF29` namespaces are rejected from merchant import. No real merchant identity or catalog evidence enters the fixture.
- The Reference Store uses the same migrations, API, Admin, cache rules, provider seams, provisioning, and commands as merchant apps. There are no canary-only kernel branches or relaxed invariants.

### Operations, privacy, and recovery

- Cloudflare logs/traces, D1 metrics/Time Travel, account Audit Logs/Notifications, shallow health, Store doctor, Admin attention, delivery journal, and five runbooks are the operations system; no central telemetry, fleet dashboard, pager, SLO system, or custom backup is built.
- Preserve health as startup plus a bounded D1 read only; extend its response to include deployed commit and migration head. Never add KV, R2, PostHog, provider, Telegram, or SMS probes to health. Doctor separately checks URL/TLS/commit/migration, binding identities and secret names, bounded D1/KV/R2 operations, and cache-purge permission.
- Logs exclude secrets, OTPs, bank data, free text, raw bodies/payloads, and addresses. Full phone is allowed only in restricted server-side Auth/Checkout/Order/Payment/support Evlog events, never generic logs, errors, URLs, browser logs, or PostHog.
- Every Production Store has a separate PostHog project with the seven-event non-PII allowlist. Replay is sampled, masked, network-capture-free, query-redacted, and stopped before Checkout, auth, tracking, Admin, and sensitive Cart content.
- D1 Time Travel is durable recovery; KV is disposable; R2 is recovered from approved source media; restored intervals require provider reconciliation. Runbooks cover outage, uncertain money, inventory mismatch, unauthorized access/isolation, and media loss.
- Canary restore is drilled before first Production launch and destructive migrations, with additional drills only after a defect or material procedure change.

### Tooling and coding constraints

- TypeScript 7 is canonical; TypeScript 6 is temporary Astro compatibility. Oxfmt formats, Oxlint handles general/Solid lint, ESLint is Astro-only, and CI runs frozen install, format, lint, TS/Astro checks, Knip, Sherif, dependency checks, and builds.
- Use only the accepted dependency stack at owning seams. Strict TypeScript forbids `any`, unchecked/non-null assertions, ignored errors, and classes outside the error hierarchy.
- Use named exports with exported arrow constants, plain data, feature entrypoints, and direct operations. Reject layered services/repositories, generic factories/buses, speculative interfaces/plugins, catch-all helpers, and unearned wrappers/comments.

## Testing Decisions

- Verify external behavior at the highest seam; do not expose internals merely for testing. Add no unit/integration suites, mocks, stubs, fake providers, fake Cloudflare primitives, or doubles. Missing credentials/infrastructure are blocked, never simulated green.
- The primary seam is deployed Өрнүүн 48 through ordinary Storefront/Admin browser flows, APIs, scheduled/Workflow entrypoints, real D1/KV/R2, and all eight Canary Scenarios. Inspect resulting Orders, Payments, Fulfillment, Customers, Discounts, reservations, ledgers, and Audit Events, including duplicate delivery and concurrency.
- The landed local delivery seam is preserved. Until remote delivery is implemented, `store:create` and remote canary/Production commands must keep their explicit unavailable failures. Later real `store:apply`, `store:proof`, `store:doctor`, and eligible `store:cleanup` proof covers creation, generated types, zero migrations, seed, deploy, journal identity, failure/resume, missing secrets, safety-critical revalidation, bookmark, and Production cleanup refusal. Proof also confirms the absence of target locks, automatic drift adoption, generic desired-state reconciliation, and automatic rollback.
- Agent-browser proves mobile/desktop Storefront, search, Variants/Bundles, Personalization, Cart, stale quote correction, Checkout/payment switch, Customer/Guest access, core Admin operations, keyboard/focus, 200% zoom, 320px reflow, reduced motion, representative screen-reader journeys, console, and overflow.
- Curl and focused TypeScript harnesses prove HTTP statuses/envelopes, idempotency, auth/roles, callback replay, rate limits, search, health, and cache headers. Real Drizzle/D1 proves migrations, constraints, isolation, SKU uniqueness, atomic reservation, ledger reconciliation, CMS parsing, Guest linking, auth namespaces, FTS rebuild, and query plans.
- Real provider test modes or merchant-authorized nominal journeys prove exact payment, callback/poll race, duplicates, closure/expiry, late evidence, transfer switch, and handoff recovery. SMS uses the private binding and controlled canary phone; Telegram uses an actual bot, exact allowlist, bounded one-tap references, replay rejection, and Admin parity.
- Cache proof covers MISS/HIT, no stock leakage, fresh availability beside cached presentation, stale-price rejection, successful tag purge to fresh MISS, canonical redirects, cookie absence, and the deny-first private matrix.
- Mongolia-like measurements report cold HTML (≤1.5s p75/2.0s p95), warm HTML (<50ms p75/<100ms p95), and availability (≤350ms p95). Accessibility uses WCAG 2.2 AA human proof; privacy inspects logs, PostHog, replay, URLs, and errors.
- Canary recovery proof bookmarks, creates marked effects, restores, redeploys compatible code, reconciles via ordinary commands, and reruns proof. Production restore stays human-authorized and Store-local.
- Every PR runs applicable repository gates, real affected proof, and the final thermo-nuclear review. Valid findings are fixed and material fixes re-reviewed. Accepted prototypes are prior art only; their throwaway code is not merged.

## Out of Scope

- SaaS multitenancy, shared merchant storage/runtime, fleet control planes, dashboards, release services/trains, automatic convergence/rollout, permanent staging, dynamic plugins, or Store-specific commerce forks.
- Enterprise scale, sharding, distributed/warehouse/location inventory, batches, waitlists, partial reservations, split shipments, multiple couriers, geospatial/live courier pricing, or courier APIs.
- Multi-currency/tax engines, fractional quantities, split tender, partial confirmation, line cancellation, exchanges, general returns, automated Refund execution, loyalty, gift cards, referrals, reviews, advanced attribution, or customer uploads.
- AI/semantic/DO search, maintained aliases, unbounded fuzzy matching, or public live-inventory search caching.
- Generic Pages/documents, page builders, arbitrary CSS/HTML/scripts/SEO, schedules, approval/history/redirect systems, or media normalization/derivative/orphan pipelines.
- Generic dispatch/repository/command/event/job/outbox/notification systems, Queues, speculative adapters, automated Khaan reconciliation, runtime provider switching, Byl hosted checkout, Storepay, or provider-owned commerce.
- Cross-Store/merged Customer identity, phone-change/address-book workflows, Staff Customer-session revocation, or Telegram enrollment/role/second-tap/merchant authority.
- Custom telemetry/backup/paging/SLO systems, automatic restore/rollback, or recurring recovery ceremony.
- The CSV/XLSX importer remains deferred until a real merchant input exists. Private prospect demos and outreach are owned by #36, which is blocked by this specification. Real credentials or merchant evidence in Git, automated outreach, real demo commerce, Demo promotion, and a committed Rozie package remain outside this specification.
- Unit/integration suites, mocks, stubs, fake providers, or simulated infrastructure proof.

## Further Notes

- This specification synthesizes the resolved Wayfinder map #2 and all 28 closed child issues. The final founder reconciliation overrides all earlier artifacts. Obsolete Telegram enrollment/revalidation/second tap, normalized CMS tables, two-KV assumptions, general Revisions, `AcceptCodOrder`, serialized Results, notification persistence, doctor provider probes, fixed six-month drills, and repeated full canary suites per Production Store must not return.
- Bootstrap #31 is closed by PR #34 at merge `f748ab739274ed57e57e115c081a3c68bc249733`. `/to-tickets` must begin from the landed baseline and must not create work to rebuild it; tickets should extend the named seams and preserve the honest unavailable boundaries until their real implementations land. It must not create prospect-demo or outreach tickets from this specification; that work belongs to blocked issue #36.
- The flow remains `/to-spec` → `/to-tickets` → `/implement`. Keep each implementation slice small, vertical, reviewable, and within the Target Store complexity budget.
