# Commerce domain and state-machine model

This is the approved pre-schema contract for the shared commerce kernel. Persistence, interfaces, and provider integrations must preserve these semantics rather than redefine them.

## Boundaries and ownership

**Decision status:** Approved by the orchestrator.

Every commerce identity, command, idempotency key, event, and reference is scoped to exactly one independently deployed Store, and all references resolve within it. Customer and Staff Member identities never link or merge across Stores, even when phone numbers match. Each Store's commerce persistence is authoritative; no global commerce identity or cross-store aggregate exists in v1. The merchant app may choose presentation, but only the shared kernel may mutate price, inventory, checkout, Payment, Order, cancellation, refund, or Fulfillment truth.

The kernel owns these aggregate boundaries:

| Aggregate | Owns | Does not own |
| --- | --- | --- |
| Product | merchandising identity, Option Groups, allowed Option Values, Variants, personalization definitions, publication lifecycle | inventory quantity, cart state, order history |
| Bundle | merchandising identity, fixed Variant components and quantities, bundle price, publication lifecycle | independent stock |
| Discount Rule | eligibility, activation window, usage policy, calculation policy, Discount Redemption Entries | mutable Order totals |
| Order | Order Lines, Commercial Snapshots, totals, contact snapshot, Order state, links to its Payments, Inventory Reservation, and Fulfillment | provider-specific state |
| Payment | expected and confirmed amounts, method, Payment state, validated Payment Evidence, Refund Obligation, and Refund records | Order or inventory transitions chosen by an adapter |
| Inventory Reservation | normalized Inventory Demand and reservation state for one Order | catalog presentation or Payment state |
| Stock Item | on-hand balance, active reserved quantity, Inventory Entries | Bundle stock |
| Fulfillment | Pickup or Delivery snapshot and Fulfillment state | Payment truth |
| Customer | verified store-scoped phone identity and links to Orders | mutable copies of historical order contact details |

Separate aggregates may change in one atomic transaction when an invariant spans them. Aggregate boundaries describe ownership and concurrency, not a requirement for separate network calls.

## Shared value rules

**Money and snapshot status:** Approved by the orchestrator.

- Money is integer Mongolian tögrög (MNT). No floating-point money enters the domain. Customer prices and fees are tax-inclusive in v1; the kernel does not calculate a separate dynamic tax.
- Cart Line, Order Line, Variant stock, reservation, adjustment, and Bundle component quantities are positive integers with platform hard maxima and optional stricter merchant or Order limits. Fractional, weight-based, and continuously measured products are excluded in v1.
- Human-facing names and submitted contact details are snapshots, not identity keys. Capture only what fulfillment and order evidence require; later operational corrections are new audited facts, never historical rewrites.
- Phone numbers are normalized once at the boundary; only a verified normalized phone may establish a Customer or link Guest Orders.
- Mutable aggregates carry a monotonic Revision. A command against existing state supplies the expected Revision; mismatch rejects the whole command without partial effects.
- IDs identify both entity kind and Store ownership. Physical TypeID prefixes and serialization are decided with the schema.
- Timestamps used for business decisions are server-comparable instants and never come from the browser. QPay expiry is the earlier of authenticated provider expiry and the kernel-configured maximum hold duration.

## Catalog model

**Lifecycle/composition and option/variant status:** Approved by the orchestrator.

A Product always has at least one Variant. Products with no customer-selectable options receive one Default Variant; interfaces may hide it, but commerce code never has a second path for directly sellable Products.

An Option Group belongs to one Product. Its Option Values form only the combinations explicitly represented by active Variants; the cart cannot submit an arbitrary option combination. A Product owns one positive integer-MNT base price; a Variant owns a required non-empty store-scoped SKU and may provide a positive integer-MNT override, while the Default Variant normally inherits the base price. Product ownership, complete Option Value combination, and SKU may change while Draft but become immutable at first Published/Active use; SKU remains permanently non-reusable after archival. Price override, images, and merchandising data may change revisionally for future Orders. Changing Product, option combination, or published SKU requires a replacement Variant plus dependency migration before archival. Publication requires a valid positive price, unique SKU, and a complete allowed option combination. Option surcharges, Personalization pricing, and zero or negative published prices are excluded in v1.

