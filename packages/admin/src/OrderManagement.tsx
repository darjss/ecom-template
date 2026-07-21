import {
  adminOrderQueryOptions,
  adminOrdersQueryOptions,
  createStoreQueryClient,
} from "@ecom/client";
import {
  OrderIdSchema,
  type AdminOrder,
  type OrderFulfillmentState,
  type OrderId,
  type OrderPaymentState,
} from "@ecom/contracts";
import { QueryClientProvider, useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import * as v from "valibot";

const money = new Intl.NumberFormat("mn-MN", {
  style: "currency",
  currency: "MNT",
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat("mn-MN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const orderLabels = {
  placed: "Хүлээн авсан",
  completed: "Дууссан",
  cancelled: "Цуцлагдсан",
} as const;

const paymentLabels: Record<OrderPaymentState, string> = {
  pending: "Төлбөр хүлээж байна",
  awaiting_confirmation: "Шилжүүлэг хүлээж байна",
  confirmed: "Төлбөр баталгаажсан",
  failed: "Төлбөр амжилтгүй",
  expired: "Төлбөрийн хугацаа дууссан",
  rejected: "Төлбөр татгалзсан",
  superseded: "Шинэ төлбөрөөр солигдсон",
  released_unresolved: "Төлбөр тодорхойгүй",
  partially_refunded: "Хэсэгчлэн буцаасан",
  refunded: "Буцаан олгосон",
};

const fulfillmentLabels: Record<OrderFulfillmentState, string> = {
  unfulfilled: "Бэлтгэж эхлээгүй",
  processing: "Бэлтгэж байна",
  ready: "Бэлэн",
  handed_off: "Хүргэлтэд гарсан",
  picked_up: "Хүлээн авсан",
  fulfilled: "Хүргэгдсэн",
  delivery_failed: "Хүргэлт амжилтгүй",
  returned: "Буцаагдсан",
  cancelled: "Цуцлагдсан",
};

const Status = (props: {
  state: OrderPaymentState | OrderFulfillmentState | AdminOrder["state"];
  label: string;
}) => (
  <span
    class="inline-flex w-fit rounded-full px-2.5 py-1.5 text-xs leading-none font-bold"
    classList={{
      "bg-emerald-100 text-emerald-950":
        props.state === "confirmed" ||
        props.state === "completed" ||
        props.state === "fulfilled" ||
        props.state === "picked_up",
      "bg-red-100 text-red-950":
        props.state === "failed" ||
        props.state === "expired" ||
        props.state === "rejected" ||
        props.state === "delivery_failed" ||
        props.state === "returned" ||
        props.state === "cancelled",
      "bg-blue-100 text-blue-950": props.state === "ready" || props.state === "handed_off",
      "bg-amber-100 text-amber-950":
        props.state === "pending" ||
        props.state === "awaiting_confirmation" ||
        props.state === "placed" ||
        props.state === "unfulfilled" ||
        props.state === "processing" ||
        props.state === "superseded" ||
        props.state === "released_unresolved" ||
        props.state === "partially_refunded" ||
        props.state === "refunded",
    }}
  >
    {props.label}
  </span>
);

const LoadingState = (props: { label: string }) => (
  <div class="grid gap-3 border-y border-black/15 py-6" role="status">
    <span class="sr-only">{props.label}</span>
    <For each={[0, 1, 2, 3]}>
      {() => (
        <div class="grid gap-3 py-3 md:grid-cols-[minmax(12rem,1fr)_9rem_8rem_minmax(10rem,1fr)]">
          <span class="h-5 w-40 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
          <span class="h-5 w-24 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
          <span class="h-5 w-20 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
          <span class="h-5 w-32 animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
        </div>
      )}
    </For>
  </div>
);

const ErrorState = (props: { label: string }) => (
  <div class="border-y border-red-900/20 bg-red-50 px-5 py-10 text-red-950" role="alert">
    <h2 class="m-0 text-lg font-bold">Захиалгыг харуулж чадсангүй</h2>
    <p class="mt-2 mb-0 max-w-prose">{props.label}</p>
  </div>
);

const OrderInbox = () => {
  const query = useQuery(() => adminOrdersQueryOptions());
  return (
    <section aria-label="Захиалгын жагсаалт">
      <Show
        when={query.data}
        keyed
        fallback={
          <Show
            when={query.isPending}
            fallback={<ErrorState label="Холболтоо шалгаад хуудсыг дахин ачаална уу." />}
          >
            <LoadingState label="Захиалгуудыг ачаалж байна…" />
          </Show>
        }
      >
        {(data) => (
          <Show
            when={data.data.orders.length > 0}
            fallback={
              <div class="border-y border-black/15 py-16 text-center">
                <h2 class="m-0 text-xl font-bold">Одоогоор захиалга алга</h2>
                <p class="mt-2 mb-0 text-(--muted)">
                  Шинэ захиалга үүсэхэд хүлээн авагч болон төлөв нь энд харагдана.
                </p>
              </div>
            }
          >
            <div class="mb-4 flex justify-end">
              <span class="rounded-full bg-(--surface) px-3 py-2 text-sm font-bold">
                Сүүлийн {data.data.orders.length} захиалга
              </span>
            </div>
            <div class="hidden grid-cols-[minmax(12rem,1.2fr)_9rem_8rem_minmax(10rem,1fr)_minmax(10rem,1fr)] gap-4 border-b border-black/15 px-3 pb-3 text-xs font-bold text-(--muted) md:grid">
              <span>Захиалга</span>
              <span>Огноо</span>
              <span>Нийт</span>
              <span>Төлбөр</span>
              <span>Биелэлт</span>
            </div>
            <ul class="m-0 list-none p-0">
              <For each={data.data.orders}>
                {(order) => (
                  <li class="border-b border-black/15">
                    <a
                      class="group grid min-h-20 gap-x-4 gap-y-3 px-3 py-5 text-(--ink) no-underline transition-colors duration-150 hover:bg-black/4 focus-visible:bg-black/4 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-(--focus) md:grid-cols-[minmax(12rem,1.2fr)_9rem_8rem_minmax(10rem,1fr)_minmax(10rem,1fr)] md:items-center"
                      href={`/admin/orders/${order.id}`}
                    >
                      <div class="min-w-0">
                        <strong class="block text-base group-hover:underline">
                          № {order.orderNumber}
                        </strong>
                        <span class="mt-1 block truncate text-sm text-(--muted)">
                          {order.recipient.name} · {order.lines.length} нэр төрөл
                        </span>
                      </div>
                      <div class="text-sm">
                        <span class="mr-2 font-bold text-(--muted) md:hidden">Огноо</span>
                        {dateTime.format(new Date(order.placedAt))}
                      </div>
                      <div class="font-bold tabular-nums">
                        <span class="mr-2 text-sm text-(--muted) md:hidden">Нийт</span>
                        {money.format(order.totalMnt)}
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-(--muted) md:hidden">Төлбөр</span>
                        <Show
                          when={order.payment}
                          fallback={<span class="text-sm">Төлбөргүй</span>}
                          keyed
                        >
                          {(payment) => (
                            <Status state={payment.state} label={paymentLabels[payment.state]} />
                          )}
                        </Show>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-(--muted) md:hidden">Биелэлт</span>
                        <Status
                          state={order.fulfillment.state}
                          label={fulfillmentLabels[order.fulfillment.state]}
                        />
                      </div>
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        )}
      </Show>
    </section>
  );
};

const OrderDetail = (props: { id: OrderId }) => {
  const query = useQuery(() => adminOrderQueryOptions(props.id));
  return (
    <Show
      when={query.data}
      keyed
      fallback={
        <Show
          when={query.isPending}
          fallback={<ErrorState label="Захиалга олдсонгүй эсвэл түр харах боломжгүй байна." />}
        >
          <LoadingState label="Захиалгыг ачаалж байна…" />
        </Show>
      }
    >
      {(data) => {
        const order = data.data;
        return (
          <article aria-labelledby="order-title">
            <a
              class="mb-6 inline-flex min-h-11 items-center font-bold text-(--ink) underline decoration-black/30 underline-offset-4 hover:decoration-black focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-(--focus)"
              href="/admin/orders"
            >
              ← Захиалгууд руу буцах
            </a>
            <header class="flex flex-col items-start justify-between gap-5 border-b border-black/15 pb-8 sm:flex-row sm:items-end">
              <div>
                <p class="m-0 text-sm font-bold text-(--muted)">
                  {dateTime.format(new Date(order.placedAt))}
                </p>
                <h2
                  id="order-title"
                  class="mt-2 mb-0 text-3xl font-extrabold tracking-tight sm:text-5xl"
                >
                  Захиалга № {order.orderNumber}
                </h2>
              </div>
              <Status state={order.state} label={orderLabels[order.state]} />
            </header>

            <section
              class="grid gap-8 border-b border-black/15 py-8 sm:grid-cols-2"
              aria-label="Хүлээн авагч"
            >
              <div>
                <h3 class="m-0 text-sm font-bold text-(--muted)">Хүлээн авагч</h3>
                <p class="mt-3 mb-0 text-lg font-bold">{order.recipient.name}</p>
                <a
                  class="mt-1 inline-flex min-h-11 items-center text-(--ink) underline decoration-black/30 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-(--focus)"
                  href={`tel:${order.recipient.phone}`}
                >
                  {order.recipient.phone}
                </a>
              </div>
              <div>
                <h3 class="m-0 text-sm font-bold text-(--muted)">
                  {order.destination.mode === "delivery" ? "Хүргэлтийн хаяг" : "Авах цэг"}
                </h3>
                <Show
                  when={order.destination.mode === "pickup" ? order.destination.name : undefined}
                >
                  {(name) => <p class="mt-3 mb-1 text-lg font-bold">{name()}</p>}
                </Show>
                <p class="mt-3 mb-0 max-w-prose whitespace-pre-line">{order.destination.address}</p>
              </div>
            </section>

            <section
              class="grid gap-5 border-b border-black/15 py-8 sm:grid-cols-3"
              aria-label="Захиалгын төлөв"
            >
              <div class="grid content-start gap-2">
                <h3 class="m-0 text-sm font-bold text-(--muted)">Төлбөр</h3>
                <Show when={order.payment} fallback={<span>Төлбөргүй</span>} keyed>
                  {(payment) => (
                    <Status state={payment.state} label={paymentLabels[payment.state]} />
                  )}
                </Show>
              </div>
              <div class="grid content-start gap-2">
                <h3 class="m-0 text-sm font-bold text-(--muted)">Биелэлт</h3>
                <Status
                  state={order.fulfillment.state}
                  label={fulfillmentLabels[order.fulfillment.state]}
                />
              </div>
              <div class="grid content-start gap-2">
                <h3 class="m-0 text-sm font-bold text-(--muted)">Хүлээлгэн өгөх хэлбэр</h3>
                <span>{order.fulfillment.mode === "delivery" ? "Хүргэлт" : "Өөрөө авах"}</span>
              </div>
            </section>

            <section class="border-b border-black/15 py-8" aria-labelledby="order-lines-title">
              <div class="mb-4 flex items-baseline justify-between gap-4">
                <h3 id="order-lines-title" class="m-0 text-xl font-bold">
                  Бараанууд
                </h3>
                <span class="text-sm font-bold text-(--muted)">{order.lines.length} нэр төрөл</span>
              </div>
              <ul class="m-0 list-none p-0">
                <For each={order.lines}>
                  {(line) => (
                    <li class="grid grid-cols-[1fr_auto] gap-4 border-t border-black/10 py-4 first:border-t-0">
                      <div class="min-w-0">
                        <strong class="block">{line.name}</strong>
                        <span class="mt-1 block text-sm text-(--muted)">
                          {line.sku} · {line.quantity} ш × {money.format(line.unitPriceMnt)}
                        </span>
                      </div>
                      <strong class="tabular-nums">{money.format(line.totalMnt)}</strong>
                    </li>
                  )}
                </For>
              </ul>
            </section>

            <section class="ml-auto grid max-w-md gap-3 py-8" aria-label="Төлбөрийн дүн">
              <div class="flex justify-between gap-6 text-(--muted)">
                <span>Барааны дүн</span>
                <span class="tabular-nums">{money.format(order.subtotalMnt)}</span>
              </div>
              <Show when={order.discountTotalMnt > 0}>
                <div class="flex justify-between gap-6 text-(--muted)">
                  <span>Хөнгөлөлт</span>
                  <span class="tabular-nums">− {money.format(order.discountTotalMnt)}</span>
                </div>
              </Show>
              <div class="flex justify-between gap-6 text-(--muted)">
                <span>Хүргэлт</span>
                <span class="tabular-nums">{money.format(order.deliveryFeeMnt)}</span>
              </div>
              <div class="mt-2 flex justify-between gap-6 border-t border-black/15 pt-4 text-xl font-extrabold">
                <span>Нийт</span>
                <span class="tabular-nums">{money.format(order.totalMnt)}</span>
              </div>
            </section>
          </article>
        );
      }}
    </Show>
  );
};

export const AdminOrderInbox = () => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <OrderInbox />
    </QueryClientProvider>
  );
};

export const AdminOrderDetail = (props: { id: string }) => {
  const id = v.safeParse(OrderIdSchema, props.id);
  if (!id.success) {
    return <ErrorState label="Захиалгын хаяг буруу байна. Жагсаалт руу буцна уу." />;
  }
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <OrderDetail id={id.output} />
    </QueryClientProvider>
  );
};
