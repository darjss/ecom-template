import type { VariantId } from "@ecom/contracts";

export const skuFromVariantId = (variantId: VariantId) =>
  `SKU-${variantId.slice("variant_".length).toUpperCase()}`;

export const compactSku = (value: string) =>
  value
    .replaceAll(/[A-Z]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 32))
    .replaceAll(/[-/\p{White_Space}]/gu, "");
