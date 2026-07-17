import {
  createCustomerId,
  CustomerIdSchema,
  MongolianPhoneSchema,
  type MongolianPhone,
} from "@ecom/contracts";
import { and, eq, exists, gt, gte, inArray, lte, lt, or, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import {
  customerOtpChallenges,
  customerOtpRateAdmissions,
  customerOtpRateCounters,
  customers,
} from "../db/schema";

const ReturnedRequestSchema = v.object({ requestId: v.string() });
const ReturnedCustomerSchema = v.object({
  id: CustomerIdSchema,
  normalizedPhone: MongolianPhoneSchema,
  authUserId: v.string(),
});

const customerSelection = {
  id: customers.id,
  normalizedPhone: customers.normalizedPhone,
  authUserId: customers.authUserId,
};

type CustomerOtpRateAdmission = {
  readonly requestId: string;
  readonly now: number;
  readonly cooldown: { readonly key: string; readonly expiresAt: number };
  readonly phoneDay: { readonly key: string; readonly expiresAt: number };
  readonly ipWindow: { readonly key: string; readonly expiresAt: number };
};

const admitOtpSend = async (input: CustomerOtpRateAdmission) => {
  const db = database();
  const unexpiredCounterAtLimit = (key: string, limit: number) =>
    db
      .select({ key: customerOtpRateCounters.key })
      .from(customerOtpRateCounters)
      .where(
        and(
          eq(customerOtpRateCounters.key, key),
          gt(customerOtpRateCounters.expiresAt, new Date(input.now)),
          gte(customerOtpRateCounters.count, limit),
        ),
      );
  const incrementCounter = (key: string, expiresAt: number) =>
    db
      .insert(customerOtpRateCounters)
      .select(
        db
          .select({
            key: sql<string>`${key}`.as("key"),
            count: sql<number>`1`.as("count"),
            expiresAt: sql<Date>`${expiresAt}`.as("expires_at"),
          })
          .from(customerOtpRateAdmissions)
          .where(eq(customerOtpRateAdmissions.requestId, input.requestId)),
      )
      .onConflictDoUpdate({
        target: customerOtpRateCounters.key,
        set: {
          count: sql`${customerOtpRateCounters.count} + 1`,
          expiresAt: new Date(expiresAt),
        },
      });

  const expiredCounterKeys = db
    .select({ key: customerOtpRateCounters.key })
    .from(customerOtpRateCounters)
    .where(lte(customerOtpRateCounters.expiresAt, new Date(input.now)))
    .orderBy(customerOtpRateCounters.expiresAt)
    .limit(100);
  const staleAdmissionIds = db
    .select({ requestId: customerOtpRateAdmissions.requestId })
    .from(customerOtpRateAdmissions)
    .where(lte(customerOtpRateAdmissions.createdAt, new Date(input.now - 24 * 60 * 60 * 1_000)))
    .orderBy(customerOtpRateAdmissions.createdAt)
    .limit(100);
  const counters = [input.cooldown, input.phoneDay, input.ipWindow];
  const [, , , , , , , admittedRows, counterRows] = await db.batch([
    db
      .delete(customerOtpRateCounters)
      .where(inArray(customerOtpRateCounters.key, expiredCounterKeys)),
    db
      .delete(customerOtpRateAdmissions)
      .where(inArray(customerOtpRateAdmissions.requestId, staleAdmissionIds)),
    db.insert(customerOtpRateAdmissions).values({
      requestId: input.requestId,
      createdAt: new Date(input.now),
    }),
    db
      .delete(customerOtpRateAdmissions)
      .where(
        and(
          eq(customerOtpRateAdmissions.requestId, input.requestId),
          or(
            exists(unexpiredCounterAtLimit(input.cooldown.key, 1)),
            exists(unexpiredCounterAtLimit(input.phoneDay.key, 5)),
            exists(unexpiredCounterAtLimit(input.ipWindow.key, 10)),
          ),
        ),
      ),
    incrementCounter(input.cooldown.key, input.cooldown.expiresAt),
    incrementCounter(input.phoneDay.key, input.phoneDay.expiresAt),
    incrementCounter(input.ipWindow.key, input.ipWindow.expiresAt),
    db
      .select({ requestId: customerOtpRateAdmissions.requestId })
      .from(customerOtpRateAdmissions)
      .where(eq(customerOtpRateAdmissions.requestId, input.requestId))
      .limit(1),
    db
      .select({
        key: customerOtpRateCounters.key,
        count: customerOtpRateCounters.count,
        expiresAt: customerOtpRateCounters.expiresAt,
      })
      .from(customerOtpRateCounters)
      .where(
        inArray(
          customerOtpRateCounters.key,
          counters.map(({ key }) => key),
        ),
      ),
  ]);

  if (admittedRows.length > 0) {
    return { admitted: true as const };
  }

  const retryAt = counterRows.reduce((latest, counter) => {
    const limit =
      counter.key === input.cooldown.key ? 1 : counter.key === input.phoneDay.key ? 5 : 10;
    return counter.count >= limit ? Math.max(latest, counter.expiresAt.getTime()) : latest;
  }, input.now + 1_000);
  return {
    admitted: false as const,
    retryAfterSeconds: Math.max(1, Math.ceil((retryAt - input.now) / 1_000)),
  };
};

const replaceChallenge = async (
  phone: MongolianPhone,
  digest: string,
  requestId: string,
  createdAt: number,
  expiresAt: number,
) => {
  await database()
    .insert(customerOtpChallenges)
    .values({
      normalizedPhone: phone,
      digest,
      requestId,
      attempts: 0,
      expiresAt: new Date(expiresAt),
      createdAt: new Date(createdAt),
    })
    .onConflictDoUpdate({
      target: customerOtpChallenges.normalizedPhone,
      set: {
        digest,
        requestId,
        attempts: 0,
        expiresAt: new Date(expiresAt),
        createdAt: new Date(createdAt),
      },
    });
};

const consumeChallenge = async (phone: MongolianPhone, digest: string, now: number) => {
  const db = database();
  const activePhone = and(
    eq(customerOtpChallenges.normalizedPhone, phone),
    gt(customerOtpChallenges.expiresAt, new Date(now)),
  );
  const [matched] = await db.batch([
    db
      .delete(customerOtpChallenges)
      .where(
        and(
          activePhone,
          eq(customerOtpChallenges.digest, digest),
          lt(customerOtpChallenges.attempts, 5),
        ),
      )
      .returning({ requestId: customerOtpChallenges.requestId }),
    db.delete(customerOtpChallenges).where(and(activePhone, eq(customerOtpChallenges.attempts, 4))),
    db
      .update(customerOtpChallenges)
      .set({ attempts: sql`${customerOtpChallenges.attempts} + 1` })
      .where(and(activePhone, lt(customerOtpChallenges.attempts, 4))),
    db
      .delete(customerOtpChallenges)
      .where(
        and(
          eq(customerOtpChallenges.normalizedPhone, phone),
          lte(customerOtpChallenges.expiresAt, new Date(now)),
        ),
      ),
  ]);
  const row = matched.at(0);
  return row ? v.parse(ReturnedRequestSchema, row) : undefined;
};

const establish = async (phone: MongolianPhone) => {
  const db = database();
  const customerId = createCustomerId();
  const [, rows] = await db.batch([
    db
      .insert(customers)
      .values({
        id: customerId,
        normalizedPhone: phone,
        authUserId: customerId,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: customers.normalizedPhone }),
    db
      .select(customerSelection)
      .from(customers)
      .where(eq(customers.normalizedPhone, phone))
      .limit(1),
  ]);
  return v.parse(ReturnedCustomerSchema, rows.at(0));
};

const findByAuthUserId = async (authUserId: string) => {
  const rows = await database()
    .select(customerSelection)
    .from(customers)
    .where(eq(customers.authUserId, authUserId))
    .limit(1);
  const row = rows.at(0);
  return row ? v.parse(ReturnedCustomerSchema, row) : undefined;
};

export const customerQueries = {
  admitOtpSend,
  replaceChallenge,
  consumeChallenge,
  establish,
  findByAuthUserId,
};
