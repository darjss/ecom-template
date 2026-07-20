import { groupingMutationOptions } from "@ecom/client";
import type { Category } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { groupingErrorMessage, submitAndFocusGroupingError } from "./grouping-form";

const inputClass =
  "min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)";
const labelClass = "grid gap-1.5 text-xs font-bold text-(--muted)";
export const CreateCategoryForm = (props: { categories: readonly Category[] }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { name: "", slug: "", parentId: "", position: 0 },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create-category",
        input: {
          name: value.name.trim(),
          slug: value.slug.trim(),
          parentId: value.parentId === "" ? null : value.parentId,
          position: value.position,
        },
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid gap-3 border-t border-black/10 py-5 md:grid-cols-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusGroupingError(event.currentTarget, () => form.handleSubmit());
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            <span>Ангиллын нэр</span>
            <input
              class={inputClass}
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
          <label class={labelClass}>
            <span>URL slug</span>
            <input
              class={inputClass}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="parentId">
        {(field) => (
          <label class={labelClass}>
            <span>Дээд ангилал</span>
            <select
              class={inputClass}
              value={field().state.value}
              onChange={(event) => field().handleChange(event.currentTarget.value)}
            >
              <option value="">Дээд ангилалгүй</option>
              <For each={props.categories.filter((category) => category.state !== "archived")}>
                {(category) => <option value={category.id}>{category.name}</option>}
              </For>
            </select>
          </label>
        )}
      </form.Field>
      <form.Field name="position">
        {(field) => (
          <label class={labelClass}>
            <span>Дараалал</span>
            <input
              class={inputClass}
              type="number"
              min="0"
              max="10000"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Ангилал үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{groupingErrorMessage(error)}</p>}
      </Show>
    </form>
  );
};

export const CreateCollectionForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { name: "", slug: "", description: "" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create-collection",
        input: {
          name: value.name.trim(),
          slug: value.slug.trim(),
          description: value.description,
        },
      });
      form.reset();
    },
  }));
  return (
    <form
      class="grid gap-3 border-t border-black/10 py-5 md:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusGroupingError(event.currentTarget, () => form.handleSubmit());
      }}
    >
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            <span>Collection нэр</span>
            <input
              class={inputClass}
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
          <label class={labelClass}>
            <span>URL slug</span>
            <input
              class={inputClass}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="description">
        {(field) => (
          <label class={labelClass}>
            <span>Тайлбар</span>
            <input
              class={inputClass}
              maxlength={5000}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Collection үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{groupingErrorMessage(error)}</p>}
      </Show>
    </form>
  );
};

export const CreateTagForm = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => groupingMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { label: "" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "create-tag",
        input: { label: value.label.trim() },
      });
      form.reset();
    },
  }));
  return (
    <form
      class="flex flex-wrap items-end gap-3 border-t border-black/10 py-5"
      onSubmit={async (event) => {
        event.preventDefault();
        await submitAndFocusGroupingError(event.currentTarget, () => form.handleSubmit());
      }}
    >
      <form.Field name="label">
        {(field) => (
          <label class={labelClass}>
            <span>Tag шошго</span>
            <input
              class={inputClass}
              required
              maxlength={80}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Үүсгэж байна…" : "Tag үүсгэх"}
      </Button>
      <Show when={mutation.error} keyed>
        {(error) => <p role="alert">{groupingErrorMessage(error)}</p>}
      </Show>
    </form>
  );
};
