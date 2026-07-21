import { catalogMutationOptions } from "@ecom/client";
import type { CatalogClientError, Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { CatalogImageForm } from "./CatalogImageForm";
import { InventoryAdjustmentForm } from "./InventoryAdjustmentForm";
import { ProductVariantsForm } from "./ProductVariantsForm";

const money = new Intl.NumberFormat("mn-MN");

const mutationErrorMessage = (error: CatalogClientError) =>
  error.kind === "api" ? error.error.message : "Хүсэлтийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.";

const ProductEditForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: {
      name: props.product.name,
      slug: props.product.slug,
      description: props.product.description,
      priceMnt: props.product.priceMnt,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "update",
        id: props.product.id,
        name: value.name.trim(),
        slug: value.slug.trim(),
        description: value.description,
        priceMnt: value.priceMnt,
      });
    },
  }));
  return (
    <form
      class="col-span-full grid grid-cols-1 items-end gap-3 md:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Нэр</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
              required
              maxlength={120}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="slug">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>URL slug</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="priceMnt">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Үнэ (₮)</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
              type="number"
              min="1"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Тайлбар</span>
            <textarea
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
              maxlength={5000}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" variant="secondary" disabled={mutation.isPending}>
        Хадгалах
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{mutationErrorMessage(error)}</p>}
      </Show>
    </form>
  );
};

export const CatalogProductRow = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const nextAction = () =>
    props.product.state === "draft"
      ? ("publish" as const)
      : props.product.state === "published"
        ? ("archive" as const)
        : ("reactivate" as const);
  const actionLabel = () =>
    props.product.state === "draft"
      ? "Нийтлэх"
      : props.product.state === "published"
        ? "Архивлах"
        : "Дахин идэвхжүүлэх";
  return (
    <li class="grid grid-cols-1 gap-4 border-t border-black/10 py-5 md:grid-cols-[minmax(14rem,1fr)_auto]">
      <div class="grid gap-1 text-sm text-(--muted)">
        <strong class="text-base text-(--ink)">{props.product.name}</strong>
        <span>
          {props.product.sku} · {money.format(props.product.priceMnt)} ₮ · {props.product.state}
        </span>
        <span>
          Гар дээр {props.product.onHandQuantity}, нөөцлөгдсөн {props.product.reservedQuantity}
        </span>
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ kind: nextAction(), id: props.product.id })}
      >
        {actionLabel()}
      </Button>
      <ProductEditForm product={props.product} />
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{mutationErrorMessage(error)}</p>}
      </Show>
      <CatalogImageForm item={props.product} />
      <ProductVariantsForm product={props.product} />
      <InventoryAdjustmentForm product={props.product} />
    </li>
  );
};
