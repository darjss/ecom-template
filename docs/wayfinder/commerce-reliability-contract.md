# Commerce reliability and asynchronous-work contract

**Decision status:** Founder approved.

This contract implements the commerce model accepted in issue #17 without creating alternate Payment, Order, inventory, or Fulfillment truth. It deliberately favors a small Store-scale design over a general command bus or job framework.

Supporting research:

- [Cloudflare background execution primitives](./cloudflare-background-primitives-research.md)
- [Byl and direct QPay providers](./mongolia-payment-provider-research.md)

The concrete v1 provider decision is recorded separately in issue #32: both Byl and direct QPay adapters ship, while exactly one is manually configured for any Store.

## Reliability target

The system guarantees exactly-once **business effects**, not exactly-once delivery. HTTP requests, provider callbacks, Workflow steps, and scheduled invocations may repeat. Repetition must not create a second Order, confirm money twice, consume or release inventory twice, redeem a Discount twice, or send a second logical notification.

Every consequential mutation commits its domain state, balances, ledger entries, required audit evidence, and durable notification intent in one D1 transaction. External calls remain at-least-once and use deterministic references plus idempotent kernel commands.

D1 is authoritative for commerce. KV is not used for idempotency because it is eventually consistent and cannot atomically commit a key with Order, Payment, or inventory changes.

## Minimal idempotency

Use one small shared D1 idempotency implementation rather than a command framework. A record contains:

- operation scope;
- caller-provided or deterministic key;
- normalized request hash;
- resulting aggregate reference;
- creation time.

`(scope, key)` is unique within the Store database. Repeating the same key and request returns the existing result. Reusing a key with a different request hash returns a typed conflict. The record is written in the same transaction as the business mutation.

Use it for checkout and other externally retried commands. Provider references also have direct uniqueness constraints. Workflow steps use deterministic keys derived from Workflow instance identity and step purpose. Current-state checks and aggregate Revisions remain the ordinary protection for staff actions and scheduled transitions.

Order-creating keys live with their Orders. Provider transaction references and financial evidence are retained for the Store lifetime.

## Explicit full-stack errors

Use `better-result` for expected domain, authorization, provider, and infrastructure outcomes inside kernel and integration operations. Error unions are narrow tagged data. Do not erase them into a global domain `ApiError`, serialize Result containers over HTTP, or require generator composition.

Ordinary `await`, explicit narrowing, and fluent Result transformations are the normal style:

```ts
export const prepareOrder = async (
  input: PlaceOrderInput,
): Promise<Result<OrderDraft, PrepareOrderError>> => {
  const cart = await validateCart(input);

  if (cart.isErr()) {
    return Result.err(cart.error);
  }

  return (await resolveInventoryDemand(cart.value)).map((demand) => ({
    cart: cart.value,
    demand,
  }));
};
```

The HTTP adapter maps the Result once to a meaningful status, a route-specific success DTO, or the closed `ApiErrorEnvelope`. Valibot schemas validate every request, success DTO, and route-specific error detail. Eden preserves the route union. `Result.serialize`, `Result.deserialize`, an all-200 RPC convention, and Result instances inside Query data are excluded.

### Typed TanStack Query failures

The shared browser request boundary converts fetch rejection to a tagged network failure, parses successful and unsuccessful bodies with their Valibot contract, and throws only the declared query failure union. Reusable `queryOptions` and mutation configuration files state the exact route error type because TypeScript cannot infer thrown types from an async function.

```ts
export type ProductQueryError =
  | ProductNotFound
  | ProductUnavailable
  | NetworkUnavailable
  | ServiceUnavailable;

export const productQuery = (productId: ProductId) =>
  queryOptions<ProductDto, ProductQueryError>({
    queryKey: ["catalog", "product", productId],
    queryFn: () => requestProduct(productId),
  });
```

`useQuery(() => productQuery(productId()))` therefore exposes typed `isError` and `error`. Ordinary endpoints do not require one custom hook each. Hooks remain appropriate only when they compose reactive state or several queries.

The global Query and Mutation caches handle only common cross-interface behavior:

- network and temporary service failures receive the shared toast and limited safe retry policy;
- rate limits receive bounded retry presentation;
- an expired Staff session redirects once to Staff login;
- an unexpected response-contract failure receives generic presentation and diagnostic reporting.

Domain errors that need more than a common toast remain local to their query or mutation interface. Examples include changed Checkout, stock, price, Discount, Payment, Fulfillment, publication, cancellation, and route-specific not-found presentation. Query metadata may opt a request into local presentation and prevent duplicate global UI.

Expected tagged query failures may remain plain validated data; they do not need class instances merely to enter TanStack Query's error channel. Unexpected programmer defects and unknown thrown values are not relabeled as expected domain failures.

### Typed staff authorization

Elysia returns route-typed `AuthenticationRequired` and `PermissionDenied` envelopes for `401` and `403`. Staff query configurations include the appropriate metadata. The global cache handles the common expired-session redirect; permission or domain responses requiring richer presentation remain local. Authorization is still enforced by the kernel operation rather than the browser response path.

