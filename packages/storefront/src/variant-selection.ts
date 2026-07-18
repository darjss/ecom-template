import type { PublicProductDetail } from "@ecom/contracts";

type PublicVariant = PublicProductDetail["variants"][number];

export const selectVariant = (
  variants: readonly PublicVariant[],
  currentId: string,
  groupId: string,
  valueId: string,
) => {
  const current = variants.find(({ id }) => id === currentId);
  const matching = variants.filter((variant) =>
    variant.optionValues.some((value) => value.groupId === groupId && value.valueId === valueId),
  );
  return matching.reduce<PublicVariant | undefined>((best, candidate) => {
    const overlap = (variant: PublicVariant) =>
      current?.optionValues.filter((selection) =>
        variant.optionValues.some(
          (value) => value.groupId === selection.groupId && value.valueId === selection.valueId,
        ),
      ).length ?? 0;
    return !best || overlap(candidate) > overlap(best) ? candidate : best;
  }, undefined);
};
