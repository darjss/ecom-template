import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { compactSku } from "@ecom/contracts";
import { createPipeHandlers } from "dismatch";
import * as v from "valibot";
import { storeDefinition } from "../../apps/urnuun-48/src/profile/definition";
import { referenceStoreFixture } from "./fixture";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/urnuun-48");
const mediaRoot = join(appRoot, "public/media");
const wranglerConfig = "wrangler.jsonc";
const databaseName = "urnuun-48-db";
const bucketName = "urnuun-48-media";
const objectPrefix = "reference/wf29";
const seedTimestamp = Date.parse(referenceStoreFixture.seededAt);
const commerceSettings = referenceStoreFixture.commerceSettings;
if (storeDefinition.providers.payment !== referenceStoreFixture.paymentProvider) {
  throw new Error("Reference Store payment provider does not match the Store Profile");
}
const mode = v.parse(v.picklist(["--local", "--remote"]), process.argv[2] ?? "--local");
const persistencePath = process.argv[3] === "--persist-to" ? process.argv[4] : undefined;
if (mode === "--remote" && persistencePath) {
  throw new Error("Remote seeding cannot use a local persistence path");
}
const persistenceArgs = persistencePath
  ? ["--persist-to", v.parse(v.pipe(v.string(), v.minLength(1)), persistencePath)]
  : [];

const CommandResultSchema = v.strictObject({
  code: v.number(),
  stdout: v.string(),
  stderr: v.string(),
});

type CommandResult = v.InferOutput<typeof CommandResultSchema>;

const run = (command: string, args: readonly string[]): Promise<CommandResult> =>
  new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectCommand);
    child.on("close", (code) => {
      resolveCommand(v.parse(CommandResultSchema, { code: code ?? 1, stdout, stderr }));
    });
  });

const runRequired = async (command: string, args: readonly string[]) => {
  const result = await run(command, args);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || `${command} failed`);
  }
  return result.stdout;
};

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const nullable = (value: string | number | null) =>
  value === null ? "NULL" : typeof value === "number" ? String(value) : quote(value);
const json = (value: unknown) => quote(JSON.stringify(value));
const tuple = (values: readonly (string | number | null)[]) =>
  `(${values.map((value) => nullable(value)).join(", ")})`;
const list = (values: readonly string[]) => values.map(quote).join(", ");

const catalogItems = [
  ...referenceStoreFixture.products.map((product) => ({ ...product, kind: "product" as const })),
  ...referenceStoreFixture.bundles.map((bundle) => ({ ...bundle, kind: "bundle" as const })),
];
const variants = referenceStoreFixture.products.flatMap((product) =>
  product.variants.map((variant) => ({ ...variant, productId: product.id })),
);
const optionGroups = referenceStoreFixture.products.flatMap((product) =>
  product.optionGroups.map((group) => ({ ...group, productId: product.id })),
);
const optionValues = optionGroups.flatMap((group) =>
  group.values.map((value) => ({ ...value, optionGroupId: group.id })),
);
const catalogItemIds = catalogItems.map(({ id }) => id);
const variantIds = variants.map(({ id }) => id);
const personalizationIds = referenceStoreFixture.personalizations.map(({ id }) => id);
const catalogMediaSeedStatements = createPipeHandlers<(typeof referenceStoreFixture.media)[number]>(
  "usage",
).match<readonly string[]>({
  homepage: () => [],
  catalog: (media) => [
    `INSERT INTO catalog_item_images (catalog_item_id, media_asset_id, position, alt_text) VALUES ${tuple([media.catalogItemId, media.id, media.position, media.altText])} ON CONFLICT(catalog_item_id, position) DO UPDATE SET media_asset_id = excluded.media_asset_id, alt_text = excluded.alt_text;`,
  ],
});

