INSERT INTO commerce_settings (
  key, bank_transfer_enabled, cash_on_delivery_enabled, customer_accounts_enabled,
  telegram_enabled, pickup_enabled, delivery_enabled, delivery_fee_mnt,
  free_delivery_threshold_mnt, updated_at
) VALUES ('commerce', 1, 0, 1, 0, 0, 1, 5000, 100000, 1767225600000)
ON CONFLICT(key) DO UPDATE SET
  bank_transfer_enabled = excluded.bank_transfer_enabled,
  cash_on_delivery_enabled = excluded.cash_on_delivery_enabled,
  customer_accounts_enabled = excluded.customer_accounts_enabled,
  telegram_enabled = excluded.telegram_enabled,
  pickup_enabled = excluded.pickup_enabled,
  delivery_enabled = excluded.delivery_enabled,
  delivery_fee_mnt = excluded.delivery_fee_mnt,
  free_delivery_threshold_mnt = excluded.free_delivery_threshold_mnt,
  updated_at = excluded.updated_at;

INSERT INTO catalog_items (
  id, kind, slug, sku, sku_compact, state, name, description, price_mnt,
  created_at, updated_at, published_at, archived_at
) VALUES
  ('product_00000000000000000000000001', 'product', 'tsagaan-budaa', NULL, NULL, 'published', 'Цагаан будаа', 'Өдөр тутмын хоолонд тохирох цэвэр цагаан будаа.', 18900, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000002', 'product', 'deed-guril', NULL, NULL, 'published', 'Дээд гурил', 'Боов, талх, өдөр тутмын хоолонд зориулсан дээд гурил.', 7200, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000003', 'product', 'suun-undaa', NULL, NULL, 'published', 'Сүүн ундаа', 'Өглөөний цайнд тохирох зөөлөн амттай сүүн ундаа.', 4800, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000004', 'product', 'urgamliin-tos', NULL, NULL, 'published', 'Ургамлын тос', 'Гэрийн хоолонд зориулсан цэвэршүүлсэн ургамлын тос.', 12800, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000005', 'product', 'ugaalgiin-shingen', NULL, NULL, 'published', 'Угаалгын шингэн', 'Өдөр тутмын угаалгад зориулсан өтгөрүүлсэн шингэн.', 15900, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000006', 'product', 'ayga-tavag-ugaagch', NULL, NULL, 'published', 'Аяга таваг угаагч', 'Тос, бохирдлыг арилгах зөөлөн найрлагатай шингэн.', 6900, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000007', 'product', 'daavuun-tsunh', NULL, NULL, 'published', 'Даавуун цүнх', 'Дахин ашиглах бат бөх өдөр тутмын даавуун цүнх.', 22000, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000008', 'product', 'temdegleliin-devter', NULL, NULL, 'published', 'Тэмдэглэлийн дэвтэр', 'Ажил, хичээлийн тэмдэглэлд зориулсан дэвтэр.', 9500, 1767225600000, 1767225600000, 1767225600000, NULL),
  ('product_00000000000000000000000009', 'product', 'shoo-elsensikher', NULL, NULL, 'published', 'Шоо элсэн чихэр', 'Цай, кофенд тохирох жигд хэмжээтэй шоо элсэн чихэр.', 6400, 1767225600000, 1767225600000, 1767225600000, NULL)
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug,
  state = excluded.state,
  name = excluded.name,
  description = excluded.description,
  price_mnt = excluded.price_mnt,
  updated_at = excluded.updated_at,
  published_at = excluded.published_at,
  archived_at = NULL;

INSERT INTO variants (
  id, product_id, is_default, combination_key, sku, sku_compact,
  price_override_mnt, image_media_asset_id, state, created_at, updated_at
) VALUES
  ('variant_00000000000000000000000001', 'product_00000000000000000000000001', 1, '__default__', 'U48-RICE-01', 'u48rice01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000002', 'product_00000000000000000000000002', 1, '__default__', 'U48-FLOUR-01', 'u48flour01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000003', 'product_00000000000000000000000003', 1, '__default__', 'U48-MILK-01', 'u48milk01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000004', 'product_00000000000000000000000004', 1, '__default__', 'U48-OIL-01', 'u48oil01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000005', 'product_00000000000000000000000005', 1, '__default__', 'U48-LAUNDRY-01', 'u48laundry01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000006', 'product_00000000000000000000000006', 1, '__default__', 'U48-DISH-01', 'u48dish01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000007', 'product_00000000000000000000000007', 1, '__default__', 'U48-TOTE-01', 'u48tote01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000008', 'product_00000000000000000000000008', 1, '__default__', 'U48-NOTE-01', 'u48note01', NULL, NULL, 'active', 1767225600000, 1767225600000),
  ('variant_00000000000000000000000009', 'product_00000000000000000000000009', 1, '__default__', 'U48-SUGAR-01', 'u48sugar01', NULL, NULL, 'active', 1767225600000, 1767225600000)
ON CONFLICT(id) DO UPDATE SET
  product_id = excluded.product_id,
  is_default = excluded.is_default,
  combination_key = excluded.combination_key,
  sku = excluded.sku,
  sku_compact = excluded.sku_compact,
  state = excluded.state,
  updated_at = excluded.updated_at;

INSERT INTO stock_items (id, variant_id, on_hand_quantity, reserved_quantity, updated_at) VALUES
  ('stock_item_00000000000000000000000001', 'variant_00000000000000000000000001', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000002', 'variant_00000000000000000000000002', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000003', 'variant_00000000000000000000000003', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000004', 'variant_00000000000000000000000004', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000005', 'variant_00000000000000000000000005', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000006', 'variant_00000000000000000000000006', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000007', 'variant_00000000000000000000000007', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000008', 'variant_00000000000000000000000008', 80, 0, 1767225600000),
  ('stock_item_00000000000000000000000009', 'variant_00000000000000000000000009', 80, 0, 1767225600000)
ON CONFLICT(id) DO UPDATE SET
  variant_id = excluded.variant_id,
  on_hand_quantity = excluded.on_hand_quantity,
  reserved_quantity = excluded.reserved_quantity,
  updated_at = excluded.updated_at;
