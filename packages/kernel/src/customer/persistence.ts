import {
  createCustomerId,
  CustomerIdSchema,
  MongolianPhoneSchema,
  type MongolianPhone,
} from "@ecom/contracts";
import { and, eq, gt, isNull, lte, lt, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import { customerOtpChallenges, customers, orders } from "../db/schema";

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

const establishAndLinkOrders = async (phone: MongolianPhone) => {
  const db = database();
  const customerId = createCustomerId();
  const now = new Date();
  const [, , rows] = await db.batch([
    db
      .insert(customers)
      .values({
        id: customerId,
        normalizedPhone: phone,
        authUserId: customerId,
        createdAt: now,
      })
      .onConflictDoNothing({ target: customers.normalizedPhone }),
    db
      .update(orders)
      .set({
        customerId: sql`(SELECT ${customers.id} FROM ${customers} WHERE ${customers.normalizedPhone} = ${phone})`,
        customerLinkedAt: now,
      })
      .where(and(eq(orders.recipientPhone, phone), isNull(orders.customerId))),
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
  replaceChallenge,
  consumeChallenge,
  establishAndLinkOrders,
  findByAuthUserId,
};
