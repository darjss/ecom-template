DROP TABLE IF EXISTS cache_proof_variants;
DROP TABLE IF EXISTS cache_proof_products;

CREATE TABLE cache_proof_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_mnt INTEGER NOT NULL CHECK (price_mnt >= 0),
  catalog_version INTEGER NOT NULL CHECK (catalog_version > 0)
);

CREATE TABLE cache_proof_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES cache_proof_products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL,
  available INTEGER NOT NULL CHECK (available >= 0),
  price_mnt INTEGER NOT NULL CHECK (price_mnt >= 0)
);

CREATE INDEX cache_proof_variants_product_idx ON cache_proof_variants(product_id, position);

INSERT INTO cache_proof_products (id, slug, name, description, price_mnt, catalog_version)
VALUES (
  'product_nomad_cup',
  'nomad-cup',
  'Нүүдэл аяга',
  'Cached HTML нь бүтээгдэхүүний танилцуулгыг хурдан үзүүлнэ. Худалдан авах боломж үргэлж D1-ээс тусдаа шалгагдана.',
  28900,
  1
);

INSERT INTO cache_proof_products (id, slug, name, description, price_mnt, catalog_version)
VALUES (
  'product_steppe_bag',
  'steppe-bag',
  'Тал цүнх',
  'Хайлтын no-store хариуг шалгах хоёр дахь каталогийн бүтээгдэхүүн.',
  64900,
  1
);

INSERT INTO cache_proof_variants (id, product_id, label, position, available, price_mnt)
VALUES
  ('variant_cup_sand', 'product_nomad_cup', 'Элсэн шар', 1, 3, 28900),
  ('variant_cup_ink', 'product_nomad_cup', 'Бэхэн хөх', 2, 0, 31900),
  ('variant_bag_natural', 'product_steppe_bag', 'Байгалийн', 1, 4, 64900);
