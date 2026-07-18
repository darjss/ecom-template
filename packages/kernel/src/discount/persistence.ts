import {
  DiscountRuleSchema,
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
  discountTargets,
  variants,
} from "../db/schema";
import type { StaffActor } from "../staff/operations";

const targetRow = (discountRuleId: DiscountRuleId, target: DiscountTarget, position: number) => ({
  discountRuleId,
  position,
  kind: target.kind,
  productId: target.kind === "product" ? target.id : null,
  variantId: target.kind === "variant" ? target.id : null,
  categoryId: target.kind === "category" ? target.id : null,
  collectionId: target.kind === "collection" ? target.id : null,
});

const targetsFor = (ruleId: string, rows: readonly (typeof discountTargets.$inferSelect)[]) =>
  rows
    .filter(({ discountRuleId }) => discountRuleId === ruleId)
    .map((target) => {
      if (target.kind === "all") {
        return { kind: "all" as const };
      }
      if (target.kind === "product" && target.productId) {
        return { kind: "product" as const, id: target.productId };
      }
      if (target.kind === "variant" && target.variantId) {
        return { kind: "variant" as const, id: target.variantId };
      }
      if (target.kind === "category" && target.categoryId) {
        return { kind: "category" as const, id: target.categoryId };
      }
      if (target.kind === "collection" && target.collectionId) {
        return { kind: "collection" as const, id: target.collectionId };
      }
      throw new Error("Invalid persisted Discount target");
    });

const dto = (row: typeof discountRules.$inferSelect, targets: DiscountTarget[]) =>
  v.parse(DiscountRuleSchema, {
    ...row,
    targets,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

const readRules = async (onlyActive = false) => {
  const db = database();
  const ruleQuery = db
    .select()
    .from(discountRules)
    .where(onlyActive ? eq(discountRules.state, "active") : undefined)
    .orderBy(asc(discountRules.createdAt), asc(discountRules.id));
  const targetQuery = db.select().from(discountTargets).orderBy(asc(discountTargets.position));
  const [rows, targetRows] = await db.batch([ruleQuery, targetQuery] as const);
  return rows.map((row) => dto(row, targetsFor(row.id, targetRows)));
};

const audit = (actor: StaffActor, action: string, id: DiscountRuleId, now: Date) =>
  database().insert(auditEvents).values({
    id: createAuditEventId(),
    actorKind: "staff",
    actorId: actor.staffId,
    staffRole: actor.role,
    sourceChannel: "admin",
    action,
    outcome: "accepted",
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
      return { kind: "invalid_target" as const };
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
          redemptionCount: 0,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        }),
        db
          .insert(discountTargets)
          .values(input.targets.map((target, position) => targetRow(id, target, position))),
        audit(actor, "discount.create", id, now),
      ] as const);
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
      const [changed] = await db.batch([
        db
          .update(discountRules)
          .set({
            ...inputValues(input),
            revision: sql`${discountRules.revision} + 1`,
            updatedAt: now,
          })
          .where(and(eq(discountRules.id, id), eq(discountRules.revision, expectedRevision)))
          .returning({ id: discountRules.id }),
        db
          .delete(discountTargets)
          .where(
            and(
              eq(discountTargets.discountRuleId, id),
              sql`EXISTS (SELECT 1 FROM discount_rules WHERE id = ${id} AND revision = ${expectedRevision + 1})`,
            ),
          ),
        db.insert(discountTargets).select(
          db
            .select({
              discountRuleId: sql<string>`${id}`.as("discount_rule_id"),
              position: sql<number>`json_each.key`.as("position"),
              kind: sql<
                typeof discountTargets.$inferInsert.kind
              >`json_extract(json_each.value, '$.kind')`.as("kind"),
              productId: sql<string | null>`json_extract(json_each.value, '$.productId')`.as(
                "product_id",
              ),
              variantId: sql<string | null>`json_extract(json_each.value, '$.variantId')`.as(
                "variant_id",
              ),
              categoryId: sql<string | null>`json_extract(json_each.value, '$.categoryId')`.as(
                "category_id",
              ),
              collectionId: sql<string | null>`json_extract(json_each.value, '$.collectionId')`.as(
                "collection_id",
              ),
            })
            .from(
              sql`json_each(${JSON.stringify(input.targets.map((target, position) => targetRow(id, target, position)))})`,
            )
            .where(
              sql`EXISTS (SELECT 1 FROM discount_rules WHERE id = ${id} AND revision = ${expectedRevision + 1})`,
            ),
        ),
        audit(actor, "discount.change", id, now),
      ] as const);
      if (changed.length === 0) {
        const [existing] = await db
          .select({ id: discountRules.id })
          .from(discountRules)
          .where(eq(discountRules.id, id))
          .limit(1);
        return { kind: existing ? ("revision_conflict" as const) : ("not_found" as const) };
      }
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
    const [current] = await db
      .select()
      .from(discountRules)
      .where(eq(discountRules.id, id))
      .limit(1);
    if (!current) {
      return { kind: "not_found" as const };
    }
    if (current.revision !== expectedRevision) {
      return { kind: "revision_conflict" as const };
    }
    if ((current.state === "draft" && state === "inactive") || current.state === state) {
      return { kind: "invalid_lifecycle" as const };
    }
    const now = new Date();
    const [changed] = await db.batch([
      db
        .update(discountRules)
        .set({ state, revision: sql`${discountRules.revision} + 1`, updatedAt: now })
        .where(and(eq(discountRules.id, id), eq(discountRules.revision, expectedRevision)))
        .returning({ id: discountRules.id }),
      audit(actor, state === "active" ? "discount.activate" : "discount.deactivate", id, now),
    ] as const);
    if (changed.length === 0) {
      return { kind: "revision_conflict" as const };
    }
    return { kind: "changed" as const, value: (await readRules()).find((rule) => rule.id === id) };
  },
};
