import { catalogMutationOptions, catalogQueryOptions } from "@ecom/client";
import { type Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");

const InventoryAdjustmentForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { delta: 0, reason: "" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ kind: "adjust", id: props.product.id, ...value });
      form.reset();
    },
  }));
  return (
    <form
      class="catalog-adjustment"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="delta">
        {(field) => (
          <label>
            <span>Өөрчлөлт</span>
            <input
              type="number"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="reason">
        {(field) => (
          <label>
            <span>Шалтгаан</span>
            <input
              required
              maxlength={240}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" variant="secondary" disabled={mutation.isPending}>
        Тохируулах
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p role="alert">
            {error.kind === "api" && error.error.reason === "reservation_blocked"
              ? `Идэвхтэй захиалгын нөөц хааж байна: ${error.error.blockers?.map((blocker) => blocker.orderReference).join(", ") ?? ""}`
              : "Нөөцийг өөрчилж чадсангүй."}
          </p>
        )}
      </Show>
    </form>
  );
};

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
    </form>
  );
};

const ProductRow = (props: { product: Product }) => {
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
      <Show when={mutation.data?.data.cache === "committed_but_not_purged"}>
        <p role="alert">Өөрчлөлт хадгалагдсан ч public cache цэвэрлэгдсэнгүй.</p>
      </Show>
      <InventoryAdjustmentForm product={props.product} />
    </li>
  );
};

const CreateProductForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      priceMnt: 1,
      sku: "",
      openingQuantity: 0,
      inventoryReason: "Анхны үлдэгдэл",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ kind: "create", ...value });
      form.reset();
    },
  }));
  return (
    <form
      class="catalog-create-form"
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
      <form.Field name="openingQuantity">
        {(field) => (
          <label>
            <span>Анхны үлдэгдэл</span>
            <input
              type="number"
              min="0"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="inventoryReason">
        {(field) => (
          <label>
            <span>Үлдэгдлийн шалтгаан</span>
            <input
              required
              maxlength={240}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
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
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Бүтээгдэхүүн үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => (
          <p role="alert">
            {error.kind === "api" ? error.error.message : "Бүтээгдэхүүн үүсгэж чадсангүй."}
          </p>
        )}
      </Show>
    </form>
  );
};

export const CatalogManagement = () => {
  const catalog = useQuery(() => catalogQueryOptions());
  return (
    <section class="staff-management catalog-management" aria-labelledby="catalog-title">
      <div class="section-heading">
        <div>
          <h2 id="catalog-title">Бүтээгдэхүүн ба нөөц</h2>
          <p>Default Variant, байнгын SKU болон шалтгаант үлдэгдлийг нэг дор удирдана.</p>
        </div>
        <span class="staff-count">{catalog.data?.data.length ?? 0} бүтээгдэхүүн</span>
      </div>
      <CreateProductForm />
      <Show
        when={catalog.isSuccess ? catalog.data : undefined}
        keyed
        fallback={<p role="status">Каталог ачаалж байна…</p>}
      >
        {(data) => (
          <Show when={data.data.length > 0} fallback={<p>Анхны бүтээгдэхүүнээ үүсгэнэ үү.</p>}>
            <ul class="staff-list">
              <For each={data.data}>{(product) => <ProductRow product={product} />}</For>
            </ul>
          </Show>
        )}
      </Show>
    </section>
  );
};
