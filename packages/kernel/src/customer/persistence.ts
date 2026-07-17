import {
  createCustomerId,
  CustomerIdSchema,
  MongolianPhoneSchema,
  type MongolianPhone,
} from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { getTableName } from "drizzle-orm";
import * as v from "valibot";
import {
  customerOtpChallenges,
  customerOtpRateAdmissions,
  customerOtpRateCounters,
  customers,
} from "../db/schema";

const ReturnedRequestSchema = v.object({ requestId: v.string() });
const RateAdmissionSchema = v.object({
  admitted: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1)),
  retryAt: v.nullable(v.number()),
});
const ReturnedCustomerSchema = v.object({
  id: CustomerIdSchema,
  normalizedPhone: MongolianPhoneSchema,
  authUserId: v.string(),
});

const first = <T>(result: D1Result<T>) => result.results.at(0);
const challengesTable = getTableName(customerOtpChallenges);
const rateAdmissionsTable = getTableName(customerOtpRateAdmissions);
const rateCountersTable = getTableName(customerOtpRateCounters);
const customersTable = getTableName(customers);

type CustomerOtpRateAdmission = {
  readonly requestId: string;
  readonly now: number;
  readonly cooldown: { readonly key: string; readonly expiresAt: number };
  readonly phoneDay: { readonly key: string; readonly expiresAt: number };
  readonly ipWindow: { readonly key: string; readonly expiresAt: number };
};

const counterIncrement = (key: string, expiresAt: number, requestId: string) =>
  env.DB.prepare(
    `INSERT INTO ${rateCountersTable} (key, count, expires_at) SELECT ?, 1, ? WHERE EXISTS (SELECT 1 FROM ${rateAdmissionsTable} WHERE request_id = ?) ON CONFLICT(key) DO UPDATE SET count = ${rateCountersTable}.count + 1, expires_at = excluded.expires_at`,
  ).bind(key, expiresAt, requestId);

const admitOtpSend = async (input: CustomerOtpRateAdmission) => {
  const results = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM ${rateCountersTable} WHERE key IN (SELECT key FROM ${rateCountersTable} WHERE expires_at <= ? ORDER BY expires_at LIMIT 100)`,
    ).bind(input.now),
    env.DB.prepare(
      `DELETE FROM ${rateAdmissionsTable} WHERE request_id IN (SELECT request_id FROM ${rateAdmissionsTable} WHERE created_at <= ? ORDER BY created_at LIMIT 100)`,
    ).bind(input.now - 24 * 60 * 60 * 1_000),
    env.DB.prepare(
      `INSERT INTO ${rateAdmissionsTable} (request_id, created_at) SELECT ?, ? WHERE COALESCE((SELECT count FROM ${rateCountersTable} WHERE key = ? AND expires_at > ?), 0) < 1 AND COALESCE((SELECT count FROM ${rateCountersTable} WHERE key = ? AND expires_at > ?), 0) < 5 AND COALESCE((SELECT count FROM ${rateCountersTable} WHERE key = ? AND expires_at > ?), 0) < 10`,
    ).bind(
      input.requestId,
      input.now,
      input.cooldown.key,
      input.now,
      input.phoneDay.key,
      input.now,
      input.ipWindow.key,
      input.now,
    ),
    counterIncrement(input.cooldown.key, input.cooldown.expiresAt, input.requestId),
    counterIncrement(input.phoneDay.key, input.phoneDay.expiresAt, input.requestId),
    counterIncrement(input.ipWindow.key, input.ipWindow.expiresAt, input.requestId),
    env.DB.prepare(
      `SELECT EXISTS(SELECT 1 FROM ${rateAdmissionsTable} WHERE request_id = ?) AS admitted, MAX(CASE WHEN key = ? AND count >= 1 THEN expires_at WHEN key = ? AND count >= 5 THEN expires_at WHEN key = ? AND count >= 10 THEN expires_at END) AS retryAt FROM ${rateCountersTable} WHERE key IN (?, ?, ?)`,
    ).bind(
      input.requestId,
      input.cooldown.key,
      input.phoneDay.key,
      input.ipWindow.key,
      input.cooldown.key,
      input.phoneDay.key,
      input.ipWindow.key,
    ),
  ]);
  const source = results.at(-1)?.results.at(0);
  const admission = v.parse(RateAdmissionSchema, source);
  return admission.admitted === 1
    ? { admitted: true as const }
    : {
        admitted: false as const,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(((admission.retryAt ?? input.now + 1_000) - input.now) / 1_000),
        ),
      };
};

const replaceChallenge = async (
  phone: MongolianPhone,
  digest: string,
  requestId: string,
  createdAt: number,
  expiresAt: number,
) => {
  await env.DB.prepare(
    `INSERT INTO ${challengesTable} (normalized_phone, digest, request_id, attempts, expires_at, created_at) VALUES (?, ?, ?, 0, ?, ?) ON CONFLICT(normalized_phone) DO UPDATE SET digest = excluded.digest, request_id = excluded.request_id, attempts = 0, expires_at = excluded.expires_at, created_at = excluded.created_at`,
  )
    .bind(phone, digest, requestId, expiresAt, createdAt)
    .run();
};

const consumeChallenge = async (phone: MongolianPhone, digest: string, now: number) => {
  const matched = first(
    await env.DB.prepare(
      `DELETE FROM ${challengesTable} WHERE normalized_phone = ? AND digest = ? AND expires_at > ? AND attempts < 5 RETURNING request_id AS requestId`,
    )
      .bind(phone, digest, now)
      .run(),
  );
  if (matched) {
    return v.parse(ReturnedRequestSchema, matched);
  }

  const exhausted = first(
    await env.DB.prepare(
      `DELETE FROM ${challengesTable} WHERE normalized_phone = ? AND expires_at > ? AND attempts = 4 RETURNING request_id AS requestId`,
    )
      .bind(phone, now)
      .run(),
  );
  if (!exhausted) {
    await env.DB.prepare(
      `UPDATE ${challengesTable} SET attempts = attempts + 1 WHERE normalized_phone = ? AND expires_at > ? AND attempts < 4`,
    )
      .bind(phone, now)
      .run();
  }
  await env.DB.prepare(
    `DELETE FROM ${challengesTable} WHERE normalized_phone = ? AND expires_at <= ?`,
  )
    .bind(phone, now)
    .run();
  return undefined;
};

const establish = async (phone: MongolianPhone) => {
  const customerId = createCustomerId();
  await env.DB.prepare(
    `INSERT INTO ${customersTable} (id, normalized_phone, auth_user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(normalized_phone) DO NOTHING`,
  )
    .bind(customerId, phone, customerId, Date.now())
    .run();
  const row = first(
    await env.DB.prepare(
      `SELECT id, normalized_phone AS normalizedPhone, auth_user_id AS authUserId FROM ${customersTable} WHERE normalized_phone = ?`,
    )
      .bind(phone)
      .run(),
  );
  return v.parse(ReturnedCustomerSchema, row);
};

const findByAuthUserId = async (authUserId: string) => {
  const row = first(
    await env.DB.prepare(
      `SELECT id, normalized_phone AS normalizedPhone, auth_user_id AS authUserId FROM ${customersTable} WHERE auth_user_id = ?`,
    )
      .bind(authUserId)
      .run(),
  );
  return row ? v.parse(ReturnedCustomerSchema, row) : undefined;
};

export const customerQueries = {
  admitOtpSend,
  replaceChallenge,
  consumeChallenge,
  establish,
  findByAuthUserId,
};
