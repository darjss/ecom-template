import ArrowRight from "lucide-solid/icons/arrow-right";
import Banknote from "lucide-solid/icons/banknote";
import Check from "lucide-solid/icons/check";
import MapPin from "lucide-solid/icons/map-pin";
import QrCode from "lucide-solid/icons/qr-code";
import Truck from "lucide-solid/icons/truck";
import { Show, createMemo, createSignal } from "solid-js";
import { formatMnt } from "./data";

type PaymentChoice = "qpay" | "transfer" | "cod";
type DeliveryChoice = "delivery" | "pickup";

export const CheckoutView = () => {
  const [delivery, setDelivery] = createSignal<DeliveryChoice>("delivery");
  const [payment, setPayment] = createSignal<PaymentChoice>("qpay");
  const subtotal = 37800;
  const discount = 5000;
  const fee = createMemo(() => delivery() === "delivery" ? 6000 : 0);
  const total = createMemo(() => subtotal - discount + fee());

  return (
    <main class="u48-checkout" id="main-content">
      <section><p class="u48-kicker">Зохиомол Checkout</p><h1>Захиалгаа шалгах</h1>
        <div class="u48-checkout-block"><h2>Хүлээн авах арга</h2><div class="u48-choice-grid">
          <button class={delivery() === "delivery" ? "is-selected" : ""} type="button" onClick={() => setDelivery("delivery")}><Truck /><span><b>Хүргэлт</b>Улаанбаатар хотод 6,000₮</span><Show when={delivery() === "delivery"}><Check /></Show></button>
          <button class={delivery() === "pickup" ? "is-selected" : ""} type="button" onClick={() => setDelivery("pickup")}><MapPin /><span><b>Өөрөө авах</b>Өрнүүн 48 жишиг цэг</span><Show when={delivery() === "pickup"}><Check /></Show></button>
        </div></div>
        <div class="u48-checkout-block"><h2>Төлбөр</h2><div class="u48-choice-grid u48-payment-grid">
          <button class={payment() === "qpay" ? "is-selected" : ""} type="button" onClick={() => setPayment("qpay")}><QrCode /><span><b>QPay</b>Зөвхөн синтетик төлөв</span></button>
          <button class={payment() === "transfer" ? "is-selected" : ""} type="button" onClick={() => setPayment("transfer")}><Banknote /><span><b>Дансаар шилжүүлэх</b>Ажилтан баталгаажуулна</span></button>
          <button class={payment() === "cod" ? "is-selected" : ""} type="button" onClick={() => setPayment("cod")}><Banknote /><span><b>Бэлнээр</b>Авах үед төлнө</span></button>
        </div>
        <Show when={payment() === "qpay"}><button class="u48-switch-payment" type="button" onClick={() => setPayment("transfer")}>QPay хүлээгдэж байна. Дансаар шилжүүлэх рүү солих <ArrowRight /></button></Show>
        <Show when={payment() === "transfer"}><div class="u48-payment-note"><b>WF29-TRANSFER-DEMO</b><span>Бодит дансны дугаар харуулахгүй. Энэ төлбөр зөвхөн жишиг төлөв үүсгэнэ.</span></div></Show>
        </div>
      </section>
      <aside class="u48-order-summary"><h2>Таны сагс</h2><div class="u48-summary-item"><img src="/prototypes/urnuun48/media/p07-tote-sand.webp" alt="" /><span><b>Том даавуун цүнх</b>Элсний шар · 1 ш</span><strong>22,900₮</strong></div><div class="u48-summary-item"><img src="/prototypes/urnuun48/media/p08-notebook.webp" alt="" /><span><b>Нэртэй дэвтэр</b>ЖИШИГ 29 · 1 ш</span><strong>14,900₮</strong></div><dl><div><dt>Бараа</dt><dd>{formatMnt(subtotal)}</dd></div><div><dt>WF29-5000</dt><dd>−{formatMnt(discount)}</dd></div><div><dt>{delivery() === "delivery" ? "Хүргэлт" : "Өөрөө авах"}</dt><dd>{formatMnt(fee())}</dd></div><div><dt>Нийт</dt><dd>{formatMnt(total())}</dd></div></dl><button type="button">Жишиг захиалга үүсгэх <ArrowRight /></button><p>Бодит төлбөр авахгүй, хэрэглэгчийн мэдээлэл хадгалахгүй.</p></aside>
    </main>
  );
};
