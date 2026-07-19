import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildCatalogSearchDocument,
  catalogSearchDocumentVersion,
  krilleerCyrillicToLatin,
} from "../src/catalog-search/document";

const migrationPath = resolve("packages/kernel/migrations/0025_ordinary_speedball.sql");
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const transliterationFields = ["slug", "title", "brand", "description", "facets"] as const;
const transliterationStages = Array.from(
  { length: Math.ceil(krilleerCyrillicToLatin.length / 4) },
  (_, index) => krilleerCyrillicToLatin.slice(index * 4, index * 4 + 4),
);
const transliterateSql = (field: string, mappings: (typeof transliterationStages)[number]) =>
  mappings.reduce(
    (expression, [cyrillic, latin]) =>
      `replace(replace(${expression}, ${quote(cyrillic)}, ${quote(latin)}), ${quote(cyrillic.toUpperCase())}, ${quote(latin)})`,
    field,
  );
const transliterationCtes = transliterationStages
  .map((mappings, index) => {
    const name = `catalog_search_transliteration_${index + 1}`;
    const source =
      index === 0 ? "catalog_search_source" : `catalog_search_transliteration_${index}`;
    const projectedFields = transliterationFields
      .map((field) => {
        const input = index === 0 ? field : `latin_${field}`;
        return `      ${transliterateSql(input, mappings)} AS latin_${field}`;
      })
      .join(",\n");
    return `  ${name} AS (\n    SELECT\n      item_id, kind, slug, title, brand, description, facets,\n${projectedFields}\n    FROM ${source}\n  )`;
  })
  .join(",\n");
const transliterationResult = `catalog_search_transliteration_${transliterationStages.length}`;

