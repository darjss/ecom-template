import { CustomerOtpCodeSchema, MongolianPhoneSchema, type MongolianPhone } from "@ecom/contracts";
import { Result } from "better-result";
import { env } from "cloudflare:workers";
import * as v from "valibot";
import { establishCustomerAuthSession, readCustomerAuthSession } from "../auth/customer-runtime";
import { customerQueries } from "./persistence";

const CustomerSecretSchema = v.pipe(v.string(), v.minLength(32));
const StoredRateCounterSchema = v.object({
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
const otpLifetimeMs = 5 * 60 * 1_000;
const phoneDailyWindowMs = 24 * 60 * 60 * 1_000;
const ipWindowMs = 15 * 60 * 1_000;
const cooldownMs = 30 * 1_000;
const ulaanbaatarOffsetMs = 8 * 60 * 60 * 1_000;

export type CustomerSmsDelivery = (intent: {
  readonly requestId: string;
  readonly phone: string;
  readonly message: string;
}) => Promise<Result<undefined, { readonly code: "delivery_unavailable" }>>;

export type CustomerAuthFailure =
  | { readonly code: "invalid_input" }
  | { readonly code: "invalid_origin" }
  | { readonly code: "invalid_otp" }
  | { readonly code: "rate_limited"; readonly retryAfterSeconds: number }
  | { readonly code: "delivery_unavailable" }
  | { readonly code: "infrastructure_unavailable" };

const normalizeMongolianPhone = (source: string) => {
  const compact = source.trim().replace(/[\s()-]/g, "");
  const national = compact.startsWith("+976")
    ? compact.slice(4)
    : compact.startsWith("976")
      ? compact.slice(3)
      : compact;
  return v.safeParse(MongolianPhoneSchema, `+976${national}`);
};

const hmac = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const generateOtp = () => {
  const values = new Uint16Array(1);
  let value = 65_000;
  while (value >= 65_000) {
    crypto.getRandomValues(values);
    value = values.at(0) ?? 65_000;
  }
  return v.parse(CustomerOtpCodeSchema, String(value % 10_000).padStart(4, "0"));
};

const windowState = (now: number, size: number, offset = 0) => {
  const start = Math.floor((now + offset) / size) * size - offset;
  return { id: start, expiresAt: start + size };
};

const applySendLimits = async (phoneKey: string, ipKey: string, now: number) => {
  const day = windowState(now, phoneDailyWindowMs, ulaanbaatarOffsetMs);
  const ipWindow = windowState(now, ipWindowMs);
  const counters = [
    {
      key: `customer:otp:cooldown:${phoneKey}`,
      limit: 1,
      expiresAt: now + cooldownMs,
    },
    {
      key: `customer:otp:phone-day:${day.id}:${phoneKey}`,
      limit: 5,
      expiresAt: day.expiresAt,
    },
    {
      key: `customer:otp:ip-window:${ipWindow.id}:${ipKey}`,
      limit: 10,
      expiresAt: ipWindow.expiresAt,
    },
  ];
  const states = await Promise.all(
    counters.map(async (counter) => {
      const value = await env.EPHEMERAL_KV.get(counter.key, "json");
      const stored =
        value === null ? { count: 0, expiresAt: 0 } : v.parse(StoredRateCounterSchema, value);
      return {
        ...counter,
        count: stored.expiresAt > now ? stored.count : 0,
        storedExpiresAt: stored.expiresAt,
      };
    }),
  );
  const retryAt = states.reduce(
    (latest, state) =>
      state.count >= state.limit ? Math.max(latest, state.storedExpiresAt) : latest,
    now,
  );
  if (retryAt > now) {
    return {
      limited: true as const,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1_000)),
    };
  }

  await Promise.all(
    states.map((state) =>
      env.EPHEMERAL_KV.put(
        state.key,
        JSON.stringify({ count: state.count + 1, expiresAt: state.expiresAt }),
        {
          expirationTtl: Math.max(60, Math.ceil((state.expiresAt - now) / 1_000)),
        },
      ),
    ),
  );
  return { limited: false as const };
};

export const requestCustomerOtp = async (
  phoneSource: string,
  ipAddress: string,
  storeDisplayName: string,
  deliverSms: CustomerSmsDelivery,
): Promise<Result<{ readonly accepted: true }, CustomerAuthFailure>> => {
  const phone = normalizeMongolianPhone(phoneSource);
  const secret = v.safeParse(CustomerSecretSchema, env.BETTER_AUTH_CUSTOMER_SECRET);
  if (!phone.success) {
    return Result.err({ code: "invalid_input" });
  }
  if (!secret.success) {
    return Result.err({ code: "infrastructure_unavailable" });
  }

  try {
    const [phoneKey, ipKey] = await Promise.all([
      hmac(secret.output, `phone:${phone.output}`),
      hmac(secret.output, `ip:${ipAddress}`),
    ]);
    const requestId = crypto.randomUUID();
    const limit = await applySendLimits(phoneKey, ipKey, Date.now());
    if (limit.limited) {
      return Result.err({ code: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    }

    const code = generateOtp();
    const createdAt = Date.now();
    await customerQueries.replaceChallenge(
      phone.output,
      await hmac(secret.output, `${phone.output}:${code}`),
      requestId,
      createdAt,
      createdAt + otpLifetimeMs,
    );
    const delivery = await deliverSms({
      requestId,
      phone: phone.output,
      message: `${storeDisplayName} баталгаажуулах код: ${code}. Код 5 минут хүчинтэй.`,
    });
    return delivery.isErr()
      ? Result.err({ code: "delivery_unavailable" })
      : Result.ok({ accepted: true });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const verifyCustomerOtp = async (
  request: Request,
  origin: string,
  phoneSource: string,
  code: string,
): Promise<
  Result<{ readonly phone: MongolianPhone; readonly responseHeaders: Headers }, CustomerAuthFailure>
> => {
  if (request.headers.get("origin") !== origin) {
    return Result.err({ code: "invalid_origin" });
  }
  const phone = normalizeMongolianPhone(phoneSource);
  const parsedCode = v.safeParse(CustomerOtpCodeSchema, code);
  const secret = v.safeParse(CustomerSecretSchema, env.BETTER_AUTH_CUSTOMER_SECRET);
  if (!phone.success || !parsedCode.success) {
    return Result.err({ code: "invalid_input" });
  }
  if (!secret.success) {
    return Result.err({ code: "infrastructure_unavailable" });
  }

  try {
    const consumed = await customerQueries.consumeChallenge(
      phone.output,
      await hmac(secret.output, `${phone.output}:${parsedCode.output}`),
      Date.now(),
    );
    if (!consumed) {
      return Result.err({ code: "invalid_otp" });
    }
    const customer = await customerQueries.establish(phone.output);
    const response = await establishCustomerAuthSession(request, origin, customer.id, phone.output);
    return response
      ? Result.ok({ phone: phone.output, responseHeaders: response.headers })
      : Result.err({ code: "infrastructure_unavailable" });
  } catch {
    return Result.err({ code: "infrastructure_unavailable" });
  }
};

export const readCustomerSession = async (request: Request, origin: string) => {
  const session = await readCustomerAuthSession(request, origin);
  if (session.kind !== "active") {
    return session;
  }
  try {
    const customer = await customerQueries.findByAuthUserId(session.authUserId);
    return customer
      ? {
          kind: "active" as const,
          phone: customer.normalizedPhone,
          responseHeaders: session.responseHeaders,
        }
      : { kind: "unavailable" as const };
  } catch {
    return { kind: "unavailable" as const };
  }
};
