import { catalogMutationOptions } from "@ecom/client";
import {
  OptionValueIdSchema,
  createOptionGroupId,
  createOptionValueId,
  type OptionValueId,
  type Product,
} from "@ecom/contracts";
import { AltArrowDown, AltArrowUp, Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import * as v from "valibot";

const currentDraft = (product: Product) => ({
  groups: product.optionConfiguration.groups
    .filter(({ state }) => state === "active")
    .map((group) => ({
      id: group.id,
      key: group.key,
      label: group.label,
      position: group.position,
      values: group.values
        .filter(({ state }) => state === "active")
        .map((value) => ({
          id: value.id,
          key: value.key,
          label: value.label,
          position: value.position,
        })),
    })),
  variants: product.optionConfiguration.variants
    .filter(({ isDefault }) => !isDefault)
    .map((variant) => ({
      id: variant.id,
      optionValueIds: variant.optionValueIds,
      priceOverrideMnt: variant.priceOverrideMnt,
      imageMediaAssetId: variant.imageMediaAssetId,
      state: variant.state,
    })),
});

const errorText = "Сонголтын мэдээллийг хадгалж чадсангүй.";

const OptionPresentationEditor = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const groups = () => currentDraft(props.product).groups;
  const saveGroups = async (nextGroups: ReturnType<typeof groups>) => {
    const draft = currentDraft(props.product);
    await mutation.mutateAsync({
      kind: "save-options",
      id: props.product.id,
      groups: nextGroups,
      variants: draft.variants,
    });
  };
  return (
    <div class="grid gap-3">
      <For each={groups()}>
        {(group, index) => {
          const form = createForm(() => ({
            defaultValues: {
              label: group.label,
              valueLabels: group.values.map(({ label }) => label).join(", "),
            },
            onSubmit: async ({ value }) => {
              const labels = value.valueLabels.split(",").map((label) => label.trim());
              if (labels.length !== group.values.length || labels.some((label) => !label)) {
                return;
              }
              await saveGroups(
                groups().map((candidate) =>
                  candidate.id === group.id
                    ? {
                        ...candidate,
                        label: value.label.trim(),
                        values: candidate.values.map((optionValue, position) => ({
                          ...optionValue,
                          label: labels[position] ?? optionValue.label,
                        })),
                      }
                    : candidate,
                ),
              );
            },
          }));
          const move = async (offset: -1 | 1) => {
            const next = [...groups()];
            const target = index() + offset;
            const moving = next[index()];
            const replaced = next[target];
            if (!moving || !replaced) {
              return;
            }
            next[index()] = { ...replaced, position: index() };
            next[target] = { ...moving, position: target };
            await saveGroups(next);
          };
          return (
            <form
              class="grid grid-cols-1 items-end gap-3 border-t border-black/10 pt-3 md:grid-cols-[1fr_2fr_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                await form.handleSubmit();
              }}
            >
              <form.Field name="label">
                {(field) => (
                  <label class="grid gap-1 text-xs font-bold text-(--muted)">
                    <span>Бүлгийн нэр</span>
                    <input
                      class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
                      required
                      maxlength={80}
                      value={field().state.value}
                      onInput={(event) => field().handleChange(event.currentTarget.value)}
                    />
                  </label>
                )}
              </form.Field>
              <form.Field name="valueLabels">
                {(field) => (
                  <label class="grid gap-1 text-xs font-bold text-(--muted)">
                    <span>Утгын нэрс</span>
                    <input
                      class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
                      required
                      value={field().state.value}
                      onInput={(event) => field().handleChange(event.currentTarget.value)}
                    />
                  </label>
                )}
              </form.Field>
              <div class="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mutation.isPending || index() === 0}
                  onClick={() => void move(-1)}
                  aria-label={`${group.label} дээш`}
                >
                  <AltArrowUp aria-hidden="true" size={20} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mutation.isPending || index() === groups().length - 1}
                  onClick={() => void move(1)}
                  aria-label={`${group.label} доош`}
                >
                  <AltArrowDown aria-hidden="true" size={20} />
                </Button>
                <Button type="submit" variant="secondary" disabled={mutation.isPending}>
                  Нэр хадгалах
                </Button>
              </div>
            </form>
          );
        }}
      </For>
      <Show when={mutation.isError}>
        <p role="alert">{errorText}</p>
      </Show>
    </div>
  );
};

const AddOptionGroupForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { key: "", label: "", values: "" },
    onSubmit: async ({ value }) => {
      const parsedValues = value.values
        .split(",")
        .map((entry) => entry.trim().split(":"))
        .filter((entry) => entry.length === 2 && entry[0] && entry[1]);
      if (parsedValues.length === 0) {
        return;
      }
      const draft = currentDraft(props.product);
      const groupId = createOptionGroupId();
      await mutation.mutateAsync({
        kind: "save-options",
        id: props.product.id,
        groups: [
          ...draft.groups,
          {
            id: groupId,
            key: value.key.trim(),
            label: value.label.trim(),
            position: draft.groups.length,
            values: parsedValues.map(([key, label], position) => ({
              id: createOptionValueId(),
              key: key ?? "",
              label: label ?? "",
              position,
            })),
          },
        ],
        variants: draft.variants,
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid grid-cols-1 gap-3 border-t border-black/10 pt-4 md:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="label">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Сонголтын бүлэг</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              required
              maxlength={80}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="key">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Түлхүүр</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="values">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Утгууд (red:Улаан, blue:Цэнхэр)</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button
        type="submit"
        variant="secondary"
        disabled={mutation.isPending || currentDraft(props.product).groups.length >= 3}
      >
        Бүлэг нэмэх
      </Button>
      <Show when={mutation.isError}>
        <p role="alert">{errorText}</p>
      </Show>
    </form>
  );
};

const AddVariantForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const groups = () =>
    props.product.optionConfiguration.groups.filter(({ state }) => state === "active");
  const form = createForm(() => ({
    defaultValues: { optionValueIds: [] as OptionValueId[], priceOverrideMnt: "" },
    onSubmit: async ({ value }) => {
      if (value.optionValueIds.length !== groups().length) {
        return;
      }
      const draft = currentDraft(props.product);
      await mutation.mutateAsync({
        kind: "save-options",
        id: props.product.id,
        groups: draft.groups,
        variants: [
          ...draft.variants,
          {
            optionValueIds: value.optionValueIds,
            priceOverrideMnt: value.priceOverrideMnt === "" ? null : Number(value.priceOverrideMnt),
            imageMediaAssetId: null,
            state: "active",
          },
        ],
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid grid-cols-1 gap-3 border-t border-black/10 pt-4 md:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="optionValueIds">
        {(field) => (
          <For each={groups()}>
            {(group, index) => (
              <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
                <span>{group.label}</span>
                <select
                  class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                  required
                  value={field().state.value[index()] ?? ""}
                  onChange={(event) => {
                    const parsed = v.safeParse(OptionValueIdSchema, event.currentTarget.value);
                    if (parsed.success) {
                      const next = [...field().state.value];
                      next[index()] = parsed.output;
                      field().handleChange(next);
                    }
                  }}
                >
                  <option value="">Сонгох</option>
                  <For each={group.values.filter(({ state }) => state === "active")}>
                    {(value) => <option value={value.id}>{value.label}</option>}
                  </For>
                </select>
              </label>
            )}
          </For>
        )}
      </form.Field>
      <form.Field name="priceOverrideMnt">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Үнэ өөрчлөх (₮)</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
              type="number"
              min="1"
              placeholder="Үндсэн үнэ"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button
        type="submit"
        variant="secondary"
        disabled={mutation.isPending || groups().length === 0}
      >
        Variant нэмэх
      </Button>
      <Show when={mutation.isError}>
        <p role="alert">{errorText}</p>
      </Show>
    </form>
  );
};

const VariantRow = (props: {
  product: Product;
  variant: Product["optionConfiguration"]["variants"][number];
}) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: {
      priceOverrideMnt:
        props.variant.priceOverrideMnt === null ? "" : String(props.variant.priceOverrideMnt),
      imageMediaAssetId: props.variant.imageMediaAssetId ?? "",
    },
    onSubmit: async ({ value }) =>
      mutation.mutateAsync({
        kind: "update-variant",
        id: props.product.id,
        variantId: props.variant.id,
        priceOverrideMnt: value.priceOverrideMnt === "" ? null : Number(value.priceOverrideMnt),
        imageMediaAssetId:
          value.imageMediaAssetId === ""
            ? null
            : (props.product.images.find(
                ({ mediaAsset }) => mediaAsset.id === value.imageMediaAssetId,
              )?.mediaAsset.id ?? null),
      }),
  }));
  const labels = () =>
    props.variant.optionValueIds
      .flatMap((id) =>
        props.product.optionConfiguration.groups.flatMap((group) =>
          group.values.filter((value) => value.id === id).map(({ label }) => label),
        ),
      )
      .join(" / ");
  return (
    <li class="grid gap-3 border-t border-black/10 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{labels()}</strong> · {props.variant.sku} · {props.variant.state}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              kind: props.variant.state === "active" ? "archive-variant" : "reactivate-variant",
              id: props.product.id,
              variantId: props.variant.id,
            })
          }
        >
          {props.variant.state === "active" ? "Архивлах" : "Идэвхжүүлэх"}
        </Button>
      </div>
      <form
        class="flex flex-wrap items-end gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await form.handleSubmit();
        }}
      >
        <form.Field name="priceOverrideMnt">
          {(field) => (
            <label class="grid gap-1 text-xs font-bold text-(--muted)">
              <span>Үнэ</span>
              <input
                class="min-h-11 w-36 rounded-lg border border-black/25 bg-(--paper) px-3 font-normal text-(--ink)"
                type="number"
                min="1"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="imageMediaAssetId">
          {(field) => (
            <label class="grid gap-1 text-xs font-bold text-(--muted)">
              <span>Бүтээгдэхүүний зураг</span>
              <select
                class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 text-(--ink)"
                value={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.value)}
              >
                <option value="">Үндсэн зураг</option>
                <For each={props.product.images}>
                  {(image) => <option value={image.mediaAsset.id}>{image.altText}</option>}
                </For>
              </select>
            </label>
          )}
        </form.Field>
        <Button type="submit" variant="secondary" disabled={mutation.isPending}>
          Хадгалах
        </Button>
      </form>
      <Show when={mutation.isError}>
        <p role="alert">{errorText}</p>
      </Show>
    </li>
  );
};

export const ProductVariantsForm = (props: { product: Product }) => (
  <section class="col-span-full grid gap-4" aria-label={`${props.product.name} сонголт ба Variant`}>
    <div>
      <h3 class="m-0 text-base font-bold">Сонголт ба Variant</h3>
      <p class="mt-1 mb-0 text-sm text-(--muted)">
        SKU автоматаар үүсэж, анхны нийтлэлтийн дараа сонголтын баримтууд түгжигдэнэ.
      </p>
    </div>
    <OptionPresentationEditor product={props.product} />
    <Show when={props.product.state === "draft"}>
      <AddOptionGroupForm product={props.product} />
      <AddVariantForm product={props.product} />
    </Show>
    <ul class="m-0 list-none p-0">
      <For each={props.product.optionConfiguration.variants.filter(({ isDefault }) => !isDefault)}>
        {(variant) => <VariantRow product={props.product} variant={variant} />}
      </For>
    </ul>
  </section>
);
