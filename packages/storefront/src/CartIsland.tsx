import { CartProvider, useCart } from "@ecom/client/cart";
import { Bag } from "@ecom/ui/icons";
import { Show } from "solid-js";

export type FeaturedItem = {
  readonly id: string;
  readonly title: string;
  readonly unitPriceMnt: number;
  readonly storageKey: string;
};

const CartControls = (props: FeaturedItem) => {
  const cart = useCart();
  return (
    <div class="cart-controls" aria-live="polite">
      <button
        class="ui-button ui-button--primary"
        onClick={() =>
          cart.addLine({
            id: props.id,
            title: props.title,
            unitPriceMnt: props.unitPriceMnt,
            quantity: 1,
          })
        }
      >
        Сагсанд нэмэх
      </button>
      <span class="cart-count">
        <Bag size={20} aria-hidden="true" />
        <Show when={cart.itemCount() > 0} fallback="Сагс хоосон">
          Сагсанд {cart.itemCount()} бараа
        </Show>
      </span>
      <Show when={cart.itemCount() > 0}>
        <button class="ui-button ui-button--quiet" onClick={cart.clear}>
          Цэвэрлэх
        </button>
      </Show>
    </div>
  );
};

export const CartIsland = (props: FeaturedItem) => (
  <CartProvider storageKey={props.storageKey}>
    <CartControls {...props} />
  </CartProvider>
);
