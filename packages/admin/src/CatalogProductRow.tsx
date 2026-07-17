import { catalogMutationOptions } from "@ecom/client";
import type { CatalogClientError, Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { Show } from "solid-js";
import { InventoryAdjustmentForm } from "./InventoryAdjustmentForm";

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
      sku: props.product.sku,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ kind: "update", id: props.product.id, ...value });
    },
  }));
  return (
    <form
      class="catalog-edit-form"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label>
            <span>Нэр</span>
            <input
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
          <label>
            <span>URL slug</span>
            <input
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="sku">
        {(field) => (
          <label>
            <span>SKU</span>
            <input
              required
              maxlength={64}
              disabled={props.product.state !== "draft"}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="priceMnt">
        {(field) => (
          <label>
            <span>Үнэ (₮)</span>
            <input
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
          <label>
            <span>Тайлбар</span>
            <textarea
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
    <li class="catalog-product-row">
      <div>
        <strong>{props.product.name}</strong>
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
      <Show when={props.product.cachePurgeDebt} keyed>
        {(debt) => (
          <div role="alert">
            <p>
              Өөрчлөлт хадгалагдсан ч public cache цэвэрлэгдсэнгүй. Оролдлого: {debt.attemptCount}
            </p>
            <Show when={debt.requestId} keyed>
              {(requestId) => <p>Cloudflare хүсэлтийн ID: {requestId}</p>}
            </Show>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ kind: "retry-cache-purge", id: props.product.id })}
            >
              Cache цэвэрлэгээг дахин оролдох
            </Button>
          </div>
        )}
      </Show>
      <InventoryAdjustmentForm product={props.product} />
    </li>
  );
};
