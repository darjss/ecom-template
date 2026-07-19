import { createStoreQueryClient, guestTrackingQueryOptions } from "@ecom/client";
import {
  GuestTrackingRequestSchema,
  type GuestTrackingClientError,
  type GuestTrackingRequest,
} from "@ecom/contracts";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import * as v from "valibot";

declare global {
  interface Window {
    guestTrackingFragment?: string;
  }
}

const money = new Intl.NumberFormat("mn-MN");
const fallbackRequest: GuestTrackingRequest = {
  orderId: "order_00000000000000000000000000",
  token: "0000000000000000000000000000000000000000000",
};
const orderState = {
  placed: "Захиалга хүлээн авсан",
  completed: "Захиалга дууссан",
  cancelled: "Захиалга цуцлагдсан",
} as const;
const paymentState = {
  pending: "Төлбөр хүлээгдэж байна",
  awaiting_confirmation: "Шилжүүлэг баталгаажихыг хүлээж байна",
  confirmed: "Төлбөр баталгаажсан",
  rejected: "Төлбөр татгалзсан",
  failed: "Төлбөр амжилтгүй",
  expired: "Төлбөрийн хугацаа дууссан",
  superseded: "Өөр төлбөрөөр солигдсон",
  released_unresolved: "Төлбөр шалгагдаж байна",
  partially_refunded: "Төлбөрийн хэсгийг буцаасан",
  refunded: "Төлбөрийг буцаасан",
} as const;
const fulfillmentState = {
  unfulfilled: "Бэлтгэж эхлээгүй",
  processing: "Бэлтгэж байна",
  ready: "Бэлэн болсон",
  handed_off: "Хүргэлтэд өгсөн",
  picked_up: "Очоод авсан",
  fulfilled: "Хүлээлгэн өгсөн",
  delivery_failed: "Хүргэлт амжилтгүй",
  returned: "Буцаагдсан",
  cancelled: "Хүргэлт цуцлагдсан",
} as const;

const errorMessage = (error: GuestTrackingClientError) =>
  error.kind === "api" && error.error.code === "not_found"
    ? "Энэ tracking холбоос хүчингүй эсвэл хугацаа нь дууссан байна."
    : "Захиалгын мэдээллийг одоогоор авч чадсангүй.";

const readCapability = () => {
  const value = (window.guestTrackingFragment ?? window.location.hash).slice(1);
  delete window.guestTrackingFragment;
  const separator = value.indexOf(".");
  const parsed = v.safeParse(GuestTrackingRequestSchema, {
    orderId: value.slice(0, separator),
    token: value.slice(separator + 1),
  });
  history.replaceState(null, "", "/tracking");
  return parsed.success ? parsed.output : undefined;
};

const GuestTrackingContent = () => {
  const [capability, setCapability] = createSignal<GuestTrackingRequest>();
  const [fragmentRead, setFragmentRead] = createSignal(false);
  onMount(() => {
    setCapability(readCapability());
    setFragmentRead(true);
  });
  const tracking = useQuery(() => ({
    ...guestTrackingQueryOptions(capability() ?? fallbackRequest),
    enabled: capability() !== undefined,
  }));
  return (
    <Switch>
      <Match when={!fragmentRead() || tracking.isPending}>
        <p
          class="mx-auto max-w-2xl border-y border-black/15 bg-white px-5 py-10 text-center font-bold"
          role="status"
        >
          Захиалгын явцыг шалгаж байна…
        </p>
      </Match>
      <Match when={fragmentRead() && capability() === undefined}>
        <p
          class="mx-auto max-w-2xl border-y border-red-800/25 bg-red-50 px-5 py-10 text-center font-bold text-red-900"
          role="alert"
        >
          Tracking холбоос дутуу эсвэл хүчингүй байна.
        </p>
      </Match>
      <Match when={tracking.error} keyed>
        {(error) => (
          <p
            class="mx-auto max-w-2xl border-y border-red-800/25 bg-red-50 px-5 py-10 text-center font-bold text-red-900"
            role="alert"
          >
            {errorMessage(error)}
          </p>
        )}
      </Match>
      <Match when={tracking.data?.data} keyed>
        {(order) => (
          <article class="mx-auto max-w-3xl overflow-hidden border border-black/15 bg-white">
            <header class="flex flex-wrap items-end justify-between gap-6 bg-(--navy) px-5 py-7 text-white sm:px-8 sm:py-9">
              <div>
                <p class="m-0 text-sm font-bold opacity-80">Захиалга №{order.orderNumber}</p>
                <h1 class="mt-2 mb-0 text-2xl leading-tight font-extrabold text-balance sm:text-4xl">
                  {orderState[order.state]}
                </h1>
              </div>
              <strong class="text-xl tabular-nums sm:text-2xl">
                {money.format(order.totalMnt)} ₮
              </strong>
            </header>
            <div class="grid border-b border-black/15 sm:grid-cols-2" aria-label="Захиалгын төлөв">
              <section class="px-5 py-6 sm:border-r sm:border-black/15 sm:px-8">
                <h2 class="m-0 text-sm font-bold text-black/65">Төлбөр</h2>
                <Show when={order.payments.at(-1)} fallback={<p>Төлбөр шаардахгүй</p>} keyed>
                  {(payment) => <p>{paymentState[payment.state]}</p>}
                </Show>
              </section>
              <section class="border-t border-black/15 px-5 py-6 sm:border-t-0 sm:px-8">
                <h2 class="m-0 text-sm font-bold text-black/65">
                  {order.fulfillment.mode === "delivery" ? "Хүргэлт" : "Pickup"}
                </h2>
                <p>{fulfillmentState[order.fulfillment.state]}</p>
              </section>
            </div>
            <section class="px-5 py-7 sm:px-8" aria-labelledby="tracking-lines-title">
              <h2 id="tracking-lines-title" class="m-0 text-lg font-bold">
                Захиалгын бараа
              </h2>
              <ul class="m-0 mt-4 list-none border-t border-black/15 p-0">
                <For each={order.lines}>
                  {(line) => (
                    <li class="flex items-start justify-between gap-5 border-b border-black/15 py-4">
                      <span class="grid gap-1">
                        <b>{line.name}</b>
                        <small class="text-black/65">
                          {line.sku} · {line.quantity} ширхэг
                        </small>
                      </span>
                      <strong class="whitespace-nowrap tabular-nums">
                        {money.format(line.totalMnt)} ₮
                      </strong>
                    </li>
                  )}
                </For>
              </ul>
            </section>
            <p class="m-0 border-t border-black/15 bg-(--yellow) px-5 py-4 text-sm font-bold sm:px-8">
              Энэ хувийн холбоос {new Date(order.expiresAt).toLocaleDateString("mn-MN")} хүртэл
              ажиллана.
            </p>
          </article>
        )}
      </Match>
    </Switch>
  );
};

export const GuestTrackingIsland = () => (
  <QueryClientProvider client={createStoreQueryClient()}>
    <GuestTrackingContent />
  </QueryClientProvider>
);
