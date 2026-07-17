import { createCustomerId, MongolianPhoneSchema, type MongolianPhone } from "@ecom/contracts";
import { env } from "cloudflare:workers";
import { getTableName } from "drizzle-orm";
import * as v from "valibot";
import { customerOtpChallenges, customers } from "../db/schema";

const ReturnedRequestSchema = v.object({ requestId: v.string() });
const ReturnedCustomerSchema = v.object({
  id: v.string(),
  normalizedPhone: MongolianPhoneSchema,
  authUserId: v.string(),
});

const first = <T>(result: D1Result<T>) => result.results.at(0);
const challengesTable = getTableName(customerOtpChallenges);
const customersTable = getTableName(customers);

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

const establish = async (phone: MongolianPhone, authUserId: string) => {
  await env.DB.prepare(
    `INSERT INTO ${customersTable} (id, normalized_phone, auth_user_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(normalized_phone) DO NOTHING`,
  )
    .bind(createCustomerId(), phone, authUserId, Date.now())
    .run();
  const row = first(
    await env.DB.prepare(
      `SELECT id, normalized_phone AS normalizedPhone, auth_user_id AS authUserId FROM ${customersTable} WHERE normalized_phone = ?`,
    )
      .bind(phone)
      .run(),
  );
  const customer = v.parse(ReturnedCustomerSchema, row);
  return customer.authUserId === authUserId ? customer : undefined;
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
  replaceChallenge,
  consumeChallenge,
  establish,
  findByAuthUserId,
};
