# Store Profile, CMS, theme, and media contract

This document records founder-approved decisions for Wayfinder ticket #20. It is intentionally incomplete until the remaining theme, CMS schema, SEO, navigation, media lifecycle, initialization, and reference-fixture decisions are resolved.

## Ownership boundary

A Store is one independently deployed merchant application. Its repository-owned Store Profile is a small typed build-time contract. It owns:

- immutable store and application identity;
- Mongolian locale and MNT currency invariants;
- enabled shared-kernel capabilities;
- statically registered provider choices;
- non-secret operational limits and defaults;
- app-owned storefront entrypoints, Theme schema defaults, and the approved font catalog.

D1 owns merchant-editable public truth:

- storefront and legal identity;
- logos and other Media Assets;
- contacts, trust content, and Locations;
- navigation and SEO settings;
- the published Theme token document and selected approved fonts;
- announcements, banners, homepage sections, and policies;
- Catalog Items, groupings, merchandising, and delivery settings.

Worker bindings own secrets. Generated Wrangler configuration owns binding and deployment wiring.

A Store Profile is the compile-time capability ceiling rather than current merchant settings. Its closed, versioned definition contains stable `storeKey`, `mn-MN` locale, MNT currency, storefront entrypoint, Theme schema version, supported shared capabilities, statically registered adapter choices, and approved font IDs. D1 stores which supported capabilities are currently enabled and their non-secret merchant settings; a capability is available only when the Profile supports it, D1 enables it, and required secret bindings exist.

The Profile contains no Cloudflare resource IDs, domain, merchant copy, contacts, price, credentials, current operational settings, or arbitrary extension bag. Generated Wrangler configuration owns environment-specific deployment identity and bindings. Profile validation runs during app generation, build, and provisioning; unknown schema versions and unsupported combinations fail before deployment.

A Store Profile cannot redefine schema, commerce behavior, API semantics, authorization, pricing, inventory, checkout, Payment, Order, Fulfillment, migration ordering, or cache safety. Merchant content and Theme publication never require deployment. Storefront code, the Theme token schema and compiler, approved font catalog, capability ceiling, provider wiring, and other build-owned configuration do require deployment.

## Immediate publishing

D1 contains only current published CMS truth. V1 has no persisted CMS draft, schedule, release, or site-wide publish model.

Unsaved edits remain browser-local under the approved versioned draft and reconciliation contract. Preview renders those local values against the real app-owned storefront. Publishing sends one complete logical aggregate with its expected Revision. The D1 write is atomic, increments the Revision, and becomes the current published value immediately.

Logical publishing aggregates include:

- the Homepage and its ordered sections;
- one navigation menu;
- one policy page;
- store identity and contact settings;
- one announcement or banner.

A Revision conflict rejects the write for explicit reconciliation. A successful write is followed by targeted global cache purging. Publication is a D1 write plus cache invalidation, never a Worker deployment.

The CMS contract has no asynchronous cache-invalidation status or retry outbox. The publication request awaits its purge attempt. A purge failure is surfaced and logged as an operational error after the content is already durable; TTL expiry remains the fallback.

## Bounded CMS content

The Homepage is one aggregate containing an ordered composition of bounded shared section types rather than a free-form page builder or one fixed record. V1 section types are Hero, Featured Collection, Product Rail, Promotion Grid, Image With Text, Rich Text, Locations, and Trust Highlights. Each section has stable identity, type, typed validated content, position, enabled state, Revision, and explicit Media Asset and Catalog references.

The shared CMS contract and Merchant Admin own each section's persisted fields. Merchant storefront code owns its visual composition and may render canonical sections distinctively, but it cannot introduce per-store persisted section schemas or commerce behavior. Adding a section type requires a shared-kernel change and deployment. Publishing the Homepage atomically replaces its complete ordered composition.

A separate singleton Announcement Bar presents one short active Mongolian message above the header across the entire storefront. It supports an optional internal link and one of `neutral`, `promotion`, or `important` emphasis. It has no image, arbitrary HTML, animation, or schedule. It remains separate from the media-rich Homepage Hero.

Reusable Ordering Notices may appear on Product pages, Cart, and Checkout according to explicit placement values. A Product may also have one optional product-specific Purchase Notice. Both are explanatory content only: they cannot alter or override price, live availability, inventory, personalization requirements, discount eligibility, Delivery Option quotes, Payment availability, policy acceptance, or any other shared-kernel truth. Structured commerce results always win. V1 notices do not introduce required checkboxes or arbitrary conditional logic.

