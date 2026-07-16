import { CartSchema, type Cart, type CartLine } from "@ecom/contracts";
import { makePersisted } from "@solid-primitives/storage";
import {
  createContext,
  createMemo,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";
import { createStore } from "solid-js/store";
import * as v from "valibot";

const deserializeCart = (value: string) => {
  const parsed: unknown = JSON.parse(value);
  return v.parse(CartSchema, parsed);
};

type CartContextValue = {
  readonly lines: Accessor<CartLine[]>;
  readonly itemCount: Accessor<number>;
  readonly addLine: (line: CartLine) => void;
  readonly clear: () => void;
};

const CartContext = createContext<CartContextValue>();

export type CartProviderProps = {
  readonly storageKey: string;
};

export const CartProvider: ParentComponent<CartProviderProps> = (props) => {
  const [cart, setCart] = makePersisted(createStore<Cart>({ lines: [] }), {
    name: props.storageKey,
    serialize: JSON.stringify,
    deserialize: deserializeCart,
  });
  const lines = () => cart.lines;
  const itemCount = createMemo(() => cart.lines.reduce((total, line) => total + line.quantity, 0));
  const addLine = (line: CartLine) => {
    const index = cart.lines.findIndex((candidate) => candidate.id === line.id);
    if (index === -1) {
      setCart("lines", cart.lines.length, line);
      return;
    }
    setCart("lines", index, "quantity", (quantity) => quantity + line.quantity);
  };
  const clear = () => setCart("lines", []);

  return (
    <CartContext.Provider value={{ lines, itemCount, addLine, clear }}>
      {props.children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return cart;
};
