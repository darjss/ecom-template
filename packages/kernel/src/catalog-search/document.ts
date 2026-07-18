export const catalogSearchDocumentVersion = "krilleer-cyr-lat-v1" as const;

export const krilleerCyrillicToLatin = [
  ["щ", "shch"],
  ["ш", "sh"],
  ["ч", "ch"],
  ["ц", "c"],
  ["ё", "yo"],
  ["ю", "yu"],
  ["я", "ya"],
  ["е", "ye"],
  ["ж", "j"],
  ["х", "h"],
  ["а", "a"],
  ["б", "b"],
  ["в", "v"],
  ["г", "g"],
  ["д", "d"],
  ["э", "e"],
  ["з", "z"],
  ["и", "i"],
  ["й", "yy"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ф", "f"],
  ["ө", "q"],
  ["ү", "w"],
  ["ы", "y"],
  ["ь", "ь"],
  ["ъ", "'"],
] as const;

const transliteration = new Map<string, string>(krilleerCyrillicToLatin);

export const searchTokens = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .split(/[\p{White_Space}\p{P}\p{S}]+/u)
    .filter(Boolean);

export const transliterateSearchText = (value: string) =>
  [...value.toLowerCase()].map((character) => transliteration.get(character) ?? character).join("");

export type CatalogSearchDocumentInput = {
  readonly itemId: string;
  readonly kind: "product" | "bundle";
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly facets: string;
};

export const buildCatalogSearchDocument = (input: CatalogSearchDocumentInput) => {
  const fields = {
    slug: input.slug.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    facets: input.facets.trim(),
  };
  const fingerprint = JSON.stringify([
    catalogSearchDocumentVersion,
    input.itemId,
    input.kind,
    ...Object.values(fields),
  ]);
  return {
    itemId: input.itemId,
    kind: input.kind,
    documentVersion: catalogSearchDocumentVersion,
    fingerprint,
    ...fields,
    latinSlug: transliterateSearchText(fields.slug),
    latinTitle: transliterateSearchText(fields.title),
    latinDescription: transliterateSearchText(fields.description),
    latinFacets: transliterateSearchText(fields.facets),
  };
};
