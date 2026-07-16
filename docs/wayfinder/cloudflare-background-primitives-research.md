# Cloudflare background execution primitives

Research for wayfinder issue #22. Sources were checked on 2026-07-14.

## Decision summary

Do not build a general D1 job runner in v1.

Use three levels of execution:

1. `ctx.waitUntil()` only for short, non-critical post-response work such as analytics and best-effort cache cleanup.
2. One statically registered Cloudflare Workflow for durable commerce tasks that need retries, sleeping, or operator-visible recovery, including QPay polling and expiry, notification delivery, and reconciliation work.
3. A scheduled Worker invokes a small idempotent reconciliation command that finds overdue business state and starts or repairs missing Workflow work. D1 domain state, ledgers, audit evidence, and provider references remain authoritative; Workflow state never becomes commerce truth.

Cloudflare Queues are unnecessary for the expected v1 store volume. Add a Queue only if notification or event throughput later needs independent batching and fan-out.

## Why `waitUntil()` is insufficient for commerce truth

`ctx.waitUntil(promise)` extends an invocation after its response is sent and is appropriate for work that should not delay the response. The promise remains bounded by the Worker invocation lifetime; failure does not change the response already returned, and it supplies no durable retry history, sleep, dead-letter state, or operator recovery mechanism. It therefore fits analytics and non-critical cleanup, not payment expiry, inventory release, or required notifications.

Source: [Cloudflare Workers Context API](https://developers.cloudflare.com/workers/runtime-apis/context/).

## Why Workflows fit the durable tasks

Cloudflare Workflows persist progress at named steps, retry failed steps, support configurable retry delay and backoff, and can sleep until a duration or timestamp without consuming a normal step. Workflow instances expose queued, running, paused, waiting, errored, terminated, and complete statuses. This removes the need to implement custom leases, retry scheduling, and job status machinery in D1.

Workflow code must keep side effects inside `step.do`; code outside a step may execute more than once. Every side-effecting step must still call an idempotent kernel command or provider operation because durable execution does not make external side effects exactly-once.

Use deterministic, store-local instance IDs derived from the causal domain event or task identity. Workflow IDs are unique per Workflow while retained. `createBatch` skips retained duplicate IDs, whereas `create` reports an ID collision. D1 retains the permanent business evidence because Workflow instance retention is bounded.

Sources:

- [Workflow overview](https://developers.cloudflare.com/workflows/)
- [Sleeping and retrying](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/)
- [Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/)
- [Workers API for Workflows](https://developers.cloudflare.com/workflows/build/workers-api/)
- [Workflow limits](https://developers.cloudflare.com/workflows/reference/limits/)

## Why not Queues by default

Cloudflare Queues provide at-least-once delivery, configurable retries and delays, batching, and optional dead-letter queues. Consumers must therefore be idempotent. Queues are a strong fit for independent high-throughput fan-out, but they do not model a durable sequence such as poll, sleep, poll, expire, and notify. Queue delay is also bounded, while Workflow sleeps are designed for long-running orchestration.

Adding both Queues and Workflows to every merchant deployment would add provisioning and operational surface without a demonstrated v1 throughput need. A Workflow can execute a one-step notification task now. A Queue remains a later scaling seam.

Sources:

- [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)
- [Queue batching, retries, and delays](https://developers.cloudflare.com/queues/configuration/batching-retries/)
- [Dead-letter queues](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/)

## Reliability boundary

Starting a Workflow and committing D1 cannot form one atomic transaction. The minimum healing contract is:

- Commit authoritative business state and a deterministic task identity in D1.
- Start the Workflow with that identity and await the handoff when the caller needs proof that durable work was accepted.
- Reusing the request idempotency key returns the committed business result and safely retries missing Workflow creation.
- Scheduled reconciliation scans authoritative overdue or incomplete business state and idempotently creates or repairs missing work.
- Workflow steps call kernel commands with deterministic idempotency keys.

This keeps the unavoidable dual-write gap recoverable without implementing a generic outbox processor. If production evidence later shows reconciliation scans are too expensive or delayed, a narrow D1 dispatch-intent table can be added without changing domain truth.

## Cost estimate for ten stores

Twenty Orders per day across ten Stores is about 6,000 Orders per 30-day month. A moderate design using two Workflow instances and ten total durable steps per Order would consume about 12,000 Workflow invocations and 60,000 steps monthly. A deliberately conservative estimate of three instances and twenty-five total steps per Order is 18,000 invocations and 150,000 steps.

The Workers Paid plan currently includes 10 million shared monthly requests, 30 million CPU milliseconds, 1 GB-month of Workflow state, and 500,000 Workflow steps. At 6,000 Orders, the step allowance permits roughly 83 steps per Order before considering unrelated Workflow use. Idle, sleeping, and API-wait time does not incur CPU time. Keeping successful-instance retention short should keep this workload well below the included storage allowance.

Cloudflare states that Workflow step and storage billing begins on 2026-08-10. Beyond the Paid allowance, the published rates are $0.80 per additional 100,000 steps and $0.20 per additional GB-month; Workflow requests and CPU share normal Workers Standard allowances and overage rates. Under either estimate, Workflow usage should add $0 to the existing $5 Workers Paid minimum, assuming the rest of the account does not already consume those shared allowances.

Source: [Cloudflare Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/).
