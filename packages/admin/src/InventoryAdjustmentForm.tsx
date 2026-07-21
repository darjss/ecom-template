import { catalogMutationOptions } from "@ecom/client";
import type { Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { Show } from "solid-js";

export const InventoryAdjustmentForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const form = createForm(() => ({
    defaultValues: { delta: 0 },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "adjust",
        id: props.product.id,
        delta: value.delta,
      });
      form.reset();
    },
  }));
  return (
    <form
      class="col-span-full grid items-end gap-3 md:flex"
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
      }}
    >
      <form.Field name="delta">
        {(field) => (
          <label class="grid gap-1.5 text-xs font-bold text-(--muted)">
            <span>Өөрчлөлт</span>
            <input
              class="min-h-11 rounded-lg border border-black/25 bg-(--paper) px-3 py-2 font-normal text-(--ink)"
              type="number"
              required
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
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
              ? "Захиалгад нөөцөлсөн тооноос үлдэгдлийг бага болгож болохгүй."
              : "Нөөцийг өөрчилж чадсангүй."}
          </p>
        )}
      </Show>
    </form>
  );
};
