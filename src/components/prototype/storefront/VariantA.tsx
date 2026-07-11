import ArrowRight from "lucide-solid/icons/arrow-right";
import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { For } from "solid-js";
import { formatPrice, products } from "./catalog";

type VariantProps = {
  variant: string;
  onSearch: () => void;
};

export const VariantA = (props: VariantProps) => (
  <div class="khev-page khev-a">
    <header class="khev-a-header">
      <a class="khev-logo" href={`/prototype/storefront?variant=${props.variant}`} aria-label="Хэв нүүр">
        ХЭВ<span>®</span>
      </a>
      <nav aria-label="Үндсэн цэс">
        <a href="#new">Шинэ</a>
        <a href="#collections">Коллекц</a>
        <a href="#about">Бидний тухай</a>
      </nav>
      <div class="khev-header-actions">
        <button type="button" onClick={props.onSearch} aria-label="Хайх">
          <Search aria-hidden="true" />
          <span>Хайх</span>
        </button>
        <button type="button" aria-label="Сагс, хоосон">
          <ShoppingBag aria-hidden="true" />
          <span>0</span>
        </button>
      </div>
    </header>

    <main>
      <section class="khev-a-hero">
        <div class="khev-a-copy">
          <p class="khev-kicker">Улаанбаатар · Шугам 01</p>
          <h1>Өөрийн<br />хэмээр.</h1>
          <p class="khev-a-intro">Хотын хөдөлгөөнд зориулсан тод эсгүүр, зөөлөн материал, давхарлан өмсөх шинэ хэлбэр.</p>
          <a class="khev-text-link" href="#new">Коллекц үзэх <ArrowRight aria-hidden="true" /></a>
        </div>
        <figure>
          <img src={products[1]?.image} alt={products[1]?.alt} width="1400" height="2100" fetchpriority="high" />
          <figcaption>01 / Зураас хослол</figcaption>
        </figure>
        <p class="khev-a-vertical">УЛААНБААТАРТ ЗОХИОГДОВ</p>
      </section>

      <section class="khev-a-products" id="new" aria-labelledby="a-new-title">
        <div class="khev-section-heading">
          <p class="khev-kicker">Шинэ загвар</p>
          <h2 id="a-new-title">Энэ долоо хоногийн сонголт</h2>
        </div>
        <div class="khev-a-product-list">
          <For each={products.slice(0, 3)}>
            {(product, index) => (
              <a class={`khev-a-product khev-a-product-${index() + 1}`} href={`/prototype/storefront/${product.slug}?variant=A`}>
                <img src={product.image} alt={product.alt} width="700" height="1050" loading="lazy" />
                <span><strong>{product.name}</strong><small>{formatPrice(product.price)}</small></span>
              </a>
            )}
          </For>
        </div>
      </section>
    </main>
  </div>
);
