import { catalogMutationOptions } from "@ecom/client";
import type { Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createSignal, Show } from "solid-js";

export const InventoryAdjustmentForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const [idempotencyKey, setIdempotencyKey] = createSignal(crypto.randomUUID());
  const form = createForm(() => ({
    defaultValues: { delta: 0, reason: "" },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        kind: "adjust",
        id: props.product.id,
        ...value,
        idempotencyKey: idempotencyKey(),
      });
      form.reset();
      setIdempotencyKey(crypto.randomUUID());
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
