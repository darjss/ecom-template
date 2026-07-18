import type { PublicProductDetail } from "@ecom/contracts";
import { For, Show } from "solid-js";
import { selectVariant } from "./variant-selection";

export const ProductVariantSelector = (props: {
  readonly product: PublicProductDetail;
  readonly selectedVariantId: () => string;
  readonly onSelect: (id: string) => void;
}) => {
  const selectedVariant = () =>
    props.product.variants.find(({ id }) => id === props.selectedVariantId());
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
    const next = selectVariant(props.product.variants, props.selectedVariantId(), groupId, valueId);
    if (next) {
      props.onSelect(next.id);
    }
  };
  return (
    <>
      <For each={props.product.optionGroups}>
        {(group) => (
          <fieldset class="m-0 grid gap-2 border-0 p-0">
            <legend class="mb-1 text-sm font-bold">{group.label}</legend>
            <div class="flex flex-wrap gap-2">
              <For each={group.values}>
                {(value) => {
                  const selected = () => selectedValueId(group.id) === value.id;
                  const impossible = () => variantsContaining(group.id, value.id).length === 0;
                  return (
                    <button
                      type="button"
                      class="min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition-colors motion-reduce:transition-none"
                      classList={{
                        "border-(--tomato) bg-(--tomato) text-white": selected(),
                        "border-black/25 bg-white text-(--ink)": !selected(),
                      }}
                      aria-pressed={selected()}
                      disabled={impossible()}
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
          <p class="m-0 text-sm text-(--muted)" aria-live="polite">
            Барааны код: <strong>{variant.sku}</strong>
          </p>
        )}
      </Show>
    </>
  );
};
