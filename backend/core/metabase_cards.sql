-- SQL para criar 6 perguntas no Metabase (Native query → base sistema_gestao).
-- Guarde cada pergunta; o ID aparece na URL: /question/NUMERO
-- Configure no Django (env):
--   METABASE_URL=http://localhost:3000
--   METABASE_USER=email_do_admin_metabase
--   METABASE_PASSWORD=...
--   ou METABASE_API_KEY=... (Metabase Admin → API keys)
--   METABASE_CARD_OVERVIEW=1
--   METABASE_CARD_BY_CATEGORY=2
--   ... (um ID por pergunta)

-- 1) METABASE_CARD_OVERVIEW — uma linha
SELECT
  COUNT(*)::integer AS total_products,
  COALESCE(SUM(quantity), 0)::bigint AS total_units,
  COALESCE(SUM(quantity * price), 0)::double precision AS total_stock_value
FROM core_product;

-- 2) METABASE_CARD_BY_CATEGORY
SELECT
  COALESCE(c.name, '(sem categoria)') AS name,
  COUNT(p.id)::integer AS product_count,
  COALESCE(SUM(p.quantity), 0)::bigint AS units,
  COALESCE(SUM(p.quantity * p.price), 0)::double precision AS stock_value
FROM core_product p
LEFT JOIN core_category c ON c.id = p.category_id
GROUP BY c.name
ORDER BY stock_value DESC NULLS LAST;

-- 3) METABASE_CARD_BY_BRAND
SELECT
  COALESCE(b.name, '(sem marca)') AS name,
  COUNT(p.id)::integer AS product_count,
  COALESCE(SUM(p.quantity), 0)::bigint AS units,
  COALESCE(SUM(p.quantity * p.price), 0)::double precision AS stock_value
FROM core_product p
LEFT JOIN core_brand b ON b.id = p.brand_id
GROUP BY b.name
ORDER BY stock_value DESC NULLS LAST;

-- 4) METABASE_CARD_LOW_STOCK (limite fixo 5; alinhar com o card se mudar)
SELECT
  p.id,
  p.name,
  p.quantity,
  p.price::double precision AS price,
  p.expiration_date,
  COALESCE(c.name, '') AS category,
  COALESCE(b.name, '') AS brand
FROM core_product p
LEFT JOIN core_category c ON c.id = p.category_id
LEFT JOIN core_brand b ON b.id = p.brand_id
WHERE p.quantity <= 5
ORDER BY p.quantity, p.name
LIMIT 100;

-- 5) METABASE_CARD_TOP_VALUE
SELECT
  p.id,
  p.name,
  p.quantity,
  p.price::double precision AS price,
  (p.quantity * p.price)::double precision AS line_value
FROM core_product p
ORDER BY line_value DESC NULLS LAST
LIMIT 10;

-- 6) METABASE_CARD_EXPIRATION — uma linha
SELECT
  COUNT(*) FILTER (
    WHERE expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE
  )::integer AS expired_count,
  COUNT(*) FILTER (
    WHERE expiration_date IS NOT NULL
      AND expiration_date >= CURRENT_DATE
      AND expiration_date < CURRENT_DATE + INTERVAL '7 days'
  )::integer AS next_7_days_count,
  COUNT(*) FILTER (
    WHERE expiration_date IS NOT NULL
      AND expiration_date >= CURRENT_DATE
      AND expiration_date < CURRENT_DATE + INTERVAL '30 days'
  )::integer AS next_30_days_count
FROM core_product;
