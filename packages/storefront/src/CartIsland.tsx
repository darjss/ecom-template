import { CartProvider, createStoreQueryClient } from "@ecom/client";
import { QueryClientProvider } from "@tanstack/solid-query";
import { CartPresentation, type CartCatalogEntry } from "./CartPresentation";

export type CartIslandProps = {
  readonly storageKey: string;
  readonly catalog: readonly CartCatalogEntry[];
};

export const CartIsland = (props: CartIslandProps) => {
  const queryClient = createStoreQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider storageKey={props.storageKey}>
        <CartPresentation catalog={props.catalog} />
      </CartProvider>
    </QueryClientProvider>
  );
};

export type { CartCatalogEntry };
