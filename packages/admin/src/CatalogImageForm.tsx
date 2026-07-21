import { catalogImageMutationOptions } from "@ecom/client";
import type { CatalogClientError, Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

type CatalogImageFormValues = {
  readonly file: File | null;
  readonly position: number;
  readonly altText: string;
};

const positions = [0, 1, 2, 3, 4, 5, 6, 7];

const mutationErrorMessage = (error: CatalogClientError) =>
  error.kind === "api"
    ? error.error.message
    : "Зургийг хадгалж чадсангүй. Сүлжээг шалгаад дахин оролдоно уу.";

export const CatalogImageForm = (props: { item: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogImageMutationOptions(queryClient));
  const defaultValues: CatalogImageFormValues = { file: null, position: 0, altText: "" };
  const form = createForm(() => ({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (!value.file) {
        return;
      }
      await mutation.mutateAsync({
        catalogItemId: props.item.id,
        file: value.file,
        position: value.position,
        altText: value.altText.trim(),
      });
      form.reset();
    },
  }));

  return (
    <section class="col-span-full border-t border-black/10 pt-4" aria-label="Каталогийн зураг">
      <Show when={props.item.images.length > 0}>
        <ul class="m-0 mb-4 flex list-none flex-wrap gap-3 p-0">
          <For each={props.item.images}>
            {(image) => (
              <li class="w-28">
                <img
                  class="aspect-square w-full rounded-lg border border-black/15 object-cover"
                  src={`/media/${image.mediaAsset.id}/320.webp`}
                  alt={image.altText}
                  width="112"
                  height="112"
                  loading="lazy"
                />
                <p class="mt-1.5 mb-0 text-xs text-(--muted)">
                  {image.position + 1}. {image.altText}
                </p>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <form
        class="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(12rem,1fr)_7rem_minmax(16rem,2fr)_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          await form.handleSubmit();
        }}
      >
        <form.Field name="file">
          {(field) => (
            <label class="grid min-w-0 gap-1.5 text-xs font-bold text-(--muted)">
              <span>JPEG, PNG эсвэл WebP · 8 MB хүртэл</span>
              <input
                class="min-h-11 w-full min-w-0 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink) file:mr-3 file:rounded-md file:border-0 file:bg-(--surface) file:px-3 file:py-1.5 file:font-bold file:text-(--ink)"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) =>
                  field().handleChange(event.currentTarget.files?.item(0) ?? null)
                }
              />
            </label>
          )}
        </form.Field>
        <form.Field name="position">
          {(field) => (
            <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
              <span>Байрлал</span>
              <select
                class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
                value={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.selectedIndex)}
              >
                <For each={positions}>{(position) => <option>{position + 1}</option>}</For>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="altText">
          {(field) => (
            <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
              <span>Энэ хэрэглээнд харагдах зургийн тайлбар</span>
              <input
                class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
                required
                maxlength={240}
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <Button type="submit" variant="secondary" disabled={mutation.isPending}>
          {mutation.isPending ? "Хадгалж байна…" : "Зураг хадгалах"}
        </Button>
        <Show when={mutation.error} keyed>
          {(error) => (
            <p class="md:col-span-full" role="alert">
              {mutationErrorMessage(error)}
            </p>
          )}
        </Show>
      </form>
    </section>
  );
};
