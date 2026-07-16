import { CartSchema, type CartLine } from "@ecom/contracts";
import { makePersisted } from "@solid-primitives/storage";
import {
  createContext,
  createMemo,
  createSignal,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";
import * as v from "valibot";

const deserializeCart = (value: string) => {
  const parsed: unknown = JSON.parse(value);
  return v.parse(CartSchema, parsed).lines;
};

type CartContextValue = {
  readonly lines: Accessor<CartLine[]>;
  readonly itemCount: Accessor<number>;
  readonly addLine: (line: CartLine) => void;
  readonly clear: () => void;
};

const CartContext = createContext<CartContextValue>();

export const CartProvider: ParentComponent = (props) => {
  const [lines, setLines] = makePersisted(createSignal<CartLine[]>([]), {
    name: "urnuun-48:cart:v1",
    serialize: (cartLines) => JSON.stringify({ lines: cartLines }),
    deserialize: deserializeCart,
  });
  const itemCount = createMemo(() => lines().reduce((total, line) => total + line.quantity, 0));
  const addLine = (line: CartLine) => {
    setLines((current) => {
      const existing = current.find((candidate) => candidate.id === line.id);
      if (!existing) return [...current, line];
      return current.map((candidate) =>
        candidate.id === line.id
          ? { ...candidate, quantity: candidate.quantity + line.quantity }
          : candidate,
      );
    });
  };
  const clear = () => setLines([]);

  return (
    <CartContext.Provider value={{ lines, itemCount, addLine, clear }}>
      {props.children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside CartProvider");
  return cart;
};
