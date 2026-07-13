CREATE VIRTUAL TABLE product_search_tiered USING fts5(
  product_id UNINDEXED,
  native_key,
  strict_key,
  basic_key,
  sku_key,
  tokenize = 'unicode61 remove_diacritics 0',
  prefix = '2 3'
);
