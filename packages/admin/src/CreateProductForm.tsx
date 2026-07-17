import { catalogMutationOptions } from "@ecom/client";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { Show } from "solid-js";

export const CreateProductForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      priceMnt: 1,
      openingQuantity: 0,
      inventoryReason: "Анхны үлдэгдэл",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create",
        name: value.name.trim(),
        slug: value.slug.trim(),
        description: value.description,
        priceMnt: value.priceMnt,
        openingQuantity: value.openingQuantity,
        inventoryReason: value.inventoryReason.trim(),
      });
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
