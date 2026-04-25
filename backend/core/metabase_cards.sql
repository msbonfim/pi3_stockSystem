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

-- ============================================================
-- INDICADORES ADICIONAIS (para montar no dashboard do Metabase)
-- ============================================================

-- 7) ESTOQUE POR CATEGORIA (quantidade e valor)
-- Visual sugerida: barras horizontais (ordenado por valor)
SELECT
  COALESCE(c.name, '(sem categoria)') AS categoria,
  COUNT(p.id)::integer AS total_produtos,
  COALESCE(SUM(p.quantity), 0)::bigint AS total_unidades,
  COALESCE(SUM(p.quantity * p.price), 0)::double precision AS valor_estoque
FROM core_product p
LEFT JOIN core_category c ON c.id = p.category_id
GROUP BY c.name
ORDER BY valor_estoque DESC NULLS LAST;

-- 8) PRODUTOS PROXIMOS DO VENCIMENTO POR CATEGORIA
-- Janela: hoje até os proximos 30 dias (ajuste se quiser 7/15 dias)
-- Visual sugerida: barras empilhadas (7 dias / 8-30 dias / vencidos)
SELECT
  COALESCE(c.name, '(sem categoria)') AS categoria,
  COUNT(*) FILTER (
    WHERE p.expiration_date IS NOT NULL
      AND p.expiration_date < CURRENT_DATE
  )::integer AS vencidos,
  COUNT(*) FILTER (
    WHERE p.expiration_date IS NOT NULL
      AND p.expiration_date >= CURRENT_DATE
      AND p.expiration_date < CURRENT_DATE + INTERVAL '7 days'
  )::integer AS vence_em_7_dias,
  COUNT(*) FILTER (
    WHERE p.expiration_date IS NOT NULL
      AND p.expiration_date >= CURRENT_DATE + INTERVAL '7 days'
      AND p.expiration_date < CURRENT_DATE + INTERVAL '30 days'
  )::integer AS vence_entre_8_e_30_dias
FROM core_product p
LEFT JOIN core_category c ON c.id = p.category_id
GROUP BY c.name
ORDER BY (vence_em_7_dias + vence_entre_8_e_30_dias + vencidos) DESC, categoria;

-- 9) INDICADOR EXTRA #1: COBERTURA DE ESTOQUE BAIXO POR CATEGORIA
-- Quantos itens com quantidade <= 5 por categoria.
-- Visual sugerida: barras ou tabela com condicional de cor.
SELECT
  COALESCE(c.name, '(sem categoria)') AS categoria,
  COUNT(*) FILTER (WHERE p.quantity <= 5)::integer AS itens_estoque_baixo,
  COUNT(*)::integer AS total_itens,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE p.quantity <= 5) / NULLIF(COUNT(*), 0),
    2
  ) AS pct_estoque_baixo
FROM core_product p
LEFT JOIN core_category c ON c.id = p.category_id
GROUP BY c.name
ORDER BY itens_estoque_baixo DESC, categoria;

-- 10) INDICADOR EXTRA #2: VALOR EM RISCO DE PERDA (vencidos + 30 dias)
-- Valor financeiro potencialmente perdido por validade.
-- Visual sugerida: KPI + serie temporal (se houver historico).
SELECT
  COALESCE(SUM(p.quantity * p.price) FILTER (
    WHERE p.expiration_date IS NOT NULL
      AND p.expiration_date < CURRENT_DATE
  ), 0)::double precision AS valor_vencido,
  COALESCE(SUM(p.quantity * p.price) FILTER (
    WHERE p.expiration_date IS NOT NULL
      AND p.expiration_date >= CURRENT_DATE
      AND p.expiration_date < CURRENT_DATE + INTERVAL '30 days'
  ), 0)::double precision AS valor_a_vencer_30_dias,
  COALESCE(SUM(p.quantity * p.price), 0)::double precision AS valor_total_estoque
FROM core_product p;

-- 11) PRODUTOS VENDIDOS NO MES vs RECEITA BRUTA
-- Requer as tabelas core_sale e core_saleitem (migration 0006+).
SELECT
  DATE_TRUNC('month', s.sold_at)::date AS mes,
  SUM(si.quantity)::bigint AS produtos_vendidos,
  SUM(si.line_total)::double precision AS receita_bruta
FROM core_saleitem si
JOIN core_sale s ON s.id = si.sale_id
WHERE s.sold_at >= DATE_TRUNC('year', CURRENT_DATE)
GROUP BY 1
ORDER BY 1;
