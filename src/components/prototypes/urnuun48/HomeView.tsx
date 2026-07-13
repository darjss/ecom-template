import ArrowRight from "lucide-solid/icons/arrow-right";
import MapPin from "lucide-solid/icons/map-pin";
import PackageCheck from "lucide-solid/icons/package-check";
import Truck from "lucide-solid/icons/truck";
import { ProductShelf } from "./ProductShelf";
import { products, type ReferenceProduct } from "./data";

interface HomeViewProps {
  onOpen: (id: string) => void;
  onAdd: (product: ReferenceProduct) => void;
}

const categories = ["Хүнс", "Цэвэрлэгээ", "Цүнх, хадгалалт", "Бичиг хэрэг", "Багц"];

export const HomeView = (props: HomeViewProps) => (
  <main id="main-content">
    <nav class="u48-category-nav" aria-label="Бүтээгдэхүүний ангилал">
      {categories.map((category) => (
        <button type="button">{category}</button>
      ))}
    </nav>
    <section class="u48-hero">
      <div class="u48-hero-copy">
        <p class="u48-kicker">Өдөр бүрийн хэрэгцээг цэгцтэй</p>
        <h1>
          Гэрийн тавиураа
          <br />
          <span>нэг дороос</span>
        </h1>
        <p>Гал тогоо, гэр ахуй, жижиг бэлгийн хэрэгцээг ойлгомжтой сонгоорой.</p>
        <button
          type="button"
          onClick={() =>
            document.querySelector("#u48-catalog-title")?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Өнөөдрийн сонголт <ArrowRight aria-hidden="true" />
        </button>
      </div>
      <div class="u48-hero-image">
        <img
          src="/prototypes/urnuun48/media/hero-pantry.webp"
          alt="Өрнүүн 48-ын зохиомол хүнс, гэр ахуйн бүтээгдэхүүнтэй модон тавиур"
          width="1000"
          height="1000"
        />
        <div class="u48-hero-tag">
          <b>120,000₮</b>
          <span>дээш хүргэлт үнэгүй</span>
        </div>
      </div>
      <div class="u48-hero-side">
        <p>Шинэ гэр</p>
        <strong>
          Цэвэрхэн эхлэх
          <br />
          бэлэн багцууд
        </strong>
        <button type="button" onClick={() => props.onOpen("B01")}>
          Багц үзэх <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
    <ProductShelf products={products} onOpen={props.onOpen} onAdd={props.onAdd} />
    <section class="u48-assurance" aria-label="Үйлчилгээний мэдээлэл">
      <div>
        <Truck aria-hidden="true" />
        <span>
          <b>6,000₮ хүргэлт</b>Улаанбаатар хотод
        </span>
      </div>
      <div>
        <MapPin aria-hidden="true" />
        <span>
          <b>Үнэгүй авах</b>Жишиг цэгээс
        </span>
      </div>
      <div>
        <PackageCheck aria-hidden="true" />
        <span>
          <b>Бодит үлдэгдэл</b>Захиалахад дахин шалгана
        </span>
      </div>
    </section>
  </main>
);