const toSnakeCase = (value: string) =>
  value.replaceAll(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
const ftsColumns = Object.keys(
  buildCatalogSearchDocument({
    itemId: "",
    kind: "product",
    slug: "",
    title: "",
    brand: "",
    description: "",
    facets: "",
  }),
).map(toSnakeCase);
const columns = ftsColumns.join(", ");
const projection = `INSERT INTO catalog_search(${columns}) SELECT ${columns} FROM catalog_search_documents`;
const refresh = (itemId: string) =>
  `INSERT OR IGNORE INTO catalog_search_refresh(item_id) VALUES (${itemId});`;
const refreshFrom = (selection: string) =>
  `INSERT OR IGNORE INTO catalog_search_refresh(item_id) ${selection};`;
const breakpoint = "--> statement-breakpoint";
const triggerNames = [
  "catalog_search_refresh_item",
  "catalog_search_catalog_insert",
  "catalog_search_catalog_update",
  "catalog_search_catalog_delete",
  "catalog_search_categories_membership_insert",
  "catalog_search_categories_membership_delete",
  "catalog_search_collections_membership_insert",
  "catalog_search_collections_membership_delete",
  "catalog_search_tags_membership_insert",
  "catalog_search_tags_membership_delete",
  "catalog_search_categories_update",
  "catalog_search_collections_update",
  "catalog_search_tags_update",
  "catalog_search_option_groups_update",
  "catalog_search_option_values_update",
  "catalog_search_variants_insert",
  "catalog_search_variants_update",
  "catalog_search_variants_delete",
  "catalog_search_variant_option_values_insert",
  "catalog_search_variant_option_values_update",
  "catalog_search_variant_option_values_delete",
];
const teardown = [
  ...triggerNames.map((name) => `DROP TRIGGER ${name};`),
  "DROP VIEW catalog_search_diagnostics;",
  "DROP VIEW catalog_search_documents;",
  "DROP VIEW catalog_search_source;",
  "DROP TABLE catalog_search;",
].join(`\n${breakpoint}\n`);

const migration = `ALTER TABLE \`catalog_items\` ADD \`brand_text\` text;
${breakpoint}
${teardown}
${breakpoint}
CREATE VIRTUAL TABLE catalog_search USING fts5(
  item_id UNINDEXED,
  kind UNINDEXED,
  document_version UNINDEXED,
  fingerprint UNINDEXED,
  slug,
  title,
  brand,
  description,
  facets,
  latin_slug,
  latin_title,
  latin_brand,
  latin_description,
  latin_facets,
  tokenize = 'unicode61',
  prefix = '2 3'
);
${breakpoint}
CREATE VIEW catalog_search_source AS
SELECT
  item.id AS item_id,
  item.kind AS kind,
  item.slug AS slug,
  item.name AS title,
  coalesce(item.brand_text, '') AS brand,
  item.description AS description,
  trim(
    coalesce((SELECT group_concat(value, ' ') FROM (SELECT category.name AS value FROM catalog_item_categories membership JOIN categories category ON category.id = membership.category_id WHERE membership.catalog_item_id = item.id AND category.state = 'active' ORDER BY category.position, category.name, category.id)), '') || ' ' ||
    coalesce((SELECT group_concat(value, ' ') FROM (SELECT collection.name AS value FROM catalog_item_collections membership JOIN collections collection ON collection.id = membership.collection_id WHERE membership.catalog_item_id = item.id AND collection.state = 'active' ORDER BY collection.name, collection.id)), '') || ' ' ||
    coalesce((SELECT group_concat(value, ' ') FROM (SELECT tag.label AS value FROM catalog_item_tags membership JOIN tags tag ON tag.id = membership.tag_id WHERE membership.catalog_item_id = item.id AND tag.state = 'active' ORDER BY tag.label, tag.id)), '') || ' ' ||
    coalesce((SELECT group_concat(value, ' ') FROM (SELECT option_value.label AS value FROM variants variant JOIN variant_option_values membership ON membership.variant_id = variant.id JOIN option_values option_value ON option_value.id = membership.option_value_id JOIN option_groups option_group ON option_group.id = option_value.option_group_id WHERE variant.product_id = item.id AND variant.state = 'active' AND option_value.state = 'active' AND option_group.state = 'active' ORDER BY option_group.position, option_value.position, option_value.label, option_value.id)), '')
  ) AS facets
FROM catalog_items item
WHERE item.state = 'published';
${breakpoint}
CREATE VIEW catalog_search_documents AS
WITH
${transliterationCtes}
SELECT
  item_id,
  kind,
  ${quote(catalogSearchDocumentVersion)} AS document_version,
  json_array(${quote(catalogSearchDocumentVersion)}, item_id, kind, slug, title, brand, description, facets) AS fingerprint,
  slug,
  title,
  brand,
  description,
  facets,
  latin_slug,
  latin_title,
  latin_brand,
  latin_description,
  latin_facets
FROM ${transliterationResult};
${breakpoint}
${projection};
${breakpoint}
CREATE VIEW catalog_search_diagnostics AS
SELECT
  (SELECT count(*) FROM catalog_search_documents) AS canonical_count,
  (SELECT count(*) FROM catalog_search) AS projection_count,
  (SELECT count(*) FROM catalog_search_documents expected WHERE NOT EXISTS (SELECT 1 FROM catalog_search actual WHERE actual.item_id = expected.item_id)) AS missing_count,
  (SELECT count(*) FROM catalog_search actual WHERE NOT EXISTS (SELECT 1 FROM catalog_search_documents expected WHERE expected.item_id = actual.item_id)) AS orphan_count,
  (SELECT count(*) FROM (SELECT item_id FROM catalog_search GROUP BY item_id HAVING count(*) > 1)) AS duplicate_count,
  (SELECT count(*) FROM catalog_search_documents expected JOIN catalog_search actual ON actual.item_id = expected.item_id WHERE actual.document_version IS NOT expected.document_version OR actual.fingerprint IS NOT expected.fingerprint OR actual.kind IS NOT expected.kind OR actual.slug IS NOT expected.slug OR actual.title IS NOT expected.title OR actual.brand IS NOT expected.brand OR actual.description IS NOT expected.description OR actual.facets IS NOT expected.facets OR actual.latin_slug IS NOT expected.latin_slug OR actual.latin_title IS NOT expected.latin_title OR actual.latin_brand IS NOT expected.latin_brand OR actual.latin_description IS NOT expected.latin_description OR actual.latin_facets IS NOT expected.latin_facets) AS mismatched_count;
${breakpoint}
CREATE TRIGGER catalog_search_refresh_item AFTER INSERT ON catalog_search_refresh BEGIN
  DELETE FROM catalog_search WHERE item_id = NEW.item_id;
  ${projection} WHERE item_id = NEW.item_id;
  DELETE FROM catalog_search_refresh WHERE item_id = NEW.item_id;
END;
${breakpoint}
CREATE TRIGGER catalog_search_catalog_insert AFTER INSERT ON catalog_items BEGIN
  ${refresh("NEW.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_catalog_update AFTER UPDATE OF slug, state, name, brand_text, description ON catalog_items BEGIN
  ${refresh("NEW.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_catalog_delete AFTER DELETE ON catalog_items BEGIN
  ${refresh("OLD.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_categories_membership_insert AFTER INSERT ON catalog_item_categories BEGIN
  ${refresh("NEW.catalog_item_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_categories_membership_delete AFTER DELETE ON catalog_item_categories BEGIN
  ${refresh("OLD.catalog_item_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_collections_membership_insert AFTER INSERT ON catalog_item_collections BEGIN
  ${refresh("NEW.catalog_item_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_collections_membership_delete AFTER DELETE ON catalog_item_collections BEGIN
  ${refresh("OLD.catalog_item_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_tags_membership_insert AFTER INSERT ON catalog_item_tags BEGIN
  ${refresh("NEW.catalog_item_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_tags_membership_delete AFTER DELETE ON catalog_item_tags BEGIN
  ${refresh("OLD.catalog_item_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_categories_update AFTER UPDATE OF name, state, position ON categories BEGIN
  ${refreshFrom("SELECT DISTINCT catalog_item_id FROM catalog_item_categories WHERE category_id = NEW.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_collections_update AFTER UPDATE OF name, state ON collections BEGIN
  ${refreshFrom("SELECT DISTINCT catalog_item_id FROM catalog_item_collections WHERE collection_id = NEW.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_tags_update AFTER UPDATE OF label, state ON tags BEGIN
  ${refreshFrom("SELECT DISTINCT catalog_item_id FROM catalog_item_tags WHERE tag_id = NEW.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_option_groups_update AFTER UPDATE OF state, position ON option_groups BEGIN
  ${refreshFrom("SELECT DISTINCT product_id FROM variants WHERE product_id = NEW.product_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_option_values_update AFTER UPDATE OF label, state, position ON option_values BEGIN
  ${refreshFrom("SELECT DISTINCT variant.product_id FROM variant_option_values membership JOIN variants variant ON variant.id = membership.variant_id WHERE membership.option_value_id = NEW.id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_variants_insert AFTER INSERT ON variants BEGIN
  ${refresh("NEW.product_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_variants_update AFTER UPDATE OF state, product_id ON variants BEGIN
  ${refresh("OLD.product_id")}
  ${refreshFrom("SELECT NEW.product_id WHERE NEW.product_id <> OLD.product_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_variants_delete AFTER DELETE ON variants BEGIN
  ${refresh("OLD.product_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_variant_option_values_insert AFTER INSERT ON variant_option_values BEGIN
  ${refreshFrom("SELECT product_id FROM variants WHERE id = NEW.variant_id")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_variant_option_values_update AFTER UPDATE OF variant_id, option_value_id ON variant_option_values BEGIN
  ${refreshFrom("SELECT DISTINCT product_id FROM variants WHERE id IN (OLD.variant_id, NEW.variant_id)")}
END;
${breakpoint}
CREATE TRIGGER catalog_search_variant_option_values_delete AFTER DELETE ON variant_option_values BEGIN
  ${refreshFrom("SELECT product_id FROM variants WHERE id = OLD.variant_id")}
END;
`;

const current = await readFile(migrationPath, "utf8").catch(() => "");
if (process.argv.includes("--check")) {
  if (current !== migration) {
    throw new Error("Catalog search migration differs from its versioned document policy");
  }
} else {
  await writeFile(migrationPath, migration);
}