D1 owns separate Primary Navigation and Footer Navigation aggregates. Primary Navigation has at most two levels and drives desktop and mobile presentation. Footer Navigation is a sequence of named groups with one level of ordered items. Every item has stable identity, Mongolian label, position, enabled state, and a typed destination. Internal destinations reference Home, Category, Collection, Catalog Item, Location, or Policy identity rather than storing a handwritten URL. External destinations accept validated HTTPS URLs and may explicitly open in a new tab. Arbitrary HTML, JavaScript URLs, and merchant-defined application routes are excluded.

Navigation publication rejects missing, inactive, or cyclic destinations. Content referenced by active navigation must be removed from that navigation before archival. Storefront code owns responsive and visual presentation while the shared contract owns navigation structure, destination resolution, and link safety.

The remaining CMS surface is explicit. Storefront Identity is one singleton containing display name, optional legal name, tagline, short summary, logo and favicon Media Asset references, public phone and email, and typed approved social links. A Location contains name, public address, optional phone, opening-hours text, optional validated map or directions URL, active state, and Pickup-enabled state. Commerce owns whether a Location is currently a valid Pickup destination; CMS fields supply its public presentation.

Policies use fixed Terms, Privacy, Delivery, Returns and Refunds, and Payment kinds. Merchants can edit their content but cannot create arbitrary policy routes or kinds. Trust Highlights remain a bounded optional Homepage section with icon, title, and short supporting text and cannot assert system-generated guarantees. V1 has no generic Pages table.

Policies and Rich Text Homepage sections store constrained Markdown. The shared renderer allows paragraphs, `h2` and `h3` headings, bold, italic, ordered and unordered lists, blockquotes, and validated links. It rejects raw HTML, scripts, styles, Markdown images, iframes, tables, and arbitrary components. Images remain explicit Media Asset fields. Announcements, titles, summaries, and Trust Highlights remain plain text. Merchant Admin supplies a simple formatting toolbar and live storefront preview over the same shared renderer.

Public slugs are generated from names using normalized Unicode letters and numbers, so Mongolian Cyrillic, Latin, and mixed-script merchant or product names remain valid. Generation lowercases where applicable, replaces whitespace and punctuation with hyphens, collapses repeats, and resolves collisions with a short deterministic suffix. A slug may be edited while its entity is Draft and becomes immutable at first publication. Renaming does not silently change a published URL; archival permanently reserves the slug to the same identity, and reactivation restores the same URL. V1 therefore needs no redirect subsystem.

V1 SEO is zero-configuration. Merchant Admin exposes no dedicated SEO fields or controls. Storefront code derives site titles and descriptions from Store identity and summary; page metadata from current Product, Bundle, Category, Collection, Location, Policy, and Homepage content; and social images from the page's primary Media Asset, the Homepage Hero, or a repository-owned branded fallback. It generates canonical URLs from the Production Store domain, safe title composition, Open Graph metadata, sitemap entries for active public content, and product, organization, breadcrumb, and location structured data where applicable.

Merchant content cannot supply arbitrary meta elements, canonical URLs, robots directives, JSON-LD, or scripts. Cached structured data omits live availability rather than publishing stale stock. Cart, Checkout, Customer, tracking-token, Payment, Order, and Admin surfaces are excluded from indexing. Prospect Demos are hardcoded `noindex, nofollow` regardless of D1 content.

## Storefront rendering and caching

Anonymous storefront content is rendered by Astro SSR. On a Workers Cache miss, the server reads current CMS and non-stock Catalog data directly from D1, renders complete HTML, and returns a cacheable response. SSR does not call the Store's own public HTTP API and does not put a duplicate CMS representation in KV.

Workers Cache sits in front of Worker execution. A warm HTML hit executes neither Astro nor D1. Workers Cache's built-in lower and upper tiers, request collapsing, and global purge are used instead of the legacy Cache API or a custom cache hierarchy.

Public HTML uses the starting policy:

```http
Cache-Control: public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400
```

The browser rechecks at the edge while the shared cache may retain HTML for one year. Publication, rather than TTL expiry, is the normal freshness mechanism. Cloudflare may still evict cold entries.

