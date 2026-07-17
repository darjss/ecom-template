import { env } from "cloudflare:workers";
import {
  findCatalogProductById,
  productJoins,
  productProjection,
  projectProduct,
} from "./product-projection";

export const catalogReaderQueries = {
  findById: findCatalogProductById,

  async listAll() {
    const result = await env.DB.prepare(
      `SELECT ${productProjection} ${productJoins} ORDER BY ci.created_at DESC`,
    ).all();
    return result.results.map(projectProduct);
  },

  async listPublished() {
    const result = await env.DB.prepare(
      "SELECT ci.id, ci.slug, ci.name, ci.description, ci.price_mnt AS priceMnt FROM catalog_items ci JOIN variants v ON v.product_id = ci.id AND v.is_default = 1 AND v.state = 'active' WHERE ci.state = 'published' ORDER BY ci.created_at DESC",
    ).all();
    return result.results;
  },

  async findPublishedBySlug(slug: string) {
    const result = await env.DB.prepare(
      "SELECT ci.id, ci.slug, ci.name, ci.description, ci.price_mnt AS priceMnt, v.id AS variantId FROM catalog_items ci JOIN variants v ON v.product_id = ci.id AND v.is_default = 1 AND v.state = 'active' WHERE ci.state = 'published' AND ci.slug = ? LIMIT 1",
    )
      .bind(slug)
      .all();
    return result.results.at(0);
  },
};
