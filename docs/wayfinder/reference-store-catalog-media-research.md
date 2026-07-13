# Fictional reference-store catalog and media research

**Status:** revised research recommendation for [Research the fictional reference-store catalog and media dataset](https://github.com/darjss/ecom-template/issues/29), retrieved 2026-07-14 and updated after founder feedback. It proposes inputs for [Prototype the fictional reference store and canary fixture](https://github.com/darjss/ecom-template/issues/28); it is not the accepted fixture contract and contains no downloaded or generated media.

## Source boundary

### Sourced facts

- The founder-approved commerce contract requires integer-MNT prices; at least one Variant per Product; immutable published SKUs and option combinations; Bundles made from fixed Variant quantities with derived inventory; non-commercial text/select/checkbox Personalization; and store-scoped Categories, Collections, Tags, Discounts, inventory, Orders, Payments, and Fulfillments. The accepted [commerce model](https://github.com/darjss/ecom-template/blob/ce2a500/docs/wayfinder/commerce-domain-model.md) and [canonical language](https://github.com/darjss/ecom-template/blob/ce2a500/CONTEXT.md) are normative.
- The accepted [Store Profile, CMS, Theme, and Media contract](https://github.com/darjss/ecom-template/blob/d6b78a9/docs/wayfinder/store-profile-cms-media-contract.md) requires deterministic repository-owned fixtures, generated WebP media, immutable R2 objects, contextual alt text on usages, no provenance rows in D1, no seeded operational history, and normal commerce commands for scenarios.
- The accepted local [search contract](./search-contract-research.md) defines normalization, exact compact SKU lookup, native/strict/basic transliteration stages, live availability hydration, publication filtering, and the required synthetic proof boundary.
- Image generation is allowed. OpenAI's business terms say the customer owns generated Output as between the customer and OpenAI, to the extent permitted by law; the API supports direct WebP output. Sources: OpenAI, [Services Agreement §4](https://openai.com/policies/services-agreement/) and [Image generation API](https://developers.openai.com/api/docs/guides/image-generation), retrieved 2026-07-14.
- `.invalid` is permanently reserved for names intended to be visibly invalid. Source: IETF, [RFC 2606 §2](https://www.rfc-editor.org/rfc/rfc2606#section-2), retrieved 2026-07-14.

Everything below is a **design recommendation**, not an external fact.

## Recommended fictional Store

Use **Өрнүүн 48** as a compact Ulaanbaatar apartment-household general store: pantry staples, cleaning supplies, a reusable carry item, and a small gift/stationery item. The number and `WF29` namespace make the fixture recognizable without imitating a merchant.

| Field | Recommended fixture value |
| --- | --- |
| `storeKey` | `wf29-urnuun48` |
| Display name | `Өрнүүн 48` |
| Legal-name display | `Өрнүүн 48 — зохиомол жишиг өгөгдөл, бүртгэлгүй` |
| Tagline | `Өдөр бүрийн хэрэгцээг цэгцтэй` |
| Summary | `Гал тогоо, гэр ахуй, жижиг бэлгийн хэрэгцээг нэг дороос сонгох зохиомол жишиг дэлгүүр.` |
| Email | `sainuu@urnuun48.invalid` |
| Public phone/social/map URL | Omit all three |
| Pickup Location | `Өрнүүн 48 — жишиг цэг`; `Улаанбаатар хот, Зохиомол дүүрэг, Канар гудамж 29 (бодит хаяг биш)`; `Даваа–Ням 09:00–21:00 (жишиг)` |
| Delivery | Ulaanbaatar flat fee 6,000 MNT; free at post-discount merchandise subtotal 120,000 MNT; Pickup free |
| House brand text | `Ө48 Өдөр`, `Ө48 Гэр`, or `Ө48 Бэлэг`; no separate Brand aggregate is implied |
| Announcement | `120,000₮-өөс дээш захиалгад хүргэлт үнэгүй — жишиг дэлгүүр` |

Physical weight below is a count-based fulfillment/display attribute only. It must not create fractional quantity or weight-priced delivery.

## Compact canonical fixture matrix

### Groupings and Discounts

- Categories: `хүнс`; `гэр-ахуй` with children `цэвэрлэгээ`, `цүнх-хадгалалт`, and `бичиг-хэрэг`.
- Ordered Collections: `өдөр-тутмын-хэрэгцээ` = P01–P07, P09, B01; `шинэ-гэр` = P05–P08, B01; `бэлэглэхэд-бэлэн` = P07, P08.
- Flat Tags: `үндсэн-хүнс`, `хөргөлттэй`, `цэвэрлэгээ`, `дахин-ашиглана`, `бэлэг`, `жишиг-сонголт`. Collections remain manual; none derives from stock.
- Brand text: P01–P04 and P09 use `Ө48 Өдөр`; P05–P07, B01, and B02 use `Ө48 Гэр`; P08 uses `Ө48 Бэлэг`.
- `D01 / WF29-5000`: active code, fixed 5,000 MNT, targets `шинэ-гэр`, minimum eligible subtotal 30,000 MNT, global limit 29. Submitted valid code wins.
- `D02 / AUTO-WF29-7`: active automatic 7%, whole catalog, minimum merchandise subtotal 50,000 MNT. Exactly one Discount applies under the commerce contract.

### Catalog Items

| Key | Published Mongolian name and short copy | Category; Collections; Tags | Personalization | Discount |
| --- | --- | --- | --- | --- |
| P01 | **Өглөөний цагаан будаа, 1 кг.** `Өдөр тутмын хоолонд зориулсан, дахин битүүмжилдэг ууттай цагаан будаа.` | `хүнс`; `өдөр-тутмын-хэрэгцээ`; `үндсэн-хүнс`, `жишиг-сонголт` | — | D02 |
| P02 | **Дотоодын I зэргийн гурил, 1 кг.** `Банш, гурилан хоол болон өдөр тутмын жигнэлтэд хэрэглэх савласан гурил.` | `хүнс`; `өдөр-тутмын-хэрэгцээ`; `үндсэн-хүнс` | — | D02 |
| P03 | **Савласан сүү, 1 л.** `Хөргөлттэй хадгалах, өдөр тутмын хэрэглээний савласан сүү.` | `хүнс`; `өдөр-тутмын-хэрэгцээ`; `хөргөлттэй`, `жишиг-сонголт` | — | D02 |
| P04 | **Ургамлын тос, 1 л.** `Хоол хийхэд зориулсан нэг литрийн савлагаатай ургамлын тос.` | `хүнс`; `өдөр-тутмын-хэрэгцээ`; `үндсэн-хүнс` | — | D02 |
| P05 | **Үнэргүй угаалгын нунтаг.** `Өдөр тутмын хувцас угаалтад зориулсан хоёр хэмжээтэй нунтаг.` | `цэвэрлэгээ`; `өдөр-тутмын-хэрэгцээ`, `шинэ-гэр`; `цэвэрлэгээ`, `жишиг-сонголт` | — | D01/D02 |
| P06 | **Аяга таваг угаагч шингэн, 500 мл.** `Гал тогооны өдөр тутмын цэвэрлэгээнд зориулсан шингэн.` | `цэвэрлэгээ`; `өдөр-тутмын-хэрэгцээ`, `шинэ-гэр`; `цэвэрлэгээ` | — | D01/D02 |
| P07 | **Өдөр тутмын даавуун цүнх.** `Хоёр хэмжээ, хоёр өнгөөс сонгох, эвхэж авч явах даавуун цүнх.` | `цүнх-хадгалалт`; all three Collections; `дахин-ашиглана`, `бэлэг`, `жишиг-сонголт` | — | D01/D02 |
| P08 | **Нэртэй тэмдэглэлийн дэвтэр.** `Нүүрний богино бичвэр, боодлын туузыг сонгон бэлдэх дэвтэр.` | `бичиг-хэрэг`; `шинэ-гэр`, `бэлэглэхэд-бэлэн`; `бэлэг` | `cover_name`: optional text, 0–24 characters; `ribbon_color`: required select of `Элсний шар`, `Тэнгэрийн хөх`, `Навчин ногоон`; `without_price_tag`: optional checkbox | D01/D02 |
| P09 | **Ёотон сахар, 500 г.** `Цай, кофенд хэрэглэх жижиг савлагаатай ёотон сахар.` | `хүнс`; `өдөр-тутмын-хэрэгцээ`; `үндсэн-хүнс` | — | D02 |
| B01 | **Цэвэрлэгээний хослол.** `Угаалгын нунтаг 800 г болон аяга таваг угаагч шингэний тогтмол багц.` | `цэвэрлэгээ`; `өдөр-тутмын-хэрэгцээ`, `шинэ-гэр`; `цэвэрлэгээ` | — | D01/D02 |
| B02 | **Гал тогооны нөөц багц.** `Хоёр будаа, нэг гурил, нэг ургамлын тос бүхий тогтмол багц.` | `хүнс`; —; `үндсэн-хүнс` | — | D02 |

Personalization labels and selected values are snapshotted, but never change SKU, price, quantity, or demand. The 24-character limit and three select values are fixture bounds subject to the future platform hard cap.

### Variants, prices, stock, and shipping attributes

`inherit` means Product base price; `override` exercises Variant pricing. “Low” is a scenario assertion for on-hand `1..3`, not a persisted commerce state. Published zero-stock items remain visible but unsellable through live availability.

| Item / Variant | Immutable fixture SKU | Base / resolved price | Initial on-hand | Gross ship weight | Canary state |
| --- | --- | ---: | ---: | ---: | --- |
| P01 Default | `WF29-RICE-1K` | 5,400 / inherit | 20 | 1,050 g | available |
| P02 Default | `WF29-FLOUR-1K` | 2,900 / inherit | 30 | 1,050 g | available |
| P03 Default | `WF29-MILK-1L` | 5,500 / inherit | 3 | 1,080 g | low |
| P04 Default | `WF29-OIL-1L` | 12,900 / inherit | 0 | 1,050 g | out |
| P05 `Жин: 800 г` | `WF29-WASH-800` | 9,500 / inherit | 8 | 850 g | available |
| P05 `Жин: 1.6 кг` | `WF29-WASH-1600` | 9,500 / **17,900 override** | 0 | 1,680 g | out variant |
| P06 Default | `WF29-DISH-500` | 7,500 / inherit | 12 | 560 g | available |
| P07 `Хэмжээ: Жижиг; Өнгө: Элсний шар` | `WF29-TOTE-S-SAND` | 18,900 / inherit | 7 | 190 g | available |
| P07 `Хэмжээ: Том; Өнгө: Элсний шар` | `WF29-TOTE-L-SAND` | 18,900 / **22,900 override** | 2 | 260 g | low variant |
| P07 `Хэмжээ: Жижиг; Өнгө: Тэнгэрийн хөх` | `WF29-TOTE-S-SKY` | 18,900 / inherit | 4 | 190 g | available |
| P07 `Хэмжээ: Том; Өнгө: Тэнгэрийн хөх` | `WF29-TOTE-L-SKY` | 18,900 / **22,900 override** | 0 | 260 g | out variant |
| P08 Default | `WF29-Ө-001` | 14,900 / inherit | 15 | 320 g | personalized |
| P09 Default | `WF29-YO-500` | 2,700 / inherit | 10 | 530 g | available |
| B01 Bundle | `WF29-BND-CLEAN` | 15,900 | derived 8 | derived 1,410 g | available |
| B02 Bundle | `WF29-BND-PANTRY` | 24,900 | derived 0 | derived 4,200 g | out via P04 |

Bundle definitions are fixed at first publication:

- B01 demand: `1 × P05/WF29-WASH-800 + 1 × P06/WF29-DISH-500`.
- B02 demand: `2 × P01/WF29-RICE-1K + 1 × P02/WF29-FLOUR-1K + 1 × P04/WF29-OIL-1L`.

All prices, delivery fees, Discounts, stock, and weights are simple synthetic estimates. They only need to feel plausible in the prototype.

## Search and normalization canaries

| Query | Expected proof |
| --- | --- |
| `Өдөр тутмын даавуун цүнх` | native, title, high confidence → P07 |
| `ödör tutmyn daavuun tsünkh` | strict transliteration → P07 |
| `oedoer tutmyn daavuun tsuenkh` | strict ASCII transliteration → P07 |
| `odor tutmyn daavuun tsunh` | bounded basic fallback, low confidence → P07; never silently reported as native |
| `  ҮНЭРГҮЙ—УГААЛГЫН　НУНТАГ ` | NFKC/case/punctuation/Unicode-whitespace normalization → P05; display query unchanged |
| `yooton sakhar` | strict `Ёотон сахар` recovery → P09; native `ё` and `е` remain distinct |
| `ｗｆ２９／Ө／００１` and `wf29-ө-001` | compatibility normalization plus exact compact SKU key `wf29ө001` → P08 |
| `wf29o001` | no exact SKU match; Latin `o` must not equal Cyrillic `ө` |
| `угаалгын нунтаг` with `category=цэвэрлэгээ` | P05 before description-only matches; Product results before shortcuts |
| unpublished clone `WF29-DRAFT-001` | never returned |

Keep names, descriptions, brand text, Variant labels, Categories, Collections, and Tags in the search projection; never put raw stock counts there.

## Synthetic operational scenario matrix

Initial seed contains catalog/CMS/configuration and legitimate initial Inventory Entries only—no Orders, Customers, Payments, sessions, tracking links, or Refunds. Scenario tooling provisions or resets clean resources, then invokes ordinary APIs/commands with stable scenario keys and generated database IDs.

| Stable scenario key | Commands/data created | Required assertion |
| --- | --- | --- |
| `wf29.search.tiers` | Run the table above plus category/collection shortcut queries | source/confidence, punctuation, compact Unicode SKU, publication filtering, deterministic ordering, and no stock leakage |
| `wf29.bundle.reserve` | Place quantity 2 of B01 | demand reserves two `WASH-800` and two `DISH-500`; remaining derived Bundle availability is 6; B02 remains unavailable because P04 is zero |
| `wf29.cache.live-stock` | Warm P03 HTML; place a reservation consuming all 3; release it | cached HTML contains no authoritative stock and remains reusable; batched no-store availability changes available → unavailable → available |
| `wf29.guest.qpay-transfer` | Anonymous Delivery Order: P07 large/sand 22,900 + personalized P08 14,900; apply `WF29-5000`; fee 6,000 | fixed Discount allocates exactly 3,029/1,971; total is 38,800; Pending QPay becomes Superseded, one 38,800 Awaiting Confirmation transfer is created, confirmation consumes both Variants, then Processing → Ready → Handed Off → Fulfilled → Completed |
| `wf29.cod.pickup` | Anonymous Pickup Order: 2 × P01 + 1 × P03; COD | total 16,300 and fee 0; `AcceptCodOrder` consumes inventory without confirming cash; Pickup and exact cash confirmation permit completion |
| `wf29.cancel.refund` | Delivery Order for B01; confirm QPay; cancel before handoff; record Refunds 10,000 then 11,900 | total 21,900; component inventory is restored; Refund Obligation is 21,900; immutable Refund evidence closes it without rewriting Payment confirmation |
| `wf29.customer.link` | Place Guest Order using the runtime canary-phone reference; verify the same phone; link | one Customer gains the eligible Guest Order; recipient snapshot is unchanged; Guest Tracking Link remains order-scoped/private |
| `wf29.stock.race` | Two concurrent placements each request quantity 2 of P07 large/sand | exactly one complete reservation wins; Available Quantity never goes negative |

For the personalization Order, use `cover_name = "ЖИШИГ 29"`, `ribbon_color = "Тэнгэрийн хөх"`, and `without_price_tag = true`; also prove missing required select and a 25-character text are rejected.

## Media recommendation

Use a good image-generation model to create consistent fictional product photography. OpenAI GPT Image is a straightforward default, but the prototype can use another model if its output is better.

For each approved image, keep one small manifest row:

| Field | Value |
| --- | --- |
| Asset | Stable Product, Variant, Bundle, Hero, logo, or fallback key |
| Source | Generated, original photography, or exact licensed-photo URL |
| Rights | Provider terms or specific photo license |
| Provenance | Model, prompt, generation date, and final file hash |
| Use | May be committed, uploaded to fixture R2, and shown in the reference Store |

Generate clean studio photos with one consistent art direction. Do not use real merchant images as references. Avoid people, existing brands, logos, barcodes, readable packaging text, and recognizable trade dress. Review the final images for obvious generation errors and brand leakage, then commit only the selected WebPs.

Original photography and clearly licensed photos are also fine. Record the photographer or exact asset URL and license. Marketplace images, social posts, manufacturer packshots, and prospect photos remain excluded.

## Strict fictional-identity rules

1. Reserve `wf29`, `WF29-`, `wf29.*`, and `fixturePurpose: reference-canary` for every stable fixture/scenario key; reject those prefixes from merchant imports.
2. Keep the legal-name suffix `зохиомол жишиг өгөгдөл, бүртгэлгүй` and an environment-visible notice: `Энэ бол зохиомол жишиг дэлгүүр. Бодит захиалга хүлээн авахгүй.` Never present it as an incorporated or operating merchant.
3. Use only `.invalid` email/domain values in committed fixture data. Do not invent a dialable phone number. Store and Location phones remain null.
4. Customer/recipient phone input is a runtime secret reference to a dedicated allow-listed canary SMS sink, never a literal in Git, logs, screenshots, docs, or fixtures. If no controlled sink exists, report the phone/OTP scenario blocked; never send to a guessed valid-format number.
5. Synthetic people use role labels such as `Жишиг Худалдан авагч 29`, `Жишиг Хүлээн авагч 29`, and `Жишиг Ажилтан 29`, never realistic full names. Addresses must contain `Зохиомол`, `Канар`, and `бодит хаяг биш`; map links and geocodable coordinates remain absent.
6. Payment records use `WF29-QPAY-*`, `WF29-TRANSFER-*`, `WF29-COD-*`, and non-numeric `TEST-MNT-WF29` references. Real account numbers, QR payloads, provider customer IDs, card-like numbers, and production credentials are forbidden. Provider sandbox/test bindings remain secrets and must fail closed when absent.
7. Orders, Customers, Payments, Refunds, inventory evidence, and tracking links are created only by scenario commands. Names, notes, reasons, idempotency keys, and external references all retain the `WF29` marker; bearer secrets never appear in snapshots.
8. Do not assign GTINs, real company registration numbers, postal codes, bank names, certification marks, health claims, origin claims beyond generic fixture copy, or third-party trademarks.
9. Media contains no people, signatures, handwriting, real streets/interiors, third-party logos, barcodes, QR codes, certification marks, readable model-generated packaging text, or recognizable product trade dress.
10. The reference-store prototype should add a manifest inspection step that rejects unapproved remote/reference URLs, missing generation records, and text/SKUs/references without `WF29`/fictional markers. This is fixture validation, not a shared-kernel exception.

## Direct recommendation for the reference-store prototype

Search-check and human-approve **Өрнүүн 48** as a fictional candidate before freezing it; if any merchant, company, or mark collision appears, replace the display identity while preserving the `WF29` namespace. Prototype this exact 9-Product/2-Bundle matrix first. Browser-review the Homepage, search/autocomplete, Category/Collection pages, P05 size selection, P07 size/color and live stock, P08 all three Personalization controls, both Bundle pages, Cart/Checkout, pickup/delivery, and the relevant Admin catalog/inventory views at desktop and mobile widths. Use reviewed image-generated product photography; do not use Blender or real merchant imagery.

[Prototype the fictional reference store and canary fixture](https://github.com/darjss/ecom-template/issues/28) may change the name, visual direction, copy, or prices after human review, but it should preserve the coverage properties and stable semantic keys: Default Variant, complete size/color combinations, inherited and overridden prices, Unicode compact SKU, available/low/out Variants, available/out derived Bundles, all Personalization types, manual groupings, both Discount modes, native/strict/basic search, cached presentation with live availability, and every operational journey above. The prototype ticket's resolution—not this draft—should freeze the reviewed canonical values and media hashes.
