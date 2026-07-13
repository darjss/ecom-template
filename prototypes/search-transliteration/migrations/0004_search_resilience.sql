ALTER TABLE products ADD COLUMN brand TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN available INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN merchandising_position INTEGER NOT NULL DEFAULT 0;

CREATE INDEX products_category_idx ON products(category);
CREATE INDEX products_availability_position_idx ON products(available DESC, merchandising_position ASC, id ASC);

CREATE TABLE search_terms (
  term TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  representation TEXT NOT NULL,
  UNIQUE(term, product_id, field, representation)
);
CREATE INDEX search_terms_term_idx ON search_terms(term);

CREATE VIRTUAL TABLE product_search_resilient USING fts5(
  product_id UNINDEXED,
  title_native,
  brand_native,
  category_native,
  tags_native,
  description_native,
  title_strict,
  brand_strict,
  category_strict,
  tags_strict,
  description_strict,
  title_basic,
  brand_basic,
  category_basic,
  tags_basic,
  description_basic,
  tokenize = 'unicode61 remove_diacritics 0',
  prefix = '2 3'
);
