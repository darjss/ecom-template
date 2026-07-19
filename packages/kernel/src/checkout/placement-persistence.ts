import {
  PlaceOrderResultSchema,
  createAuditEventId,
  createDiscountRedemptionId,
  createFulfillmentId,
  createInventoryEntryId,
  createOrderDiscountId,
  createOrderId,
  createOrderLineId,
  createPaymentEntryId,
  createPaymentId,
  createReservationId,
  type CheckoutQuote,
  type PlaceOrderInput,
  type PlaceOrderResult,
} from "@ecom/contracts";
import { and, eq, exists, sql } from "drizzle-orm";
import * as v from "valibot";
import { database } from "../db/database";
import {
  auditEvents,
  commerceSettings,
  discountRedemptionEntries,
  discountRules,
  fulfillments,
  inventoryEntries,
  inventoryReservationItems,
  inventoryReservations,
  orderDiscountAdjustments,
  orderDiscountAllocations,
  orderLines,
  orders,
  paymentEntries,
  payments,
  placementIdempotency,
  stockItems,
} from "../db/schema";

type PlacementDestination =
  | { kind: "delivery"; address: string }
  | { kind: "pickup"; locationId: string; name: string; address: string };

export const readPlacement = async (key: string) => {
  const rows = await database()
    .select({
      intentDigest: placementIdempotency.intentDigest,
      resultJson: placementIdempotency.resultJson,
    })
    .from(placementIdempotency)
    .where(eq(placementIdempotency.key, key))
    .limit(1);
  const row = rows.at(0);
  return row
    ? {
        intentDigest: row.intentDigest,
        result: v.parse(PlaceOrderResultSchema, JSON.parse(row.resultJson)),
      }
    : undefined;
};

