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
    <section class="u48-pantry" aria-labelledby="u48-pantry-title">
      <div class="u48-pantry-beam">
        <span>Ө48 Өдөр</span>
        <b>Тавиур 01 · өдөр тутмын нөөц</b>
        <span>УБ · 09:00–21:00</span>
      </div>
      <div class="u48-pantry-grid">
        <nav class="u48-pantry-categories" aria-label="Бүтээгдэхүүний ангилал">
          <p>Тасалгаа</p>
          {categories.map((category, index) => (
            <button type="button">
              <span>{String(index + 1).padStart(2, "0")}</span>
              {category}
            </button>
          ))}
        </nav>
        <div class="u48-pantry-copy">
          <p class="u48-kicker">Өдөр бүрийн хэрэгцээг цэгцтэй</p>
          <h1 id="u48-pantry-title">
            Гэрийн
            <br />
            <span>тавиур.</span>
          </h1>
          <p>Хүнс, цэвэрлэгээ, жижиг бэлгийг нэг тавиураас ойлгомжтой сонгоорой.</p>
          <button
            type="button"
            onClick={() =>
              document.querySelector("#u48-catalog-title")?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Тавиур үзэх <ArrowRight aria-hidden="true" />
          </button>
        </div>
        <div class="u48-pantry-image">
          <img
            src="/prototypes/urnuun48/media/hero-pantry.webp"
            alt="Өрнүүн 48-ын зохиомол хүнс, гэр ахуйн бүтээгдэхүүнтэй модон тавиур"
            width="1000"
            height="1000"
          />
          <div class="u48-shelf-marker">
            <b>48</b>
            <span>гэрийн нөөц</span>
          </div>
        </div>
        <button class="u48-pantry-bundle" type="button" onClick={() => props.onOpen("B01")}>
          <img src="/prototypes/urnuun48/media/b01-cleaning-bundle.webp" alt="" />
          <span>Тасалгаа 05</span>
          <strong>Цэвэрлэгээний хослол</strong>
          <small>15,900₮ · Бэлэн</small>
          <ArrowRight aria-hidden="true" />
        </button>
        <div class="u48-pantry-delivery">
          <span>120,000₮</span>
          <strong>дээш хүргэлт үнэгүй</strong>
          <small>Улаанбаатар хотод</small>
        </div>
      </div>
      <div class="u48-pantry-plinth">
        <span>01 Хүнс</span>
        <span>02 Гэр ахуй</span>
        <span>03 Жижиг бэлэг</span>
        <b>ӨРНҮҮН / 48</b>
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
