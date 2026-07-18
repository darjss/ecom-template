export const catalogSku = (slug: string, ownerId: string) => {
  const suffix = ownerId.slice(-10).toUpperCase();
  const stem = slug.slice(0, 64 - suffix.length - 1).toUpperCase();
  return `${stem}-${suffix}`;
};

export const compactSku = (value: string) =>
  value
    .replaceAll(/[A-Z]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 32))
    .replaceAll(/[-/\p{White_Space}]/gu, "");
