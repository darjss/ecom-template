# Mongolian Ecommerce

The shared language for catalog, ordering, payment, and fulfillment within each independently deployed merchant store.

## Catalog

**Catalog Item**:
A Product or Bundle that may be grouped for navigation, merchandising, discounts, and search.

**Product**:
A customer-facing catalog concept that always contains at least one Variant.

**Option Group**:
A Product-defined customer choice, such as size or color, whose allowed Option Values determine valid Variants.

**Option Value**:
One allowed selection within an Option Group.

**Variant**:
The purchasable inventory identity of a Product. A Product without customer-selectable options has one Default Variant.
_Avoid_: Product SKU

**Default Variant**:
The sole, implicit Variant of a Product with no customer-selectable options; customer and merchant interfaces may present it as the Product itself.

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
A merchant-defined eligibility and calculation policy that produces explicit Discount Adjustments without changing catalog prices.
_Avoid_: Coupon, when referring to the rule itself

**Discount Adjustment**:
An immutable reduction allocated to an Order or Order Line, including its reason and source rule.

**Discount Redemption Entry**:
An immutable claim or compensating release against a Discount Rule's global redemption capacity.

**Delivery Option**:
A currently available Pickup or Delivery choice and its quoted fee.

**Commercial Snapshot**:
Immutable customer-visible product, selection, personalization, pricing, discount, tax, and delivery facts preserved when an Order is placed.

## Inventory

**Stock Item**:
The inventory account for one Variant in a store's shared inventory pool.

**Inventory Reservation**:
A temporary, Order-owned claim on Stock Items that prevents the same available units from being promised twice.
_Avoid_: Stock hold

**Inventory Demand**:
The normalized Stock Item quantities required by an Order Line; Bundle demand is expanded into its component Variants.

**Inventory Entry**:
An immutable increase, decrease, reservation, release, or consumption recorded against a Stock Item.
_Avoid_: Stock edit

**Inventory Ledger**:
The ordered history of Inventory Entries explaining a Stock Item's on-hand and reserved balances.

**Available Quantity**:
A Stock Item's on-hand quantity minus quantity claimed by active Inventory Reservations.

## Ordering

**Order**:
The durable commercial commitment placed by a customer, containing immutable Commercial Snapshots and independently evolving payment and fulfillment state.
_Avoid_: Transaction

**Order Line**:
An immutable record of a purchased Variant or Bundle, its quantity, Personalization, Inventory Demand, and Commercial Snapshot.

**Cancellation**:
The audited termination of an Order before fulfillment has passed the allowed cancellation boundary.

## Payments

**Payment**:
One store-scoped attempt to collect money for an Order through QPay, bank transfer, or cash on delivery. An Order may retain multiple Payments but has at most one active collectible Payment.
_Avoid_: Transaction

**Payment Evidence**:
A provider or staff-observed fact, such as a QPay settlement or transfer reference, that the shared kernel validates before changing Payment truth.

**Financial Entry**:
An immutable expected, confirmed, or refunded money movement recorded against a Payment.

**Financial Ledger**:
The ordered history of Financial Entries explaining confirmed and refunded amounts for an Order.

**Refund Obligation**:
An audited requirement to return confirmed money after an Order decision such as Cancellation.

**Refund**:
An immutable record that previously confirmed money was returned manually.

## Fulfillment

**Fulfillment**:
The operational journey that prepares an Order for courier handoff or customer Pickup.

**Pickup**:
Fulfillment in which the customer collects the Order from a merchant Location.

**Delivery**:
Fulfillment in which the merchant hands the Order to a courier for a snapshotted address and fee.

**Delivery Failed**:
A deliberate final-failure and return-initiated Fulfillment state after courier handoff, not an ordinary unsuccessful delivery attempt.

**Returned**:
A Fulfillment state confirming that an unsuccessfully delivered Order is physically back in merchant custody.

## Customers and access

**Customer**:
An optional, store-scoped identity established by a verified phone number and used for Order history.
_Avoid_: Account, User

**Guest Order**:
An Order placed without a Customer identity; its contact details remain an immutable snapshot.

**Guest Tracking Link**:
A time-limited capability that grants narrow read access to one Guest Order without creating or authenticating a Customer.

**Staff Member**:
A store-scoped authenticated operator acting under an assigned role.
_Avoid_: Customer User

## Evidence and concurrency

**Domain Event**:
An immutable fact emitted after the shared kernel accepts a domain transition.

**Audit Event**:
An immutable operator-readable record of who or what attempted or caused a consequential change and why.

**Revision**:
A monotonic aggregate version required by mutating commands to prevent lost updates.
