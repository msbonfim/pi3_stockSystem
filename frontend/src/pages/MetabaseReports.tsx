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
import type { AutoCard, NestedPieHighValueRow, NestedPieRingRow } from "./metabaseReports.logic";
import {
  buildComboCategoryStockRows,
  buildHighValuesPieRows,
  buildNestedPieRingRows,
  buildSalesRevenueMonthRows,
  partitionReportCards,
  resolveCategoryCoverageScatterKeys,
  resolveScatterKeys,
} from "./metabaseReports.logic";

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "https://pi2-stocksystem-backend.onrender.com/api";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v: unknown, colType?: string) => {
  if (v === null || v === undefined) return "—";
  if (colType === "number") return Number(v).toLocaleString("pt-BR");
  return String(v);
};

/** snake_case / chaves SQL → texto legível nos cards de resumo (topo). */
function humanizeFieldLabel(name: string): string {
  return String(name).replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

const PIE_COLORS = ["#6366f1", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#84cc16", "#f97316"];

/** 120 matizes ~3° aparte — base antes do deslocamento áureo por índice. */
const HUE_RING: readonly number[] = Array.from({ length: 120 }, (_, i) =>
  Math.round((i * 360) / 120) % 360,
);

const GOLDEN_ANGLE_DEG = 137.50776405003785;

function hashSegmentKey(segment: string, index: number): number {
  const s = `${index}\0${segment}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Cor estável por (segmento, índice): matiz bem espalhada + sat/luz que mudam com índice
 * (menos colisões visuais que só `hash % 360`).
 */
function pieSegmentColor(segment: string, index: number): string {
  const hi = hashSegmentKey(segment, index);
  const ring = HUE_RING[hi % HUE_RING.length];
  const hue = (ring + index * GOLDEN_ANGLE_DEG + (hi % 23) * 3.7) % 360;
  const sat = 46 + ((hi >>> 4) % 28) + (index % 6) * 4;
  const light = 32 + ((hi >>> 9) % 14) + (index % 7) * 3;
  const sSat = Math.min(90, Math.max(44, sat));
  const sLight = Math.min(62, Math.max(28, light));
  return `hsl(${hue.toFixed(1)} ${sSat}% ${sLight}%)`;
}

/** Legenda com quadrados alinhados às cores dos segmentos das pizzas. */
function PieSegmentsLegend({ segments }: { segments: string[] }) {
  if (!segments.length) return null;
  const MAX = 48;
  const shown = segments.slice(0, MAX);
  const rest = segments.length - MAX;
  return (
    <ul className="flex max-h-[9.5rem] shrink-0 flex-wrap gap-x-3 gap-y-1.5 overflow-y-auto rounded-md border border-border/50 bg-muted/20 px-2 py-2 text-xs">
      {shown.map((seg, i) => (
        <li key={`${i}-${seg}`} className="flex max-w-[200px] items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-[2px] border border-border/60 shadow-sm"
            style={{ backgroundColor: pieSegmentColor(seg, i) }}
            aria-hidden
          />
          <span className="truncate text-muted-foreground" title={seg}>
            {seg || "—"}
          </span>
        </li>
      ))}
      {rest > 0 ? <li className="text-muted-foreground">+{rest} …</li> : null}
    </ul>
  );
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
            <dt className="text-muted-foreground" title={k}>
              {humanizeFieldLabel(k)}
            </dt>
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
                <dt className="text-muted-foreground" title={col}>
                  {humanizeFieldLabel(col)}
                </dt>
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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
      <div ref={wrapRef} className="relative min-h-[160px] w-full flex-1 overflow-hidden">
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
              {rows.map((row, i) => (
                <Cell
                  key={`hv-in-${i}`}
                  fill={pieSegmentColor(String(row.segment ?? ""), i)}
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
              {rows.map((row, i) => (
                <Cell
                  key={`hv-out-${i}`}
                  fill={pieSegmentColor(String(row.segment ?? ""), i)}
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
      <PieSegmentsLegend segments={rows.map((r) => String(r.segment ?? ""))} />
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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
      <div ref={wrapRef} className="relative min-h-[160px] w-full flex-1 overflow-hidden">
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
              {rows.map((row, i) => (
                <Cell
                  key={`np-in-${i}`}
                  fill={pieSegmentColor(String(row.segment ?? ""), i)}
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
              {rows.map((row, i) => (
                <Cell
                  key={`np-out-${i}`}
                  fill={pieSegmentColor(String(row.segment ?? ""), i)}
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
      <PieSegmentsLegend segments={rows.map((r) => String(r.segment ?? ""))} />
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
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              iconType="circle"
              formatter={(value) => <span className="text-foreground">{value}</span>}
            />
            <Scatter name="Total × estoque baixo (tamanho)" data={points} fill="#16a34a" />
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
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            iconType="circle"
            formatter={(value) => <span className="text-foreground">{value}</span>}
          />
          <Scatter name="Preço × quantidade (tamanho)" data={points} fill="#6366f1" />
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
              name === "stock_value" || name === "Valor em estoque (R$)" ? money(value) : Number(value).toLocaleString("pt-BR")
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="rect"
            formatter={(value) => <span className="text-foreground">{value}</span>}
          />
          <Bar
            yAxisId="count"
            dataKey="total_produtos"
            name="Produtos (contagem)"
            fill="#06b6d4"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Line
            yAxisId="money"
            type="monotone"
            dataKey="valor_estoque"
            name="Valor em estoque (R$)"
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
                name === "receita_bruta" || name === "Receita bruta"
                  ? money(Number(value))
                  : Number(value).toLocaleString("pt-BR")
              }
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="rect"
              formatter={(value) => <span className="text-foreground">{value}</span>}
            />
            <Bar
              yAxisId="revenue"
              dataKey="receita_bruta"
              name="Receita bruta"
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Line
              yAxisId="sold"
              type="monotone"
              dataKey="produtos_vendidos"
              name="Produtos vendidos"
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
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="square"
            formatter={(value) => <span className="text-foreground">{value}</span>}
          />
          {numCols.map((col, i) => (
            <Bar
              key={col}
              dataKey={col}
              name={col}
              fill={PIE_COLORS[i % PIE_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
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
            <div className="grid gap-4 lg:grid-cols-3">
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
                          ? "flex h-[min(520px,calc(100vh-14rem))] min-h-[420px] max-h-[560px] flex-col overflow-hidden"
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
