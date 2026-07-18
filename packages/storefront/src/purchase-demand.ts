import type { CartLine } from "@ecom/contracts";

type PurchaseIdentity =
  | { readonly kind: "variant"; readonly id: string }
  | { readonly kind: "bundle"; readonly id: string };

const identityOf = (line: CartLine): PurchaseIdentity =>
  line.kind === "variant"
    ? { kind: "variant", id: line.variantId }
    : { kind: "bundle", id: line.bundleId };

const matchesIdentity = (line: CartLine, identity: PurchaseIdentity) => {
  const candidate = identityOf(line);
  return candidate.kind === identity.kind && candidate.id === identity.id;
};

const boundedDemand = (quantity: number) => ({
  quantity: Math.min(quantity, 999),
  withinBounds: quantity <= 999,
});

export const resolvePurchaseDemand = (
  lines: readonly CartLine[],
  identity: PurchaseIdentity,
  proposedQuantity: number,
) =>
  boundedDemand(
    lines.reduce(
      (total, line) => total + (matchesIdentity(line, identity) ? line.quantity : 0),
      proposedQuantity,
    ),
  );

export const resolveCartEditDemand = (
  lines: readonly CartLine[],
  line: CartLine,
  proposedQuantity: number,
) => {
  const identity = identityOf(line);
  const editedIndex = lines.indexOf(line);
  if (editedIndex === -1) {
    return { identity, quantity: 999, withinBounds: false };
  }
  return {
    identity,
    ...boundedDemand(
      lines.reduce(
        (total, candidate, index) =>
          total +
          (matchesIdentity(candidate, identity)
            ? index === editedIndex
              ? proposedQuantity
              : candidate.quantity
            : 0),
        0,
      ),
    ),
  };
};
