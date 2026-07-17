import type { PublicProductDetail } from "@ecom/contracts";
import { createMemo, createSignal, For, Show } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");

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
  const selectValue = (groupId: string, valueId: string) => {
    const current = selectedVariant();
    const exact = props.product.variants.find(
      (variant) =>
        variant.optionValues.some(
          (value) => value.groupId === groupId && value.valueId === valueId,
        ) &&
        current?.optionValues.every(
          (value) =>
            value.groupId === groupId ||
            variant.optionValues.some(
              (candidate) =>
                candidate.groupId === value.groupId && candidate.valueId === value.valueId,
            ),
        ),
    );
    const fallback = props.product.variants.find((variant) =>
      variant.optionValues.some((value) => value.groupId === groupId && value.valueId === valueId),
    );
    const next = exact ?? fallback;
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
                  const isSold = () =>
                    props.product.variants.some((variant) =>
                      variant.optionValues.some(
                        (selection) =>
                          selection.groupId === group.id && selection.valueId === value.id,
                      ),
                    );
                  return (
                    <button
                      type="button"
                      class="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition-colors motion-reduce:transition-none"
                      classList={{
                        "border-(--tomato) bg-(--tomato) text-white": isSelected(),
                        "border-black/25 bg-white text-(--ink)": !isSelected(),
                      }}
                      disabled={!isSold()}
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
