export type CatalogSkuOwnerKind = "variant" | "bundle";

export const catalogSku = (slug: string, ownerKind: CatalogSkuOwnerKind, ownerId: string) => {
  const ownerMarker = ownerKind === "variant" ? "VAR" : "BND";
  const suffix = `${ownerMarker}-${ownerId.slice(-10).toUpperCase()}`;
  const maximumStemLength = 64 - suffix.length - 1;
  const [firstSegment = "ITEM", ...remainingSegments] = slug.toUpperCase().split("-");
  let stem = firstSegment.slice(0, maximumStemLength);
  for (const segment of remainingSegments) {
    if (stem.length + segment.length + 1 > maximumStemLength) {
      break;
    }
    stem += `-${segment}`;
  }
  return `${stem}-${suffix}`;
};

export const compactSku = (value: string) =>
  value
    .replaceAll(/[A-Z]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 32))
    .replaceAll(/[-/\p{White_Space}]/gu, "");
