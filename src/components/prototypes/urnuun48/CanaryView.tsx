import CheckCircle2 from "lucide-solid/icons/check-circle-2";
import CircleDot from "lucide-solid/icons/circle-dot";

const scenarios = [
  ["wf29.search.tiers", "Хайлт", "Native, strict, basic transliteration болон Unicode SKU"],
  ["wf29.bundle.reserve", "Багцын нөөц", "B01 × 2 нь хоёр бүрэлдэхүүнээс тус бүр 2-г нөөцөлнө"],
  [
    "wf29.cache.live-stock",
    "Cache + үлдэгдэл",
    "Cached HTML тогтвортой, no-store availability 3 → 0 → 3",
  ],
  [
    "wf29.guest.qpay-transfer",
    "QPay → шилжүүлэг",
    "38,800₮, нэг идэвхтэй Payment, дараа нь Fulfillment",
  ],
  ["wf29.cod.pickup", "COD + Pickup", "16,300₮, хүргэлт 0₮, бараа авахад бэлэн"],
  [
    "wf29.cancel.refund",
    "Cancellation + Refund",
    "21,900₮ үүргийг 10,000₮ + 11,900₮ баримтаар хаана",
  ],
  ["wf29.customer.link", "Customer холбох", "Баталгаажсан утас өмнөх Guest Order-ыг холбоно"],
  ["wf29.stock.race", "Сүүлийн нөөц", "Хоёр өрсөлдсөн Checkout-оос яг нэг нь амжилттай"],
];

export const CanaryView = () => (
  <main class="u48-canaries" id="main-content">
    <header>
      <p class="u48-kicker">Fixture inspector</p>
      <h1>Канарын аяллууд</h1>
      <span>Эдгээр нь прототипийн хүлээгдэж буй баталгаа. Production proof биш.</span>
    </header>
    <div class="u48-canary-list">
      {scenarios.map(([key, title, detail], index) => (
        <article>
          <div>{index < 3 ? <CheckCircle2 /> : <CircleDot />}</div>
          <p>{key}</p>
          <h2>{title}</h2>
          <span>{detail}</span>
          <b>{index < 3 ? "Fixture-д харагдана" : "Implementation-д батална"}</b>
        </article>
      ))}
    </div>
    <section class="u48-fixture-boundary">
      <h2>Цэвэр seed-ийн хил</h2>
      <p>
        Catalog, CMS, Store Profile болон эхний Inventory Entries л байна. Order, Customer, Payment,
        Refund, session, tracking link байхгүй.
      </p>
      <code>fixturePurpose: reference-canary</code>
    </section>
  </main>
);