Public JSON endpoints may independently use Workers Cache when a real consumer needs them, such as search, catalog pagination, or client-side collection filtering. They are not introduced solely as an internal SSR data source. HTML and related public JSON carry the same semantic cache tags where one publication affects both, allowing one purge to invalidate both representations.

Representative tags include:

- `store-shell` for global identity, navigation, and footer content;
- `homepage` for Homepage content;
- `product:<id>` for one Product page and public representation;
- `category:<id>` and `collection:<id>` for grouping pages;
- `policy:<id>` for one policy page.

Public API caching is decided per endpoint. Live availability, Cart, Checkout, Order, Payment, Customer, tracking-token, inventory-truth, and Admin responses are private or `no-store`. Live Variant availability is fetched in one batched request after the cached HTML and never blocks the initial document. Checkout revalidates all commercial truth.

The performance proof target distinguishes warm and cold paths:

- warm public HTML p75 TTFB below 50 ms and p95 below 100 ms from Mongolia-like networks;
- cached assets and media p75 response start below 50 ms;
- live availability p95 below 150 ms without blocking initial HTML;
- cold HTML render measured and reported separately rather than represented as a sub-50 ms cache hit.

## Theme architecture

The shared presentation package owns a versioned, typed Theme token schema, Valibot validation, Tailwind v4 mappings, a safe CSS-variable compiler, contrast requirements, and bounded font, radius, and shadow choices. The merchant app owns its storefront composition, initial Theme, and approved preset and font catalogs. D1 owns one current revisioned published Theme document.

The design takes inspiration from tweakcn's paired semantic tokens, presets, live CSS-variable preview, checkpoints, and Tailwind v4 variable mapping without embedding tweakcn or adopting its React state architecture. Implementation uses SolidJS, TanStack Form, Valibot, and the already-approved local draft and reconciliation behavior. Theme values are validated OKLCH and bounded choices rather than arbitrary CSS strings. Merchant Admin styling is outside the storefront Theme scope.

The initial token contract covers the Zaidan-compatible semantic surface and foreground pairs, including background, card, popover, primary, secondary, muted, accent, destructive, border, input, and focus ring, plus heading and body typography, base radius, and bounded shadow treatment. Global spacing is not merchant-editable because it can break app-owned storefront composition. Repository-owned starter presets and the fictional reference Store Theme are browser-reviewed rather than importing tweakcn's preset catalog wholesale.

A Store publishes one intentional Theme mode with an explicit `light` or `dark` appearance used for native browser color-scheme behavior. Some presets may be light and others dark, and applying a preset may change that appearance. The customer storefront has no mode toggle, duplicate light/dark token documents, or automatic operating-system switching. Merchant Admin's independent appearance preference does not affect the Storefront Theme.

Unsaved Theme edits apply CSS custom properties only to the scoped storefront preview. Publishing validates and atomically replaces the complete Theme document under an expected Revision, then globally purges the `store-theme` tag attached to every public storefront HTML response. On the next cache miss, Astro reads the Theme with page data, compiles roughly one kilobyte of CSS custom properties, and inlines them in the rendered HTML. Tailwind utilities and component CSS remain statically compiled. A normal Theme value change therefore requires publication and cache invalidation, not deployment.

The asset split is:

- inline in cached HTML: published color, radius, typography, and shadow variables;
- immutable R2 objects: approved font files, images, textures, and other media;
- deployed CSS: component structure, Tailwind mappings, layout, responsive behavior, and animations.

The app exposes a small repository-approved font catalog. The published Theme stores only `bodyFontId` and `headingFontId`. Applying a complete preset may change its default font pairing; editing colors alone does not alter typography, and Admin may select heading and body fonts independently from the same catalog. Selecting an existing font requires only Theme publication. Adding a font requires a repository change and deployment.

Every approved font is self-hosted as an immutable WOFF2 R2 asset, has verified redistribution rights, covers Mongolian Cyrillic including Ө, ө, Ү, and ү, is subset to required characters and weights, and has fallback metrics chosen to limit layout shift. A storefront uses at most two active font families and never loads Google Fonts at runtime.

Primary inspiration:

