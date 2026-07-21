import { adminOrderQueryOptions, orderMutationOptions } from "@ecom/client";
import type {
  OrderFulfillmentMode,
  OrderFulfillmentState,
  OrderOperationClientError,
  OrderPaymentState,
  OrderSummary,
  StaffRole,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");
const dateTime = new Intl.DateTimeFormat("mn-MN", { dateStyle: "medium", timeStyle: "short" });

const paymentLabels: Record<OrderPaymentState, string> = {
  pending: "Төлбөр хүлээгдэж байна",
  awaiting_confirmation: "Шилжүүлэг баталгаажуулах шаардлагатай",
  confirmed: "Төлбөр баталгаажсан",
  failed: "Төлбөр амжилтгүй",
  expired: "Төлбөрийн хугацаа дууссан",
  rejected: "Төлбөр татгалзсан",
  superseded: "Өөр төлбөрөөр сольсон",
  released_unresolved: "Тодорхойгүй төлбөрийг чөлөөлсөн",
  partially_refunded: "Хэсэгчлэн буцаан олгосон",
  refunded: "Буцаан олгосон",
};

const fulfillmentLabels: Record<OrderFulfillmentState, string> = {
  unfulfilled: "Бэлтгэж эхлээгүй",
  processing: "Бэлтгэж байна",
  ready: "Бэлэн болсон",
  handed_off: "Хүргэлтэд өгсөн",
  picked_up: "Хүлээн авсан",
  fulfilled: "Хүргэгдсэн",
  delivery_failed: "Хүргэлт амжилтгүй",
  returned: "Буцаан хүлээн авсан",
  cancelled: "Цуцлагдсан",
};

const nextFulfillmentLabel = (
  mode: OrderFulfillmentMode,
  state: OrderFulfillmentState,
): string | undefined => {
  if (state === "unfulfilled") {
    return "Бэлтгэж эхлэх";
  }
  if (state === "processing") {
    return "Бэлэн болгох";
  }
  if (mode === "delivery" && state === "ready") {
    return "Хүргэлтэд өгөх";
  }
  if (mode === "delivery" && state === "handed_off") {
    return "Хүргэгдсэн болгох";
  }
  return mode === "pickup" && state === "ready" ? "Хүлээн авсан болгох" : undefined;
};

const operationErrorMessage = (error: OrderOperationClientError) => {
  if (error.kind === "network") {
    return "Сүлжээний холболтыг шалгаад дахин оролдоно уу.";
  }
  if (error.kind === "api") {
    if (error.error.reason === "payment_required") {
      return "Гүйцэтгэлийг ахиулахаас өмнө төлбөрийг баталгаажуулна уу.";
    }
    if (error.error.reason === "payment_not_confirmable") {
      return "Энэ төлбөрийг одоогийн төлөвөөс баталгаажуулах боломжгүй.";
    }
    if (error.error.reason === "fulfillment_not_advanceable") {
      return "Гүйцэтгэлийг одоогийн төлөвөөс ахиулах боломжгүй.";
    }
    if (error.error.code === "forbidden") {
      return "Энэ үйлдлийг хийх эрх хүрэхгүй байна.";
    }
  }
  return "Захиалгыг шинэчилж чадсангүй. Дахин оролдоно уу.";
};

const OrderFacts = (props: { readonly order: OrderSummary }) => (
  <>
    <ul class="m-0 grid list-none gap-3 border-y border-black/15 px-0 py-5">
      <For each={props.order.lines}>
        {(line) => (
          <li class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 text-sm">
            <div class="min-w-0">
              <strong class="block truncate">{line.name}</strong>
              <span class="text-(--muted)">
                {line.sku} · {line.quantity} × {money.format(line.unitPriceMnt)} ₮
              </span>
            </div>
            <span class="tabular-nums">{money.format(line.totalMnt)} ₮</span>
          </li>
        )}
      </For>
    </ul>
    <dl class="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
      <dt>Барааны дүн</dt>
      <dd class="m-0 tabular-nums">{money.format(props.order.subtotalMnt)} ₮</dd>
      <dt>Хөнгөлөлт</dt>
      <dd class="m-0 tabular-nums">{money.format(props.order.discountTotalMnt)} ₮</dd>
      <dt>Хүргэлт</dt>
      <dd class="m-0 tabular-nums">{money.format(props.order.deliveryFeeMnt)} ₮</dd>
      <dt class="border-t border-black/15 pt-3 font-bold">Нийт</dt>
      <dd class="m-0 border-t border-black/15 pt-3 font-bold tabular-nums">
        {money.format(props.order.totalMnt)} ₮
      </dd>
    </dl>
  </>
);

export const OrderDetail = (props: {
  readonly id: OrderSummary["id"];
  readonly role: StaffRole;
}) => {
  const queryClient = useQueryClient();
  const order = useQuery(() => adminOrderQueryOptions(props.id));
  const mutation = useMutation(() => orderMutationOptions(queryClient));

  return (
    <section class="mx-auto grid w-full max-w-5xl gap-8" aria-labelledby="order-title">
      <a class="w-fit text-sm font-bold text-(--muted)" href="/admin">
        Удирдлага руу буцах
      </a>
      <Show
        when={order.data?.data}
        fallback={
          <div class="border-y border-black/15 py-12">
            <h1 id="order-title" class="m-0 text-3xl font-bold tracking-tight sm:text-4xl">
              Захиалга
            </h1>
            <p class="mt-3 mb-0" role={order.isError ? "alert" : "status"}>
              {order.isError ? "Захиалгыг харуулж чадсангүй." : "Захиалгыг ачаалж байна…"}
            </p>
          </div>
        }
      >
        {(current) => {
          const payment = () => current().payment;
          const paymentLabel = () => {
            const currentPayment = payment();
            return currentPayment ? paymentLabels[currentPayment.state] : "Төлбөр шаардахгүй";
          };
          const nextLabel = () =>
            current().state === "placed"
              ? nextFulfillmentLabel(current().fulfillment.mode, current().fulfillment.state)
              : undefined;
          return (
            <>
              <header class="flex flex-col items-start justify-between gap-4 border-b border-black/15 pb-8 sm:flex-row">
                <div>
                  <p class="m-0 text-sm text-(--muted)">
                    {dateTime.format(new Date(current().placedAt))}
                  </p>
                  <h1
                    id="order-title"
                    class="m-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
                  >
                    Захиалга №{current().orderNumber}
                  </h1>
                </div>
                <span class="rounded-full bg-(--surface) px-3 py-2 text-sm font-bold">
                  {current().state === "completed" ? "Дууссан" : "Хүлээн авсан"}
                </span>
              </header>
              <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
                <div class="grid content-start gap-6">
                  <OrderFacts order={current()} />
                </div>
                <aside class="grid content-start gap-5 border-t border-black/15 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                  <div>
                    <h1 class="m-0 text-lg font-bold">Төлбөр</h1>
                    <p class="mt-2 mb-0 text-sm" aria-live="polite">
                      {paymentLabel()}
                    </p>
                  </div>
                  <Show
                    when={
                      payment()?.method === "bank_transfer" &&
                      payment()?.state === "awaiting_confirmation" &&
                      props.role !== "staff"
                    }
                  >
                    <Button
                      class="w-full"
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ kind: "confirm_payment", id: props.id })}
                    >
                      {mutation.isPending ? "Шинэчилж байна…" : "Төлбөр баталгаажуулах"}
                    </Button>
                  </Show>
                  <div class="border-t border-black/15 pt-5">
                    <h1 class="m-0 text-lg font-bold">Гүйцэтгэл</h1>
                    <p class="mt-2 mb-0 text-sm" aria-live="polite">
                      {fulfillmentLabels[current().fulfillment.state]}
                    </p>
                  </div>
                  <Show when={payment()?.state === "confirmed" ? nextLabel() : undefined} keyed>
                    {(label) => (
                      <Button
                        class="w-full"
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({ kind: "advance_fulfillment", id: props.id })
                        }
                      >
                        <Show when={!mutation.isPending} fallback="Шинэчилж байна…">
                          {label}
                        </Show>
                      </Button>
                    )}
                  </Show>
                  <Show when={mutation.error} keyed>
                    {(error) => (
                      <p class="m-0 text-sm text-red-800" role="alert">
                        {operationErrorMessage(error)}
                      </p>
                    )}
                  </Show>
                  <p class="m-0 text-xs leading-relaxed text-(--muted)" aria-live="polite">
                    Энд хийсэн өөрчлөлт захиалгын нууц холбоос дээр шууд харагдана.
                  </p>
                </aside>
              </div>
            </>
          );
        }}
      </Show>
    </section>
  );
};
