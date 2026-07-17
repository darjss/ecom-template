import { catalogMutationOptions } from "@ecom/client";
import type { Product } from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createSignal, Show } from "solid-js";

export const InventoryAdjustmentForm = (props: { product: Product }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => catalogMutationOptions(queryClient));
  const [pendingCommand, setPendingCommand] = createSignal<{
    signature: string;
    idempotencyKey: string;
  }>();
  const form = createForm(() => ({
    defaultValues: { delta: 0, reason: "" },
    onSubmit: async ({ value }) => {
      const canonicalReason = value.reason.trim();
      const signature = JSON.stringify([value.delta, canonicalReason]);
      const existing = pendingCommand();
      const command =
        existing?.signature === signature
          ? existing
          : { signature, idempotencyKey: crypto.randomUUID() };
      setPendingCommand(command);
      await mutation.mutateAsync({
        kind: "adjust",
        id: props.product.id,
        delta: value.delta,
        reason: canonicalReason,
        idempotencyKey: command.idempotencyKey,
      });
      form.reset();
      setPendingCommand(undefined);
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
