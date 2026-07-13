CREATE TABLE search_deletion_keys (
  deletion_key TEXT NOT NULL,
  term TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  representation TEXT NOT NULL,
  UNIQUE(deletion_key, term, product_id, field, representation)
);
CREATE INDEX search_deletion_keys_key_idx ON search_deletion_keys(deletion_key);