export const commitPlacement = async (
  input: PlaceOrderInput,
  quote: CheckoutQuote,
  intentDigest: string,
  destination: PlacementDestination,
): Promise<PlaceOrderResult | undefined> => {
  const db = database();
  const orderId = createOrderId();
  const lineIds = new Map(quote.lines.map((line) => [line.position, createOrderLineId()]));
  const paymentId = createPaymentId();
  const fulfillmentId = createFulfillmentId();
  const reservationId = createReservationId();
  const adjustmentId = quote.discount.kind === "applied" ? createOrderDiscountId() : undefined;
  const correlationId = crypto.randomUUID();
  const now = new Date();
  const demand = new Map<string, number>();
  for (const line of quote.lines) {
    for (const item of line.demand) {
      demand.set(item.variantId, (demand.get(item.variantId) ?? 0) + item.quantity);
    }
  }
  const stockAvailable = [...demand].map(([variantId, quantity]) =>
    exists(
      db
        .select({ id: stockItems.id })
        .from(stockItems)
        .where(
          and(
            eq(stockItems.variantId, variantId),
            sql`${stockItems.onHandQuantity} - ${stockItems.reservedQuantity} >= ${quantity}`,
          ),
        ),
    ),
  );
  const discountAvailable =
    quote.discount.kind === "applied"
      ? exists(
          db
            .select({ id: discountRules.id })
            .from(discountRules)
            .where(
              and(
                eq(discountRules.id, quote.discount.ruleId),
                eq(discountRules.state, "active"),
                sql`${discountRules.globalLimit} IS NULL OR (SELECT coalesce(sum(${discountRedemptionEntries.quantityDelta}), 0) FROM ${discountRedemptionEntries} WHERE ${discountRedemptionEntries.discountRuleId} = ${discountRules.id}) < ${discountRules.globalLimit}`,
              ),
            ),
        )
      : undefined;
  const orderExists = exists(
    db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)),
  );
  const orderStatement = db.insert(orders).select(
    db
      .select({
        id: sql<string>`${orderId}`.as("id"),
        orderNumber:
          sql<number>`coalesce((SELECT max(${orders.orderNumber}) FROM ${orders}), 0) + 1`.as(
            "order_number",
          ),
        state: sql<"placed">`'placed'`.as("state"),
        recipientName: sql<string>`${input.contact.recipientName}`.as("recipient_name"),
        recipientPhone: sql<string>`${input.contact.recipientPhone}`.as("recipient_phone"),
        currency: sql<"MNT">`'MNT'`.as("currency"),
        subtotalMnt: sql<number>`${quote.subtotalMnt}`.as("subtotal_mnt"),
        discountTotalMnt:
          sql<number>`${quote.discount.kind === "applied" ? quote.discount.amountMnt : 0}`.as(
            "discount_total_mnt",
          ),
        deliveryFeeMnt: sql<number>`${quote.deliveryFeeMnt}`.as("delivery_fee_mnt"),
        grandTotalMnt: sql<number>`${quote.totalMnt}`.as("grand_total_mnt"),
        fulfillmentMode: sql<"delivery" | "pickup">`${destination.kind}`.as("fulfillment_mode"),
        deliveryAddress: sql<
          string | null
        >`${destination.kind === "delivery" ? destination.address : null}`.as("delivery_address"),
        pickupLocationId: sql<
          string | null
        >`${destination.kind === "pickup" ? destination.locationId : null}`.as(
          "pickup_location_id",
        ),
        pickupName: sql<
          string | null
        >`${destination.kind === "pickup" ? destination.name : null}`.as("pickup_name"),
        pickupAddress: sql<
          string | null
        >`${destination.kind === "pickup" ? destination.address : null}`.as("pickup_address"),
        commercialFingerprint: sql<string>`${quote.commercialFingerprint}`.as(
          "commercial_fingerprint",
        ),
        placedAt: sql<Date>`${now.getTime()}`.as("placed_at"),
        createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
      })
      .from(commerceSettings)
      .where(
        and(
          eq(commerceSettings.key, "commerce"),
          eq(commerceSettings.bankTransferEnabled, true),
          sql`NOT EXISTS (SELECT 1 FROM ${placementIdempotency} WHERE ${placementIdempotency.key} = ${input.idempotencyKey})`,
          ...stockAvailable,
          discountAvailable,
        ),
      ),
  );
  const statements = [];
  for (const line of quote.lines) {
    const lineId = lineIds.get(line.position);
    if (!lineId) {
      throw new Error("Order Line identity missing");
    }
    statements.push(
      db.insert(orderLines).select(
        db
          .select({
            id: sql<string>`${lineId}`.as("id"),
            orderId: orders.id,
            position: sql<number>`${line.position}`.as("position"),
            catalogItemId: sql<string>`${line.source.catalogItemId}`.as("catalog_item_id"),
            itemKind: sql<
              "product" | "bundle"
            >`${line.source.kind === "variant" ? "product" : "bundle"}`.as("item_kind"),
            variantId: sql<
              string | null
            >`${line.source.kind === "variant" ? line.source.id : null}`.as("variant_id"),
            itemName: sql<string>`${line.name}`.as("item_name"),
            sku: sql<string>`${line.sku}`.as("sku"),
            quantity: sql<number>`${line.quantity}`.as("quantity"),
            unitPriceMnt: sql<number>`${line.unitPriceMnt}`.as("unit_price_mnt"),
            merchandiseAmountMnt: sql<number>`${line.merchandiseAmountMnt}`.as(
              "merchandise_amount_mnt",
            ),
            discountMnt: sql<number>`${line.discountMnt}`.as("discount_mnt"),
            totalMnt: sql<number>`${line.totalMnt}`.as("total_mnt"),
            optionsJson: sql<string>`${JSON.stringify(line.options)}`.as("options_json"),
            personalizationsJson: sql<string>`${JSON.stringify(line.personalizations)}`.as(
              "personalizations_json",
            ),
            bundleComponentsJson: sql<string>`${JSON.stringify(line.bundleComponents)}`.as(
              "bundle_components_json",
            ),
          })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ),
    );
  }
  if (quote.discount.kind === "applied" && adjustmentId) {
    statements.push(
      db.insert(orderDiscountAdjustments).select(
        db
          .select({
            id: sql<string>`${adjustmentId}`.as("id"),
            orderId: orders.id,
            discountRuleId: sql<string>`${quote.discount.ruleId}`.as("discount_rule_id"),
            ruleName: sql<string>`${quote.discount.name}`.as("rule_name"),
            amountMnt: sql<number>`${quote.discount.amountMnt}`.as("amount_mnt"),
          })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ),
      db.insert(discountRedemptionEntries).select(
        db
          .select({
            id: sql<string>`${createDiscountRedemptionId()}`.as("id"),
            discountRuleId: sql<string>`${quote.discount.ruleId}`.as("discount_rule_id"),
            orderId: orders.id,
            kind: sql<"claim">`'claim'`.as("kind"),
            quantityDelta: sql<number>`1`.as("quantity_delta"),
            commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
            createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          })
          .from(orders)
          .where(eq(orders.id, orderId)),
      ),
    );
    for (const line of quote.lines.filter(({ discountMnt }) => discountMnt > 0)) {
      const lineId = lineIds.get(line.position);
      if (!lineId) {
        throw new Error("Discount allocation Order Line identity missing");
      }
      statements.push(
        db.insert(orderDiscountAllocations).select(
          db
            .select({
              adjustmentId: sql<string>`${adjustmentId}`.as("adjustment_id"),
              orderLineId: sql<string>`${lineId}`.as("order_line_id"),
              amountMnt: sql<number>`${line.discountMnt}`.as("amount_mnt"),
            })
            .from(orders)
            .where(eq(orders.id, orderId)),
        ),
      );
    }
  }
  statements.push(
    db.insert(inventoryReservations).select(
      db
        .select({
          id: sql<string>`${reservationId}`.as("id"),
          orderId: orders.id,
          state: sql<"active">`'active'`.as("state"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          transitionedAt: sql<Date | null>`NULL`.as("transitioned_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
  );
  for (const [variantId, quantity] of demand) {
    const stockExistsForOrder = and(eq(stockItems.variantId, variantId), orderExists);
    statements.push(
      db.insert(inventoryReservationItems).select(
        db
          .select({
            reservationId: sql<string>`${reservationId}`.as("reservation_id"),
            stockItemId: stockItems.id,
            quantity: sql<number>`${quantity}`.as("quantity"),
          })
          .from(stockItems)
          .where(stockExistsForOrder),
      ),
      db.insert(inventoryEntries).select(
        db
          .select({
            id: sql<string>`${createInventoryEntryId()}`.as("id"),
            stockItemId: stockItems.id,
            reservationId: sql<string>`${reservationId}`.as("reservation_id"),
            orderId: sql<string>`${orderId}`.as("order_id"),
            kind: sql<"reservation">`'reservation'`.as("kind"),
            onHandDelta: sql<number>`0`.as("on_hand_delta"),
            reservedDelta: sql<number>`${quantity}`.as("reserved_delta"),
            actorKind: sql<"system">`'system'`.as("actor_kind"),
            staffId: sql<string | null>`NULL`.as("staff_id"),
            staffRole: sql<"owner" | "manager" | "staff" | null>`NULL`.as("staff_role"),
            reason: sql<string>`'order_placement'`.as("reason"),
            commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
            createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          })
          .from(stockItems)
          .where(stockExistsForOrder),
      ),
      db
        .update(stockItems)
        .set({
          reservedQuantity: sql`${stockItems.reservedQuantity} + ${quantity}`,
          updatedAt: now,
        })
        .where(stockExistsForOrder),
    );
  }
  statements.push(
    db.insert(payments).select(
      db
        .select({
          id: sql<string>`${paymentId}`.as("id"),
          orderId: orders.id,
          attemptNumber: sql<number>`1`.as("attempt_number"),
          method: sql<"bank_transfer">`'bank_transfer'`.as("method"),
          state: sql<"awaiting_confirmation">`'awaiting_confirmation'`.as("state"),
          expectedAmountMnt: orders.grandTotalMnt,
          confirmedAmountMnt: sql<number>`0`.as("confirmed_amount_mnt"),
          refundedAmountMnt: sql<number>`0`.as("refunded_amount_mnt"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
    db.insert(paymentEntries).select(
      db
        .select({
          id: sql<string>`${createPaymentEntryId()}`.as("id"),
          paymentId: sql<string>`${paymentId}`.as("payment_id"),
          sequence: sql<number>`1`.as("sequence"),
          kind: sql<"expected">`'expected'`.as("kind"),
          expectedDeltaMnt: orders.grandTotalMnt,
          confirmedDeltaMnt: sql<number>`0`.as("confirmed_delta_mnt"),
          refundedDeltaMnt: sql<number>`0`.as("refunded_delta_mnt"),
          actorKind: sql<"system">`'system'`.as("actor_kind"),
          commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
    db.insert(fulfillments).select(
      db
        .select({
          id: sql<string>`${fulfillmentId}`.as("id"),
          orderId: orders.id,
          mode: sql<"delivery" | "pickup">`${destination.kind}`.as("mode"),
          state: sql<"unfulfilled">`'unfulfilled'`.as("state"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
          updatedAt: sql<Date>`${now.getTime()}`.as("updated_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
    db.insert(auditEvents).select(
      db
        .select({
          id: sql<string>`${createAuditEventId()}`.as("id"),
          actorKind: sql<"system">`'system'`.as("actor_kind"),
          actorId: sql<string | null>`NULL`.as("actor_id"),
          staffRole: sql<"owner" | "manager" | "staff" | null>`NULL`.as("staff_role"),
          telegramOperatorLabel: sql<string | null>`NULL`.as("telegram_operator_label"),
          telegramUserId: sql<number | null>`NULL`.as("telegram_user_id"),
          sourceChannel: sql<"storefront">`'storefront'`.as("source_channel"),
          action: sql<string>`'order.place'`.as("action"),
          outcome: sql<"accepted">`'accepted'`.as("outcome"),
          entityKind: sql<string>`'order'`.as("entity_kind"),
          entityId: orders.id,
          reason: sql<string | null>`NULL`.as("reason"),
          commandCorrelationId: sql<string>`${correlationId}`.as("command_correlation_id"),
          metadataJson: sql<string | null>`NULL`.as("metadata_json"),
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
    db.insert(placementIdempotency).select(
      db
        .select({
          key: sql<string>`${input.idempotencyKey}`.as("key"),
          intentDigest: sql<string>`${intentDigest}`.as("intent_digest"),
          resultJson: sql<string>`json_object(
            'orderId', ${orders.id},
            'orderNumber', ${orders.orderNumber},
            'orderState', 'placed',
            'totalMnt', ${orders.grandTotalMnt},
            'payment', json_object('id', ${paymentId}, 'method', 'bank_transfer', 'state', 'awaiting_confirmation', 'expectedAmountMnt', ${orders.grandTotalMnt}),
            'fulfillment', json_object('id', ${fulfillmentId}, 'mode', ${destination.kind}, 'state', 'unfulfilled'),
            'reservation', json_object('id', ${reservationId}, 'state', 'active')
          )`.as("result_json"),
          orderId: orders.id,
          createdAt: sql<Date>`${now.getTime()}`.as("created_at"),
        })
        .from(orders)
        .where(eq(orders.id, orderId)),
    ),
  );
  await db.batch([orderStatement, ...statements]);
  const placement = await readPlacement(input.idempotencyKey);
  return placement?.intentDigest === intentDigest ? placement.result : undefined;
};
