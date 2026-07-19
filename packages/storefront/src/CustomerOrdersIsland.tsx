import {
  createStoreQueryClient,
  customerOrdersQueryOptions,
  customerSessionQueryOptions,
} from "@ecom/client";
import { QueryClientProvider, createQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { CustomerAuthPanel } from "./CustomerAuthIsland";
import { OrderSummaryView } from "./OrderSummary";

const CustomerOrdersContent = () => {
  const session = createQuery(() => customerSessionQueryOptions());
  const orders = createQuery(() =>
    customerOrdersQueryOptions(
      session.data?.data.kind === "authenticated" ? session.data.data.phone : undefined,
    ),
  );
  return (
    <div class="grid gap-8">
      <CustomerAuthPanel />
      <Show when={session.data?.data.kind === "authenticated"}>
        <section aria-labelledby="customer-orders-title">
          <h2 id="customer-orders-title" class="m-0 text-2xl font-bold">
            Миний захиалгууд
          </h2>
          <Show
            when={orders.data?.data.orders}
            fallback={
              <p role={orders.error ? "alert" : "status"}>
                {orders.error
                  ? "Захиалгын түүхийг авч чадсангүй."
                  : "Захиалгын түүхийг ачаалж байна…"}
              </p>
            }
          >
            {(history) => (
              <Show
                when={history().length > 0}
                fallback={<p>Энэ дугаарт холбоотой захиалга одоогоор алга.</p>}
              >
                <div class="mt-6 grid gap-8">
                  <For each={history()}>{(order) => <OrderSummaryView order={order} />}</For>
                </div>
              </Show>
            )}
          </Show>
        </section>
      </Show>
    </div>
  );
};

export const CustomerOrdersIsland = () => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerOrdersContent />
    </QueryClientProvider>
  );
};
