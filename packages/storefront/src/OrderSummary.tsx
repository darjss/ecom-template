import type { OrderSummary } from "@ecom/contracts";
import { createPipeHandlers } from "dismatch";
import { For, Show } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");
const dateTime = new Intl.DateTimeFormat("mn-MN", { dateStyle: "medium", timeStyle: "short" });
type OrderStateInput = {
  [State in OrderSummary["state"]]: { readonly state: State };
}[OrderSummary["state"]];
type Payment = NonNullable<OrderSummary["payment"]>;
type PaymentMethodInput = {
  [Method in Payment["method"]]: { readonly method: Method };
}[Payment["method"]];
type PaymentStateInput = {
  [State in Payment["state"]]: { readonly state: State };
}[Payment["state"]];
type FulfillmentModeInput = {
  [Mode in OrderSummary["fulfillment"]["mode"]]: { readonly mode: Mode };
}[OrderSummary["fulfillment"]["mode"]];
type FulfillmentStateInput = {
  [State in OrderSummary["fulfillment"]["state"]]: { readonly state: State };
}[OrderSummary["fulfillment"]["state"]];

const orderState = createPipeHandlers<OrderStateInput>("state").match<{
  readonly label: string;
  readonly class: string;
}>({
  placed: () => ({ label: "Захиалга хүлээн авсан", class: "text-amber-900 bg-amber-50" }),
  completed: () => ({ label: "Дууссан", class: "text-green-900 bg-green-50" }),
  cancelled: () => ({ label: "Цуцлагдсан", class: "text-red-900 bg-red-50" }),
});
const paymentMethod = createPipeHandlers<PaymentMethodInput>("method").match<string>({
  qpay: () => "QPay",
  bank_transfer: () => "Банкны шилжүүлэг",
  cash_on_delivery: () => "Хүлээн авахдаа төлөх",
});
const paymentState = createPipeHandlers<PaymentStateInput>("state").match<string>({
  pending: () => "Төлбөр хүлээгдэж байна",
  awaiting_confirmation: () => "Баталгаажуулалт хүлээж байна",
  confirmed: () => "Төлбөр баталгаажсан",
  failed: () => "Төлбөр амжилтгүй",
  expired: () => "Төлбөрийн хугацаа дууссан",
  rejected: () => "Төлбөр татгалзсан",
  superseded: () => "Өөр төлбөрөөр сольсон",
  released_unresolved: () => "Тодорхойгүй төлбөрийг чөлөөлсөн",
  partially_refunded: () => "Хэсэгчлэн буцаан олгосон",
  refunded: () => "Буцаан олгосон",
});
const fulfillmentMode = createPipeHandlers<FulfillmentModeInput>("mode").match<string>({
  delivery: () => "Хүргэлт",
  pickup: () => "Очиж авах",
});
const fulfillmentState = createPipeHandlers<FulfillmentStateInput>("state").match<string>({
  unfulfilled: () => "Бэлтгэж эхлээгүй",
  processing: () => "Бэлтгэж байна",
  ready: () => "Бэлэн болсон",
  handed_off: () => "Хүргэлтэд өгсөн",
  picked_up: () => "Хүлээн авсан",
  fulfilled: () => "Хүргэгдсэн",
  delivery_failed: () => "Хүргэлт амжилтгүй",
  returned: () => "Буцаан хүлээн авсан",
  cancelled: () => "Цуцлагдсан",
});

export const OrderSummaryView = (props: { readonly order: OrderSummary }) => {
  const state = () => orderState({ state: props.order.state });
  return (
    <article class="border-y border-black/15 py-6">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="m-0 text-sm text-(--muted)">
            {dateTime.format(new Date(props.order.placedAt))}
          </p>
          <h2 class="m-0 mt-1 text-xl font-bold">Захиалга №{props.order.orderNumber}</h2>
        </div>
        <span class={`rounded-full px-3 py-1 text-sm font-bold ${state().class}`}>
          {state().label}
        </span>
      </header>
      <ul class="m-0 mt-5 grid list-none gap-3 p-0">
        <For each={props.order.lines}>
          {(line) => (
            <li class="grid grid-cols-[1fr_auto] gap-4 border-b border-black/10 pb-3 text-sm">
              <div>
                <strong>{line.name}</strong>
                <p class="m-0 mt-1 text-(--muted)">
                  {line.sku} · {line.quantity} × {money.format(line.unitPriceMnt)} ₮
                </p>
              </div>
              <span class="tabular-nums">{money.format(line.totalMnt)} ₮</span>
            </li>
          )}
        </For>
      </ul>
      <dl class="mt-5 grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
        <dt>Барааны дүн</dt>
        <dd class="m-0 tabular-nums">{money.format(props.order.subtotalMnt)} ₮</dd>
        <dt>Хөнгөлөлт</dt>
        <dd class="m-0 tabular-nums">−{money.format(props.order.discountTotalMnt)} ₮</dd>
        <dt>Хүргэлт</dt>
        <dd class="m-0 tabular-nums">{money.format(props.order.deliveryFeeMnt)} ₮</dd>
        <dt class="border-t border-black/15 pt-3 font-bold">Нийт</dt>
        <dd class="m-0 border-t border-black/15 pt-3 font-bold tabular-nums">
          {money.format(props.order.totalMnt)} ₮
        </dd>
      </dl>
      <div class="mt-5 grid gap-2 text-sm sm:grid-cols-2">
        <p class="m-0">
          <strong>Гүйцэтгэл:</strong> {fulfillmentMode({ mode: props.order.fulfillment.mode })} ·{" "}
          {fulfillmentState({ state: props.order.fulfillment.state })}
        </p>
        <Show when={props.order.payment} keyed>
          {(payment) => (
            <p class="m-0">
              <strong>Төлбөр:</strong> {paymentMethod({ method: payment.method })} ·{" "}
              {paymentState({ state: payment.state })}
            </p>
          )}
        </Show>
      </div>
    </article>
  );
};