A Bundle is separately purchasable and owns its own required non-empty store-scoped SKU and positive integer-MNT price. Bundle SKU follows the Variant policy: Draft-editable, immutable at first publication, and permanently non-reusable. Its fixed components reference active Variants and positive quantities and become immutable at first publication. Published price and merchandising content may change revisionally for future Orders, but changing component identities or quantities requires a new Bundle identity/SKU and eventual archival of the old Bundle after dependencies are resolved. It never has independent inventory: its Inventory Demand is the sum of component demand multiplied by ordered bundle quantity. A Bundle cannot contain another Bundle in v1, preventing recursive demand and ambiguous availability.

A Product or Bundle owns ordered text, single-select, and checkbox Personalization definitions with stable keys, customer-visible labels, requiredness, and typed validation. Merchant-configured text limits are capped by a platform hard maximum; select accepts exactly one active configured value; checkbox is boolean. A customer's validated answers belong to the Cart Line, and definition identity/version, label, and value are snapshotted into the Order Line. Personalization does not alter SKU, price, quantity, Variant identity, or Inventory Demand. Files and rich content are excluded in v1.

Product and Bundle are both Catalog Items for grouping. Categories form an optional acyclic parent/child navigation taxonomy; Collections are manually curated ordered Catalog Item groups; Tags are flat merchant labels without inherent storefront navigation. Membership is many-to-many. Dynamic rule-based Collections are excluded in v1.

Categories, Collections, and Tags move `Draft → Active → Archived`. Only Active groupings affect navigation, merchandising, search facets, or new Discount eligibility. Memberships remain on archival. Archival is rejected while an active child Category or Active Discount Rule depends on the grouping; staff must explicitly reparent or deactivate the rule first. Archived grouping identities are terminal in v1.

Products and Bundles use one publication lifecycle:

```text
Draft --publish--> Published --archive--> Archived
                     ^                    |
                     +-----reactivate-----+
```

Draft items are freely editable but not purchasable. Publishing requires every catalog invariant to hold. A Published item may be revised in place, but a change cannot invalidate its active Variant combinations or published Bundle dependencies; price and copy changes affect only future checkout. Archived prevents new purchases and preserves every historical reference and snapshot. An archived Product or Bundle may reactivate under the same immutable identity when its publication invariants still hold; its original SKUs remain bound to their original identities and are never reassigned. Option Groups and Option Values are Product-owned definitions rather than independently publishable. They are freely editable while Product is Draft. After first publication, Group ownership, Value identity, and machine key become immutable once referenced by a Published/Active Variant; customer-visible labels and ordering may change revisionally. Values may become Archived only after dependent Variants are replaced or archived and Bundle dependencies resolved. A Variant is Active or Archived within its Product and may reactivate only under its original identity, SKU, Product ownership, and Option Value combination when its invariants hold. At least one Variant must remain Active while the Product is Published, and a Variant used by a Published Bundle cannot be archived first.

## Cart, checkout, and commercial truth

**Checkout-boundary status:** Approved by the orchestrator.

The Cart is localStorage-only convenience state. It may contain stale labels, prices, or availability and never reserves stock. The server accepts cart intent, not cart truth.

Checkout performs one authoritative placement operation:

1. Normalize and validate contact, Cart Lines, quantities, Personalization, requested Discount identifiers, and Delivery selection.
2. Resolve current active Products, Variants, Bundles, Discount Rules, prices, and Delivery Options.
3. Expand every line into normalized Inventory Demand.
4. Recalculate subtotal, Discount Adjustments, delivery fee, and grand total in MNT.
5. Require the commercial facts displayed to the customer and reject with structured current facts when item, Variant, or Bundle eligibility, selected options, discount outcome, Delivery availability or fee, unit amounts, or grand total changed—even if cheaper. Revalidate stock independently. Harmless copy, image, or other non-commercial metadata changes do not block placement; the Order snapshots current authoritative presentation facts.
6. Atomically create the Placed Order and immutable Commercial Snapshots, reserve all Inventory Demand, create its initial Payment when money is due, create its Fulfillment, and record required consequential evidence. If grand total is zero, create no Payment and immediately consume the reservation in the same transaction.

