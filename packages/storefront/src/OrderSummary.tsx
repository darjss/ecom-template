import type { OrderSummary } from "@ecom/contracts";
import { createPipeHandlers } from "dismatch";
import { For, Show } from "solid-js";

const money = new Intl.NumberFormat("mn-MN");
const dateTime = new Intl.DateTimeFormat("mn-MN", {
  timeZone: "Asia/Ulaanbaatar",
  dateStyle: "long",
  timeStyle: "short",
  hour12: false,
});
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

const orderState = createPipeHandlers<OrderStateInput>("state").match<string>({
  placed: () => "Захиалга хүлээн авсан",
  completed: () => "Дууссан",
  cancelled: () => "Цуцлагдсан",
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
  const stateLabel = () => orderState({ state: props.order.state });
  return (
    <article class="overflow-hidden border border-(--wood-dark) bg-(--paper)">
      <header class="flex flex-wrap items-start justify-between gap-4 bg-(--navy) px-5 py-6 text-(--paper) sm:px-7">
        <div>
          <p class="m-0 text-sm text-white/70">{dateTime.format(new Date(props.order.placedAt))}</p>
          <h2 class="m-0 mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            Захиалга №{props.order.orderNumber}
          </h2>
        </div>
        <span
          data-state={props.order.state}
          class="rounded-full px-3 py-1 text-sm font-bold data-[state=cancelled]:bg-red-50 data-[state=cancelled]:text-red-900 data-[state=completed]:bg-green-50 data-[state=completed]:text-green-900 data-[state=placed]:bg-amber-50 data-[state=placed]:text-amber-900"
        >
          {stateLabel()}
        </span>
      </header>

      <div class="grid border-b border-black/15 sm:grid-cols-2">
        <section
          class="border-b border-black/15 p-5 sm:border-r sm:border-b-0 sm:p-7"
          aria-labelledby={`payment-${props.order.id}`}
        >
          <p class="m-0 text-sm font-bold text-(--muted)">Одоогийн төлөв</p>
          <h3 id={`payment-${props.order.id}`} class="m-0 mt-2 text-lg font-black">
            Төлбөр
          </h3>
          <Show
            when={props.order.payment}
            keyed
            fallback={<p class="m-0 mt-4 text-xl font-bold">Төлбөрийн мэдээлэл бүртгэгдээгүй</p>}
          >
            {(payment) => (
              <>
                <p class="m-0 mt-4 text-xl font-bold text-(--accent)">
                  {paymentState({ state: payment.state })}
                </p>
                <p class="m-0 mt-2 text-sm text-(--muted)">
                  {paymentMethod({ method: payment.method })} ·{" "}
                  {money.format(payment.expectedAmountMnt)} ₮
                </p>
              </>
            )}
          </Show>
        </section>

        <section class="p-5 sm:p-7" aria-labelledby={`fulfillment-${props.order.id}`}>
          <p class="m-0 text-sm font-bold text-(--muted)">Одоогийн төлөв</p>
          <h3 id={`fulfillment-${props.order.id}`} class="m-0 mt-2 text-lg font-black">
            Бэлтгэл, хүргэлт
          </h3>
          <p class="m-0 mt-4 text-xl font-bold text-(--accent)">
            {fulfillmentState({ state: props.order.fulfillment.state })}
          </p>
          <p class="m-0 mt-2 text-sm text-(--muted)">
            Хүлээн авах хэлбэр: {fulfillmentMode({ mode: props.order.fulfillment.mode })}
          </p>
        </section>
      </div>

      <div class="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-labelledby={`items-${props.order.id}`}>
          <h3 id={`items-${props.order.id}`} class="m-0 text-lg font-black">
            Захиалсан бараа
          </h3>
          <ul class="m-0 mt-4 grid list-none gap-3 p-0">
            <For each={props.order.lines}>
              {(line) => (
                <li class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-black/10 pb-3 text-sm">
                  <div class="min-w-0">
                    <strong class="block text-pretty">{line.name}</strong>
                    <p class="m-0 mt-1 text-(--muted)">
                      {line.sku} · {line.quantity} × {money.format(line.unitPriceMnt)} ₮
                    </p>
                  </div>
                  <span class="font-bold tabular-nums">{money.format(line.totalMnt)} ₮</span>
                </li>
              )}
            </For>
          </ul>
        </section>

        <section aria-labelledby={`total-${props.order.id}`}>
          <h3 id={`total-${props.order.id}`} class="m-0 text-lg font-black">
            Төлбөрийн дүн
          </h3>
          <dl class="mt-4 grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
            <dt>Барааны дүн</dt>
            <dd class="m-0 tabular-nums">{money.format(props.order.subtotalMnt)} ₮</dd>
            <Show when={props.order.discountTotalMnt > 0}>
              <dt>Хөнгөлөлт</dt>
              <dd class="m-0 tabular-nums">−{money.format(props.order.discountTotalMnt)} ₮</dd>
            </Show>
            <dt>Хүргэлт</dt>
            <dd class="m-0 tabular-nums">{money.format(props.order.deliveryFeeMnt)} ₮</dd>
            <dt class="border-t border-black/15 pt-3 font-black">Нийт</dt>
            <dd class="m-0 border-t border-black/15 pt-3 text-lg font-black tabular-nums">
              {money.format(props.order.totalMnt)} ₮
            </dd>
          </dl>
        </section>
      </div>
    </article>
  );
};
