import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { For } from "solid-js";
import { categories, formatPrice, products } from "./catalog";

type VariantProps = {
  variant: string;
  onSearch: () => void;
};

export const VariantB = (props: VariantProps) => (
  <div class="khev-page khev-b">
    <div class="khev-b-notice">200,000₮-өөс дээш хүргэлт үнэгүй <span>УБ хотод 24–48 цаг</span></div>
    <header class="khev-b-header">
      <a class="khev-logo" href={`/prototype/storefront?variant=${props.variant}`} aria-label="Хэв нүүр">ХЭВ<span>®</span></a>
      <nav aria-label="Бүтээгдэхүүний ангилал">
        <For each={categories}>{(category) => <a href="#catalog">{category}</a>}</For>
      </nav>
      <div class="khev-header-actions">
        <button type="button" onClick={props.onSearch} aria-label="Шуурхай хайлт"><Search aria-hidden="true" /><span>Шуурхай хайлт</span></button>
        <button type="button" aria-label="Сагс, хоосон"><ShoppingBag aria-hidden="true" /><span>0</span></button>
      </div>
    </header>

    <main>
      <section class="khev-b-title">
        <div>
          <p class="khev-kicker">Шинэ / 08 бүтээгдэхүүн</p>
          <h1>Өдөр бүрийн<br />шинэ дүрэм</h1>
        </div>
        <p>Хөдөлгөөнд саад болохгүй эсгүүр. Хослуулж өмсөхөд хялбар өнгө. Удаан хэрэглэхээр сонгосон материал.</p>
      </section>

      <section class="khev-b-catalog" id="catalog" aria-label="Шинэ бүтээгдэхүүн">
        <For each={products}>
          {(product, index) => (
            <a class={`khev-b-product khev-b-product-${index() + 1}`} href={`/prototype/storefront/${product.slug}?variant=B`}>
              <div class="khev-b-image">
                <img src={product.image} alt={product.alt} width="700" height="1050" loading={index() < 4 ? "eager" : "lazy"} />
                <span>{index() < 2 ? "Шинэ" : product.collection}</span>
              </div>
              <div class="khev-b-meta">
                <strong>{product.name}</strong>
                <small>{formatPrice(product.price)}</small>
              </div>
            </a>
          )}
        </For>
      </section>
    </main>
  </div>
);
