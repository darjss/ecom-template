import type { PublicProductDetail } from "@ecom/contracts";
import { createMemo, createSignal, For, Show } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");
const overlapWithCurrent = (
  candidate: PublicProductDetail["variants"][number],
  current: PublicProductDetail["variants"][number] | undefined,
) =>
  current?.optionValues.filter((selection) =>
    candidate.optionValues.some(
      (candidateValue) =>
        candidateValue.groupId === selection.groupId &&
        candidateValue.valueId === selection.valueId,
    ),
  ).length ?? 0;

export const ProductVariantSelector = (props: { product: PublicProductDetail }) => {
  const [selectedVariantId, setSelectedVariantId] = createSignal("");
  const selectedVariant = createMemo(
    () =>
      props.product.variants.find(({ id }) => id === selectedVariantId()) ??
      props.product.variants[0],
  );
  const selectedValueId = (groupId: string) =>
    selectedVariant()?.optionValues.find(({ groupId: candidate }) => candidate === groupId)
      ?.valueId;
  const variantsContaining = (groupId: string, valueId: string) =>
    props.product.variants.filter((variant) =>
      variant.optionValues.some(
        (candidate) => candidate.groupId === groupId && candidate.valueId === valueId,
      ),
    );
  const selectValue = (groupId: string, valueId: string) => {
    const current = selectedVariant();
    const matching = variantsContaining(groupId, valueId);
    const next = matching.reduce<(typeof matching)[number] | undefined>(
      (best, candidate) =>
        !best || overlapWithCurrent(candidate, current) > overlapWithCurrent(best, current)
          ? candidate
          : best,
      undefined,
    );
    if (next) {
      setSelectedVariantId(next.id);
    }
  };
  const image = createMemo(() => selectedVariant()?.image ?? props.product.images[0] ?? null);

  return (
    <div class="grid gap-5" aria-label="Бүтээгдэхүүний сонголт">
      <Show when={image()} keyed>
        {(selectedImage) => (
          <img
            class="aspect-square w-full max-w-72 object-cover"
            src={`/media/${selectedImage.mediaAssetId}/640.webp`}
            alt={selectedImage.altText}
            width="640"
            height="640"
          />
        )}
      </Show>
      <For each={props.product.optionGroups}>
        {(group) => (
          <fieldset class="m-0 grid gap-2 border-0 p-0">
            <legend class="mb-1 text-sm font-bold">{group.label}</legend>
            <div class="flex flex-wrap gap-2">
              <For each={group.values}>
                {(value) => {
                  const isSelected = () => selectedValueId(group.id) === value.id;
                  return (
                    <button
                      type="button"
                      class="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition-colors motion-reduce:transition-none"
                      classList={{
                        "border-(--tomato) bg-(--tomato) text-white": isSelected(),
                        "border-black/25 bg-white text-(--ink)": !isSelected(),
                      }}
                      disabled={variantsContaining(group.id, value.id).length === 0}
                      aria-pressed={isSelected()}
                      onClick={() => selectValue(group.id, value.id)}
                    >
                      {value.label}
                    </button>
                  );
                }}
              </For>
            </div>
          </fieldset>
        )}
      </For>
      <Show when={selectedVariant()} keyed>
        {(variant) => (
          <div aria-live="polite">
            <strong class="block text-2xl tabular-nums">{money.format(variant.priceMnt)} ₮</strong>
            <span class="mt-1 block text-sm text-(--muted)">Барааны код: {variant.sku}</span>
          </div>
        )}
      </Show>
      <p class="m-0 text-sm">
        Сонголт нь танилцуулга бөгөөд худалдан авах боломжийг тусад нь шинээр шалгана.
      </p>
      <button type="button" disabled>
        Боломж шалгаж байна
      </button>
    </div>
  );
};
