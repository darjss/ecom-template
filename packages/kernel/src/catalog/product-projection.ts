import { ProductSchema, type Product, type ProductId } from "@ecom/contracts";
import { env } from "cloudflare:workers";
import * as v from "valibot";

const ReturnedProductSchema = v.strictObject({
  id: v.string(),
  defaultVariantId: v.string(),
  stockItemId: v.string(),
  slug: v.string(),
  state: v.string(),
  name: v.string(),
  description: v.string(),
  priceMnt: v.number(),
  sku: v.string(),
  onHandQuantity: v.number(),
  reservedQuantity: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const productProjection = `ci.id, v.id AS defaultVariantId, si.id AS stockItemId, ci.slug, ci.state, ci.name, ci.description, ci.price_mnt AS priceMnt, s.sku, si.on_hand_quantity AS onHandQuantity, si.reserved_quantity AS reservedQuantity, ci.created_at AS createdAt, ci.updated_at AS updatedAt`;
export const productJoins =
  "FROM catalog_items ci JOIN variants v ON v.product_id = ci.id AND v.is_default = 1 JOIN skus s ON s.variant_id = v.id JOIN stock_items si ON si.variant_id = v.id";

export const projectProduct = (source: unknown): Product => {
  const row = v.parse(ReturnedProductSchema, source);
  return v.parse(ProductSchema, {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  });
};

export const findCatalogProductById = async (id: ProductId) => {
  const result = await env.DB.prepare(`SELECT ${productProjection} ${productJoins} WHERE ci.id = ?`)
    .bind(id)
    .all();
  const row = result.results.at(0);
  return row ? projectProduct(row) : undefined;
};
