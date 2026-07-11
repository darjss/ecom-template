import ArrowRight from "lucide-solid/icons/arrow-right";
import Menu from "lucide-solid/icons/menu";
import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { For } from "solid-js";
import { formatPrice, products } from "./catalog";

type VariantProps = {
  variant: string;
  onSearch: () => void;
};

export const VariantC = (props: VariantProps) => (
  <div class="khev-page khev-c">
    <header class="khev-c-header">
      <button type="button" aria-label="Цэс"><Menu aria-hidden="true" /></button>
      <a class="khev-logo" href={`/prototype/storefront?variant=${props.variant}`} aria-label="Хэв нүүр">ХЭВ<span>®</span></a>
      <div class="khev-header-actions">
        <button type="button" onClick={props.onSearch} aria-label="Хайх"><Search aria-hidden="true" /></button>
        <button type="button" aria-label="Сагс, хоосон"><ShoppingBag aria-hidden="true" /><span>0</span></button>
      </div>
    </header>

    <main>
      <section class="khev-c-hero">
        <div class="khev-c-hero-copy">
          <p class="khev-kicker">Хотын хэм / 2026</p>
          <h1>Хот өөрчлөгдөнө.<br />Хэв үлдэнэ.</h1>
          <a href="#paths">Өөрийн төрхийг олох <ArrowRight aria-hidden="true" /></a>
        </div>
        <div class="khev-c-hero-images" aria-hidden="true">
          <img src="/prototype/storefront/15444673.webp" alt="" width="1400" height="934" fetchpriority="high" />
          <img src="/prototype/storefront/7691349.webp" alt="" width="700" height="1050" />
        </div>
      </section>

      <section class="khev-c-paths" id="paths" aria-labelledby="paths-title">
        <div class="khev-section-heading">
          <p class="khev-kicker">Танд зориулсан зам</p>
          <h2 id="paths-title">Өнөөдөр ямар хэмтэй вэ?</h2>
        </div>
        <div class="khev-c-path-grid">
          <a href="#edit"><span>01</span><strong>Ажил хэрэгч,<br />хэт албархуу биш</strong><small>6 загвар</small></a>
          <a href="#edit"><span>02</span><strong>Оройн хотод<br />тод харагдах</strong><small>4 загвар</small></a>
          <a href="#edit"><span>03</span><strong>Өдөр бүр<br />давхарлан өмсөх</strong><small>8 загвар</small></a>
        </div>
      </section>

      <section class="khev-c-edit" id="edit" aria-labelledby="edit-title">
        <div class="khev-c-edit-lead">
          <p class="khev-kicker">Хэвийн сонголт</p>
          <h2 id="edit-title">Зөөлөн давхарга,<br />тод шугам</h2>
          <p>Нэг өнгийн суурин дээр эсгүүрийн ялгааг мэдрэх гурван сонголт.</p>
        </div>
        <For each={products.slice(3, 6)}>
          {(product) => (
            <a class="khev-c-product" href={`/prototype/storefront/${product.slug}?variant=C`}>
              <img src={product.image} alt={product.alt} width="700" height="1050" loading="lazy" />
              <span><strong>{product.name}</strong><small>{formatPrice(product.price)}</small></span>
            </a>
          )}
        </For>
      </section>
    </main>
  </div>
);
