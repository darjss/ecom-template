import { CartProvider, useCart } from "@ecom/client/cart";
import { Bag, Button } from "@ecom/ui";
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
      <Button
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
      </Button>
      <span class="cart-count">
        <Bag size={20} aria-hidden="true" />
        <Show when={cart.itemCount() > 0} fallback="Сагс хоосон">
          Сагсанд {cart.itemCount()} бараа
        </Show>
      </span>
      <Show when={cart.itemCount() > 0}>
        <Button variant="secondary" onClick={cart.clear}>
          Цэвэрлэх
        </Button>
      </Show>
    </div>
  );
};

export const CartIsland = (props: FeaturedItem) => (
  <CartProvider storageKey={props.storageKey}>
    <CartControls {...props} />
  </CartProvider>
);