## Cloudflare background execution

Every Store deployment owns one Store-specific Workflow resource alongside its Worker, D1, KV, R2, and secrets. All Stores import the same statically registered Workflow implementation, but instances, credentials, visibility, and recovery remain isolated per Store.

One Workflow definition accepts a small tagged task union and creates many instances, for example:

```text
payment:<payment-id>:lifecycle
notification:<notification-id>:telegram
reconcile:<scheduled-window>
```

Use Workflow steps for durable provider inspection, the fifteen-minute automated-payment deadline, notification delivery, retries, and repair work. Side effects occur only inside `step.do`, and every step invokes an idempotent adapter operation or kernel command. Workflow state coordinates execution but never becomes commerce truth.

Use `ctx.waitUntil()` only for short non-critical work such as analytics and best-effort cache cleanup. It is not sufficient for Payment, inventory, required notification, or reconciliation work because it supplies no durable retry or recovery record.

Do not add a generic D1 job runner, Cloudflare Queue, or custom lease system in v1. A Queue remains a later scaling seam if independent event fan-out outgrows Workflow execution.

### Durable handoff and healing

D1 commit and Workflow creation cannot be atomic. The minimum recovery contract is:

1. Commit authoritative business state and deterministic task identity in D1.
2. Await Workflow creation when the request must prove durable handoff.
3. If handoff fails after commit, return a retryable infrastructure failure; retrying the original idempotent request returns the committed business result and retries the missing Workflow creation.
4. A Store Cron trigger starts a bounded reconciliation Workflow that finds overdue or incomplete authoritative state and idempotently starts or repairs missing work.

Notification delivery has a narrow delivery record created with the causal transaction. It records logical notification identity, channel, status, attempts, and sanitized last failure. It is not a general outbox or command queue.

## Adapter scope

Implement only adapters required by real v1 integrations: automated payment, SMS OTP, and Telegram. SMS and Telegram adapters accept an already-authorized delivery intent and return typed provider outcomes; they cannot authorize users, choose commerce transitions, or suppress required audit evidence.

Do not predefine courier or tax adapters in v1. Courier integration and dynamic tax calculation are excluded, so those hypothetical interfaces would add surface without a second implementation. Add their seams only when a paid integration supplies concrete requirements. Every adapter is statically registered; runtime plugin loading and adapter-provided Admin interfaces remain excluded.

## Automated payments

The kernel calls one provider-neutral seam. Both Byl and direct QPay adapters ship in v1, but the founder manually configures exactly one for each Store using merchant-owned credentials. Provisioning and Admin do not choose or switch providers, and a Store never enables both concurrently.

```ts
export interface AutomatedPaymentAdapter {
  readonly provider: "byl" | "qpay";

  begin(
    input: BeginProviderPayment,
  ): Promise<Result<ProviderPayment, ProviderFailure>>;

  inspect(
    reference: ProviderPaymentReference,
  ): Promise<Result<ProviderPaymentObservation, ProviderFailure>>;

  close(
    reference: ProviderPaymentReference,
  ): Promise<Result<ProviderCloseOutcome, ProviderFailure>>;

  parseWebhook(
    request: Request,
  ): Promise<Result<ProviderPaymentReference, ProviderFailure>>;
}
```

`begin` receives the kernel Payment and Order references, exact integer-MNT amount, fifteen-minute deadline, callback URL, and optional normalized customer phone. It returns an opaque provider reference and a customer action:

```ts
export type ProviderCustomerAction =
  | { kind: "redirect"; url: string }
  | { kind: "qr"; payload: string; fallbackUrl?: string }
  | { kind: "app_approval"; message: string };
```

`inspect` normalizes only `pending`, `confirmed`, or `closed`, plus authenticated provider reference, amount, currency, and event identity. The kernel validates exact Store, Order, MNT amount, and current state before choosing a transition.

`close` means that an attempt is no longer collectible, or reports that it was already confirmed. The adapter hides whether this uses Byl invoice void, direct QPay cancellation, or a future provider's equivalent. Provider errors never mutate commerce state.

A future Storepay adapter may use `app_approval`. Its `confirmed` observation must mean Storepay has accepted or guaranteed the merchant's full sale amount. Customer installments remain between Storepay and its customer and do not become kernel Payment states.

Byl uses its invoice API, not hosted checkout. The kernel retains ownership of catalog, discounts, contact data, totals, inventory, and Orders.

## Automated-payment lifecycle

Automated payment attempts have a fixed fifteen-minute inventory hold. Provider callbacks and Workflow checks call the same small synchronization operation:

```ts
syncAutomatedPayment(providerReference)
```

It authenticates current status through the configured adapter, locates the Payment by unique provider reference, and atomically confirms an exact paid Pending attempt. Repeating confirmation returns the existing result. Failure evidence cannot undo a confirmed Payment.

