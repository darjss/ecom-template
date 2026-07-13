import ArrowRight from "lucide-solid/icons/arrow-right";
import Plus from "lucide-solid/icons/plus";
import { For, Show } from "solid-js";
import { formatMnt, type ReferenceProduct } from "./data";

interface ProductShelfProps {
  products: ReferenceProduct[];
  onOpen: (id: string) => void;
  onAdd: (product: ReferenceProduct) => void;
}

const stockLabel = (status: ReferenceProduct["status"]) => {
  if (status === "low") return "3 үлдсэн";
  if (status === "out") return "Дууссан";
  return "Бэлэн";
};

export const ProductShelf = (props: ProductShelfProps) => (
  <section class="u48-catalog" aria-labelledby="u48-catalog-title">
    <div class="u48-section-heading">
      <div><p>Ө48 Өдөр</p><h2 id="u48-catalog-title">Өдөр тутмын тавиур</h2></div>
      <button type="button">Бүгдийг үзэх <ArrowRight aria-hidden="true" /></button>
    </div>
    <div class="u48-shelf-grid">
      <For each={props.products.slice(0, 8)}>{(product, index) => (
        <article class={`u48-product u48-product-${index() + 1}`}>
          <button class="u48-product-image" type="button" onClick={() => props.onOpen(product.id)} aria-label={`${product.name} дэлгэрэнгүй`}>
            <img src={product.image} alt={`${product.shortName}, зохиомол бүтээгдэхүүний зураг`} width="1000" height="1000" loading={index() > 3 ? "lazy" : "eager"} />
          </button>
          <div class="u48-product-copy">
            <p class={`u48-stock u48-stock-${product.status}`}>{stockLabel(product.status)}</p>
            <button class="u48-product-name" type="button" onClick={() => props.onOpen(product.id)}>{product.shortName}</button>
            <div class="u48-product-buy">
              <strong>{formatMnt(product.price)}</strong>
              <button type="button" disabled={product.status === "out"} onClick={() => props.onAdd(product)} aria-label={`${product.shortName} сагсанд нэмэх`}>
                <Show when={product.status !== "out"} fallback="Дууссан"><Plus aria-hidden="true" /></Show>
              </button>
            </div>
          </div>
        </article>
      )}</For>
    </div>
  </section>
);