A Draft Order may exist while the server assembles and validates a placement, but it has no external commercial commitment and owns no reservation. The externally durable result of successful checkout is a Placed Order. Retrying the same checkout command must return that result rather than create another Order; the reliability contract defines idempotency storage.

An Order Line snapshots customer-visible item identity and name, applicable Variant identity and name, selected options, SKU, Personalization, resolved unit catalog price, quantity, line adjustments, line total, and expanded Inventory Demand. A purchased Bundle remains one customer-visible Order Line with its own SKU, quantity, price, discount allocation, and Personalization while also snapshotting component Variant identities, SKUs, per-bundle quantities, and total Inventory Demand for fulfillment and audit. Bundle price is not allocated across components, and Refunds are recorded only at Order level in v1. The Order snapshots currency, subtotal, allocated and order-level Discount Adjustments, delivery method, fee and destination or Pickup Location, fulfillment-required submitted contact facts, grand total, and policy/version references needed to explain the sale. Later catalog, Discount Rule, Location, or Customer edits never rewrite it. Once Placed, items, quantities, Personalization, discounts, delivery mode or fee, and submitted destination are immutable; material customer changes require whole-Order Cancellation and a new `PlaceOrder`. Corrected contact instructions, staff notes, courier references, and similar operational facts append with audit evidence without rewriting the original snapshot.

### Discounts

**Decision status:** Approved by the orchestrator.

Discount Rules are either a percentage or fixed-MNT merchandise reduction. A rule may be automatic or require one normalized code, may target the whole catalog or explicit Products, Variants, Categories, or Collections, and may set an activation window, minimum eligible subtotal, and global redemption limit. Customer-specific and per-customer limits are excluded in v1 because guest checkout remains valid. Exactly one rule applies to an Order; the submitted valid code wins, otherwise the kernel chooses the eligible automatic rule producing the greatest reduction. Fixed reductions are capped at eligible merchandise subtotal, percentage reductions are bounded from 1–100%, and the result is allocated deterministically across eligible Order Lines. Discounts do not reduce delivery fees; free delivery is computed separately from the post-discount merchandise subtotal.

A Discount Rule moves `Draft → Active ↔ Inactive`. Draft rules are ineligible. Active rules may change only with expected Revision and audit evidence, affecting future Orders only. Activation windows and atomic redemption facts derive scheduled, expired, or exhausted eligibility rather than adding stored lifecycle states. The applied rule identity and version remain in the immutable Order snapshot.

The kernel, not the client, determines eligibility and allocation. Order discounts allocate proportionally by each eligible Order Line's pre-discount merchandise amount using integer-MNT largest-remainder rounding; leftover tögrög follow stable Order Line order. Allocations sum exactly to the Discount Adjustment and cannot exceed a line's pre-discount amount. Discount Adjustments cannot reduce the Order below zero, cannot change inventory identity, and preserve source rule, reason, amount, and line allocation in the Commercial Snapshot. Redemption capacity is claimed atomically with Order placement through an immutable Discount Redemption Entry. Whole-Order Cancellation without any Confirmed Payment—including QPay deadline expiry, kernel-classified final failure, or rejected unpaid transfer/COD—restores capacity through an explicit compensating entry. Once any Payment is Confirmed, later Cancellation or Refund never restores capacity.

## State machines

Order, Payment, Fulfillment, and Inventory Reservation are orthogonal state dimensions. Interfaces may derive labels such as “paid and processing,” but no combined status is stored as commerce truth.

### Order

```text
Placed --complete--> Completed
   |
   +--cancel-------> Cancelled
```

- `place` atomically creates Placed state from transaction-internal Draft assembly and requires valid commercial truth and a complete Inventory Reservation.
- `complete` requires Fulfillment to be Fulfilled, all required money to be confirmed, and no unresolved amount inconsistency. COD collection must be confirmed before completion; a zero-total Order has no Payment requirement.
- `cancel` is allowed before courier handoff or Pickup, plus a narrow post-handoff Delivery exception after verified physical Returned. It releases an active reservation; if stock was already consumed, it records a compensating Inventory Entry. Confirmed money creates a Refund Obligation rather than pretending payment never happened.
- Completed and Cancelled are terminal. Returns after Fulfilled are outside v1.

