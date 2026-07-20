import {
  DiscountRuleSchema,
  DiscountTargetSchema,
  createAuditEventId,
  createDiscountRuleId,
  type DiscountRule,
  type DiscountRuleId,
  type DiscountRuleInput,
  type DiscountTarget,
} from "@ecom/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import {
  auditEvents,
  catalogItems,
  categories,
  collections,
  discountRules,
  variants,
} from "../db/schema";
import type { StaffActor } from "../staff/operations";

const TargetListSchema = v.pipe(v.array(DiscountTargetSchema), v.minLength(1), v.maxLength(100));
const encodeTargets = (targets: readonly DiscountTarget[]) =>
  JSON.stringify(
    targets.map((target) =>
      target.kind === "all" ? { kind: target.kind } : { id: target.id, kind: target.kind },
    ),
  );
const decodeTargets = (targetsJson: string) => v.parse(TargetListSchema, JSON.parse(targetsJson));

const dto = (row: typeof discountRules.$inferSelect): DiscountRule => {
  const { targetsJson, ...rule } = row;
  return v.parse(DiscountRuleSchema, {
    ...rule,
    targets: decodeTargets(targetsJson),
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
};

const readRules = async (onlyActive = false) => {
  const rows = await database()
    .select()
    .from(discountRules)
    .where(onlyActive ? eq(discountRules.state, "active") : undefined)
    .orderBy(asc(discountRules.createdAt), asc(discountRules.id));
  return rows.map(dto);
};

const auditValues = (actor: StaffActor, action: string, id: DiscountRuleId, now: Date) => ({
  id: createAuditEventId(),
  actorKind: "staff" as const,
  actorId: actor.staffId,
  staffRole: actor.role,
  sourceChannel: "admin" as const,
  action,
  outcome: "accepted" as const,
  entityKind: "discount_rule",
  entityId: id,
  commandCorrelationId: crypto.randomUUID(),
  createdAt: now,
});

const inputValues = (input: DiscountRuleInput) => ({
  name: input.name,
  mode: input.mode,
  code: input.code,
  calculation: input.calculation,
  value: input.value,
  startsAt: input.startsAt ? new Date(input.startsAt) : null,
  endsAt: input.endsAt ? new Date(input.endsAt) : null,
  minimumSubtotalMnt: input.minimumSubtotalMnt,
  globalLimit: input.globalLimit,
  targetsJson: encodeTargets(input.targets),
});

const validTargets = async (targets: readonly DiscountTarget[]) => {
  const products = targets.flatMap((target) => (target.kind === "product" ? [target.id] : []));
  const variantIds = targets.flatMap((target) => (target.kind === "variant" ? [target.id] : []));
  const categoryIds = targets.flatMap((target) => (target.kind === "category" ? [target.id] : []));
  const collectionIds = targets.flatMap((target) =>
    target.kind === "collection" ? [target.id] : [],
  );
  const db = database();
  const [productRows, variantRows, categoryRows, collectionRows] = await db.batch([
    db.select({ id: catalogItems.id }).from(catalogItems).where(inArray(catalogItems.id, products)),
    db.select({ id: variants.id }).from(variants).where(inArray(variants.id, variantIds)),
    db.select({ id: categories.id }).from(categories).where(inArray(categories.id, categoryIds)),
    db
      .select({ id: collections.id })
      .from(collections)
      .where(inArray(collections.id, collectionIds)),
  ] as const);
  return (
    productRows.length === products.length &&
    variantRows.length === variantIds.length &&
    categoryRows.length === categoryIds.length &&
    collectionRows.length === collectionIds.length
  );
};

export type DiscountPersistenceResult =
  | { readonly kind: "changed"; readonly value: DiscountRule | undefined }
  | { readonly kind: "duplicate_code" }
  | { readonly kind: "invalid_target" }
  | { readonly kind: "infrastructure" };

export const discountQueries = {
  list: () => readRules(),
  listActive: () => readRules(true),
  validTargets,
  async create(actor: StaffActor, input: DiscountRuleInput): Promise<DiscountPersistenceResult> {
    if (!(await validTargets(input.targets))) {
      return { kind: "invalid_target" };
    }
    const db = database();
    const id = createDiscountRuleId();
    const now = new Date();
    try {
      await db.batch([
        db.insert(discountRules).values({
          id,
          ...inputValues(input),
          state: "draft",
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
        db.insert(auditEvents).values(auditValues(actor, "discount.create", id, now)),
      ] as const);
      return { kind: "changed", value: (await readRules()).find((rule) => rule.id === id) };
    } catch (error) {
      return {
        kind:
          error instanceof Error && error.message.includes("discount_rules.code")
            ? "duplicate_code"
            : "infrastructure",
      };
    }
  },
  async update(
    actor: StaffActor,
    id: DiscountRuleId,
    expectedRevision: number,
    input: DiscountRuleInput,
  ) {
    if (!(await validTargets(input.targets))) {
      return { kind: "invalid_target" as const };
    }
    const db = database();
    const now = new Date();
    try {
      const changed = await db
        .update(discountRules)
        .set({
          ...inputValues(input),
          revision: sql`${discountRules.revision} + 1`,
          updatedAt: now,
        })
        .where(and(eq(discountRules.id, id), eq(discountRules.revision, expectedRevision)))
        .returning({ id: discountRules.id });
      if (changed.length === 0) {
        const existing = await db
          .select({ id: discountRules.id })
          .from(discountRules)
          .where(eq(discountRules.id, id))
          .limit(1);
        return { kind: existing.length ? ("revision_conflict" as const) : ("not_found" as const) };
      }
      await db.insert(auditEvents).values(auditValues(actor, "discount.change", id, now));
      return {
        kind: "changed" as const,
        value: (await readRules()).find((rule) => rule.id === id),
      };
    } catch (error) {
      return {
        kind:
          error instanceof Error && error.message.includes("discount_rules.code")
            ? ("duplicate_code" as const)
            : ("infrastructure" as const),
      };
    }
  },
  async transition(
    actor: StaffActor,
    id: DiscountRuleId,
    expectedRevision: number,
    state: "active" | "inactive",
  ) {
    const db = database();
    const current = await db
      .select({ state: discountRules.state, revision: discountRules.revision })
      .from(discountRules)
      .where(eq(discountRules.id, id))
      .limit(1);
    const rule = current.at(0);
    if (!rule) {
      return { kind: "not_found" as const };
    }
    if (rule.revision !== expectedRevision) {
      return { kind: "revision_conflict" as const };
    }
    if ((rule.state === "draft" && state === "inactive") || rule.state === state) {
      return { kind: "invalid_lifecycle" as const };
    }
    const now = new Date();
    const changed = await db
      .update(discountRules)
      .set({ state, revision: sql`${discountRules.revision} + 1`, updatedAt: now })
      .where(and(eq(discountRules.id, id), eq(discountRules.revision, expectedRevision)))
      .returning({ id: discountRules.id });
    if (changed.length === 0) {
      return { kind: "revision_conflict" as const };
    }
    await db
      .insert(auditEvents)
      .values(
        auditValues(
          actor,
          state === "active" ? "discount.activate" : "discount.deactivate",
          id,
          now,
        ),
      );
    return { kind: "changed" as const, value: (await readRules()).find((item) => item.id === id) };
  },
};
