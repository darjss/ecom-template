import * as v from "valibot";
import type { DraftIdentity } from "./draft-store";
import type { ReconciliationDescriptor, RecordSnapshot } from "./model";

export const categoryOptions = ["Ноолууран хувцас", "Гадуур хувцас", "Аксессуар"];

export const nameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(2, "Бүтээгдэхүүний нэрийг оруулна уу."),
  v.maxLength(80, "Нэр 80 тэмдэгтээс богино байх шаардлагатай."),
);
export const priceSchema = v.pipe(
  v.number("Үнийг бүхэл тоогоор оруулна уу."),
  v.integer("Үнэ бүхэл төгрөгөөр байх шаардлагатай."),
  v.minValue(1_000, "Үнэ хамгийн багадаа 1,000 ₮ байна."),
);
export const categorySchema = v.picklist(categoryOptions, "Ангилал сонгоно уу.");
export const descriptionSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(10, "Тайлбар хамгийн багадаа 10 тэмдэгт байна."),
  v.maxLength(180, "Тайлбар 180 тэмдэгтээс богино байх шаардлагатай."),
);

export const productSchema = v.object({
  name: nameSchema,
  price: priceSchema,
  category: categorySchema,
  description: descriptionSchema,
  published: v.boolean(),
});

export type ProductValues = v.InferOutput<typeof productSchema>;

export const productIdentity: DraftIdentity = {
  storeId: "fictional-urnuu",
  formId: "product-summary",
  entityId: "product-cashmere-cardigan",
};

export const initialProductRecord: RecordSnapshot<ProductValues> = {
  revision: 7,
  values: {
    name: "Хөвсгөл ноолууран кардиган",
    price: 289_000,
    category: "Ноолууран хувцас",
    description: "Хөнгөн нэхээстэй, өдөр тутам давхарлан өмсөхөд зориулсан зөөлөн кардиган.",
    published: false,
  },
};

const formatPrice = (price: number) => `${new Intl.NumberFormat("mn-MN").format(price)} ₮`;

export const productDescriptors: ReconciliationDescriptor<ProductValues>[] = [
  {
    id: "name",
    label: "Бүтээгдэхүүний нэр",
    equals: (left, right) => left.name === right.name,
    format: (values) => values.name,
    copy: (target, source) => ({ ...target, name: source.name }),
  },
  {
    id: "price",
    label: "Үндсэн үнэ",
    equals: (left, right) => left.price === right.price,
    format: (values) => formatPrice(values.price),
    copy: (target, source) => ({ ...target, price: source.price }),
  },
  {
    id: "category",
    label: "Ангилал",
    equals: (left, right) => left.category === right.category,
    format: (values) => values.category,
    copy: (target, source) => ({ ...target, category: source.category }),
  },
  {
    id: "description",
    label: "Дэлгүүрийн товч тайлбар",
    equals: (left, right) => left.description === right.description,
    format: (values) => values.description,
    copy: (target, source) => ({ ...target, description: source.description }),
  },
  {
    id: "published",
    label: "Нийтлэх төлөв",
    equals: (left, right) => left.published === right.published,
    format: (values) => (values.published ? "Нийтэлнэ" : "Ноорог хэвээр"),
    copy: (target, source) => ({ ...target, published: source.published }),
  },
];