- [tweakcn Theme schema](https://github.com/jnsahaj/tweakcn/blob/f89566aef1b6d71d0f72b998d16a5980bea10c98/types/theme.ts#L5-L76)
- [tweakcn CSS-variable and Tailwind v4 generation](https://github.com/jnsahaj/tweakcn/blob/f89566aef1b6d71d0f72b998d16a5980bea10c98/utils/theme-style-generator.ts#L11-L164)
- [tweakcn preset and checkpoint behavior](https://github.com/jnsahaj/tweakcn/blob/f89566aef1b6d71d0f72b998d16a5980bea10c98/store/editor-store.ts#L86-L157)

## Media references and banner rendering

V1 media deliberately has no processing pipeline. An authenticated, size-limited Admin upload accepts a declared JPEG, PNG, or WebP and stores its bytes unchanged under a random immutable R2 object key. A minimal D1 Media Asset contains identity, object key, declared content type, alt text, and creation time. It has no content digest, provenance record, generated derivative rows, or creator audit metadata.

A CMS record references Media Asset identity rather than a mutable `latest` object. Replacing a Banner image uploads a new object, atomically changes the Banner's `mediaAssetId` with its other published fields, and purges affected HTML and public-data tags. Existing objects are never overwritten.

The Store serves images from private R2 through a bounded media route using Cloudflare's on-demand image resizing and edge caching. Responsive `srcset` URLs request allowed widths and automatic output format without persisting derivative records. SSR fetches only CMS and Media Asset metadata; it never fetches image bytes. Storefront layout supplies stable image aspect and dimensions, meaningful alt text, responsive `srcset` and `sizes`, and appropriate loading priority.

Raw-file normalization, EXIF correction or stripping, color normalization, content hashing, pre-generated derivatives, and automated orphan reconciliation are excluded. Unreferenced old R2 objects may remain in v1 and be deleted manually. Prospect evidence provenance remains in the private prospect artifact and is not copied into Production D1.

## Prospect Demo to Production initialization

A Prospect Demo runtime is never promoted, cloned, or treated as a Production Store backup. After merchant acceptance, the reviewed merchant app source may retain its storefront code, Store Profile, Theme defaults, and approved private CMS and Catalog seed artifact, but provisioning creates entirely new Production Worker, D1, KV, R2, secrets, and deployment configuration. Shared migrations run from zero.

The private approved artifact, not the running Demo deployment, is the transfer boundary. A resumable import creates new Production store-scoped identities and copies approved media into Production R2. Imported Catalog, CMS, Theme, and Navigation content remains Draft until the merchant confirms prices, initial inventory, identity and contacts, delivery settings, and payment configuration. Publication follows activation review and live proof.

Demo D1 state, resource identifiers, synthetic Orders or Customers, Payment or inventory state, sessions, tracking tokens, demo passwords, demo Telegram routing, secrets, and cache contents never cross the boundary. Provisioning and import use the already-approved resumable journal behavior.

## Fictional reference Store fixture

The repository contains one completely fictional reference merchant app with its Store Profile, custom storefront, and a typed fixture manifest covering Store identity, Locations, Theme and font selection, Homepage, Announcement Bar, Navigation, Policies, Catalog and merchandising, delivery and payment configuration, initial inventory, and named synthetic operational scenarios. A compact generated WebP media set is committed with the fixture and uploaded into each target Store's R2 during provisioning; it has no remote URLs, real merchant identity, or external availability dependency.

The fixture has stable slugs, SKUs, and scenario keys while generated database IDs may vary. Seeding is deterministic and idempotent, and every customer, Order, Payment, bank, and contact fact is unmistakably synthetic. It runs the same migrations, Admin, APIs, cache policy, provisioning, capabilities, and statically selected adapters as any merchant app.

There are zero reference-store branches or relaxed invariants in the shared kernel. Initial seed data creates only legitimate starting state. Scenario and canary tooling outside the kernel drives normal commerce commands and APIs to create operational state. A deployment-purpose marker may control noindex, monitoring, and cleanup but cannot alter commerce behavior. Ticket #28 chooses and browser-reviews the actual fictional identity, visual direction, products, media, and scenarios within this contract.

## Primary platform evidence

- [Workers Cache](https://developers.cloudflare.com/workers/cache/)
- [Workers Cache purging](https://developers.cloudflare.com/workers/cache/purge/)
- [Workers Cache keys](https://developers.cloudflare.com/workers/cache/cache-keys/)
- [D1 global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
