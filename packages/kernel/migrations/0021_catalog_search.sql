CREATE VIRTUAL TABLE catalog_search USING fts5(
  item_id UNINDEXED,
  kind UNINDEXED,
  slug,
  title,
  description,
  facets,
  latin,
  tokenize = 'unicode61',
  prefix = '2 3'
);
--> statement-breakpoint
CREATE VIEW catalog_search_source AS
SELECT
  item.id AS item_id,
  item.kind AS kind,
  item.slug AS slug,
  item.name AS title,
  item.description AS description,
  trim(
    coalesce((SELECT group_concat(category.name, ' ') FROM catalog_item_categories membership JOIN categories category ON category.id = membership.category_id WHERE membership.catalog_item_id = item.id AND category.state = 'active'), '') || ' ' ||
    coalesce((SELECT group_concat(collection.name, ' ') FROM catalog_item_collections membership JOIN collections collection ON collection.id = membership.collection_id WHERE membership.catalog_item_id = item.id AND collection.state = 'active'), '') || ' ' ||
    coalesce((SELECT group_concat(tag.label, ' ') FROM catalog_item_tags membership JOIN tags tag ON tag.id = membership.tag_id WHERE membership.catalog_item_id = item.id AND tag.state = 'active'), '') || ' ' ||
    coalesce((SELECT group_concat(option_value.label, ' ') FROM variants variant JOIN variant_option_values membership ON membership.variant_id = variant.id JOIN option_values option_value ON option_value.id = membership.option_value_id JOIN option_groups option_group ON option_group.id = option_value.option_group_id WHERE variant.product_id = item.id AND variant.state = 'active' AND option_value.state = 'active' AND option_group.state = 'active'), '')
  ) AS facets,
  trim(item.slug || ' ' || item.name || ' ' || item.description || ' ' ||
    coalesce((SELECT group_concat(category.name, ' ') FROM catalog_item_categories membership JOIN categories category ON category.id = membership.category_id WHERE membership.catalog_item_id = item.id AND category.state = 'active'), '') || ' ' ||
    coalesce((SELECT group_concat(collection.name, ' ') FROM catalog_item_collections membership JOIN collections collection ON collection.id = membership.collection_id WHERE membership.catalog_item_id = item.id AND collection.state = 'active'), '') || ' ' ||
    coalesce((SELECT group_concat(tag.label, ' ') FROM catalog_item_tags membership JOIN tags tag ON tag.id = membership.tag_id WHERE membership.catalog_item_id = item.id AND tag.state = 'active'), '')
  ) AS native_text
