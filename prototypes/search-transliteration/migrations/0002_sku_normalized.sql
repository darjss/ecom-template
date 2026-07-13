ALTER TABLE products ADD COLUMN sku_normalized TEXT NOT NULL DEFAULT '';
CREATE INDEX products_sku_normalized_idx ON products(sku_normalized);
