/** Lógica pura dos relatórios Metabase (testável sem React). */

export type AutoCard = {
  id: number;
  name: string;
  description?: string;
  chart_type:
    | "bar"
    | "line"
    | "metric"
    | "table"
    | "error"
    | "scatter"
    | "combo_category_stock"
    | "nested_pie_equal_category"
    | "nested_pie_equal_brand"
    | "nested_pie_high_values";
  col_names: string[];
  col_types: string[];
  rows: Record<string, unknown>[];
  metric_values: Record<string, number>;
  error?: string;
};

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const TOP_SUMMARY_MATCHERS: { order: number; test: (nameNorm: string) => boolean }[] = [
  { order: 0, test: (n) => n.includes("valores totais") },
  { order: 1, test: (n) => n.includes("vencidos") && (n.includes("30") || n.includes("+ 30")) },
  { order: 2, test: (n) => n.includes("por validade") },
];

export function isTopSummaryCardName(name: string): boolean {
  const n = norm(name);
  return TOP_SUMMARY_MATCHERS.some(({ test }) => test(n));
}

function topSummarySortOrder(name: string): number {
  const n = norm(name);
  const i = TOP_SUMMARY_MATCHERS.findIndex(({ test }) => test(n));
  return i === -1 ? 999 : TOP_SUMMARY_MATCHERS[i].order;
}

export function gridCardSortOrder(name: string): number {
  const n = norm(name);
  if (n.includes("estoque por categoria") && n.includes("quantidade") && n.includes("valor")) return 0;
  if (n.includes("produtos vendidos") && n.includes("receita bruta")) return 1;
  return 999;
}

export function partitionReportCards(cards: AutoCard[]): {
  topSummaryCards: AutoCard[];
  gridCards: AutoCard[];
} {
  const topSummaryCards: AutoCard[] = [];
  const gridCards: AutoCard[] = [];
  for (const c of cards) {
    if (isTopSummaryCardName(c.name || "")) topSummaryCards.push(c);
    else gridCards.push(c);
  }
  topSummaryCards.sort(
    (a, b) => topSummarySortOrder(a.name || "") - topSummarySortOrder(b.name || ""),
  );
  gridCards.sort((a, b) => gridCardSortOrder(a.name || "") - gridCardSortOrder(b.name || ""));
  return { topSummaryCards, gridCards };
}

export function resolveCategoryCoverageScatterKeys(
  card: AutoCard,
): { catKey: string; totalKey: string; lowItemsKey: string } | null {
  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let catKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "string") continue;
    const n = norm(names[i]);
    if (n.includes("categoria") || n.includes("category")) {
      catKey = names[i];
      break;
    }
  }
  if (!catKey) {
    const idx = types.indexOf("string");
    if (idx >= 0) catKey = names[idx];
  }
  if (!catKey) return null;

  let totalKey = "";
  let lowItemsKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "number") continue;
    const n = norm(names[i]);
    if (n.includes("itens_estoque_baixo") || (n.includes("estoque_baixo") && n.includes("itens")))
      lowItemsKey = names[i];
    if (n.includes("total_itens") || (n.includes("total") && n.includes("itens") && !n.includes("estoque_baixo")))
      totalKey = names[i];
  }

  const numCols = names.filter((_, i) => types[i] === "number");
  const title = norm(card.name || "");
  if (!lowItemsKey || !totalKey) {
    if (title.includes("cobertura") && title.includes("categoria") && numCols.length >= 2) {
      if (!lowItemsKey) lowItemsKey = numCols[0];
      if (!totalKey) totalKey = numCols[1];
    }
  }
  if (!lowItemsKey || !totalKey || lowItemsKey === totalKey) return null;
  return { catKey, totalKey, lowItemsKey };
}

export function resolveScatterKeys(card: AutoCard): { nameKey: string; qtyKey: string; priceKey: string } | null {
  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let nameKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "string") continue;
    const n = norm(names[i]);
    if (n.includes("nome") || n.includes("name") || n.includes("produto")) {
      nameKey = names[i];
      break;
    }
  }
  if (!nameKey) {
    const idx = types.indexOf("string");
    if (idx >= 0) nameKey = names[idx];
  }
  if (!nameKey) return null;

  let qtyKey = "";
  let priceKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "number") continue;
    const n = norm(names[i]);
    if (n.includes("quant") || n.includes("qtd") || n === "qty") qtyKey = names[i];
    if (n.includes("preco") || n.includes("price") || (n.includes("valor") && !n.includes("line"))) priceKey = names[i];
  }

  const numCols = names.filter((_, i) => types[i] === "number");
  if (!qtyKey || !priceKey) {
    if (numCols.length >= 3) {
      if (!qtyKey) qtyKey = numCols[1];
      if (!priceKey) priceKey = numCols[2];
    } else if (numCols.length === 2) {
      if (!qtyKey) qtyKey = numCols[0];
      if (!priceKey) priceKey = numCols[1];
    }
  }
  if (!qtyKey || !priceKey || qtyKey === priceKey) return null;
  return { nameKey, qtyKey, priceKey };
}