For every Placed Order, subtotal equals the sum of pre-discount line totals; total discount equals the sum of allocated Discount Adjustments; grand total equals subtotal minus discount plus delivery fee; and all values remain non-negative integer MNT.

### Payment

**Decision status:** Approved by the orchestrator.

```text
QPay:           Pending --confirm evidence--> Confirmed --partial refund--> Partially Refunded --full refund--> Refunded
                   +-----fail evidence-------> Failed --switch to transfer--> Superseded
                   +-----deadline------------> Expired
                   +-----switch to transfer---------------------------------> Superseded

Transfer/COD:  Awaiting Confirmation --staff confirm--> Confirmed --partial refund--> Partially Refunded --full refund--> Refunded
                         +---------staff reject-------> Rejected
```

- QPay begins Pending while automated external collection is active and moves directly to Confirmed, Failed, or Expired from authenticated evidence or deadline. Its Payment and reservation share the earlier of authenticated provider expiry and the kernel-configured maximum hold. Manual transfer and COD begin Awaiting Confirmation with no automatic v1 deadline and remain held until authorized staff confirm or reject transfer evidence or cash collection. Provider-specific canonical states and synthetic human-queue transitions for QPay are excluded.
- Confirm requires accepted Payment Evidence, exact Store, Order, currency, and expected amount, and one application of its provider reference.
- Same-method QPay replacement attempts are allowed only while the original Active reservation remains valid and never extend its deadline. Before any money is Confirmed, the customer may switch an unconfirmed Pending or Failed QPay attempt to full-amount bank transfer on the same Order. The switch atomically marks the old QPay attempt Superseded, preserves its history, creates one Awaiting Confirmation transfer attempt, and converts the existing reservation to an indefinite manual-transfer hold. No other method switch is allowed, and no switch is allowed after confirmation.
- Expired, Rejected, and Superseded are terminal for that Payment attempt. Failed is terminal for QPay collection but may be marked Superseded only by the permitted bank-transfer switch. A QPay Failed attempt alone leaves the unpaid Order, Active reservation, and redemption claim until the original deadline so a same-method replacement or bank-transfer switch remains possible. Explicit Cancellation, final deadline Expiry, or a kernel-classified final failure cancels the Order and compensates reservation and eligible redemption; adapters report evidence but never decide retryability or Order cancellation. QPay deadline expiry atomically expires Payment and reservation and cancels the unpaid Order. Manual-transfer or COD rejection atomically rejects Payment, releases the reservation, and cancels the unpaid Order. An Order may have multiple attempts but at most one active collectible Payment.
- Split tender and partial confirmation are excluded in v1. Each active collectible attempt expects the full outstanding integer-MNT Order total and confirms only on an exact match. Once the required amount is Confirmed, no new collectible Payment may be created; partial or full Refunds reduce net retained money but never recreate amount due or reopen collection. A new sale requires a new Order, and unexpected later evidence is quarantined. Duplicate, late, excess, underpaid, or otherwise mismatched evidence is quarantined for reconciliation; replacement-attempt history is preserved.
- A late provider success, including evidence for a Superseded QPay attempt, is recorded as Payment Evidence and a reconciliation exception. It never resurrects an expired reservation or changes an Order or its active Payment without a kernel recovery command.
- Refund states record merchant-confirmed manual execution. Every Refund records an Order-level integer-MNT amount, owner/manager actor, mandatory reason, and external or manual reference when available. Cumulative Refunds cannot exceed confirmed money. No allocation across Order Lines or delivery fees is required. Partially Refunded may advance to Refunded; Refund records are immutable and corrected with compensating records.
- Each Payment attempt has one ordered immutable Financial Ledger. Typed Expected, Confirmed, and Refunded entries carry integer-MNT changes, resulting confirmed and refunded balances, evidence or reference, actor or system source, reason, and command correlation. Efficient balances are persisted but reconcile exactly to entries. Refund Obligation remains Payment-owned and reconciles against Refund entries; Order totals aggregate across attempts without losing attempt history.

### Fulfillment

**Decision status:** Approved by the orchestrator.

