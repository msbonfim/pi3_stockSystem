import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
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
  _meta?: AnalyticsMeta;
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PIE_COLORS = ["#6366f1", "#16a34a", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#84cc16", "#f97316"];

/** Barras horizontais: muitas marcas ficam ilegíveis na pizza; top N + "Outros". */
const BRAND_BAR_TOP = 12;
function brandBarsForChart(rows: { name: string; stock_value: number }[]) {
  const sorted = [...rows].sort((a, b) => b.stock_value - a.stock_value);
  if (sorted.length <= BRAND_BAR_TOP) return sorted;
  const head = sorted.slice(0, BRAND_BAR_TOP);
  const tail = sorted.slice(BRAND_BAR_TOP);
  const others = tail.reduce((s, r) => s + r.stock_value, 0);
  return [...head, { name: `Outros (${tail.length} marcas)`, stock_value: others }];
}

export default function MetabaseReports() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const metabaseUrl =
    (import.meta.env.VITE_METABASE_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:3000";

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
    return () => {
      cancel = true;
    };
  }, []);

  const brandChartRows = useMemo(() => (data ? brandBarsForChart(data.by_brand) : []), [data]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">Análises no Frontend</h1>
            <Badge className="bg-blue-600 hover:bg-blue-600">Fonte: Metabase</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/">Voltar</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={metabaseUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Metabase
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
              <Card><CardHeader><CardTitle>Total produtos</CardTitle></CardHeader><CardContent>{data.overview.total_products}</CardContent></Card>
              <Card><CardHeader><CardTitle>Unidades</CardTitle></CardHeader><CardContent>{data.overview.total_units}</CardContent></Card>
              <Card><CardHeader><CardTitle>Valor estoque</CardTitle></CardHeader><CardContent>{money(data.overview.total_stock_value)}</CardContent></Card>
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
                  <p className="text-sm font-normal text-muted-foreground">
                    Barras horizontais (top {BRAND_BAR_TOP} + outros agrupados)
                  </p>
                </CardHeader>
                <CardContent
                  className="min-h-[280px]"
                  style={{
                    height: Math.min(520, Math.max(280, brandChartRows.length * 36 + 72)),
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={brandChartRows}
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(v) =>
                          typeof v === "number" && v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : typeof v === "number" && v >= 1000
                              ? `${(v / 1000).toFixed(0)}k`
                              : String(v)
                        }
                        fontSize={11}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={112}
                        tick={{ fontSize: 11 }}
                        interval={0}
                      />
                      <Tooltip formatter={(v: number) => money(v)} labelFormatter={(l) => String(l)} />
                      <Bar dataKey="stock_value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Top valor</CardTitle></CardHeader>
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
          </>
        )}
      </div>
    </div>
  );
}