export type ComboCategoryRow = {
  categoria: string;
  total_produtos: number;
  total_unidades: number;
  valor_estoque: number;
};

export type SalesRevenueRow = {
  label: string;
  produtos_vendidos: number;
  receita_bruta: number;
};

export function resolveComboCategoryStockKeys(
  card: AutoCard,
): { catKey: string; prodKey: string; unitsKey: string; valueKey: string } | null {
  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let catKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "string") continue;
    const n = norm(names[i]);
    if (n.includes("categoria") || n.includes("category")) {
      catKey = names[i];
      break;
    }
  }
  if (!catKey) {
    const idx = types.indexOf("string");
    if (idx >= 0) catKey = names[idx];
  }
  if (!catKey) return null;

  let prodKey = "";
  let unitsKey = "";
  let valueKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "number") continue;
    const n = norm(names[i]);
    if (n.includes("total_produtos") || (n.includes("total") && n.includes("produto"))) prodKey = names[i];
    if (n.includes("total_unidades") || (n.includes("unidades") && !n.includes("preco"))) unitsKey = names[i];
    if (n.includes("valor_estoque") || (n.includes("valor") && n.includes("estoque"))) valueKey = names[i];
  }

  const numCols = names.filter((_, i) => types[i] === "number");
  const title = norm(card.name || "");
  if (!prodKey || !unitsKey || !valueKey) {
    if (title.includes("estoque") && title.includes("categoria") && numCols.length >= 3) {
      if (!prodKey) prodKey = numCols[0];
      if (!unitsKey) unitsKey = numCols[1];
      if (!valueKey) valueKey = numCols[2];
    }
  }
  if (!prodKey || !unitsKey || !valueKey) return null;
  const uniq = new Set([prodKey, unitsKey, valueKey]);
  if (uniq.size !== 3) return null;
  return { catKey, prodKey, unitsKey, valueKey };
}

export function buildComboCategoryStockRows(card: AutoCard): ComboCategoryRow[] | null {
  const keys = resolveComboCategoryStockKeys(card);
  if (!keys) return null;
  const out: ComboCategoryRow[] = [];
  for (const row of card.rows) {
    const categoria = String(row[keys.catKey] ?? "");
    const total_produtos = Number(row[keys.prodKey]);
    const total_unidades = Number(row[keys.unitsKey]);
    const valor_estoque = Number(row[keys.valueKey]);
    if (
      !Number.isFinite(total_produtos)
      || !Number.isFinite(total_unidades)
      || !Number.isFinite(valor_estoque)
    )
      continue;
    out.push({
      categoria: categoria || "—",
      total_produtos,
      total_unidades,
      valor_estoque,
    });
  }
  return out;
}

export function resolveSalesRevenueMonthKeys(
  card: AutoCard,
): { labelKey: string; soldKey: string; revenueKey: string } | null {
  const title = norm(card.name || "");
  const isSalesRevenueMonthCard =
    title.includes("produtos vendidos") && title.includes("receita bruta");
  if (!isSalesRevenueMonthCard) return null;

  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let labelKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] === "date") {
      labelKey = names[i];
      break;
    }
  }
  if (!labelKey) {
    const idx = types.indexOf("string");
    if (idx >= 0) labelKey = names[idx];
  }
  if (!labelKey) labelKey = names[0];

  let soldKey = "";
  let revenueKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "number") continue;
    const n = norm(names[i]);
    if (
      n.includes("produtos_vendidos")
      || (n.includes("produto") && n.includes("vendid"))
      || n.includes("itens_vendidos")
      || n.includes("qtd_vendida")
    )
      soldKey = names[i];
    if (
      n.includes("receita_bruta")
      || (n.includes("receita") && n.includes("bruta"))
      || n.includes("faturamento")
      || n.includes("valor_vendas")
    )
      revenueKey = names[i];
  }

  if (!soldKey || !revenueKey) {
    const numericCols = names.filter((_, i) => types[i] === "number");
    if (numericCols.length >= 2) {
      if (!soldKey) soldKey = numericCols[0];
      if (!revenueKey) revenueKey = numericCols[1];
    }
  }
  if (!soldKey || !revenueKey || soldKey === revenueKey) return null;
  return { labelKey, soldKey, revenueKey };
}

/** Eixo X: só data (sem hora). Evita `Date` para não mudar o dia por fuso. */
export function formatSalesMonthAxisLabel(raw: unknown): string {
  if (raw === null || raw === undefined) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return s;
}

export function buildSalesRevenueMonthRows(card: AutoCard): SalesRevenueRow[] | null {
  const keys = resolveSalesRevenueMonthKeys(card);
  if (!keys) return null;
  const out: SalesRevenueRow[] = [];
  for (const row of card.rows) {
    const label = formatSalesMonthAxisLabel(row[keys.labelKey]);
    const produtos_vendidos = Number(row[keys.soldKey]);
    const receita_bruta = Number(row[keys.revenueKey]);
    if (!Number.isFinite(produtos_vendidos) || !Number.isFinite(receita_bruta)) continue;
    out.push({
      label: label || "—",
      produtos_vendidos,
      receita_bruta,
    });
  }
  return out.length ? out : null;
}

