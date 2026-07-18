import type { CartLine } from "@ecom/contracts";

type PurchaseIdentity =
  | { readonly kind: "variant"; readonly id: string }
  | { readonly kind: "bundle"; readonly id: string };

const matchesIdentity = (line: CartLine, identity: PurchaseIdentity) =>
  line.kind === identity.kind &&
  (line.kind === "variant" ? line.variantId : line.bundleId) === identity.id;

export const resolvePurchaseDemand = (
  lines: readonly CartLine[],
  identity: PurchaseIdentity,
  proposedQuantity: number,
) => {
  const existingQuantity = lines.reduce(
    (total, line) => total + (matchesIdentity(line, identity) ? line.quantity : 0),
    0,
  );
  const resultingQuantity = existingQuantity + proposedQuantity;
  return {
    quantity: Math.min(resultingQuantity, 999),
    withinBounds: resultingQuantity <= 999,
  };
};
