# Authentication, authorization, and session contract

## Status and boundaries

**Decision status:** Founder approved.

Each Store has one independently deployed Worker, D1 database, and `EPHEMERAL_KV` resource. Staff Members, Customers, sessions, pending approvals, and Guest Tracking Links belong to exactly one Store and never link across Stores. The Store's founder-maintained Telegram operator allowlist is deployment configuration, never shared identity. Matching Google emails, phone numbers, or Telegram users in another Store confer no identity or authority.

The Store runs two separately configured Better Auth instances. They share infrastructure only where explicitly stated; neither instance accepts the other instance's users, sessions, cookies, or verification records.

| Authority domain | Sign-in proof | Base path | Purpose |
| --- | --- | --- | --- |
| Staff Auth | Google OAuth | `/api/auth/staff` | Merchant Admin |
| Customer Auth | SMS phone OTP | `/api/auth/customer` | Optional Customer identity and Order history |
| Demo Admin | Expiring demo password | app-owned demo path | Restricted synthetic demo only |
| Guest tracking | Order-specific bearer token | public tracking path | Read one Guest Order only |
| Telegram | Founder-allowlisted Telegram operator | bot webhook | Store-local financial companion actions |

Staff Auth and Customer Auth use distinct Better Auth model/table names, cookie prefixes, KV key prefixes, and secrets. All auth cookies are Secure, HttpOnly, SameSite=Lax, and host-only. One Store `EPHEMERAL_KV` binding is sufficient; logical key prefixes isolate Staff, Customer, verification, rate-limit, Demo Admin, cache, and short-lived action records. KV owns best-effort Customer OTP send rate limits; D1 retains atomic challenge consumption. Base URL and trusted-origin handling follow the host-validation and Portless contract approved in #16.

## Staff identity and approval

A minimal Store-local Staff record is the source of Admin authority. It has a unique normalized email, nullable linked Staff Auth user identity, nullable role, and status of `pending`, `active`, or `revoked`. Google proves control of a verified email but never grants a role by itself. There is no organization, team, invitation, or cross-Store membership model.

The first Owner is created manually before first login through a repository-owned provisioning command:

```text
pnpm store:owner:add --store <slug> --email <email>
```

The command writes an active Owner record to that Store's D1. There is no public bootstrap route and no first-login-wins behavior. The same command is the manual recovery path when all Owners lose Google access; it requires existing deployment/database authority.

After bootstrap, Staff entry has two paths:

1. An Owner pre-adds an active normalized email and role in Admin. The matching Google user can sign in immediately.
2. A Google user attempts Staff sign-in and receives no Admin session. A deduplicated pending Staff record is created, and the user sees only an awaiting-approval result. An Owner may approve with a role or delete the request. The applicant signs in again after approval.

Only Owners may approve, reject, revoke, or delete Staff records; change Staff roles; create another Owner; or change authentication settings. Multiple Owners are allowed. Admin must refuse to revoke, demote, or delete the final active Owner.

A role change or revocation deletes every Staff Auth session for that Staff Member. Staff sessions contain the role snapshot used for authorization, last 14 days, and use Better Auth's rolling refresh near expiry. Staff Auth must not use a client cookie cache that can remain valid after server-side session deletion. Normal requests validate the revocable KV-backed session and do not query D1 again solely for role authorization.

## Staff roles

V1 has exactly three roles:

| Capability | Owner | Manager | Staff |
| --- | ---: | ---: | ---: |
| Staff and auth settings | Yes | No | No |
| Payment confirmation/rejection and Refund recording | Yes | Yes | No |
| Discounts and inventory adjustments | Yes | Yes | Yes |
| Catalog and CMS | Yes | Yes | Yes |
| Orders and non-financial fulfillment operations | Yes | Yes | Yes |
| Operational analytics | Yes | Yes | Yes |
| Deployment or demo activation controls | Owner-controlled provisioning only | No | No |

Manager may perform every normal Store operation, including financial actions, but may not manage identity or authentication authority. Staff may manage catalog, CMS, inventory, and non-financial Order operations, but may not perform financial actions, manage Staff, change auth/payment/deployment settings, or invoke Owner/Manager-only overrides. The previously proposed Fulfillment Staff role is excluded.