export type NestedPieRingRow = {
  segment: string;
  product_count: number;
  stock_value: number;
};

export function resolveNestedPieRingKeys(
  card: AutoCard,
  mode: "category" | "brand",
): { labelKey: string; countKey: string; valueKey: string } | null {
  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let labelKey = "";
  if (mode === "category") {
    for (let i = 0; i < names.length; i++) {
      if (types[i] !== "string") continue;
      const n = norm(names[i]);
      if (n.includes("categoria") || n.includes("category") || n === "name" || n.includes("nome")) {
        labelKey = names[i];
        break;
      }
    }
  } else {
    for (let i = 0; i < names.length; i++) {
      if (types[i] !== "string") continue;
      const n = norm(names[i]);
      if (n.includes("marca") || n.includes("brand") || n.includes("fabricante")) {
        labelKey = names[i];
        break;
      }
    }
  }
  if (!labelKey) {
    const idx = types.indexOf("string");
    const title = norm(card.name || "");
    if (
      idx >= 0
      && ((mode === "category" && title.includes("por categoria"))
        || (mode === "brand" && title.includes("por marca")))
    )
      labelKey = names[idx];
  }
  if (!labelKey) return null;

  let countKey = "";
  let valueKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "number") continue;
    const n = norm(names[i]);
    if (
      n.includes("product_count")
      || (n.includes("produto") && n.includes("count"))
      || n.includes("total_produtos")
    )
      countKey = names[i];
    if (
      n.includes("stock_value")
      || n.includes("valor_estoque")
      || (n.includes("stock") && n.includes("value"))
      || (n.includes("valor") && n.includes("estoque") && !n.includes("baixo"))
    )
      valueKey = names[i];
  }

  const numCols = names.filter((_, i) => types[i] === "number");
  const title = norm(card.name || "");
  if (!countKey || !valueKey) {
    const titleOk =
      (mode === "category" && title.includes("por categoria") && !title.includes("estoque"))
      || (mode === "brand" && title.includes("por marca"));
    if (titleOk && numCols.length >= 2) {
      if (numCols.length === 2) {
        countKey = numCols[0];
        valueKey = numCols[1];
      } else if (numCols.length >= 3) {
        countKey = numCols[0];
        valueKey = numCols[numCols.length - 1];
      }
    }
  }
  if (!countKey || !valueKey || countKey === valueKey) return null;
  return { labelKey, countKey, valueKey };
}

export function buildNestedPieRingRows(card: AutoCard, mode: "category" | "brand"): NestedPieRingRow[] | null {
  const keys = resolveNestedPieRingKeys(card, mode);
  if (!keys) return null;
  const out: NestedPieRingRow[] = [];
  for (const row of card.rows) {
    const segment = String(row[keys.labelKey] ?? "");
    const product_count = Number(row[keys.countKey]);
    const stock_value = Number(row[keys.valueKey]);
    if (!Number.isFinite(product_count) || !Number.isFinite(stock_value)) continue;
    out.push({
      segment: segment || "—",
      product_count,
      stock_value,
    });
  }
  return out.length ? out : null;
}

export type NestedPieHighValueRow = {
  segment: string;
  preco: number;
};

export function resolveHighValuesPieKeys(card: AutoCard): { nameKey: string; priceKey: string } | null {
  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let nameKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "string") continue;
    const n = norm(names[i]);
    if (
      n.includes("produto")
      || n.includes("nome")
      || n.includes("name")
      || n.includes("item")
      || n.includes("titulo")
    ) {
      nameKey = names[i];
      break;
    }
  }
  if (!nameKey) {
    const idx = types.indexOf("string");
    if (idx >= 0) nameKey = names[idx];
  }
  if (!nameKey) return null;

  let priceKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "number") continue;
    const n = norm(names[i]);
    if (n.includes("quantidade") || n.includes("qty") || n.includes("qtd")) continue;
    if (
      n.includes("preco")
      || n.includes("price")
      || n === "valor"
      || (n.includes("valor") && !n.includes("estoque") && !n.includes("stock"))
    )
      priceKey = names[i];
  }
  if (!priceKey) {
    const nums = names.filter((_, i) => types[i] === "number");
    if (nums.length === 1) priceKey = nums[0];
    else if (nums.length >= 2)
      priceKey =
        nums.find((k) => {
          const n = norm(k);
          return n.includes("preco") || n.includes("price") || n.includes("valor");
        }) || nums[0];
  }
  if (!priceKey) return null;
  return { nameKey, priceKey };
}

export function buildHighValuesPieRows(card: AutoCard): NestedPieHighValueRow[] | null {
  const keys = resolveHighValuesPieKeys(card);
  if (!keys) return null;
  const out: NestedPieHighValueRow[] = [];
  for (const row of card.rows) {
    const segment = String(row[keys.nameKey] ?? "");
    const preco = Number(row[keys.priceKey]);
    if (!Number.isFinite(preco)) continue;
    out.push({ segment: segment || "—", preco });
  }
  return out.length ? out : null;
}
