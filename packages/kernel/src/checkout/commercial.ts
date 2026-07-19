import type { CheckoutQuote, CheckoutQuoteLine } from "@ecom/contracts";

export type CommercialDiscountPolicy =
  | { kind: "none" }
  | {
      kind: "applied";
      ruleId: string;
      mode: "automatic" | "code";
      code: string | null;
      calculation: "percentage" | "fixed_mnt";
      value: number;
      startsAt: number | null;
      endsAt: number | null;
      minimumSubtotalMnt: number;
      globalLimit: number | null;
      targetsJson: string;
    };

export type CommercialDiscountContext = {
  activeRules: Array<{
    id: string;
    mode: "automatic" | "code";
    code: string | null;
    calculation: "percentage" | "fixed_mnt";
    value: number;
    startsAt: number | null;
    endsAt: number | null;
    minimumSubtotalMnt: number;
    globalLimit: number | null;
    targetsJson: string;
    updatedAt: number;
  }>;
  categoryMemberships: Array<{ catalogItemId: string; categoryId: string }>;
  collectionMemberships: Array<{ catalogItemId: string; collectionId: string }>;
  activeCategoryIds: string[];
  activeCollectionIds: string[];
};

export type CommercialDeliveryPolicy = {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFeeMnt: number;
  freeDeliveryThresholdMnt: number | null;
  updatedAt: number;
};

export type CommercialFacts = ReturnType<typeof commercialFacts>;

const commercialLine = (line: CheckoutQuoteLine) => ({
  position: line.position,
  source: line.source,
  quantity: line.quantity,
  sku: line.sku,
  unitPriceMnt: line.unitPriceMnt,
  merchandiseAmountMnt: line.merchandiseAmountMnt,
  discountMnt: line.discountMnt,
  totalMnt: line.totalMnt,
  options: line.options.map(({ groupId, groupKey, valueId, valueKey }) => ({
    groupId,
    groupKey,
    valueId,
    valueKey,
  })),
  personalizations: line.personalizations.map(({ definitionId, key, value }) => ({
    definitionId,
    key,
    value: value.kind === "single_select" ? { kind: value.kind, valueId: value.valueId } : value,
  })),
  bundleComponents: line.bundleComponents.map(
    ({ variantId, sku, perBundleQuantity, totalQuantity }) => ({
      variantId,
      sku,
      perBundleQuantity,
      totalQuantity,
    }),
  ),
  demand: line.demand,
});

export const commercialFacts = (
  quote: Omit<CheckoutQuote, "quotedAt" | "commercialFingerprint">,
  discountPolicy: CommercialDiscountPolicy,
  discountContext: CommercialDiscountContext,
  deliveryPolicy: CommercialDeliveryPolicy,
) => ({
  lines: quote.lines.map(commercialLine),
  subtotalMnt: quote.subtotalMnt,
  discount:
    quote.discount.kind === "applied"
      ? {
          kind: quote.discount.kind,
          ruleId: quote.discount.ruleId,
          amountMnt: quote.discount.amountMnt,
          submittedCode: quote.discount.submittedCode,
          codeAccepted: quote.discount.codeAccepted,
        }
      : quote.discount,
  discountPolicy,
  discountContext,
  postDiscountMerchandiseMnt: quote.postDiscountMerchandiseMnt,
  fulfillment: quote.fulfillment,
  deliveryPolicy,
  deliveryFeeMnt: quote.deliveryFeeMnt,
  totalMnt: quote.totalMnt,
});
