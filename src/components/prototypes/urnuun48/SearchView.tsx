import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import { For, Show, createMemo } from "solid-js";
import { formatMnt, products, type ReferenceProduct } from "./data";

interface SearchViewProps {
  query: string;
  onOpen: (id: string) => void;
  onAdd: (product: ReferenceProduct) => void;
}

export const SearchView = (props: SearchViewProps) => {
  const results = createMemo(() => {
    const query = props.query.trim().toLocaleLowerCase("mn-MN");
    if (!query) return products;
    return products.filter((product) =>
      `${product.name} ${product.sku} ${product.category}`
        .toLocaleLowerCase("mn-MN")
        .includes(query),
    );
  });

  return (
    <main class="u48-results" id="main-content">
      <header>
        <p>Хайлтын үр дүн</p>
        <h1>“{props.query || "Бүх бүтээгдэхүүн"}”</h1>
        <span>{results().length} сонголт</span>
      </header>
      <Show
        when={results().length > 0}
        fallback={
          <div class="u48-empty">
            <Search aria-hidden="true" />
            <h2>Илэрц олдсонгүй</h2>
            <p>Бүтээгдэхүүний нэр эсвэл WF29 SKU-аар дахин хайгаарай.</p>
          </div>
        }
      >
        <div class="u48-result-list">
          <For each={results()}>
            {(product) => (
              <article>
                <button type="button" onClick={() => props.onOpen(product.id)}>
                  <img src={product.image} alt="" width="1000" height="1000" />
                </button>
                <div>
                  <p>
                    {product.category} · {product.sku}
                  </p>
                  <button type="button" onClick={() => props.onOpen(product.id)}>
                    {product.name}
                  </button>
                  <span>{product.detail}</span>
                </div>
                <p class={`u48-stock u48-stock-${product.status}`}>
                  {product.status === "out"
                    ? "Дууссан"
                    : product.status === "low"
                      ? "Цөөн үлдсэн"
                      : "Бэлэн"}
                </p>
                <strong>{formatMnt(product.price)}</strong>
                <button
                  class="u48-result-add"
                  type="button"
                  disabled={product.status === "out"}
                  onClick={() => props.onAdd(product)}
                >
                  <ShoppingBag aria-hidden="true" />
                  <span>Нэмэх</span>
                </button>
              </article>
            )}
          </For>
        </div>
      </Show>
    </main>
  );
};