Authorization is enforced by the shared-kernel command boundary, not merely by hiding Admin controls. Provider callbacks and Telegram handlers invoke the same authorized commerce commands as web Admin.

## Customer identity and OTP

Checkout is anonymous-first and never requires authentication or OTP. Customer Auth exists only when a shopper chooses phone login or Order history.

Customer Auth accepts a normalized Mongolian phone number and a four-digit OTP with these rules:

- five-minute expiry;
- single use;
- at most five verification attempts before deletion;
- requesting a replacement invalidates the previous OTP;
- one SMS per phone per 30 seconds and at most five per normalized phone per day;
- at most ten sends per IP per 15 minutes;
- generic responses that do not disclose whether a Customer exists;
- only a non-recoverable representation of verification secrets is stored.

There is no Store-wide SMS cost cap. Customer sessions last 30 days and use Better Auth rolling refresh near expiry. Customers may log out, but Staff cannot revoke Customer sessions in v1. Customer account recovery, phone changes, conflicts, and Guest Order linking follow the founder-approved commerce contract in #17: verified matching phones link only eligible unclaimed Guest Orders, never rewrite historical recipient facts, and never merge across Stores.

A Guest Tracking Link remains a high-entropy, order-specific, read-only bearer capability stored non-recoverably. It cannot authorize profile, payment, cancellation, or any other Order. It expires 30 days after the Order becomes Completed or Cancelled. Tracking responses are private/no-store and prevent token leakage through referrers or third-party resources.

## Shared SMS delivery

All Store Workers call one shared SMS Gateway Worker through a private Cloudflare Service Binding. The gateway has no public send endpoint and requires no per-Store API secrets. It owns Android SMS Gateway credentials and outbound delivery only; it stores no OTP, Customer, session, or commerce authority. OTP generation, expiry, rate limiting, verification, and Customer linking remain inside the calling Store.

A gateway outage fails OTP sending without affecting anonymous checkout. Delivery retries must not extend OTP expiry or mint a new code. Store-scoped request identifiers prevent accidental duplicate sends during transport retries.

## Demo Admin

A prospect demo storefront is unlisted, passwordless, noindex, synthetic, and expires at a configured timestamp. Its Admin is protected by a separate demo password rather than Google Staff Auth. Successful entry creates a host-only HttpOnly Demo Admin cookie that cannot outlive the demo.

Demo Admin may exercise the approved synthetic operating journey but cannot manage Staff, call real payment or notification integrations, access production data, or activate a Store. Demo mode and its password route must be absent from canary and production artifacts; provisioning fails rather than deploying either target with demo mode enabled. On expiry, both the storefront and Demo Admin show an expired-demo response and deny application actions.

## Telegram companion authority

Telegram never establishes Staff identity. Each Store has founder-maintained deployment configuration containing exact numeric Telegram operator IDs and short audit labels. Merchant Admin cannot enroll operators or grant Telegram authority.

Telegram bank-transfer Confirm and Reject actions:

1. verify the Store's Telegram webhook secret and reject replayed updates;
2. require an exact allowlisted Telegram user ID;
3. consume one opaque bounded action reference created for that Payment message;
4. revalidate Payment state and expected amount;
5. execute the same shared-kernel Confirm or Reject command used by web Admin;
6. record the configured operator label and Telegram user ID as consequential evidence.

One button tap executes the action. There is no enrollment, Staff-role lookup, or second confirmation tap. Telegram never owns Payment, Order, role, session, or audit truth, and every capability remains available in web Admin.

## Implementation and proof handoff

The schema ticket owns physical columns, indexes, Better Auth model names, and migrations without changing these authority boundaries. The interface ticket owns Elysia/Eden route shapes and command middleware. Implementation must update the Better Auth schema-generation config for both instances and preserve `aot: false`.

Live proof must use real Google OAuth on an approved canonical origin, real D1 and KV bindings, the private SMS Worker service binding with Android delivery, actual browser cookies, and an actual Telegram bot. It must demonstrate pending Staff denial, approval, role enforcement, all-session revocation, cross-Store cookie/session rejection, OTP expiry and limits, Guest linking, demo build exclusion, exact Telegram allowlist enforcement, bounded one-tap action references, replay rejection, and financial command checks. Missing credentials or infrastructure are reported as blocked rather than replaced with mocks or stubs.