const buildSeedSql = () => {
  const statements: string[] = ["PRAGMA foreign_keys = ON;"];

  for (const media of referenceStoreFixture.media) {
    statements.push(
      `INSERT INTO media_assets (id, object_key, declared_content_type, created_at) VALUES ${tuple([media.id, `${objectPrefix}/${media.fileName}`, "image/webp", seedTimestamp])} ON CONFLICT(id) DO UPDATE SET object_key = excluded.object_key, declared_content_type = excluded.declared_content_type;`,
    );
  }

  for (const item of catalogItems) {
    statements.push(
      `INSERT INTO catalog_items (id, kind, slug, state, name, description, brand_text, price_mnt, created_at, updated_at, published_at, archived_at) VALUES ${tuple([item.id, item.kind, item.slug, "published", item.name, item.description, item.brandText, item.priceMnt, seedTimestamp, seedTimestamp, seedTimestamp, null])} ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, state = 'published', name = excluded.name, description = excluded.description, brand_text = excluded.brand_text, price_mnt = excluded.price_mnt, updated_at = excluded.updated_at, published_at = coalesce(catalog_items.published_at, excluded.published_at), archived_at = NULL;`,
    );
  }

  for (const group of optionGroups) {
    statements.push(
      `INSERT INTO option_groups (id, product_id, key, label, position, state, created_at, updated_at) VALUES ${tuple([group.id, group.productId, group.key, group.label, group.position, "active", seedTimestamp, seedTimestamp])} ON CONFLICT(id) DO UPDATE SET key = excluded.key, label = excluded.label, position = excluded.position, state = 'active', updated_at = excluded.updated_at;`,
    );
  }

  for (const value of optionValues) {
    statements.push(
      `INSERT INTO option_values (id, option_group_id, key, label, position, state, created_at, updated_at) VALUES ${tuple([value.id, value.optionGroupId, value.key, value.label, value.position, "active", seedTimestamp, seedTimestamp])} ON CONFLICT(id) DO UPDATE SET key = excluded.key, label = excluded.label, position = excluded.position, state = 'active', updated_at = excluded.updated_at;`,
    );
  }

  for (const variant of variants) {
    statements.push(
      `INSERT INTO variants (id, product_id, is_default, combination_key, price_override_mnt, image_media_asset_id, state, created_at, updated_at) VALUES ${tuple([variant.id, variant.productId, variant.isDefault ? 1 : 0, variant.combinationKey, variant.priceOverrideMnt, variant.imageMediaAssetId, "active", seedTimestamp, seedTimestamp])} ON CONFLICT(id) DO UPDATE SET combination_key = excluded.combination_key, price_override_mnt = excluded.price_override_mnt, image_media_asset_id = excluded.image_media_asset_id, state = 'active', updated_at = excluded.updated_at;`,
      `INSERT INTO skus (sku, sku_compact, owner_kind, variant_id, bundle_id, locked_at, created_at, updated_at) VALUES ${tuple([variant.sku, compactSku(variant.sku), "variant", variant.id, null, seedTimestamp, seedTimestamp, seedTimestamp])} ON CONFLICT(sku_compact) DO UPDATE SET sku = excluded.sku, owner_kind = 'variant', variant_id = excluded.variant_id, bundle_id = NULL, locked_at = coalesce(skus.locked_at, excluded.locked_at), updated_at = excluded.updated_at;`,
      `INSERT OR IGNORE INTO stock_items (id, variant_id, on_hand_quantity, reserved_quantity, updated_at) VALUES ${tuple([variant.stockItemId, variant.id, variant.openingQuantity, 0, seedTimestamp])};`,
      `INSERT OR IGNORE INTO inventory_entries (id, stock_item_id, reservation_id, order_id, kind, on_hand_delta, reserved_delta, actor_kind, staff_id, staff_role, reason, command_correlation_id, created_at) SELECT ${tuple([variant.inventoryEntryId, variant.stockItemId, null, null, "opening", variant.openingQuantity, 0, "system", null, null, "WF29 жишиг анхны үлдэгдэл", "wf29.reference.seed.opening.v1", seedTimestamp]).slice(1, -1)} WHERE NOT EXISTS (SELECT 1 FROM inventory_entries WHERE id = ${quote(variant.inventoryEntryId)});`,
    );
  }

  statements.push(`DELETE FROM variant_option_values WHERE variant_id IN (${list(variantIds)});`);
  for (const variant of variants) {
    for (const optionValueId of variant.optionValueIds) {
      statements.push(
        `INSERT INTO variant_option_values (variant_id, option_value_id) VALUES ${tuple([variant.id, optionValueId])};`,
      );
    }
  }

  for (const bundle of referenceStoreFixture.bundles) {
    statements.push(
      `INSERT INTO skus (sku, sku_compact, owner_kind, variant_id, bundle_id, locked_at, created_at, updated_at) VALUES ${tuple([bundle.sku, compactSku(bundle.sku), "bundle", null, bundle.id, seedTimestamp, seedTimestamp, seedTimestamp])} ON CONFLICT(sku_compact) DO UPDATE SET sku = excluded.sku, owner_kind = 'bundle', variant_id = NULL, bundle_id = excluded.bundle_id, locked_at = coalesce(skus.locked_at, excluded.locked_at), updated_at = excluded.updated_at;`,
      `DELETE FROM bundle_components WHERE bundle_id = ${quote(bundle.id)};`,
    );
    for (const component of bundle.components) {
      statements.push(
        `INSERT INTO bundle_components (bundle_id, variant_id, quantity) VALUES ${tuple([bundle.id, component.variantId, component.quantity])};`,
      );
    }
  }

  statements.push(
    `DELETE FROM personalization_values WHERE personalization_id IN (${list(personalizationIds)});`,
  );
  for (const definition of referenceStoreFixture.personalizations) {
    statements.push(
      `INSERT INTO personalization_definitions (id, catalog_item_id, kind, key, label, position, required, state, max_length, created_at, updated_at) VALUES ${tuple([definition.id, definition.catalogItemId, definition.kind, definition.key, definition.label, definition.position, definition.required ? 1 : 0, "active", definition.maxLength, seedTimestamp, seedTimestamp])} ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, key = excluded.key, label = excluded.label, position = excluded.position, required = excluded.required, state = 'active', max_length = excluded.max_length, updated_at = excluded.updated_at;`,
    );
    for (const value of definition.values) {
      statements.push(
        `INSERT INTO personalization_values (id, personalization_id, key, label, position, state, created_at, updated_at) VALUES ${tuple([value.id, definition.id, value.key, value.label, value.position, "active", seedTimestamp, seedTimestamp])} ON CONFLICT(id) DO UPDATE SET key = excluded.key, label = excluded.label, position = excluded.position, state = 'active', updated_at = excluded.updated_at;`,
      );
    }
  }

  for (const category of referenceStoreFixture.categories) {
    statements.push(
      `INSERT INTO categories (id, slug, name, parent_id, position, state, created_at, updated_at, activated_at, archived_at) VALUES ${tuple([category.id, category.slug, category.name, category.parentId, category.position, "active", seedTimestamp, seedTimestamp, seedTimestamp, null])} ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, parent_id = excluded.parent_id, position = excluded.position, state = 'active', updated_at = excluded.updated_at, activated_at = coalesce(categories.activated_at, excluded.activated_at), archived_at = NULL;`,
    );
  }

  for (const collection of referenceStoreFixture.collections) {
    statements.push(
      `INSERT INTO collections (id, slug, name, description, state, created_at, updated_at, activated_at, archived_at) VALUES ${tuple([collection.id, collection.slug, collection.name, collection.description, "active", seedTimestamp, seedTimestamp, seedTimestamp, null])} ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, description = excluded.description, state = 'active', updated_at = excluded.updated_at, activated_at = coalesce(collections.activated_at, excluded.activated_at), archived_at = NULL;`,
    );
  }

  for (const tag of referenceStoreFixture.tags) {
    statements.push(
      `INSERT INTO tags (id, label, normalized_label, state, created_at, updated_at, activated_at, archived_at) VALUES ${tuple([tag.id, tag.label, tag.label.toLocaleLowerCase("mn-MN"), "active", seedTimestamp, seedTimestamp, seedTimestamp, null])} ON CONFLICT(id) DO UPDATE SET label = excluded.label, normalized_label = excluded.normalized_label, state = 'active', updated_at = excluded.updated_at, activated_at = coalesce(tags.activated_at, excluded.activated_at), archived_at = NULL;`,
    );
  }

  statements.push(
    `DELETE FROM catalog_item_categories WHERE catalog_item_id IN (${list(catalogItemIds)});`,
    `DELETE FROM catalog_item_collections WHERE catalog_item_id IN (${list(catalogItemIds)});`,
    `DELETE FROM catalog_item_tags WHERE catalog_item_id IN (${list(catalogItemIds)});`,
  );
  for (const category of referenceStoreFixture.categories) {
    for (const catalogItemId of category.catalogItemIds) {
      statements.push(
        `INSERT INTO catalog_item_categories (catalog_item_id, category_id) VALUES ${tuple([catalogItemId, category.id])};`,
      );
    }
  }
  for (const collection of referenceStoreFixture.collections) {
    for (const [position, catalogItemId] of collection.catalogItemIds.entries()) {
      statements.push(
        `INSERT INTO catalog_item_collections (catalog_item_id, collection_id, position) VALUES ${tuple([catalogItemId, collection.id, position])};`,
      );
    }
  }
  for (const tag of referenceStoreFixture.tags) {
    for (const catalogItemId of tag.catalogItemIds) {
      statements.push(
        `INSERT INTO catalog_item_tags (catalog_item_id, tag_id) VALUES ${tuple([catalogItemId, tag.id])};`,
      );
    }
  }

  statements.push(
    `DELETE FROM catalog_item_images WHERE catalog_item_id IN (${list(catalogItemIds)});`,
  );
  for (const media of referenceStoreFixture.media) {
    statements.push(...catalogMediaSeedStatements(media));
  }

  for (const discount of referenceStoreFixture.discounts) {
    statements.push(
      `INSERT INTO discount_rules (id, name, mode, code, calculation, value, state, starts_at, ends_at, minimum_subtotal_mnt, global_limit, targets_json, revision, created_at, updated_at) VALUES ${tuple([discount.id, discount.name, discount.mode, discount.code, discount.calculation, discount.value, "active", null, null, discount.minimumSubtotalMnt, discount.globalLimit, JSON.stringify(discount.targets), 1, seedTimestamp, seedTimestamp])} ON CONFLICT(id) DO UPDATE SET name = excluded.name, mode = excluded.mode, code = excluded.code, calculation = excluded.calculation, value = excluded.value, state = 'active', starts_at = NULL, ends_at = NULL, minimum_subtotal_mnt = excluded.minimum_subtotal_mnt, global_limit = excluded.global_limit, targets_json = excluded.targets_json, updated_at = excluded.updated_at;`,
    );
  }

  statements.push(
    `INSERT INTO commerce_settings (key, bank_transfer_enabled, cash_on_delivery_enabled, customer_accounts_enabled, telegram_enabled, pickup_enabled, delivery_enabled, delivery_fee_mnt, free_delivery_threshold_mnt, updated_at) VALUES ${tuple(["commerce", Number(commerceSettings.bankTransferEnabled), Number(commerceSettings.cashOnDeliveryEnabled), Number(commerceSettings.customerAccountsEnabled), Number(commerceSettings.telegramEnabled), Number(commerceSettings.pickupEnabled), Number(commerceSettings.deliveryEnabled), commerceSettings.deliveryFeeMnt, commerceSettings.freeDeliveryThresholdMnt, seedTimestamp])} ON CONFLICT(key) DO UPDATE SET bank_transfer_enabled = excluded.bank_transfer_enabled, cash_on_delivery_enabled = excluded.cash_on_delivery_enabled, customer_accounts_enabled = excluded.customer_accounts_enabled, telegram_enabled = excluded.telegram_enabled, pickup_enabled = excluded.pickup_enabled, delivery_enabled = excluded.delivery_enabled, delivery_fee_mnt = excluded.delivery_fee_mnt, free_delivery_threshold_mnt = excluded.free_delivery_threshold_mnt, updated_at = excluded.updated_at;`,
  );

  for (const document of referenceStoreFixture.cmsDocuments) {
    statements.push(
      `INSERT INTO cms_documents (kind, status, schema_version, content_json, created_at, updated_at, published_at) VALUES ${tuple([document.kind, "published", 1, JSON.stringify(document.content), seedTimestamp, seedTimestamp, seedTimestamp])} ON CONFLICT(kind, status) DO UPDATE SET schema_version = 1, content_json = excluded.content_json, updated_at = excluded.updated_at, published_at = coalesce(cms_documents.published_at, excluded.published_at);`,
    );
  }

  statements.push(
    `INSERT INTO system_metadata (key, value, updated_at) VALUES ${tuple(["reference_store_fixture", "wf29-urnuun48:v1", seedTimestamp])} ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
  );

  return `${statements.join("\n")}\n`;
};

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const ensureMediaObject = async (
  temporaryDirectory: string,
  media: (typeof referenceStoreFixture.media)[number],
) => {
  const sourcePath = join(mediaRoot, media.fileName);
  const sourceBytes = await readFile(sourcePath);
  const sourceHash = sha256(sourceBytes);
  if (sourceHash !== media.sha256) {
    throw new Error(`${media.fileName} does not match the accepted media manifest`);
  }

  const objectPath = `${bucketName}/${objectPrefix}/${media.fileName}`;
  const downloadedPath = join(temporaryDirectory, media.fileName);
  const download = await run("pnpm", [
    "exec",
    "wrangler",
    "r2",
    "object",
    "get",
    objectPath,
    mode,
    "--config",
    wranglerConfig,
    ...persistenceArgs,
    "--file",
    downloadedPath,
  ]);
  if (download.code === 0) {
    const remoteHash = sha256(await readFile(downloadedPath));
    if (remoteHash !== media.sha256) {
      throw new Error(`${objectPath} already exists with a different immutable payload`);
    }
    return "retained" as const;
  }

  await runRequired("pnpm", [
    "exec",
    "wrangler",
    "r2",
    "object",
    "put",
    objectPath,
    mode,
    "--config",
    wranglerConfig,
    ...persistenceArgs,
    "--content-type",
    "image/webp",
    "--file",
    sourcePath,
  ]);
  return "uploaded" as const;
};

const QueryOutputSchema = v.array(
  v.object({
    results: v.array(v.record(v.string(), v.unknown())),
    success: v.boolean(),
  }),
);

const query = async (sql: string) => {
  const output = await runRequired("pnpm", [
    "exec",
    "wrangler",
    "d1",
    "execute",
    databaseName,
    mode,
    "--config",
    wranglerConfig,
    ...persistenceArgs,
    "--command",
    sql,
    "--json",
  ]);
  const parsed = v.parse(QueryOutputSchema, JSON.parse(output));
  const result = parsed.at(0);
  if (!result?.success) {
    throw new Error("D1 query did not report success");
  }
  return result.results;
};

const OperationalCountsSchema = v.strictObject({
  orders: v.number(),
  orderLines: v.number(),
  payments: v.number(),
  paymentEntries: v.number(),
  fulfillments: v.number(),
  reservations: v.number(),
  discountRedemptions: v.number(),
  customers: v.number(),
  customerOtpChallenges: v.number(),
  customerSessions: v.number(),
  staffSessions: v.number(),
});

const readOperationalCounts = async () => {
  const rows = await query(`SELECT
    (SELECT count(*) FROM orders) AS orders,
    (SELECT count(*) FROM order_lines) AS orderLines,
    (SELECT count(*) FROM payments) AS payments,
    (SELECT count(*) FROM payment_entries) AS paymentEntries,
    (SELECT count(*) FROM fulfillments) AS fulfillments,
    (SELECT count(*) FROM inventory_reservations) AS reservations,
    (SELECT count(*) FROM discount_redemption_entries) AS discountRedemptions,
    (SELECT count(*) FROM customers) AS customers,
    (SELECT count(*) FROM customer_otp_challenges) AS customerOtpChallenges,
    (SELECT count(*) FROM customer_auth_sessions) AS customerSessions,
    (SELECT count(*) FROM staff_auth_sessions) AS staffSessions;`);
  return v.parse(OperationalCountsSchema, rows.at(0));
};

const ProofSchema = v.strictObject({
  products: v.number(),
  bundles: v.number(),
  variants: v.number(),
  media: v.number(),
  catalogMedia: v.number(),
  brandText: v.number(),
  categories: v.number(),
  collections: v.number(),
  tags: v.number(),
  discounts: v.number(),
  discountTargets: v.number(),
  commerceSettings: v.number(),
  cmsDocuments: v.number(),
  openingEntries: v.number(),
  openingQuantity: v.number(),
  onHandQuantity: v.number(),
  ledgerQuantity: v.number(),
  searchCanonical: v.number(),
  searchProjection: v.number(),
  searchMissing: v.number(),
  searchOrphan: v.number(),
  searchDuplicate: v.number(),
  searchMismatched: v.number(),
  unicodeSku: v.number(),
  availableCleaningBundles: v.number(),
  unavailablePantryBundles: v.number(),
});

const readProof = async () => {
  const rows = await query(`SELECT
    (SELECT count(*) FROM catalog_items WHERE kind = 'product' AND state = 'published') AS products,
    (SELECT count(*) FROM catalog_items WHERE kind = 'bundle' AND state = 'published') AS bundles,
    (SELECT count(*) FROM variants WHERE state = 'active') AS variants,
    (SELECT count(*) FROM media_assets WHERE object_key LIKE 'reference/wf29/%') AS media,
    (SELECT count(*) FROM catalog_item_images WHERE catalog_item_id IN (${list(catalogItemIds)})) AS catalogMedia,
    (SELECT count(*) FROM catalog_items WHERE id IN (${list(catalogItemIds)}) AND brand_text IS NOT NULL) AS brandText,
    (SELECT count(*) FROM categories WHERE state = 'active') AS categories,
    (SELECT count(*) FROM collections WHERE state = 'active') AS collections,
    (SELECT count(*) FROM tags WHERE state = 'active') AS tags,
    (SELECT count(*) FROM discount_rules WHERE state = 'active') AS discounts,
    (SELECT count(*) FROM discount_rules WHERE (id = ${quote(referenceStoreFixture.discounts[0]?.id ?? "")} AND targets_json = ${json(referenceStoreFixture.discounts[0]?.targets ?? [])}) OR (id = ${quote(referenceStoreFixture.discounts[1]?.id ?? "")} AND targets_json = ${json(referenceStoreFixture.discounts[1]?.targets ?? [])})) AS discountTargets,
    (SELECT count(*) FROM commerce_settings WHERE key = 'commerce' AND bank_transfer_enabled = ${Number(commerceSettings.bankTransferEnabled)} AND cash_on_delivery_enabled = ${Number(commerceSettings.cashOnDeliveryEnabled)} AND customer_accounts_enabled = ${Number(commerceSettings.customerAccountsEnabled)} AND telegram_enabled = ${Number(commerceSettings.telegramEnabled)} AND pickup_enabled = ${Number(commerceSettings.pickupEnabled)} AND delivery_enabled = ${Number(commerceSettings.deliveryEnabled)} AND delivery_fee_mnt = ${commerceSettings.deliveryFeeMnt} AND free_delivery_threshold_mnt IS ${nullable(commerceSettings.freeDeliveryThresholdMnt)}) AS commerceSettings,
    (SELECT count(*) FROM cms_documents WHERE status = 'published') AS cmsDocuments,
    (SELECT count(*) FROM inventory_entries WHERE command_correlation_id = 'wf29.reference.seed.opening.v1') AS openingEntries,
    (SELECT coalesce(sum(on_hand_delta), 0) FROM inventory_entries WHERE command_correlation_id = 'wf29.reference.seed.opening.v1') AS openingQuantity,
    (SELECT coalesce(sum(on_hand_quantity), 0) FROM stock_items) AS onHandQuantity,
    (SELECT coalesce(sum(on_hand_delta), 0) FROM inventory_entries) AS ledgerQuantity,
    (SELECT canonical_count FROM catalog_search_diagnostics) AS searchCanonical,
    (SELECT projection_count FROM catalog_search_diagnostics) AS searchProjection,
    (SELECT missing_count FROM catalog_search_diagnostics) AS searchMissing,
    (SELECT orphan_count FROM catalog_search_diagnostics) AS searchOrphan,
    (SELECT duplicate_count FROM catalog_search_diagnostics) AS searchDuplicate,
    (SELECT mismatched_count FROM catalog_search_diagnostics) AS searchMismatched,
    (SELECT count(*) FROM skus WHERE sku = 'WF29-Ө-001' AND sku_compact = 'wf29ө001') AS unicodeSku,
    (SELECT min(CAST(stock.on_hand_quantity / component.quantity AS INTEGER)) FROM bundle_components component JOIN stock_items stock ON stock.variant_id = component.variant_id WHERE component.bundle_id = ${quote(referenceStoreFixture.bundles[0]?.id ?? "")}) AS availableCleaningBundles,
    (SELECT min(CAST(stock.on_hand_quantity / component.quantity AS INTEGER)) FROM bundle_components component JOIN stock_items stock ON stock.variant_id = component.variant_id WHERE component.bundle_id = ${quote(referenceStoreFixture.bundles[1]?.id ?? "")}) AS unavailablePantryBundles;`);
  return v.parse(ProofSchema, rows.at(0));
};

const assertProof = (proof: v.InferOutput<typeof ProofSchema>) => {
  const checks = {
    products: proof.products === 9,
    bundles: proof.bundles === 2,
    variants: proof.variants === 13,
    media: proof.media === 14 && proof.catalogMedia === 13,
    brandText: proof.brandText === 11,
    categories: proof.categories === 5,
    collections: proof.collections === 3,
    tags: proof.tags === 6,
    discounts: proof.discounts === 2 && proof.discountTargets === 2,
    commerceSettings: proof.commerceSettings === 1,
    cmsDocuments: proof.cmsDocuments === 7,
    openingEntries: proof.openingEntries === 13,
    openingQuantity: proof.openingQuantity === 111,
    inventoryLedger: proof.onHandQuantity === proof.ledgerQuantity,
    searchProjection:
      proof.searchCanonical === 11 &&
      proof.searchProjection === 11 &&
      proof.searchMissing === 0 &&
      proof.searchOrphan === 0 &&
      proof.searchDuplicate === 0 &&
      proof.searchMismatched === 0,
    unicodeSku: proof.unicodeSku === 1,
    bundleAvailability:
      proof.availableCleaningBundles === 8 && proof.unavailablePantryBundles === 0,
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failed.length > 0) {
    throw new Error(`Reference Store proof failed: ${failed.join(", ")}`);
  }
  return checks;
};

type MediaOutcome = { readonly outcome: "retained" } | { readonly outcome: "uploaded" };
const summarizeMedia = createPipeHandlers<MediaOutcome>("outcome").match<string>({
  retained: () => "retained",
  uploaded: () => "uploaded",
});

const main = async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "urnuun48-seed-"));
  try {
    const before = await readOperationalCounts();
    const mediaOutcomes = [] as {
      readonly asset: string;
      readonly outcome: "retained" | "uploaded";
    }[];
    for (const media of referenceStoreFixture.media) {
      mediaOutcomes.push({
        asset: media.key,
        outcome: await ensureMediaObject(temporaryDirectory, media),
      });
    }

    const sqlPath = join(temporaryDirectory, "reference-store-seed.sql");
    await writeFile(sqlPath, buildSeedSql());
    await runRequired("pnpm", [
      "exec",
      "wrangler",
      "d1",
      "execute",
      databaseName,
      mode,
      "--config",
      wranglerConfig,
      ...persistenceArgs,
      "--file",
      sqlPath,
      "--yes",
    ]);

    const after = await readOperationalCounts();
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(
        "Reference Store seed changed operational commerce, identity, or session rows",
      );
    }
    const proof = readProof().then((value) => ({ value, checks: assertProof(value) }));
    const completedProof = await proof;
    process.stdout.write(
      `${JSON.stringify(
        {
          storeKey: referenceStoreFixture.storeKey,
          paymentProvider: referenceStoreFixture.paymentProvider,
          scenarioKeys: referenceStoreFixture.scenarioKeys,
          mode: mode.slice(2),
          media: mediaOutcomes.map((entry) => ({
            asset: entry.asset,
            outcome: summarizeMedia(entry),
          })),
          proof: completedProof.value,
          checks: completedProof.checks,
          operationalRows: after,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

await main();
