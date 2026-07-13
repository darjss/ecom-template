import Menu from "lucide-solid/icons/menu";
import Search from "lucide-solid/icons/search";
import ShoppingBag from "lucide-solid/icons/shopping-bag";
import UserRound from "lucide-solid/icons/user-round";
import type { Accessor } from "solid-js";

interface StoreHeaderProps {
  cartCount: Accessor<number>;
  query: Accessor<string>;
  onQuery: (value: string) => void;
  onSearch: () => void;
  onCart: () => void;
}

export const StoreHeader = (props: StoreHeaderProps) => (
  <>
    <div class="u48-demo-notice">Энэ бол зохиомол жишиг дэлгүүр. Бодит захиалга хүлээн авахгүй.</div>
    <header class="u48-header">
      <button class="u48-icon-button u48-mobile-menu" type="button" aria-label="Цэс нээх">
        <Menu aria-hidden="true" />
      </button>
      <button class="u48-wordmark" type="button" onClick={() => window.location.assign("?view=home")}>
        <span>Өрнүүн</span><b>48</b>
      </button>
      <form class="u48-search" onSubmit={(event) => { event.preventDefault(); props.onSearch(); }}>
        <Search aria-hidden="true" />
        <label class="sr-only" for="u48-search-input">Бүтээгдэхүүн хайх</label>
        <input id="u48-search-input" value={props.query()} onInput={(event) => props.onQuery(event.currentTarget.value)} placeholder="Будаа, угаалгын нунтаг, WF29…" />
        <button type="submit">Хайх</button>
      </form>
      <div class="u48-header-actions">
        <button class="u48-icon-button" type="button" aria-label="Хэрэглэгчийн хэсэг"><UserRound aria-hidden="true" /></button>
        <button class="u48-cart-button" type="button" onClick={props.onCart}>
          <ShoppingBag aria-hidden="true" /><span>Сагс</span><b>{props.cartCount()}</b>
        </button>
      </div>
    </header>
  </>
);
