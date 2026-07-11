import ArrowLeft from "lucide-solid/icons/arrow-left";
import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { createSignal, For } from "solid-js";
import type { Product } from "./catalog";
import { formatPrice } from "./catalog";

type ProductViewProps = {
  product: Product;
  variant: string;
  onSearch: () => void;
};

export const ProductView = (props: ProductViewProps) => {
  const [size, setSize] = createSignal("M");

  return (
    <div class="khev-page khev-product-page">
      <header class="khev-product-header">
        <a href={`/prototype/storefront?variant=${props.variant}`}><ArrowLeft aria-hidden="true" />Буцах</a>
        <a class="khev-logo" href={`/prototype/storefront?variant=${props.variant}`} aria-label="Хэв нүүр">ХЭВ<span>®</span></a>
        <div class="khev-header-actions">
          <button type="button" onClick={props.onSearch} aria-label="Хайх"><Search aria-hidden="true" /></button>
          <button type="button" aria-label="Сагс, хоосон"><ShoppingBag aria-hidden="true" /><span>0</span></button>
        </div>
      </header>
      <main class="khev-product-main">
        <figure>
          <img src={props.product.image} alt={props.product.alt} width="1400" height="2100" fetchpriority="high" />
          <figcaption>ХЭВ / {props.product.collection}</figcaption>
        </figure>
        <section aria-labelledby="product-title">
          <p class="khev-kicker">{props.product.collection}</p>
          <h1 id="product-title">{props.product.name}</h1>
          <p class="khev-product-price">{formatPrice(props.product.price)}</p>
          <p class="khev-product-description">Хотын хэмнэлд чөлөөтэй хөдөлж, олон янзаар хослуулахад зориулсан цэвэр эсгүүр.</p>
          <fieldset>
            <legend>Хэмжээ <span>{size()}</span></legend>
            <div class="khev-sizes">
              <For each={["XS", "S", "M", "L", "XL"]}>
                {(option) => <button type="button" classList={{ selected: size() === option }} onClick={() => setSize(option)}>{option}</button>}
              </For>
            </div>
          </fieldset>
          <button type="button" class="khev-add-button">Сагсанд нэмэх</button>
          <dl>
            <div><dt>Материал</dt><dd>Хөвөн хольц</dd></div>
            <div><dt>Хүргэлт</dt><dd>УБ хотод 24–48 цаг</dd></div>
            <div><dt>Солих</dt><dd>14 хоногийн дотор</dd></div>
          </dl>
        </section>
      </main>
    </div>
  );
};