```text
Unfulfilled --start--> Processing --ready--> Ready
     |                                          |
     +--cancel--> Cancelled                     +--hand off--> Handed Off --complete------> Fulfilled
                                                |                 +--final failure--> Delivery Failed --return--> Returned
                                                +--pick up----> Picked Up -------complete--> Fulfilled
```

- Exactly one Fulfillment belongs to an Order. All Order Lines share one Pickup Location or Delivery destination and progress together. Split shipments, partial line fulfillment, multiple couriers, and mixed Pickup/Delivery are excluded in v1.
- `StartFulfillment` requires Reservation Consumed for every method. QPay and manual transfer additionally require Payment Confirmed; COD may start after `AcceptCodOrder` while Payment remains Awaiting Confirmation; a zero-total Order requires no Payment. Payment confirmation or reservation consumption never advances Fulfillment automatically—authorized staff must explicitly start it.
- Fulfillment mode is fixed to Delivery or Pickup when the Order is placed.
- Delivery uses Handed Off; Pickup uses Picked Up. Commands invalid for the chosen mode are rejected.
- Unfulfilled, Processing, or Ready Fulfillment may become Cancelled only as an atomic consequence of Order cancellation. For Delivery only, Handed Off may become Delivery Failed after a deliberate final-failure/return-initiated decision, then Returned only after verified physical return. Ordinary unsuccessful delivery attempts remain courier evidence while Handed Off. A Returned Fulfillment permits narrow post-handoff whole-Order Cancellation and compensating inventory restoration for every payment method. Unconfirmed COD is Rejected; any Confirmed Payment—including COD—preserves immutable confirmation truth and creates a Refund Obligation. Confirmed never transitions to Rejected, and stock is never restored at Delivery Failed.
- Courier references and staff notes are evidence attached to transitions, not new commerce states.

### Inventory Reservation

**Decision status:** Approved by the orchestrator.

```text
Active --accept/confirm--> Consumed
   |
   +--cancel/reject-----> Released
   +--deadline---------> Expired
```

- Checkout creates Active only if all Stock Items can be claimed atomically. A zero-total Order creates and immediately consumes the complete reservation in the `PlaceOrder` transaction because no payment uncertainty remains; normal Cancellation and redemption-compensation rules still apply when no Payment was Confirmed.
- QPay confirmation consumes the reservation. Manual transfer consumes it when owner/manager confirms payment. `AcceptCodOrder` atomically consumes it and records inventory and operator evidence but neither confirms Payment nor advances Fulfillment; Payment remains Awaiting Confirmation until cash collection and Fulfillment remains Unfulfilled until `StartFulfillment`. Reservation Consumed is authoritative COD acceptance evidence rather than another Order or Payment state.
- Consumed decreases on-hand quantity and removes reserved quantity exactly once. Released and Expired remove reserved quantity without changing on-hand quantity.
- Scheduled expiry supplies expected Revisions and never overwrites concurrent valid confirmation or staff action; the winning transition commits atomically.
- A reservation transition may drive a permitted Order or Fulfillment consequence through the kernel, never through a provider adapter.

## Inventory invariants

**Stock, ledger, and concurrency status:** Approved by the orchestrator.

A Variant maps to exactly one Stock Item in the store's single shared inventory pool. Available Quantity is current on-hand quantity minus all Active reservation demand and can never be negative. Bundle availability is derived from component Variant availability and required quantities; no Bundle stock is persisted. The minimum reservation model is one Inventory Reservation per Order, normalized Variant demand, and Stock Item on-hand and reserved balances. Placing an Order conditionally updates every demanded Stock Item in one atomic transaction so either all demand is reserved or none is. Order, Payment, discount, and inventory changes share one transaction boundary. Warehouses, stock batches, partial reservations, waitlists, and automatic rebalancing are excluded in v1.

Each Stock Item has one ordered immutable Inventory Ledger. Every typed Inventory Entry carries on-hand and reserved deltas, resulting balances, reason, actor or system source, causal Order and reservation where applicable, and command correlation. Adjustment changes on-hand; Reservation increases reserved; Release or Expiry decreases reserved; Consumption decreases both on-hand and reserved; Restoration compensates on-hand. Efficient current balances are persisted but must reconcile exactly to the ledger. An adjustment that would make on-hand lower than Active reserved demand is rejected with the blocking reservations; authorized staff must explicitly resolve or cancel affected Orders before recording the corrected count. Reservations are never auto-released, Available Quantity never becomes negative, and code never edits a balance without evidence. Consuming a Bundle reservation writes component-level entries. Cancellation after consumption uses explicit compensating entries and never deletes history.