At the deadline, the Workflow:

1. inspects the provider attempt;
2. confirms it when exact payment is reported;
3. otherwise calls `close`;
4. confirms it if close reports a race with completed payment;
5. expires Payment and reservation and cancels the unpaid Order only after close proves the attempt is no longer collectible.

If provider status is unavailable or contradictory, the Payment remains Pending and inventory remains held. The Workflow retries, and scheduled reconciliation tries again. There is no `needsAttention` state or separate payment-review system.

Callbacks await synchronization before returning provider success. The browser may poll local Order status but does not repeatedly call the provider.

### Switch to bank transfer

Before confirmation, a customer may switch an automated attempt to full-amount bank transfer. The kernel first asks the configured adapter to close the automated attempt. If already confirmed, it confirms that Payment and rejects the switch. If safely closed, one D1 transaction supersedes the old attempt, creates one Awaiting Confirmation transfer attempt, and preserves the same Order and reservation. Uncertain closure changes nothing. At most one collectible attempt exists.

Manual transfer has no automatic deadline. Its reservation remains Active until owner/manager confirmation, rejection, or Order cancellation. Confirmation consumes inventory; rejection or cancellation releases it.

## COD amendment

This contract supersedes the earlier anonymous-COD and `AcceptCodOrder` rules:

- Admin may enable or disable COD for new checkouts.
- COD requires SMS OTP verification of the checkout phone through the existing Store-scoped Customer verification flow.
- A successful COD Order belongs to that verified Customer.
- COD placement immediately consumes inventory; there is no separate `AcceptCodOrder` command.
- COD Payment remains Awaiting Confirmation until authorized staff records cash collection.
- Fulfillment may begin after placement while payment awaits collection.
- Cancellation before handoff restores inventory. A verified complete return after failed delivery permits the accepted post-handoff cancellation and restoration path.
- Disabling COD affects new checkout only and never rewrites existing Orders.

Anonymous checkout remains available for automated payment and manual bank transfer.

## Inventory and bundle reliability

The approved inventory model remains unchanged except for immediate COD consumption. Placement atomically reserves complete normalized Variant demand for Products and fixed Bundles. Bundle demand is expanded to component Variants before the transaction. Conditional Stock Item updates either reserve all demand or none.

Reservation consumption, release, expiry, and restoration are conditional state transitions with immutable Inventory Entries and resulting balances. Repeated commands return the existing transition. No path edits balances directly. Uncertain automated payment keeps the reservation Active; stock is never released based only on a local timer.

## Notification isolation

Required Telegram and SMS notifications are durable Workflow tasks created after their causal commerce transaction. Notification failure never rolls back or changes Order, Payment, inventory, or Fulfillment state.

Workflow retries temporary failures. Exhausted delivery appears in Admin under Failed Notifications with a Retry action. Retry keeps the same logical notification identity, preventing a second logical send. Every action advertised through Telegram remains available in web Admin.

## Evidence and audit

The accepted append-only evidence model remains sufficient:

- Inventory Entries explain every on-hand and reserved balance change.
- Financial Entries explain expected, confirmed, and manually refunded money.
- Audit Events record consequential staff, provider, cancellation, fulfillment, and recovery decisions.
- Provider references and minimized normalized evidence are retained; secrets and unnecessary direct PII are not.
- Corrections append compensating evidence and never rewrite history.

The kernel is not event sourced. Current state remains on aggregates, and no growing history arrays are stored on aggregate rows.

## Operator recovery

Normal recovery reuses existing commands and Workflow controls rather than privileged database edits:

- retry a failed notification;
- retry or restart an errored Workflow instance;
- confirm or reject manual transfer;
- confirm COD cash collection;
- cancel an eligible unpaid Order;
- record a manual Refund with reason and reference;
- run scheduled reconciliation again.

No generic force-transition command exists. If provider status is uncertain, the safe state is continued Payment Pending plus held inventory until a later authenticated inspection resolves it.

## Required live proof

Implementation tickets must prove these behaviors against real local or sandbox bindings and provider test modes where credentials exist:

- duplicate checkout key returns one Order;
- changed payload under the same key is rejected;
- duplicate callback and callback/poll race confirm once;
- automated expiry closes the provider attempt before releasing inventory;
- uncertain provider closure retains inventory;
- automated-to-transfer switch leaves one collectible attempt;
- complete Bundle demand reserves and consumes once;
- COD is absent when disabled and requires OTP when enabled;
- COD placement consumes inventory immediately;
- notification failure does not alter commerce state and can be retried;
- reconciliation repairs a missed Workflow handoff;
- route-specific domain, auth, network, and service failures reach typed TanStack Query `isError` states; common failures receive global handling while rich domain failures remain local.

Follow the repository proof policy: use the actual browser, curl, Wrangler, and TypeScript CLI harnesses; do not introduce unit/integration tests, mocks, or fake provider behavior. Missing credentials must be reported as blocked rather than simulated as green.
