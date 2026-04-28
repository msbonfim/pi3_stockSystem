import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

type AnalyticsMeta = { source?: string; reason?: string; hint?: string; missing?: string[] };
type Payload = {
  overview: { total_products: number; total_units: number; total_stock_value: number };
  by_category: { name: string; stock_value: number }[];
  by_brand: { name: string; stock_value: number }[];
  low_stock: { id: number; name: string; quantity: number; price: number; category: string | null }[];
  top_by_stock_value: { id: number; name: string; line_value: number }[];
  expiration: { expired_count: number; next_7_days_count: number; next_30_days_count: number };
  sales_monthly: { month: string; products_sold: number; gross_revenue: number }[];
  _meta?: AnalyticsMeta;
};

type AutoCard = {
  id: number;
  name: string;
  description?: string;
  chart_type: "bar" | "line" | "metric" | "table" | "error";
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

const BRAND_BAR_TOP = 12;
function brandBarsForChart(rows: { name: string; stock_value: number }[]) {
  const sorted = [...rows].sort((a, b) => b.stock_value - a.stock_value);
  if (sorted.length <= BRAND_BAR_TOP) return sorted;
  const head = sorted.slice(0, BRAND_BAR_TOP);
  const tail = sorted.slice(BRAND_BAR_TOP);
  const others = tail.reduce((s, r) => s + r.stock_value, 0);
  return [...head, { name: `Outros (${tail.length} marcas)`, stock_value: others }];
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
  const [data, setData] = useState<Payload | null>(null);
  const [autoCards, setAutoCards] = useState<AutoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);

  const metabaseUrl =
    (import.meta.env.VITE_METABASE_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:3000";
  const metabaseCollection = (import.meta.env.VITE_METABASE_COLLECTION as string | undefined)?.trim();

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`${API_BASE}/metabase/analytics/?low_stock_max=5`);
        const json = (await r.json()) as Payload;
        if (!cancel) setData(json);
        if (!r.ok && !cancel) setError((json as any)?.error || `API ${r.status}`);
      } catch {
        if (!cancel) setError("Falha ao carregar análises.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

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

  const brandChartRows = useMemo(() => (data ? brandBarsForChart(data.by_brand) : []), [data]);

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

        {data?._meta?.source !== "metabase" && (
          <Card className="border-amber-500/50">
            <CardContent className="pt-4 text-amber-700 dark:text-amber-400">
              Ainda não está usando os cards do Metabase. {data?._meta?.hint}
              {data?._meta?.missing?.length ? ` Faltando: ${data._meta.missing.join(", ")}` : ""}
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" /> Carregando...
          </div>
        )}
        {error && <Card><CardContent className="pt-6 text-destructive">{error}</CardContent></Card>}

        {!loading && data && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardHeader><CardTitle>Total produtos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.overview.total_products}</CardContent></Card>
              <Card><CardHeader><CardTitle>Unidades</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data.overview.total_units}</CardContent></Card>
              <Card><CardHeader><CardTitle>Valor estoque</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(data.overview.total_stock_value)}</CardContent></Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Por categoria</CardTitle></CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip formatter={(v: number) => money(v)} />
                      <Pie data={data.by_category} dataKey="stock_value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                        {data.by_category.map((_, i) => (
                          <Cell key={`cat-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Por marca</CardTitle>
                  <p className="text-sm font-normal text-muted-foreground">Top {BRAND_BAR_TOP} + outros agrupados</p>
                </CardHeader>
                <CardContent className="min-h-[280px]" style={{ height: Math.min(520, Math.max(280, brandChartRows.length * 36 + 72)) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={brandChartRows} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                      <XAxis type="number" tickFormatter={(v) => typeof v === "number" && v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11 }} interval={0} />
                      <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => String(l)} />
                      <Bar dataKey="stock_value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Produtos vendidos no mês vs receita bruta</CardTitle></CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.sales_monthly || []} margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="qtd" width={44} />
                      <YAxis yAxisId="money" orientation="right" tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} width={56} />
                      <Tooltip formatter={(v: number, name: string) => name === "Receita bruta" ? money(v) : Number(v).toLocaleString("pt-BR")} />
                      <Bar yAxisId="qtd" dataKey="products_sold" name="Produtos vendidos" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Line yAxisId="money" type="monotone" dataKey="gross_revenue" name="Receita bruta" stroke="#16a34a" strokeWidth={2} dot />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Top valor em estoque</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.top_by_stock_value.map((r) => (
                        <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell className="text-right">{money(r.line_value)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Estoque baixo</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Categoria</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.low_stock.map((r) => (
                        <TableRow key={r.id}><TableCell>{r.name}</TableCell><TableCell>{r.category ?? "—"}</TableCell><TableCell className="text-right">{r.quantity}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Cards automáticos da collection do Metabase */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">
                Cards da collection
                {!cardsLoading && !cardsError && autoCards.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({autoCards.length} cards)</span>
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
              {!cardsLoading && !cardsError && autoCards.length > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  {autoCards.map((card) => (
                    <Card key={`auto-${card.id}`}>
                      <CardHeader>
                        <CardTitle className="text-base">{card.name}</CardTitle>
                        {card.description && (
                          <p className="text-sm text-muted-foreground">{card.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className={card.chart_type === "table" || card.chart_type === "metric" ? "" : "h-[300px]"}>
                        <AutoCardChart card={card} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
