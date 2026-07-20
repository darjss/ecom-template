# Byl and direct QPay provider research

Research for wayfinder issue #22. Sources were checked on 2026-07-14.

## Recommendation

Implement both `BylPaymentAdapter` and `DirectQPayAdapter` in v1. The founder manually configures exactly one of them for each Store using merchant-owned credentials. Provisioning and Admin do not select or switch providers, and a Store never enables both concurrently.

Both adapters satisfy one small provider-neutral kernel interface. A Storepay BNPL adapter can be added later without changing Payment, Order, or inventory truth. This is a static seam, not a dynamic plugin system. Each Payment attempt permanently records the provider that created it.

## Byl fit

Byl publishes a ₮19,000 monthly plan for one project and up to 1,500 successful transactions, or ₮190,000 annually. At twenty Orders per day, one Store would produce at most roughly 600 successful monthly transactions and fit that plan. Byl says it charges no transaction percentage itself; underlying methods such as QPay may charge their own fee. Byl also advertises direct QPay merchant registration, test and live modes, webhook retries, and payment deposited directly to the merchant's configured bank account.

At the user-reported ₮400,000 direct-QPay setup cost, Byl's monthly plan reaches the same nominal cost after about 21 months, or a little over two years at the annual price, before valuing onboarding and maintenance effort.

Each merchant should own a separate Byl account/project and credentials. Do not place unrelated Stores in one shared Byl team merely to use the three-project plan: Store deployment isolation should include provider ownership and secrets, and Byl documents that a webhook signing secret is shared across a team's projects.

Sources:

- [Byl pricing](https://byl.mn/docs/pricing.html)
- [Byl introduction](https://byl.mn/docs/introduction.html)
- [Byl test and live modes](https://byl.mn/docs/test-mode.html)
- [Byl business verification](https://byl.mn/docs/verified-business.html)
- [Byl webhooks](https://byl.mn/docs/webhook.html)

## Use Byl invoices, not Byl checkout

The commerce kernel already owns cart validation, discounts, totals, contact details, inventory, and Order creation. Using Byl's hosted checkout would duplicate those responsibilities and allow a provider to recalculate commerce truth.

Use the narrower Byl invoice API with the kernel's exact immutable Order amount and reference. Byl invoices expose `draft`, `open`, `paid`, and `void` states, can be fetched by ID, and provide a void endpoint for unpaid invoices. The Store Workflow can enforce the accepted fifteen-minute hold by fetching the invoice at the deadline and either confirming a paid invoice or voiding an open invoice before releasing inventory. Byl's published create API does not document a custom due date, so the local fifteen-minute deadline and explicit void are required.

Source: [Byl invoice API](https://byl.mn/docs/api/invoices.html).

## Direct QPay fit

Direct QPay exposes invoice creation, status/payment checks, callbacks, and unpaid-invoice cancellation. It offers fewer intermediary dependencies and may be cheaper for a merchant that stays live long enough, but requires the merchant contract, setup payment, and credentials described by the user. It ships as the second v1 adapter for Stores that choose the direct relationship.

Sources:

- [QPay invoice API reference](https://qpay-docs.vercel.app/api-reference/invoices)
- [QPay Quick QR vendor model](https://qr.qpay.mn/quick-qr)

## Shared kernel boundary

Both adapters may only:

- create an exact-amount invoice;
- fetch authenticated invoice/payment status;
- void or cancel an unpaid invoice;
- verify and normalize a webhook;
- return provider references and typed provider failures.

The kernel alone decides Payment state, validates exact MNT amount and Order identity, confirms or expires the Payment, consumes or releases inventory, and records audit evidence. Byl coupons, hosted product pricing, customer collection, and order management remain unused because those duplicate kernel-owned commerce behavior.
