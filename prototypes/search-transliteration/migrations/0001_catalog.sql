CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL,
  price_mnt INTEGER NOT NULL,
  strict_key TEXT NOT NULL,
  basic_key TEXT NOT NULL
);

CREATE INDEX products_sku_idx ON products(sku);

CREATE VIRTUAL TABLE product_search USING fts5(
  product_id UNINDEXED,
  name,
  category,
  tags,
  sku,
  strict_key,
  basic_key,
  tokenize = 'unicode61 remove_diacritics 0',
  prefix = '2 3'
);
