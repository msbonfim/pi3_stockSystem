import { useEffect, useMemo, useState } from "react";
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
    | "nested_pie_equal_category";
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

/** Card só “POR CATEGORIA”: pizza dupla; ângulo das fatias ∝ product_count (como no Metabase); rótulo externo = valor estoque. */
type NestedPieCategoryRow = {
  categoria: string;
  product_count: number;
  stock_value: number;
};

function resolveNestedPieByCategoryKeys(
  card: AutoCard,
): { catKey: string; countKey: string; valueKey: string } | null {
  const { col_names: names, col_types: types } = card;
  if (!names.length) return null;

  let catKey = "";
  for (let i = 0; i < names.length; i++) {
    if (types[i] !== "string") continue;
    const n = norm(names[i]);
    if (n.includes("categoria") || n.includes("category") || n === "name" || n.includes("nome")) {
      catKey = names[i];
      break;
    }
  }
  if (!catKey) {
    const idx = types.indexOf("string");
    if (idx >= 0) catKey = names[idx];
  }
  if (!catKey) return null;

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
    if (title.includes("por categoria") && !title.includes("estoque") && numCols.length >= 2) {
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
  return { catKey, countKey, valueKey };
}

function buildNestedPieByCategoryRows(card: AutoCard): NestedPieCategoryRow[] | null {
  const keys = resolveNestedPieByCategoryKeys(card);
  if (!keys) return null;
  const out: NestedPieCategoryRow[] = [];
  for (const row of card.rows) {
    const categoria = String(row[keys.catKey] ?? "");
    const product_count = Number(row[keys.countKey]);
    const stock_value = Number(row[keys.valueKey]);
    if (!Number.isFinite(product_count) || !Number.isFinite(stock_value)) continue;
    out.push({
      categoria: categoria || "—",
      product_count,
      stock_value,
    });
  }
  return out.length ? out : null;
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

  const nestedPieCategoryRows = useMemo(() => {
    if (card.chart_type !== "nested_pie_equal_category") return null;
    return buildNestedPieByCategoryRows(card);
  }, [card]);

  /** Ordem idêntica nos dois anéis; Recharts usa a ordem do array para desenhar setores. */
  const nestedPieSortedRows = useMemo(() => {
    if (!nestedPieCategoryRows?.length) return null;
    return [...nestedPieCategoryRows].sort((a, b) =>
      String(a.categoria).localeCompare(String(b.categoria), "pt-BR", { sensitivity: "base" }),
    );
  }, [nestedPieCategoryRows]);

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

  if (card.chart_type === "nested_pie_equal_category") {
    if (!nestedPieSortedRows?.length) {
      return (
        <p className="text-destructive text-sm">
          Não foi possível montar a pizza (categoria, contagem de produtos, valor em estoque) ou não há linhas.
        </p>
      );
    }
    const totalProdutosSum = nestedPieSortedRows.reduce((s, r) => s + r.product_count, 0);
    const truncateCat = (s: string, max = 14) => {
      const t = String(s);
      return t.length > max ? `${t.slice(0, max)}…` : t;
    };
    /* Ambos os anéis usam product_count no arco para alinhar fatias; proporção = qtd produtos por categoria. */
    const pieAngleProps = { startAngle: 90, endAngle: 450, paddingAngle: 0, minAngle: 0, isAnimationActive: false };
    return (
      <div className="relative h-full min-h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as NestedPieCategoryRow;
                const cat = row.categoria ?? String(payload[0].name ?? "");
                return (
                  <div className="rounded-md border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                    <p className="font-medium text-foreground">{cat}</p>
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
              data={nestedPieSortedRows}
              dataKey="product_count"
              nameKey="categoria"
              cx="50%"
              cy="50%"
              innerRadius="26%"
              outerRadius="44%"
              labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 0.5 }}
              label={({ name }: { name?: string }) => truncateCat(String(name ?? ""))}
            >
              {nestedPieSortedRows.map((_, i) => (
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
              data={nestedPieSortedRows}
              dataKey="product_count"
              nameKey="categoria"
              cx="50%"
              cy="50%"
              innerRadius="47%"
              outerRadius="70%"
              labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 0.5 }}
              label={(props: { payload?: NestedPieCategoryRow }) => {
                const v = props.payload?.stock_value;
                return v != null && Number.isFinite(Number(v)) ? money(Number(v)) : "";
              }}
            >
              {nestedPieSortedRows.map((_, i) => (
                <Cell
                  key={`np-out-${i}`}
                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                  fillOpacity={0.85}
                  stroke="hsl(var(--background))"
                  strokeWidth={1}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex max-w-[28%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums leading-tight text-foreground">
            {totalProdutosSum.toLocaleString("pt-BR")}
          </span>
          <span className="text-xs text-muted-foreground">produtos</span>
        </div>
      </div>
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
