import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Loader2 } from "lucide-react";

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "https://pi2-stocksystem-backend.onrender.com/api";

type AutoCard = {
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

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v: unknown, colType?: string) => {
  if (v === null || v === undefined) return "—";
  if (colType === "number") return Number(v).toLocaleString("pt-BR");
  return String(v);
};
const PIE_COLORS = ["#6366f1", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#84cc16", "#f97316"];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Resumo no topo da página: estes títulos viram cards só com texto (não gráfico). */
const TOP_SUMMARY_MATCHERS: { order: number; test: (nameNorm: string) => boolean }[] = [
  { order: 0, test: (n) => n.includes("valores totais") },
  { order: 1, test: (n) => n.includes("vencidos") && (n.includes("30") || n.includes("+ 30")) },
  { order: 2, test: (n) => n.includes("por validade") },
];

function isTopSummaryCardName(name: string): boolean {
  const n = norm(name);
  return TOP_SUMMARY_MATCHERS.some(({ test }) => test(n));
}

function topSummarySortOrder(name: string): number {
  const n = norm(name);
  const i = TOP_SUMMARY_MATCHERS.findIndex(({ test }) => test(n));
  return i === -1 ? 999 : TOP_SUMMARY_MATCHERS[i].order;
}

function gridCardSortOrder(name: string): number {
  const n = norm(name);
  if (n.includes("estoque por categoria") && n.includes("quantidade") && n.includes("valor")) return 0;
  if (n.includes("produtos vendidos") && n.includes("receita bruta")) return 1;
  return 999;
}

function partitionReportCards(cards: AutoCard[]): {
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

/** Conteúdo textual para cards de resumo (métrica ou tabela). */
function SummaryTextCardContent({ card }: { card: AutoCard }) {
  if (card.chart_type === "error")
    return <p className="text-destructive text-sm">{card.error}</p>;

  const mv = card.metric_values || {};
  if (card.chart_type === "metric" && Object.keys(mv).length > 0) {
    return (
      <dl className="space-y-2 text-sm">
        {Object.entries(mv).map(([k, v]) => (
          <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums text-foreground">{Number(v).toLocaleString("pt-BR")}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const rows = card.rows || [];
  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem dados.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {rows.slice(0, 24).map((row, ri) => (
        <div
          key={ri}
          className={rows.length > 1 ? "rounded-md border border-border/50 bg-muted/25 p-3" : ""}
        >
          <dl className="space-y-1.5">
            {card.col_names.map((col, ci) => (
              <div key={`${ri}-${col}`} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">{col}</dt>
                <dd className="max-w-[70%] text-right font-medium leading-snug text-foreground">
                  {fmt(row[col], card.col_types[ci])}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Cobertura estoque baixo por categoria: categoria, itens_estoque_baixo, total_itens, ... */
function resolveCategoryCoverageScatterKeys(
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

/** Colunas típicas do card estoque baixo: id, nome, qtd, preço, ... */
function resolveScatterKeys(card: AutoCard): { nameKey: string; qtyKey: string; priceKey: string } | null {
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
    // Ordem comum: id, quantity, price
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

type ComboCategoryRow = {
  categoria: string;
  total_produtos: number;
  total_unidades: number;
  valor_estoque: number;
};

type SalesRevenueRow = {
  label: string;
  produtos_vendidos: number;
  receita_bruta: number;
};

/** SQL típico: categoria, total_produtos, total_unidades, valor_estoque — combo: barra = contagem (product_count); linha = valor (stock_value) */
function resolveComboCategoryStockKeys(
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
    if (n.includes("total_produtos") || (n.includes("total") && n.includes("produto")))
      prodKey = names[i];
    if (n.includes("total_unidades") || (n.includes("unidades") && !n.includes("preco")))
      unitsKey = names[i];
    if (n.includes("valor_estoque") || (n.includes("valor") && n.includes("estoque")))
      valueKey = names[i];
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

function buildComboCategoryStockRows(card: AutoCard): ComboCategoryRow[] | null {
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

function resolveSalesRevenueMonthKeys(
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

function buildSalesRevenueMonthRows(card: AutoCard): SalesRevenueRow[] | null {
  const keys = resolveSalesRevenueMonthKeys(card);
  if (!keys) return null;
  const out: SalesRevenueRow[] = [];
  for (const row of card.rows) {
    const label = String(row[keys.labelKey] ?? "");
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

/** Pizza dupla (por categoria ou por marca): fatias ∝ product_count; rótulo externo = valor estoque. */
type NestedPieRingRow = {
  segment: string;
  product_count: number;
  stock_value: number;
};

function resolveNestedPieRingKeys(
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

function buildNestedPieRingRows(card: AutoCard, mode: "category" | "brand"): NestedPieRingRow[] | null {
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

/** Card "Valores mais altos": produto + preço; ambos os anéis ∝ preço; rótulos interno = nome, externo = valor. */
type NestedPieHighValueRow = {
  segment: string;
  preco: number;
};

function resolveHighValuesPieKeys(card: AutoCard): { nameKey: string; priceKey: string } | null {
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

function buildHighValuesPieRows(card: AutoCard): NestedPieHighValueRow[] | null {
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

/** Pizza dupla (valores mais altos): centro = soma dos preços exibidos. */
function NestedDoublePieHighValuesChart({ rows }: { rows: NestedPieHighValueRow[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const margin = 8;
  const chartW = box.w;
  const chartH = box.h;
  const offsetW = Math.max(chartW - margin * 2, 0);
  const offsetH = Math.max(chartH - margin * 2, 0);
  const maxPieR = Math.min(offsetW, offsetH) / 2;

  const truncateLabel = (s: string, max = 14) => {
    const t = String(s);
    return t.length > max ? `${t.slice(0, max)}…` : t;
  };

  const pieAngleProps = { startAngle: 90, endAngle: 450, paddingAngle: 0, minAngle: 0, isAnimationActive: false };

  const hole = maxPieR * 0.22;
  const ringW = maxPieR * 0.22;
  const gap = maxPieR * 0.02;
  const rInnerIn = hole;
  const rInnerOut = hole + ringW;
  const rOuterIn = rInnerOut + gap;
  const rOuterOut = rOuterIn + ringW;

  const totalPreco = rows.reduce((s, r) => s + r.preco, 0);
  const maxOuterLabels = 8;

  return (
    <div ref={wrapRef} className="relative h-full min-h-[300px] w-full">
      {chartW > 32 && chartH > 32 && maxPieR > 8 ? (
        <PieChart width={chartW} height={chartH} margin={{ top: margin, right: margin, bottom: margin, left: margin }}>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as NestedPieHighValueRow;
              const seg = row.segment ?? String(payload[0].name ?? "");
              return (
                <div className="rounded-md border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                  <p className="font-medium text-foreground">{seg}</p>
                  <p className="text-muted-foreground">Preço: {money(Number(row.preco))}</p>
                </div>
              );
            }}
          />
          <Pie
            {...pieAngleProps}
            data={rows}
            dataKey="preco"
            nameKey="segment"
            cx="50%"
            cy="50%"
            innerRadius={rInnerIn}
            outerRadius={rInnerOut}
            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 0.5 }}
            label={() => ""}
          >
            {rows.map((_, i) => (
              <Cell
                key={`hv-in-${i}`}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Pie
            {...pieAngleProps}
            data={rows}
            dataKey="preco"
            nameKey="segment"
            cx="50%"
            cy="50%"
            innerRadius={rOuterIn}
            outerRadius={rOuterOut}
            labelLine={false}
            label={(props: { payload?: NestedPieHighValueRow; index?: number }) => {
              if ((props.index ?? 999) >= maxOuterLabels) return "";
              const v = props.payload?.preco;
              return v != null && Number.isFinite(Number(v)) ? money(Number(v)) : "";
            }}
          >
            {rows.map((_, i) => (
              <Cell
                key={`hv-out-${i}`}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={1}
              />
            ))}
          </Pie>
        </PieChart>
      ) : null}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex max-w-[36%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center">
        <span className="text-lg font-bold tabular-nums leading-tight text-foreground sm:text-xl">
          {money(totalPreco)}
        </span>
        <span className="text-xs text-muted-foreground">soma (exibidos)</span>
      </div>
    </div>
  );
}

/** Pizza dupla: espessura radial idêntica em px (base = maxPieRadius do Recharts, área útil após margin). */
function NestedDoublePieChart({
  rows,
  isBrandPie,
  innerDataKey,
  outerDataKey,
  totalProdutosSum,
}: {
  rows: NestedPieRingRow[];
  isBrandPie: boolean;
  innerDataKey: "stock_value" | "product_count";
  outerDataKey: "product_count";
  totalProdutosSum: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const margin = 8;
  const chartW = box.w;
  const chartH = box.h;
  const offsetW = Math.max(chartW - margin * 2, 0);
  const offsetH = Math.max(chartH - margin * 2, 0);
  /* Igual a Recharts parseCoordinateOfPie: maxPieRadius = min(offset.width, offset.height) / 2 */
  const maxPieR = Math.min(offsetW, offsetH) / 2;

  const truncateLabel = (s: string, max = 14) => {
    const t = String(s);
    return t.length > max ? `${t.slice(0, max)}…` : t;
  };

  const pieAngleProps = { startAngle: 90, endAngle: 450, paddingAngle: 0, minAngle: 0, isAnimationActive: false };

  const hole = maxPieR * 0.22;
  const ringW = maxPieR * 0.22;
  const gap = maxPieR * 0.02;
  const rInnerIn = hole;
  const rInnerOut = hole + ringW;
  const rOuterIn = rInnerOut + gap;
  const rOuterOut = rOuterIn + ringW;

  return (
    <div ref={wrapRef} className="relative h-full min-h-[300px] w-full">
      {chartW > 32 && chartH > 32 && maxPieR > 8 ? (
        <PieChart width={chartW} height={chartH} margin={{ top: margin, right: margin, bottom: margin, left: margin }}>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload as NestedPieRingRow;
              const seg = row.segment ?? String(payload[0].name ?? "");
              return (
                <div className="rounded-md border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                  <p className="font-medium text-foreground">{seg}</p>
                  <p className="text-muted-foreground">
                    Produtos: {Number(row.product_count).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-muted-foreground">Valor estoque: {money(Number(row.stock_value))}</p>
                </div>
              );
            }}
          />
          <Pie
            {...pieAngleProps}
            data={rows}
            dataKey={innerDataKey}
            nameKey="segment"
            cx="50%"
            cy="50%"
            innerRadius={rInnerIn}
            outerRadius={rInnerOut}
            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 0.5 }}
            label={() => ""}
          >
            {rows.map((_, i) => (
              <Cell
                key={`np-in-${i}`}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Pie
            {...pieAngleProps}
            data={rows}
            dataKey={outerDataKey}
            nameKey="segment"
            cx="50%"
            cy="50%"
            innerRadius={rOuterIn}
            outerRadius={rOuterOut}
            labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 0.5 }}
            label={
              isBrandPie
                ? (props: { payload?: NestedPieRingRow }) => {
                    const n = props.payload?.product_count;
                    return n != null && Number.isFinite(Number(n)) ? Number(n).toLocaleString("pt-BR") : "";
                  }
                : (props: { payload?: NestedPieRingRow }) => {
                    const v = props.payload?.stock_value;
                    return v != null && Number.isFinite(Number(v)) ? money(Number(v)) : "";
                  }
            }
          >
            {rows.map((_, i) => (
              <Cell
                key={`np-out-${i}`}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                stroke="hsl(var(--background))"
                strokeWidth={1}
              />
            ))}
          </Pie>
        </PieChart>
      ) : null}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex max-w-[28%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tabular-nums leading-tight text-foreground">
          {totalProdutosSum.toLocaleString("pt-BR")}
        </span>
        <span className="text-xs text-muted-foreground">produtos</span>
      </div>
    </div>
  );
}

function AutoCardChart({ card }: { card: AutoCard }) {
  if (card.chart_type === "error")
    return <p className="text-destructive text-sm">{card.error}</p>;

  if (card.chart_type === "metric") {
    return (
      <div className="flex flex-wrap gap-6 pt-2">
        {Object.entries(card.metric_values).map(([k, v]) => (
          <div key={k}>
            <p className="text-sm text-muted-foreground">{k}</p>
            <p className="text-2xl font-bold">{Number(v).toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>
    );
  }

  const scatterPrepared = useMemo(() => {
    if (card.chart_type !== "scatter") return null;
    const cov = resolveCategoryCoverageScatterKeys(card);
    if (cov) {
      const pts: { category: string; total_itens: number; itens_estoque_baixo: number }[] = [];
      for (const row of card.rows) {
        const category = String(row[cov.catKey] ?? "");
        const total_itens = Number(row[cov.totalKey]);
        const itens_estoque_baixo = Number(row[cov.lowItemsKey]);
        if (!Number.isFinite(total_itens) || !Number.isFinite(itens_estoque_baixo)) continue;
        pts.push({ category: category || "—", total_itens, itens_estoque_baixo });
      }
      return { variant: "category" as const, points: pts };
    }
    const keys = resolveScatterKeys(card);
    if (!keys) {
      return {
        error: "Não foi possível identificar colunas para o gráfico (categoria / totais ou nome / qtd / preço)." as const,
      };
    }
    const out: { name: string; price: number; quantity: number }[] = [];
    for (const row of card.rows) {
      const name = String(row[keys.nameKey] ?? "");
      const price = Number(row[keys.priceKey]);
      const quantity = Number(row[keys.qtyKey]);
      if (!Number.isFinite(price) || !Number.isFinite(quantity)) continue;
      out.push({ name: name || "—", price, quantity });
    }
    return { variant: "low_stock" as const, points: out };
  }, [card]);

  const comboCategoryRows = useMemo(() => {
    if (card.chart_type !== "combo_category_stock") return null;
    return buildComboCategoryStockRows(card);
  }, [card]);

  const salesRevenueMonthRows = useMemo(() => buildSalesRevenueMonthRows(card), [card]);

  const nestedPieRingRows = useMemo(() => {
    if (card.chart_type === "nested_pie_equal_category") return buildNestedPieRingRows(card, "category");
    if (card.chart_type === "nested_pie_equal_brand") return buildNestedPieRingRows(card, "brand");
    return null;
  }, [card]);

  const highValuesPieRows = useMemo(() => {
    if (card.chart_type !== "nested_pie_high_values") return null;
    const raw = buildHighValuesPieRows(card);
    if (!raw?.length) return null;
    return [...raw].sort((a, b) => b.preco - a.preco);
  }, [card]);

  /** Mesma ordem de linhas nos dois anéis (cores por índice). Em “por marca” os ângulos diferem entre anéis (métricas distintas). */
  const nestedPieSortedRows = useMemo(() => {
    if (!nestedPieRingRows?.length) return null;
    return [...nestedPieRingRows].sort((a, b) =>
      String(a.segment).localeCompare(String(b.segment), "pt-BR", { sensitivity: "base" }),
    );
  }, [nestedPieRingRows]);

  if (card.chart_type === "scatter") {
    if (!scatterPrepared || "error" in scatterPrepared) {
      return (
        <p className="text-destructive text-sm">
          {scatterPrepared && "error" in scatterPrepared ? scatterPrepared.error : "Sem dados para o gráfico."}
        </p>
      );
    }
    if (scatterPrepared.variant === "category") {
      const { points } = scatterPrepared;
      if (points.length === 0) {
        return <p className="text-muted-foreground text-sm">Sem dados.</p>;
      }
      const zMax = Math.max(...points.map((p) => p.itens_estoque_baixo), 1);
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, left: 8, bottom: 64 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 10 }}
              angle={-35}
              textAnchor="end"
              height={56}
              interval={0}
            />
            <YAxis
              dataKey="total_itens"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => Number(v).toLocaleString("pt-BR")}
              width={52}
            />
            <ZAxis type="number" dataKey="itens_estoque_baixo" range={[80, 400]} domain={[0, zMax]} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "total_itens" || name === "itens_estoque_baixo")
                  return Number(value).toLocaleString("pt-BR");
                return String(value);
              }}
              labelFormatter={() => ""}
            />
            <Scatter name="Categorias" data={points} fill="#16a34a" />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
    const { points } = scatterPrepared;
    if (points.length === 0) {
      return <p className="text-muted-foreground text-sm">Sem dados.</p>;
    }
    const qMax = Math.max(...points.map((p) => p.quantity), 1);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 8, bottom: 64 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10 }}
            angle={-35}
            textAnchor="end"
            height={56}
            interval={0}
          />
          <YAxis dataKey="price" tick={{ fontSize: 11 }} tickFormatter={(v) => money(Number(v))} width={72} />
          <ZAxis type="number" dataKey="quantity" range={[80, 400]} domain={[0, qMax]} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "price") return money(value);
              if (name === "quantity") return Number(value).toLocaleString("pt-BR");
              return String(value);
            }}
            labelFormatter={() => ""}
          />
          <Scatter name="Itens" data={points} fill="#6366f1" />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (card.chart_type === "nested_pie_high_values") {
    if (!highValuesPieRows?.length) {
      return (
        <p className="text-destructive text-sm">
          Não foi possível montar a pizza (nome do produto e preço) ou não há linhas.
        </p>
      );
    }
    return <NestedDoublePieHighValuesChart rows={highValuesPieRows} />;
  }

  if (card.chart_type === "nested_pie_equal_category" || card.chart_type === "nested_pie_equal_brand") {
    if (!nestedPieSortedRows?.length) {
      return (
        <p className="text-destructive text-sm">
          Não foi possível montar a pizza (dimensão, contagem de produtos, valor em estoque) ou não há linhas.
        </p>
      );
    }
    const isBrandPie = card.chart_type === "nested_pie_equal_brand";
    const totalProdutosSum = nestedPieSortedRows.reduce((s, r) => s + r.product_count, 0);
    const innerDataKey = (isBrandPie ? "stock_value" : "product_count") as "stock_value" | "product_count";
    const outerDataKey = "product_count" as const;
    return (
      <NestedDoublePieChart
        rows={nestedPieSortedRows}
        isBrandPie={isBrandPie}
        innerDataKey={innerDataKey}
        outerDataKey={outerDataKey}
        totalProdutosSum={totalProdutosSum}
      />
    );
  }

  if (card.chart_type === "combo_category_stock") {
    if (!comboCategoryRows?.length) {
      return (
        <p className="text-destructive text-sm">
          Não foi possível montar o gráfico (confira colunas categoria, total_produtos, total_unidades, valor_estoque) ou
          não há linhas.
        </p>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={comboCategoryRows} margin={{ top: 8, right: 8, left: 4, bottom: 56 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="categoria"
            tick={{ fontSize: 10 }}
            angle={-28}
            textAnchor="end"
            height={52}
            interval={0}
          />
          <YAxis
            yAxisId="count"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => Number(v).toLocaleString("pt-BR")}
            width={44}
            label={{ value: "product_count", angle: -90, position: "insideLeft", style: { fontSize: 10 } }}
          />
          <YAxis
            yAxisId="money"
            orientation="right"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => money(Number(v))}
            width={76}
            label={{ value: "stock_value", angle: 90, position: "insideRight", style: { fontSize: 10 } }}
          />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === "stock_value" ? money(value) : Number(value).toLocaleString("pt-BR")
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            yAxisId="count"
            dataKey="total_produtos"
            name="product_count"
            fill="#06b6d4"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="valor_estoque"
            name="stock_value"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const strCol = card.col_names[card.col_types.indexOf("string")] || card.col_names[0];
  const dateCol = card.col_names[card.col_types.indexOf("date")] || null;
  const numCols = card.col_names.filter((_, i) => card.col_types[i] === "number");
  const xKey = dateCol || strCol;

  if (card.chart_type === "line" || card.chart_type === "bar") {
    if (salesRevenueMonthRows?.length) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={salesRevenueMonthRows} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="sold"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => Number(v).toLocaleString("pt-BR")}
              width={48}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => money(Number(v))}
              width={76}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "receita_bruta" ? money(Number(value)) : Number(value).toLocaleString("pt-BR")
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="revenue"
              dataKey="receita_bruta"
              name="receita_bruta"
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Line
              yAxisId="sold"
              type="monotone"
              dataKey="produtos_vendidos"
              name="produtos_vendidos"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={card.rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          {numCols.map((col, i) => (
            <Bar key={col} dataKey={col} fill={PIE_COLORS[i % PIE_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // table
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {card.col_names.map((c) => <TableHead key={c}>{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {card.rows.slice(0, 50).map((row, ri) => (
            <TableRow key={ri}>
              {card.col_names.map((c, ci) => (
                <TableCell key={c}>{fmt(row[c], card.col_types[ci])}</TableCell>
              ))}
            </TableRow>
          ))}
          {card.rows.length === 0 && (
            <TableRow><TableCell colSpan={card.col_names.length} className="text-muted-foreground">Sem dados.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function MetabaseReports() {
  const [autoCards, setAutoCards] = useState<AutoCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const { topSummaryCards, gridCards } = useMemo(() => partitionReportCards(autoCards), [autoCards]);

  const metabaseUrl =
    (import.meta.env.VITE_METABASE_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:3000";
  const metabaseCollection = (import.meta.env.VITE_METABASE_COLLECTION as string | undefined)?.trim();

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setCardsLoading(true);
        setCardsError(null);
        const query = metabaseCollection ? `?collection=${encodeURIComponent(metabaseCollection)}` : "";
        const r = await fetch(`${API_BASE}/metabase/collection-cards/${query}`);
        const json = await r.json();
        if (!r.ok) {
          if (!cancel) setCardsError(json?.error || `API ${r.status}`);
          return;
        }
        if (!cancel) setAutoCards(Array.isArray(json?.cards) ? json.cards : []);
      } catch {
        if (!cancel) setCardsError("Falha ao carregar cards do Metabase.");
      } finally {
        if (!cancel) setCardsLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [metabaseCollection]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Análises</h1>
            <Badge className="bg-blue-600 hover:bg-blue-600">Fonte: Metabase</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/">Voltar</Link></Button>
            <Button variant="outline" asChild>
              <a href={metabaseUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />Metabase
              </a>
            </Button>
          </div>
        </div>

        {!cardsLoading && !cardsError && topSummaryCards.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {topSummaryCards.map((card) => (
              <Card key={`top-${card.id}`}>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-base">{card.name}</CardTitle>
                  {card.description ? (
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <SummaryTextCardContent card={card} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div>
          <h2 className="mb-4 text-xl font-semibold">
            Cards da collection
            {!cardsLoading && !cardsError && autoCards.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({gridCards.length} na grelha
                {topSummaryCards.length > 0 ? ` · ${topSummaryCards.length} resumo no topo` : ""})
              </span>
            )}
          </h2>

          {cardsLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando cards do Metabase...
            </div>
          )}
          {cardsError && (
            <Card><CardContent className="pt-4 text-destructive">{cardsError}</CardContent></Card>
          )}
          {!cardsLoading && !cardsError && autoCards.length === 0 && (
            <Card>
              <CardContent className="pt-4 text-muted-foreground">
                Nenhum card encontrado. Defina <code>METABASE_COLLECTION_NAME</code> no <code>backend/.env</code>.
              </CardContent>
            </Card>
          )}
          {!cardsLoading && !cardsError && gridCards.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              {gridCards.map((card) => (
                <Card key={`auto-${card.id}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{card.name}</CardTitle>
                    {card.description && (
                      <p className="text-sm text-muted-foreground">{card.description}</p>
                    )}
                  </CardHeader>
                  <CardContent
                    className={
                      card.chart_type === "table" || card.chart_type === "metric"
                        ? ""
                        : card.chart_type === "combo_category_stock"
                          ? "min-h-[380px] h-[400px]"
                          : card.chart_type === "nested_pie_equal_category"
                            || card.chart_type === "nested_pie_equal_brand"
                            || card.chart_type === "nested_pie_high_values"
                          ? "min-h-[380px] h-[400px]"
                          : "h-[300px]"
                    }
                  >
                    <AutoCardChart card={card} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!cardsLoading && !cardsError && autoCards.length > 0 && gridCards.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">
              Não há mais cards na grelha; os desta collection estão como resumo no topo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
