# Mongolian Ecommerce

The shared language for catalog, ordering, payment, and fulfillment within each independently deployed merchant store.

## Operating context

**Target Store**:
A small independent merchant Store that typically processes 10–20 Orders per day, should operate comfortably around 50 Orders per day, and may have a social audience up to roughly 50,000 followers. These figures guide product and architecture simplicity rather than impose hard platform limits.

**Complexity Budget**:
The deliberate preference for the smallest reliable design that protects essential commerce truth at Target Store scale. Spend complexity on Store isolation, authorization, validation, atomic commercial and inventory changes, retry safety, and recovery; avoid speculative scale, enterprise compliance, distributed coordination, ledgers, and unused extension points.

## Catalog

**Catalog Item**:
A Product or Bundle that may be grouped for navigation, merchandising, discounts, and search.

**Product**:
A customer-facing catalog concept that always contains at least one Variant.

**Option Group / Option Value**:
A Product-defined customer choice, such as size or color, and one allowed selection within it.

**Variant**:
The purchasable inventory identity of a Product. A Product without customer-selectable options has one Default Variant presented as the Product itself.
_Avoid_: Product SKU

**Bundle**:
A separately purchasable catalog item with its own SKU and price, composed of fixed Variants and quantities. It has no inventory independent of its components.

**Personalization**:
Validated customer input attached to a Cart Line or Order Line that does not create a Variant or change inventory identity.

**Category**:
A node in an optional acyclic parent/child navigation taxonomy containing Catalog Items.

**Collection**:
A manually curated, ordered group of Catalog Items for merchandising.

**Tag**:
A flat merchant label on Catalog Items with no inherent storefront navigation.

## Shopping and pricing

**Cart**:
A customer-device draft of intended purchases. It is neither server truth nor an inventory hold.

**Cart Line**:
A requested Variant or Bundle quantity plus any Personalization.

**Checkout**:
The server-authoritative act of validating current commercial truth and placing an Order from a Cart.

**Discount Rule**:
A merchant-defined eligibility and calculation policy that reduces an Order total without changing catalog prices. Redemption capacity is a counter on the rule, not a ledger.
_Avoid_: Coupon

**Delivery Option**:
A currently available Pickup or Delivery choice and its quoted fee.

**Commercial Snapshot**:
Immutable customer-visible product, selection, personalization, pricing, discount, and delivery facts preserved on the Order Line when an Order is placed.

## Inventory

**Stock Item**:
The inventory account for one Variant in a store's shared inventory pool, tracked as atomic on-hand and reserved counters.

**Available Quantity**:
A Stock Item's on-hand quantity minus its reserved quantity.

**Inventory Demand**:
The Stock Item quantities required by an Order Line; Bundle demand is expanded into its component Variants at placement.

## Ordering

**Order**:
The durable commercial commitment placed by a customer, containing immutable Commercial Snapshots and independently evolving payment and fulfillment state.
_Avoid_: Transaction

**Order Line**:
An immutable record of a purchased Variant or Bundle, its quantity, Personalization, and Commercial Snapshot.

**Order Token**:
The high-entropy token in the Order's URL that grants read access to one Order's status. It is the whole capability; there is no rotation or expiry machinery.

**Cancellation**:
The termination of an Order before fulfillment has passed the allowed cancellation boundary, recorded as a status with actor and timestamp.

## Payments

**Payment**:
One store-scoped attempt to collect money for an Order through QPay, bank transfer, or cash on delivery. An Order may retain multiple Payments but has at most one active collectible Payment. A Payment carries status, provider reference, and confirming actor/timestamp — not an entry ledger.
_Avoid_: Transaction

**Payment Evidence**:
A provider or staff-observed fact, such as a QPay settlement or transfer reference, validated before changing Payment truth. The provider remains the authority for automated payment state.

**Refund**:
A record that previously confirmed money was returned manually: a Payment status with note, actor, and timestamp. Execution is always manual.
_Avoid_: Refund Obligation

## Fulfillment

**Fulfillment**:
The operational journey that prepares an Order for courier handoff or customer Pickup, advanced by Staff through mode-valid status transitions.

**Pickup**:
Fulfillment in which the customer collects the Order from a merchant Location.

**Delivery**:
Fulfillment in which the merchant hands the Order to a courier for a snapshotted address and fee.

## Customers and access

**Customer**:
An optional, store-scoped identity established by a verified phone number (SMS OTP) and used for Order history.
_Avoid_: Account, User

**Guest Order**:
An Order placed without a Customer identity; its contact details remain an immutable snapshot, reachable through its Order Token.

**Staff Member**:
A store-scoped authenticated operator acting under an assigned role: Owner, Manager, or Staff.

**Telegram Operator**:
A founder-allowlisted numeric Telegram user ID permitted to confirm or reject manual-transfer Payments. Telegram is a convenience channel, never Staff identity or financial truth.