FROM catalog_items item
WHERE item.state = 'published';
--> statement-breakpoint
CREATE VIEW catalog_search_documents AS
SELECT item_id, kind, slug, title, description, facets, replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(native_text, 'щ', 'shch'), 'Щ', 'shch'), 'ш', 'sh'), 'Ш', 'sh'), 'ч', 'ch'), 'Ч', 'ch'), 'ц', 'c'), 'Ц', 'c'), 'ё', 'yo'), 'Ё', 'yo'), 'ю', 'yu'), 'Ю', 'yu'), 'я', 'ya'), 'Я', 'ya'), 'е', 'ye'), 'Е', 'ye'), 'ж', 'j'), 'Ж', 'j'), 'х', 'h'), 'Х', 'h'), 'а', 'a'), 'А', 'a'), 'б', 'b'), 'Б', 'b'), 'в', 'v'), 'В', 'v'), 'г', 'g'), 'Г', 'g'), 'д', 'd'), 'Д', 'd'), 'э', 'e'), 'Э', 'e'), 'з', 'z'), 'З', 'z'), 'и', 'i'), 'И', 'i'), 'й', 'yy'), 'Й', 'yy'), 'к', 'k'), 'К', 'k'), 'л', 'l'), 'Л', 'l'), 'м', 'm'), 'М', 'm'), 'н', 'n'), 'Н', 'n'), 'о', 'o'), 'О', 'o'), 'п', 'p'), 'П', 'p'), 'р', 'r'), 'Р', 'r'), 'с', 's'), 'С', 's'), 'т', 't'), 'Т', 't'), 'у', 'u'), 'У', 'u'), 'ф', 'f'), 'Ф', 'f'), 'ө', 'q'), 'Ө', 'q'), 'ү', 'w'), 'Ү', 'w'), 'ы', 'y'), 'Ы', 'y'), 'ь', 'ь'), 'Ь', 'ь'), 'ъ', ''''), 'Ъ', '''') AS latin
FROM catalog_search_source;
--> statement-breakpoint
INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin)
SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents;
--> statement-breakpoint
CREATE VIEW catalog_search_diagnostics AS
SELECT
  (SELECT count(*) FROM catalog_items WHERE state = 'published') AS canonical_count,
  (SELECT count(*) FROM catalog_search) AS projection_count,
  (SELECT count(*) FROM catalog_items item WHERE item.state = 'published' AND NOT EXISTS (SELECT 1 FROM catalog_search search WHERE search.item_id = item.id)) AS missing_count,
  (SELECT count(*) FROM catalog_search search WHERE NOT EXISTS (SELECT 1 FROM catalog_items item WHERE item.id = search.item_id AND item.state = 'published')) AS orphan_count,
  (SELECT count(*) FROM (SELECT item_id FROM catalog_search GROUP BY item_id HAVING count(*) > 1)) AS duplicate_count;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_insert AFTER INSERT ON catalog_items BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_update AFTER UPDATE OF slug, state, name, description ON catalog_items BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_delete AFTER DELETE ON catalog_items BEGIN
  DELETE FROM catalog_search WHERE item_id = OLD.id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_item_categories_insert AFTER INSERT ON catalog_item_categories BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.catalog_item_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = NEW.catalog_item_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_item_categories_delete AFTER DELETE ON catalog_item_categories BEGIN
  DELETE FROM catalog_search WHERE item_id = OLD.catalog_item_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = OLD.catalog_item_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_item_collections_insert AFTER INSERT ON catalog_item_collections BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.catalog_item_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = NEW.catalog_item_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_item_collections_delete AFTER DELETE ON catalog_item_collections BEGIN
  DELETE FROM catalog_search WHERE item_id = OLD.catalog_item_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = OLD.catalog_item_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_item_tags_insert AFTER INSERT ON catalog_item_tags BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.catalog_item_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = NEW.catalog_item_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_catalog_item_tags_delete AFTER DELETE ON catalog_item_tags BEGIN
  DELETE FROM catalog_search WHERE item_id = OLD.catalog_item_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = OLD.catalog_item_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_categories_update AFTER UPDATE ON categories BEGIN
  DELETE FROM catalog_search WHERE item_id IN (SELECT catalog_item_id FROM catalog_item_categories WHERE category_id = NEW.id);
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id IN (SELECT catalog_item_id FROM catalog_item_categories WHERE category_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_collections_update AFTER UPDATE ON collections BEGIN
  DELETE FROM catalog_search WHERE item_id IN (SELECT catalog_item_id FROM catalog_item_collections WHERE collection_id = NEW.id);
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id IN (SELECT catalog_item_id FROM catalog_item_collections WHERE collection_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_tags_update AFTER UPDATE ON tags BEGIN
  DELETE FROM catalog_search WHERE item_id IN (SELECT catalog_item_id FROM catalog_item_tags WHERE tag_id = NEW.id);
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id IN (SELECT catalog_item_id FROM catalog_item_tags WHERE tag_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_option_values_update AFTER UPDATE OF label, state ON option_values BEGIN
  DELETE FROM catalog_search WHERE item_id IN (SELECT variant.product_id FROM variant_option_values membership JOIN variants variant ON variant.id = membership.variant_id WHERE membership.option_value_id = NEW.id);
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id IN (SELECT variant.product_id FROM variant_option_values membership JOIN variants variant ON variant.id = membership.variant_id WHERE membership.option_value_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_variants_update AFTER UPDATE OF state ON variants BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.product_id;
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = NEW.product_id;
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_variant_options_insert AFTER INSERT ON variant_option_values BEGIN
  DELETE FROM catalog_search WHERE item_id = (SELECT product_id FROM variants WHERE id = NEW.variant_id);
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = (SELECT product_id FROM variants WHERE id = NEW.variant_id);
END;
--> statement-breakpoint
CREATE TRIGGER catalog_search_variant_options_delete AFTER DELETE ON variant_option_values BEGIN
  DELETE FROM catalog_search WHERE item_id = (SELECT product_id FROM variants WHERE id = OLD.variant_id);
  INSERT INTO catalog_search(item_id, kind, slug, title, description, facets, latin) SELECT item_id, kind, slug, title, description, facets, latin FROM catalog_search_documents WHERE item_id = (SELECT product_id FROM variants WHERE id = OLD.variant_id);
END;
