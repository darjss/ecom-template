export type StockStatus = "available" | "low" | "out";

export interface ReferenceProduct {
  id: string;
  name: string;
  shortName: string;
  category: string;
  price: number;
  image: string;
  sku: string;
  status: StockStatus;
  detail: string;
}

const media = "/prototypes/urnuun48/media";

const rice: ReferenceProduct = {
  id: "P01",
  name: "Өглөөний цагаан будаа, 1 кг",
  shortName: "Цагаан будаа",
  category: "Хүнс",
  price: 5400,
  image: `${media}/p01-rice.webp`,
  sku: "WF29-RICE-1K",
  status: "available",
  detail: "Дахин битүүмжилдэг ууттай өдөр тутмын цагаан будаа.",
};

export const products: ReferenceProduct[] = [
  rice,
  {
    id: "P02",
    name: "Дотоодын I зэргийн гурил, 1 кг",
    shortName: "I зэргийн гурил",
    category: "Хүнс",
    price: 2900,
    image: `${media}/p02-flour.webp`,
    sku: "WF29-FLOUR-1K",
    status: "available",
    detail: "Банш, гурилан хоол болон өдөр тутмын жигнэлтэд.",
  },
  {
    id: "P03",
    name: "Савласан сүү, 1 л",
    shortName: "Савласан сүү",
    category: "Хүнс",
    price: 5500,
    image: `${media}/p03-milk.webp`,
    sku: "WF29-MILK-1L",
    status: "low",
    detail: "Хөргөлттэй хадгалах өдөр тутмын савласан сүү.",
  },
  {
    id: "P04",
    name: "Ургамлын тос, 1 л",
    shortName: "Ургамлын тос",
    category: "Хүнс",
    price: 12900,
    image: `${media}/p04-oil.webp`,
    sku: "WF29-OIL-1L",
    status: "out",
    detail: "Хоол хийхэд зориулсан нэг литрийн савлагаа.",
  },
  {
    id: "P05",
    name: "Үнэргүй угаалгын нунтаг",
    shortName: "Угаалгын нунтаг",
    category: "Цэвэрлэгээ",
    price: 9500,
    image: `${media}/p05-detergent-800.webp`,
    sku: "WF29-WASH-800",
    status: "available",
    detail: "Өдөр тутмын хувцас угаалтад зориулсан хоёр хэмжээтэй нунтаг.",
  },
  {
    id: "P06",
    name: "Аяга таваг угаагч шингэн, 500 мл",
    shortName: "Угаагч шингэн",
    category: "Цэвэрлэгээ",
    price: 7500,
    image: `${media}/p06-dish-liquid.webp`,
    sku: "WF29-DISH-500",
    status: "available",
    detail: "Гал тогооны өдөр тутмын цэвэрлэгээнд.",
  },
  {
    id: "P07",
    name: "Өдөр тутмын даавуун цүнх",
    shortName: "Даавуун цүнх",
    category: "Цүнх, хадгалалт",
    price: 18900,
    image: `${media}/p07-tote-sand.webp`,
    sku: "WF29-TOTE-S-SAND",
    status: "available",
    detail: "Хоёр хэмжээ, хоёр өнгөөс сонгох эвхдэг даавуун цүнх.",
  },
  {
    id: "P08",
    name: "Нэртэй тэмдэглэлийн дэвтэр",
    shortName: "Тэмдэглэлийн дэвтэр",
    category: "Бичиг хэрэг",
    price: 14900,
    image: `${media}/p08-notebook.webp`,
    sku: "WF29-Ө-001",
    status: "available",
    detail: "Нүүрний богино бичвэр, боодлын туузыг сонгон бэлдэнэ.",
  },
  {
    id: "P09",
    name: "Ёотон сахар, 500 г",
    shortName: "Ёотон сахар",
    category: "Хүнс",
    price: 2700,
    image: `${media}/p09-sugar-cubes.webp`,
    sku: "WF29-YO-500",
    status: "available",
    detail: "Цай, кофенд хэрэглэх жижиг савлагаатай ёотон сахар.",
  },
  {
    id: "B01",
    name: "Цэвэрлэгээний хослол",
    shortName: "Цэвэрлэгээний хослол",
    category: "Багц",
    price: 15900,
    image: `${media}/b01-cleaning-bundle.webp`,
    sku: "WF29-BND-CLEAN",
    status: "available",
    detail: "800 г нунтаг болон угаагч шингэний тогтмол багц.",
  },
  {
    id: "B02",
    name: "Гал тогооны нөөц багц",
    shortName: "Гал тогооны багц",
    category: "Багц",
    price: 24900,
    image: `${media}/b02-pantry-bundle.webp`,
    sku: "WF29-BND-PANTRY",
    status: "out",
    detail: "Хоёр будаа, нэг гурил, нэг ургамлын тос.",
  },
];

export const formatMnt = (value: number) => `${new Intl.NumberFormat("mn-MN").format(value)}₮`;

export const findProduct = (id: string) => products.find((product) => product.id === id) ?? rice;
