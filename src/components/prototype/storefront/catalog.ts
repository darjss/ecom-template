export type Product = {
  slug: string;
  name: string;
  price: number;
  category: string;
  collection: string;
  tags: readonly string[];
  image: string;
  alt: string;
};

export const products: readonly Product[] = [
  {
    slug: "salkhi-jacket",
    name: "Салхи хүрэм",
    price: 289000,
    category: "Гадуур хувцас",
    collection: "Хотын хэм",
    tags: ["хүрэм", "саарал", "өвөл"],
    image: "/prototype/storefront/33522330.webp",
    alt: "Саармаг өнгийн хувцастай хоёр загвар өмсөгч",
  },
  {
    slug: "zuraas-suit",
    name: "Зураас хослол",
    price: 328000,
    category: "Хослол",
    collection: "Шугам 01",
    tags: ["цагаан", "пиджак", "хослол"],
    image: "/prototype/storefront/17445097.webp",
    alt: "Хар дэвсгэрийн өмнө цагаан хослол өмссөн эмэгтэй",
  },
  {
    slug: "namuun-dress",
    name: "Намуун даашинз",
    price: 198000,
    category: "Даашинз",
    collection: "Шугам 01",
    tags: ["торго", "хар", "үдшийн"],
    image: "/prototype/storefront/20357200.webp",
    alt: "Цагаан студид хар даашинз өмссөн эмэгтэй",
  },
  {
    slug: "tal-coat",
    name: "Тал пальто",
    price: 420000,
    category: "Гадуур хувцас",
    collection: "Хотын хэм",
    tags: ["пальто", "ноос", "шаргал"],
    image: "/prototype/storefront/15444673.webp",
    alt: "Хотын гудамжинд пальто өмссөн хоёр загвар өмсөгч",
  },
  {
    slug: "hos-shirt",
    name: "Хос цамц",
    price: 149000,
    category: "Цамц",
    collection: "Хослол",
    tags: ["цагаан", "унисекс", "хөвөн"],
    image: "/prototype/storefront/6226727.webp",
    alt: "Цагаан ижил загварын хувцастай хоёр хүн",
  },
  {
    slug: "tseg-top",
    name: "Цэг топ",
    price: 119000,
    category: "Цамц",
    collection: "Шөнийн хот",
    tags: ["хар", "гялтгануур", "топ"],
    image: "/prototype/storefront/7691349.webp",
    alt: "Хар цагаан зурагт гялтгануур топ өмссөн эмэгтэй",
  },
  {
    slug: "toli-coat",
    name: "Толь пальто",
    price: 398000,
    category: "Гадуур хувцас",
    collection: "Шөнийн хот",
    tags: ["хар", "пальто", "малгай"],
    image: "/prototype/storefront/5825655.webp",
    alt: "Дэлгүүрийн цонхон дахь хар пальто, ягаан малгайтай манекен",
  },
  {
    slug: "hamt-set",
    name: "Хамт сет",
    price: 258000,
    category: "Хослол",
    collection: "Хослол",
    tags: ["сет", "өдөр тутам", "унисекс"],
    image: "/prototype/storefront/37305164.webp",
    alt: "Саармаг студид өдөр тутмын хувцастай хоёр хүн",
  },
];

export const categories: readonly string[] = ["Гадуур хувцас", "Хослол", "Даашинз", "Цамц"];
export const collections: readonly string[] = ["Хотын хэм", "Шугам 01", "Хослол", "Шөнийн хот"];

export const formatPrice = (price: number) => `${price.toLocaleString("mn-MN")} ₮`;

export const findProduct = (slug: string | undefined) =>
  products.find((product) => product.slug === slug);
