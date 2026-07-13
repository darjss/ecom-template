import Check from "lucide-solid/icons/check";
import Minus from "lucide-solid/icons/minus";
import Plus from "lucide-solid/icons/plus";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { Show, createMemo, createSignal } from "solid-js";
import { findProduct, formatMnt } from "./data";

interface ProductViewProps {
  productId: string;
  onAdd: () => void;
}

export const ProductView = (props: ProductViewProps) => {
  const product = createMemo(() => findProduct(props.productId));
  const [quantity, setQuantity] = createSignal(1);
  const [size, setSize] = createSignal("Жижиг");
  const [color, setColor] = createSignal("Элсний шар");
  const [coverName, setCoverName] = createSignal("ЖИШИГ 29");
  const price = createMemo(() => size() === "Том" && product().id === "P07" ? 22900 : product().price);
  const availability = createMemo(() => {
    if (product().id === "P05" && size() === "1.6 кг") return "out";
    if (product().id === "P07" && size() === "Том" && color() === "Тэнгэрийн хөх") return "out";
    if (product().id === "P07" && size() === "Том") return "low";
    return product().status;
  });
  const image = createMemo(() => {
    if (product().id === "P07" && color() === "Тэнгэрийн хөх") return "/prototypes/urnuun48/media/p07-tote-sky.webp";
    if (product().id === "P05" && size() === "1.6 кг") return "/prototypes/urnuun48/media/p05-detergent-1600.webp";
    return product().image;
  });

  return (
    <main class="u48-detail" id="main-content">
      <div class="u48-detail-image"><img src={image()} alt={`${product().shortName}, зохиомол бүтээгдэхүүний зураг`} width="1000" height="1000" /></div>
      <section class="u48-detail-copy">
        <p>{product().category} · {product().sku}</p><h1>{product().name}</h1><div class="u48-detail-price">{formatMnt(price())}</div>
        <p class="u48-detail-description">{product().detail}</p>
        <Show when={product().id === "P05" || product().id === "P07"}>
          <fieldset><legend>{product().id === "P05" ? "Жин" : "Хэмжээ"}</legend><div class="u48-option-row">
            {(product().id === "P05" ? ["800 г", "1.6 кг"] : ["Жижиг", "Том"]).map((value) => <button class={size() === value ? "is-selected" : ""} type="button" onClick={() => setSize(value)}>{value}<Show when={size() === value}><Check aria-hidden="true" /></Show></button>)}
          </div></fieldset>
        </Show>
        <Show when={product().id === "P07"}><fieldset><legend>Өнгө</legend><div class="u48-option-row">{["Элсний шар", "Тэнгэрийн хөх"].map((value) => <button class={color() === value ? "is-selected" : ""} type="button" onClick={() => setColor(value)}>{value}</button>)}</div></fieldset></Show>
        <Show when={product().id === "P08"}><label class="u48-personalize">Нүүрний бичвэр <span>{coverName().length}/24</span><input value={coverName()} maxlength="24" onInput={(event) => setCoverName(event.currentTarget.value)} /></label></Show>
        <div class={`u48-live-stock u48-live-stock-${availability()}`}><span /><b>{availability() === "out" ? "Энэ сонголт дууссан" : availability() === "low" ? "2 ширхэг үлдсэн" : "Агуулахад бэлэн"}</b><p>Сагсанд үлдэгдэл хадгалахгүй. Checkout хийхэд дахин шалгана.</p></div>
        <div class="u48-detail-actions"><div class="u48-quantity"><button type="button" aria-label="Тоо хасах" onClick={() => setQuantity(Math.max(1, quantity() - 1))}><Minus /></button><b>{quantity()}</b><button type="button" aria-label="Тоо нэмэх" onClick={() => setQuantity(quantity() + 1)}><Plus /></button></div><button type="button" disabled={availability() === "out"} onClick={props.onAdd}><ShoppingBag />{availability() === "out" ? "Энэ сонголт дууссан" : `Сагсанд нэмэх · ${formatMnt(price() * quantity())}`}</button></div>
      </section>
    </main>
  );
};
