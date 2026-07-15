import { env } from "cloudflare:workers";
import { Elysia, t } from "elysia";

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_mnt: number;
}

interface AvailabilityRow {
  id: string;
  available: number;
  price_mnt: number;
}

const noStore = (headers: Record<string, string | number>) => {
  headers["cache-control"] = "private, no-store";
};

export const cacheProofRoute = new Elysia({ prefix: "/prototype" })
  .get(
    "/search",
    async ({ query, set }) => {
      noStore(set.headers);
      const normalized = query.q.trim();
      if (normalized.length < 2) return { products: [] };

      const result = await env.DB.prepare(
        "SELECT id, slug, name, description, price_mnt FROM cache_proof_products WHERE name LIKE ? ORDER BY name LIMIT 8",
      )
        .bind(`%${normalized}%`)
        .all<ProductRow>();

      return { products: result.results };
    },
    {
      query: t.Object({ q: t.String({ minLength: 1, maxLength: 80 }) }),
      response: t.Object({
        products: t.Array(
          t.Object({
            id: t.String(),
            slug: t.String(),
            name: t.String(),
            description: t.String(),
            price_mnt: t.Number(),
          }),
        ),
      }),
    },
  )
  .get(
    "/availability",
    async ({ query, set }) => {
      noStore(set.headers);
      const ids = [...new Set(query.ids.split(","))];
      const placeholders = ids.map(() => "?").join(",");
      const result = await env.DB.prepare(
        `SELECT id, available, price_mnt FROM cache_proof_variants WHERE id IN (${placeholders}) ORDER BY id`,
      )
        .bind(...ids)
        .all<AvailabilityRow>();

      return { checkedAt: Date.now(), variants: result.results };
    },
    {
      query: t.Object({
        ids: t.String({ pattern: "^[a-z0-9_-]+(?:,[a-z0-9_-]+){0,19}$", maxLength: 400 }),
      }),
      response: t.Object({
        checkedAt: t.Number(),
        variants: t.Array(
          t.Object({ id: t.String(), available: t.Number(), price_mnt: t.Number() }),
        ),
      }),
    },
  )
  .post(
    "/checkout",
    async ({ body, set }) => {
      noStore(set.headers);
      const current = await env.DB.prepare(
        "SELECT id, available, price_mnt FROM cache_proof_variants WHERE id = ?",
      )
        .bind(body.variantId)
        .first<AvailabilityRow>();

      if (!current || current.available < body.quantity) {
        set.status = 409;
        return { accepted: false, code: "OUT_OF_STOCK", currentPriceMnt: current?.price_mnt ?? null };
      }
      if (current.price_mnt !== body.quotedPriceMnt) {
        set.status = 409;
        return { accepted: false, code: "PRICE_CHANGED", currentPriceMnt: current.price_mnt };
      }

      return { accepted: true, code: "CURRENT_TRUTH_CONFIRMED", currentPriceMnt: current.price_mnt };
    },
    {
      body: t.Object({
        variantId: t.String({ pattern: "^[a-z0-9_-]+$", maxLength: 80 }),
        quantity: t.Integer({ minimum: 1, maximum: 20 }),
        quotedPriceMnt: t.Integer({ minimum: 0 }),
      }),
      response: {
        200: t.Object({
          accepted: t.Literal(true),
          code: t.Literal("CURRENT_TRUTH_CONFIRMED"),
          currentPriceMnt: t.Number(),
        }),
        409: t.Object({
          accepted: t.Literal(false),
          code: t.Union([t.Literal("OUT_OF_STOCK"), t.Literal("PRICE_CHANGED")]),
          currentPriceMnt: t.Union([t.Number(), t.Null()]),
        }),
      },
    },
  );
