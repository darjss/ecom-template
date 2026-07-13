# Өрнүүн 48 reference-store prototype contract

**Status:** candidate contract for [Prototype the fictional reference store and canary fixture](https://github.com/darjss/ecom-template/issues/28), pending the required browser review. The interactive prototype is `/prototype/urnuun48` in development builds.

## Decision

Use **Өрнүүн 48** as the completely fictional Reference Store. It is a compact Ulaanbaatar apartment-household general store whose pantry staples, cleaning supplies, reusable carry item, stationery gift, and fixed Bundles cover the shared commerce kernel without resembling a real merchant.

The accepted visual direction is **Pantry shelf**. The storefront uses a modular pale-birch shelf, warm cream ground, tomato-red commerce actions, butter-yellow signals, leaf-green availability, warm-navy trust surfaces, and bright apartment-kitchen product photography. It remains product-first and keeps search, MNT prices, availability, options, Cart, and Checkout conventional.

Visual direction probes: [A, B, and C comparison](https://html.darjs.dev/urnuun48-directions-jul14). Direction A is canonical. Direction C's compact row rhythm may inform search and repeat-purchase views. Direction B's room grouping may appear only as occasional Collection merchandising.

## Store Profile

| Field              | Canonical value                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `storeKey`         | `wf29-urnuun48`                                                                          |
| Display name       | `Өрнүүн 48`                                                                              |
| Legal display      | `Өрнүүн 48 — зохиомол жишиг өгөгдөл, бүртгэлгүй`                                         |
| Tagline            | `Өдөр бүрийн хэрэгцээг цэгцтэй`                                                          |
| Summary            | `Гал тогоо, гэр ахуй, жижиг бэлгийн хэрэгцээг нэг дороос сонгох зохиомол жишиг дэлгүүр.` |
| Email              | `sainuu@urnuun48.invalid`                                                                |
| Phone, social, map | omitted                                                                                  |
| Pickup Location    | `Өрнүүн 48 — жишиг цэг`                                                                  |
| Pickup address     | `Улаанбаатар хот, Зохиомол дүүрэг, Канар гудамж 29 (бодит хаяг биш)`                     |
| Hours              | `Даваа–Ням 09:00–21:00 (жишиг)`                                                          |
| Delivery           | Ulaanbaatar flat fee 6,000 MNT; free from 120,000 MNT post-discount merchandise subtotal |
| Notice             | `Энэ бол зохиомол жишиг дэлгүүр. Бодит захиалга хүлээн авахгүй.`                         |
| Fixture purpose    | `reference-canary`                                                                       |

`wf29`, `WF29-`, and `wf29.*` are reserved fixture namespaces and must be rejected from merchant imports.

## Canonical catalog

Freeze the exact catalog, grouping, Discount Rule, Variant, SKU, price, inventory, Personalization, search, and Bundle-demand values in [the accepted fixture matrix](./reference-store-catalog-media-research.md). It contains nine Products and two Bundles:

- Four Default Variant pantry staples plus milk, dish liquid, notebook, and sugar.
- P05 exercises size Variants and a price override.
- P07 exercises complete size/color combinations, price overrides, low stock, and an unavailable selection.
- P08 exercises optional text, required select, optional checkbox, and a Unicode SKU.
- B01 is available through component demand. B02 is unavailable because P04 is zero.
- D01 exercises a fixed code Discount Rule. D02 exercises one automatic percentage Discount Rule.

Initial seed content stops at Store Profile, CMS, catalog, grouping, Discounts, delivery configuration, Location, and legitimate opening Inventory Entries. It contains no Order, Customer, Payment, Refund, Fulfillment, session, tracking link, or operational history.

## Prototype verdict

The prototype demonstrates the following review surfaces without pretending to implement production behavior:

- Product-led Homepage with the Pantry shelf composition.
- Conventional search results with SKU and stock cues.
- P05 and P07 Variant selection, including changed image, price, low stock, and out-of-stock states.
- P08 bounded Personalization input.
- Available and unavailable Bundle presentation.
- Cart feedback and synthetic Checkout.
- Delivery and Pickup selection.
- QPay waiting state switched to bank transfer before confirmation.
- COD selection.
- Canary inspector for behavior that downstream implementation must prove with ordinary commands.

The prototype deliberately does not add D1 schema, APIs, authentication, real payment or SMS behavior, real Inventory transitions, edge caching, or a full Admin. Those are downstream implementation work.

## Media contract

The 14 selected WebP assets are generated with GPT Image 2 and recorded in the [media manifest](./reference-store-media-manifest.md). They contain no real merchant media, people, brands, readable packaging text, barcodes, QR codes, certification marks, known trade dress, or watermarks.

Product identity, names, prices, SKUs, options, and accessibility descriptions remain semantic data and HTML. Images never carry authoritative commerce facts. Downstream fixtures may regenerate sizes or crops, but changing an accepted image requires updating its manifest hash.

## Canary Scenarios

The following stable keys are canonical:

- `wf29.search.tiers`
- `wf29.bundle.reserve`
- `wf29.cache.live-stock`
- `wf29.guest.qpay-transfer`
- `wf29.cod.pickup`
- `wf29.cancel.refund`
- `wf29.customer.link`
- `wf29.stock.race`

Each scenario resets clean resources and invokes ordinary shared-kernel commands. Generated database IDs remain runtime values. Stable scenario keys provide lookup and idempotency, not persisted IDs. The exact commands and assertions remain those in the [fixture research matrix](./reference-store-catalog-media-research.md).

## Review gate

Before this contract becomes accepted, browser-review the prototype at mobile and desktop widths for:

- identity, Mongolian copy, and synthetic notices;
- Homepage hierarchy and responsive shelf behavior;
- search results and empty search;
- P05, P07, and P08 controls;
- both Bundle states;
- Cart and Checkout payment switching;
- keyboard focus, 200% zoom, reduced motion, and 44px touch targets;
- missing assets, overflow, console errors, and obvious media defects.

The browser review must wait for the orchestrator's sole browser lease. Until then, browser proof is blocked rather than simulated.
