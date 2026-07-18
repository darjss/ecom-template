import {
  CartLineSchema,
  CartSchema,
  PurchaseQuantitySchema,
  type Cart,
  type CartLine,
} from "@ecom/contracts";
import { makeObjectStorage, makePersisted } from "@solid-primitives/storage";
import {
  createContext,
  createMemo,
  createSignal,
  useContext,
  type Accessor,
  type ParentComponent,
} from "solid-js";
import { createStore } from "solid-js/store";
import { isServer } from "solid-js/web";
import * as v from "valibot";

const emptyCart = (): Cart => ({ version: 1, lines: [] });

const normalizedLine = (line: CartLine): CartLine =>
  v.parse(CartLineSchema, {
    ...line,
    personalizations: line.personalizations.toSorted((left, right) =>
      left.key.localeCompare(right.key),
    ),
  });

const lineIdentity = (line: CartLine) => {
  const identity = line.kind === "variant" ? line.variantId : line.bundleId;
  return JSON.stringify([line.kind, identity, normalizedLine(line).personalizations]);
};

export type CartRecovery = {
  readonly message: string;
};

export type AddCartLineResult =
  | "added"
  | "merged"
  | "cart_full"
  | "quantity_exceeded"
  | "recovery_required";

type CartContextValue = {
  readonly lines: Accessor<readonly CartLine[]>;
  readonly itemCount: Accessor<number>;
  readonly recovery: Accessor<CartRecovery | null>;
  readonly addLine: (line: CartLine) => AddCartLineResult;
  readonly updateQuantity: (line: CartLine, quantity: number) => boolean;
  readonly removeLine: (line: CartLine) => void;
  readonly clear: () => void;
  readonly reset: () => void;
};

const CartContext = createContext<CartContextValue>();

export type CartProviderProps = {
  readonly storageKey: string;
};

export const CartProvider: ParentComponent<CartProviderProps> = (props) => {
  const [recovery, setRecovery] = createSignal<CartRecovery | null>(null);
  const deserializeCart = (value: string): Cart => {
    try {
      const parsed: unknown = JSON.parse(value);
      const cart = v.safeParse(CartSchema, parsed);
      if (cart.success) {
        return cart.output;
      }
    } catch {
      setRecovery({ message: "Сагсыг сэргээж чадсангүй. Сагсаа шинэчилж дахин эхлүүлнэ үү." });
      return emptyCart();
    }
    setRecovery({ message: "Сагсыг сэргээж чадсангүй. Сагсаа шинэчилж дахин эхлүүлнэ үү." });
    return emptyCart();
  };
  const [cart, setCart] = makePersisted(createStore<Cart>(emptyCart()), {
    name: props.storageKey,
    serialize: JSON.stringify,
    deserialize: deserializeCart,
    storage: isServer ? makeObjectStorage({}) : localStorage,
  });
  const lines = () => cart.lines;
  const itemCount = createMemo(() => cart.lines.reduce((total, line) => total + line.quantity, 0));
  const addLine = (input: CartLine): AddCartLineResult => {
    if (recovery()) {
      return "recovery_required";
    }
    const line = normalizedLine(input);
    const identity = lineIdentity(line);
    const index = cart.lines.findIndex((candidate) => lineIdentity(candidate) === identity);
    if (index === -1) {
      if (cart.lines.length === 100) {
        return "cart_full";
      }
      setCart("lines", cart.lines.length, line);
      return "added";
    }
    const existing = cart.lines[index];
    if (!existing) {
      return "cart_full";
    }
    const quantity = existing.quantity + line.quantity;
    if (quantity > 999) {
      return "quantity_exceeded";
    }
    setCart("lines", index, "quantity", quantity);
    return "merged";
  };
  const updateQuantity = (line: CartLine, quantity: number) => {
    const parsed = v.safeParse(PurchaseQuantitySchema, quantity);
    const index = cart.lines.findIndex(
      (candidate) => lineIdentity(candidate) === lineIdentity(line),
    );
    if (!parsed.success || index === -1 || recovery()) {
      return false;
    }
    setCart("lines", index, "quantity", parsed.output);
    return true;
  };
  const removeLine = (line: CartLine) =>
    setCart(
      "lines",
      cart.lines.filter((candidate) => lineIdentity(candidate) !== lineIdentity(line)),
    );
  const clear = () => setCart("lines", []);
  const reset = () => {
    setCart(emptyCart());
    setRecovery(null);
  };

  return (
    <CartContext.Provider
      value={{ lines, itemCount, recovery, addLine, updateQuantity, removeLine, clear, reset }}
    >
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