Cached storefront HTML does not contain authoritative stock. The live availability query may report current sellability, but checkout alone promises units.

## Delivery options

**Decision status:** Approved by the orchestrator.

Delivery Options are either free Pickup at an active public Location or Delivery within Ulaanbaatar priced by one storewide flat fee. Delivery becomes free when the post-discount merchandise subtotal meets the merchant's optional configured threshold. Checkout snapshots the mode, selected Pickup Location or submitted delivery destination, fee, and threshold result. Merchant staff handle out-of-area requests and other edge cases operationally. All Locations draw from the same inventory pool. Locations move `Draft → Active → Archived`; only Active Locations may be selected for Pickup. Revisioned edits affect future Orders only, while placed Orders retain immutable labels, addresses, fees, and destination facts. Archived is terminal in v1, preserves historical identity, and prevents identity reuse. Geospatial validation, distance pricing, and live courier quotes are excluded in v1.

## Commands and transition authority

**Decision status:** Approved by the orchestrator.

The application layer exposes intention-revealing commands; persistence and adapters remain behind it. The minimum command vocabulary is:

- Catalog: `CreateProduct`, `ChangeProduct`, `PublishProduct`, `ArchiveProduct`, `ReactivateProduct`, `CreateBundle`, `ChangeBundle`, `PublishBundle`, `ArchiveBundle`, `ReactivateBundle`, `ReactivateVariant`.
- Pricing: `CreateDiscountRule`, `ChangeDiscountRule`, `ActivateDiscountRule`, `DeactivateDiscountRule`.
- Ordering: `PlaceOrder`, `CancelOrder`, `CompleteOrder`. Cancellation is staff-operated in v1. Customer sessions and Guest Tracking Links remain read-only for Order operations, so Customers and guests contact the merchant or wait for QPay expiry. Detailed role and session enforcement belongs to the auth boundary.
- Payment: `BeginPayment`, `SwitchPaymentToBankTransfer`, `RecordPaymentEvidence`, `ConfirmPayment`, `RejectPayment`, `ExpirePayment`, `RecordRefund`.
- Inventory: `AdjustInventory`; reservation, consumption, release, and expiry are internal consequences of Order, Payment, COD acceptance, cancellation, or scheduled-expiry commands.
- Fulfillment: `AcceptCodOrder`, `StartFulfillment`, `MarkReady`, `HandOffDelivery`, `MarkDeliveryFailed`, `RecordReturned`, `RecordPickup`, `CompleteFulfillment`.
- Customer: `VerifyCustomerPhone`, `LinkGuestOrders`.

Owner/manager-only financial authority is a precondition for manual confirmation, rejection, and Refund recording. Full role-to-command authorization is decided by the identity boundary ticket.

Commands either commit every owned state change and its required inventory, financial, redemption, provider, and operator evidence together or commit none. Expected Revision protects mutable aggregates. Idempotency protects command retries and provider evidence; it does not replace optimistic concurrency.

## Cancellation and refund rules

**Decision status:** Approved by the orchestrator.

Cancellation is a whole-Order decision, while Refund is a Payment fact. Line-level and quantity-level cancellation are excluded in v1; before handoff or Pickup, staff continue the complete Order or cancel it entirely. Split shipments, exchanges, and general post-fulfillment returns are handled operationally outside the system. A Returned delivery permits narrow post-handoff Cancellation only after the complete Order is verified back in merchant custody; Delivery Failed alone never permits cancellation or stock restoration. Unconfirmed COD becomes Rejected; any Confirmed Payment—including COD—preserves immutable confirmation truth and creates a Refund Obligation. Confirmed never transitions to Rejected. Returns after Fulfilled remain outside v1. Discretionary partial Refunds remain financial-only and never alter ordered quantities, Inventory Demand, pricing, or Fulfillment. Cancellation and Refund are related but never aliases:

- Cancelling an unpaid Placed Order releases its reservation and cancels pre-handoff Fulfillment.
- Cancelling an Order with confirmed unrefunded money atomically creates a Payment-owned Refund Obligation for confirmed money minus existing Refunds and preserves Payment truth until manual Refunds are recorded.
- A Refund Obligation records the Order-level amount still due after a paid Cancellation; its outstanding amount is derived from confirmed money and immutable Refund records. It cannot be silently deleted or waived.
- Owner/manager may record a mandatory-reason partial or full Refund against any Confirmed Payment without cancelling the Order. It reduces an existing Refund Obligation when present; otherwise it is an audited discretionary financial action. It never changes Order, Fulfillment, quantities, or inventory automatically.
- Returns after Fulfilled, exchanges, and automated provider refund execution are outside v1. Staff may record an authorized manual Refund and audited inventory adjustment where business policy requires it.

## Customer and guest linking

**Decision status:** Approved by the orchestrator.

An authenticated Customer owns the Order they place, while submitted recipient name, normalized phone, and destination may differ and remain immutable Fulfillment snapshots. Recipient facts never establish, transfer, or relink Customer identity. Checkout snapshots recipient and consent-relevant facts onto the Order. A Guest Order has no Customer identity and receives a narrow Guest Tracking Link. The stored secret is non-recoverable and scoped to read-only tracking of one Order; it cannot authorize profile, payment, cancellation, or other Order access. The link remains valid while the Order is active and expires automatically 30 days after the Order becomes Completed or Cancelled; v1 has no staff revocation workflow.

Exactly one Customer identity may exist per normalized verified phone within a Store. The verified phone is immutable in normal v1 workflows. Verifying another phone establishes or accesses its own Customer and never moves or merges Order history automatically; legitimate phone-change or conflict recovery requires explicit audited owner/manager handling with no cross-Store effects. SMS OTP is used only to establish or access a Customer login for a normalized phone in this Store; guest checkout and Payment never require OTP. Orders placed while authenticated belong to that Customer. `LinkGuestOrders` attaches all prior Guest Orders whose snapshotted checkout phone exactly matches the newly verified phone because no authenticated owner existed at placement. Until then, each Guest Order is accessible only through its temporary order-specific Guest Tracking Link. The linking operation is audited, idempotent, and never rewrites contact snapshots. Already linked Orders remain linked, and a conflicting Customer link requires explicit owner/manager recovery rather than automatic reassignment. Staff cannot assert phone ownership, and identity or history never links across Stores.

## Evidence, audit, and adapters

**Decision status:** Approved by the orchestrator.

Current aggregate state is commerce truth; the kernel is not event sourced and does not emit generic events for every edit. It records append-only evidence for consequential financial, inventory, authorization, Fulfillment, Cancellation, manual-override, and provider actions. Each record contains only the applicable Store and entity identity, actor or provider source, reason, command correlation, server time, and minimized safe facts needed to explain the action. Domain Events are emitted only for concrete downstream reactions defined by an interface contract. Corrections append compensating evidence rather than rewriting history. Bearer secrets and unnecessary direct PII never enter evidence or audit records.

Payment, courier, tax, and messaging adapters are statically registered translators. They may:

- initiate an external operation;
- verify authenticity and normalize external responses or callbacks into evidence;
- report external identifiers, timestamps, and diagnostics.

They may not define domain states, accept an amount mismatch, authorize staff, mutate Order or inventory records, decide idempotency, or suppress audit evidence. The shared kernel validates adapter evidence and chooses the command and transition. Provider-specific details stay in namespaced evidence or adapter-owned persistence and do not leak into canonical state machines.

## Required downstream decisions

This model intentionally leaves these implementation decisions to the already-charted tickets:

- reliability, idempotency persistence, callback/poll races, outbox, retries, and recovery;
- D1 tables, constraints, indexes, TypeID prefixes, and transaction mechanics; the physical deployment uses one separate D1 database per Store and shared repository-owned schema/backend packages, without Durable Objects for inventory reservations;
- Elysia/Eden route and module interfaces, validation envelopes, and authorization plumbing;
- auth/session mechanics and detailed role permissions.

Those decisions must implement these terms, ownership boundaries, invariants, and transitions without introducing alternate commerce truth.
