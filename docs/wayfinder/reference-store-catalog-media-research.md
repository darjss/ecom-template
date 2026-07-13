# Fictional reference-store catalog and media research

**Status:** research draft for [Research the fictional reference-store catalog and media dataset](https://github.com/darjss/ecom-template/issues/29), retrieved 2026-07-14. It proposes inputs for [Prototype the fictional reference store and canary fixture](https://github.com/darjss/ecom-template/issues/28); it is not the accepted fixture contract and contains no downloaded media.

## Source boundary

### Sourced facts

- The founder-approved commerce contract requires integer-MNT prices; at least one Variant per Product; immutable published SKUs and option combinations; Bundles made from fixed Variant quantities with derived inventory; non-commercial text/select/checkbox Personalization; and store-scoped Categories, Collections, Tags, Discounts, inventory, Orders, Payments, and Fulfillments. The accepted [commerce model](https://github.com/darjss/ecom-template/blob/ce2a500/docs/wayfinder/commerce-domain-model.md) and [canonical language](https://github.com/darjss/ecom-template/blob/ce2a500/CONTEXT.md) are normative.
- The accepted [Store Profile, CMS, Theme, and Media contract](https://github.com/darjss/ecom-template/blob/d6b78a9/docs/wayfinder/store-profile-cms-media-contract.md) requires deterministic repository-owned fixtures, generated WebP media, immutable R2 objects, contextual alt text on usages, no provenance rows in D1, no seeded operational history, and normal commerce commands for scenarios.
- The accepted local [search contract](./search-contract-research.md) defines normalization, exact compact SKU lookup, native/strict/basic transliteration stages, live availability hydration, publication filtering, and the required synthetic proof boundary.
- The National Statistics Office's June 2026 Ulaanbaatar selected-commodity averages were rice 4,984 MNT/kg, packaged domestic first-grade flour 2,512 MNT/kg, domestic carton milk 5,059 MNT/litre, imported vegetable oil 12,193 MNT/litre, laundry powder 8,612 MNT/800 g, dishwashing liquid 6,859 MNT/500 ml, and sugar 5,125 MNT/kg. These are survey averages, not merchant quotes or prescribed fixture prices. Source: NSO, [Average price of main selected commodities](https://data.1212.mn/pxweb/en/NSO/NSO__Economy,%20environment__Consumer%20Price%20Index/DT_NSO_0600_019V1.px/), API selection `Ulaanbaatar city / 2026-06`, retrieved 2026-07-14.
- Blender states that its GPL applies to Blender, not artwork created with it, and that generated artwork remains the creator's property. This does not grant rights to third-party models, textures, fonts, or logos put into a scene. Source: Blender Foundation, [Blender License](https://www.blender.org/about/license/), retrieved 2026-07-14.
- Poly Haven states that all of its assets are CC0. CC0 attempts to waive copyright and related rights, but its legal code does not waive trademark or patent rights and supplies no warranties. Sources: Poly Haven, [License](https://polyhaven.com/license), and Creative Commons, [CC0 1.0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), retrieved 2026-07-14.
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

The recommended food and cleaning prices are deliberately rounded fixture decisions close to, but not copied from, the NSO anchors. Tote, notebook, Bundle, delivery, Discount, stock, and weight values are purely synthetic recommendations.

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

## Proposed media source/license manifest

No external asset is needed. The reference-store prototype should create and review the following source recipes and outputs; paths are recommendations, not files created by this research.

| Asset IDs / outputs | Repository source recipe | Source URL | Author | License | Retrieval | Permitted repository use |
| --- | --- | --- | --- | --- | --- | --- |
| `logo` → 1024×1024 WebP; `favicon` → 128×128 PNG | Original geometric `48`/shelf source in `fixtures/reference-store/media/source/brand-mark.svg`; no font outlines or borrowed marks; SVG remains build source and is not uploaded | None; repository-original | Recorded fixture-media contributor | `CC0-1.0`, affirmed in a fixture-specific notice at creation | n/a; creation date recorded | Commit and modify source; upload declared outputs to fixture R2; use and redistribute in screenshots, docs, and generated Stores |
| `hero` → 2400×1350 WebP; `og-fallback` → 1200×630 WebP | Deterministic Blender scene of abstract apartment shelving, bags, and unbranded packages; fixed camera/material/light seeds | None; repository-original | Recorded fixture-media contributor | `CC0-1.0` | n/a; creation date recorded | Same |
| `p01`–`p06`, `p08`, `p09` → 1600×1200 WebP | One Blender Python generator using only primitive geometry, procedural materials, original label shapes, and recipe JSON; no text, external mesh, texture, HDRI, or bundled demo file | None; repository-original | Recorded fixture-media contributor | `CC0-1.0` | n/a; creation date recorded | Same |
| `p07-sand`, `p07-sky` → 1600×1200 WebP | Original cloth-like geometry generated in the same script; color recipes match Variant swatches | None; repository-original | Recorded fixture-media contributor | `CC0-1.0` | n/a; creation date recorded | Same |
| `b01`, `b02` → 1600×1200 WebP | New composition renders from the same repository-owned component scenes, not collaged merchant packshots | None; repository-original | Recorded fixture-media contributor | `CC0-1.0` | n/a; creation date recorded | Same |
| Blender rendering tool | Blender release pinned by the reference-store prototype | https://www.blender.org/about/license/ | Blender contributors | GPL for the tool; not the original output | 2026-07-14 | Use the tool to generate fixture outputs; do not import or redistribute bundled third-party demo assets |

Pin Blender major/minor version, render engine, color-management settings, seeds, recipe hash, output dimensions, and output SHA-256 in the eventual manifest. Render lossless masters locally, export committed WebP, and upload unchanged bytes under immutable keys. Alt text stays on each Catalog/CMS usage, for example `Элсний шар өнгийн том даавуун цүнх` or `Угаалгын нунтаг, аяга таваг угаагч шингэн бүхий цэвэрлэгээний хослол`; it is not Media Asset metadata.

If original procedural work proves insufficient, Poly Haven is the only researched fallback: select one specific CC0 surface or HDRI, pin its per-asset URL, displayed author, downloaded-file hash, CC0 version, retrieval date, and transformation recipe. Do not rely only on the library-wide license page. The direct recommendation remains **zero external inputs**.

### Rejected source notes

- **Any prospect or merchant catalog, including Rozie Store:** reject without inspection or adaptation. Product names, assortment, copy, prices, photography, logo, layout, and identity must not be used as a reference dataset.
- **Marketplaces, image search results, social posts, manufacturer packshots, and recognizable branded packaging:** reject because the fixture cannot establish a clean repository-use grant and would import real identity.
- **Unsplash/Pexels-style stock photography:** reject for the baseline even where a platform grants broad use; it is unnecessary, not repository-original, and may introduce people, property, or brand review. Unsplash uses its own license rather than CC0. Source: Unsplash, [License](https://unsplash.com/license), retrieved 2026-07-14.
- **Poly Haven assets:** legally viable as the documented CC0 fallback, but reject from the baseline to keep the fixture reproducible without downloads and to avoid provenance work that procedural scenes do not need.
- **Blender splash scenes, demo `.blend` files, BlenderKit, add-ons that inject assets, downloaded fonts, HDRIs, meshes, or textures:** reject. Blender's output rule does not cleanse rights in third-party scene inputs.
- **Generative-image services or model outputs:** reject unless the reference-store prototype separately proves the service terms, model/output rights, prompts, and absence of copied marks or identifiable people. No such source is needed here.

## Strict fictional-identity rules

1. Reserve `wf29`, `WF29-`, `wf29.*`, and `fixturePurpose: reference-canary` for every stable fixture/scenario key; reject those prefixes from merchant imports.
2. Keep the legal-name suffix `зохиомол жишиг өгөгдөл, бүртгэлгүй` and an environment-visible notice: `Энэ бол зохиомол жишиг дэлгүүр. Бодит захиалга хүлээн авахгүй.` Never present it as an incorporated or operating merchant.
3. Use only `.invalid` email/domain values in committed fixture data. Do not invent a dialable phone number. Store and Location phones remain null.
4. Customer/recipient phone input is a runtime secret reference to a dedicated allow-listed canary SMS sink, never a literal in Git, logs, screenshots, docs, or fixtures. If no controlled sink exists, report the phone/OTP scenario blocked; never send to a guessed valid-format number.
5. Synthetic people use role labels such as `Жишиг Худалдан авагч 29`, `Жишиг Хүлээн авагч 29`, and `Жишиг Ажилтан 29`, never realistic full names. Addresses must contain `Зохиомол`, `Канар`, and `бодит хаяг биш`; map links and geocodable coordinates remain absent.
6. Payment records use `WF29-QPAY-*`, `WF29-TRANSFER-*`, `WF29-COD-*`, and non-numeric `TEST-MNT-WF29` references. Real account numbers, QR payloads, provider customer IDs, card-like numbers, and production credentials are forbidden. Provider sandbox/test bindings remain secrets and must fail closed when absent.
7. Orders, Customers, Payments, Refunds, inventory evidence, and tracking links are created only by scenario commands. Names, notes, reasons, idempotency keys, and external references all retain the `WF29` marker; bearer secrets never appear in snapshots.
8. Do not assign GTINs, real company registration numbers, postal codes, bank names, certification marks, health claims, origin claims beyond generic fixture copy, or third-party trademarks.
9. Media contains no people, signatures, handwriting, real streets/interiors, logos, barcodes, QR codes, text generated from an external font, or recognizable product trade dress.
10. The reference-store prototype should add a manifest lint/inspection step that rejects unapproved remote URLs and scans text/SKUs/references for missing `WF29`/fictional markers. This is fixture validation, not a shared-kernel exception.

## Direct recommendation for the reference-store prototype

Search-check and human-approve **Өрнүүн 48** as a fictional candidate before freezing it; if any merchant, company, or mark collision appears, replace the display identity while preserving the `WF29` namespace. Prototype this exact 9-Product/2-Bundle matrix first. Browser-review the Homepage, search/autocomplete, Category/Collection pages, P05 size selection, P07 size/color and live stock, P08 all three Personalization controls, both Bundle pages, Cart/Checkout, pickup/delivery, and the relevant Admin catalog/inventory views at desktop and mobile widths. Use the procedural Blender direction and no external media.

[Prototype the fictional reference store and canary fixture](https://github.com/darjss/ecom-template/issues/28) may change the name, visual direction, copy, or prices after human review, but it should preserve the coverage properties and stable semantic keys: Default Variant, complete size/color combinations, inherited and overridden prices, Unicode compact SKU, available/low/out Variants, available/out derived Bundles, all Personalization types, manual groupings, both Discount modes, native/strict/basic search, cached presentation with live availability, and every operational journey above. The prototype ticket's resolution—not this draft—should freeze the reviewed canonical values and media hashes.
