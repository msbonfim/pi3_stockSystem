import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
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
  const [autoCards, setAutoCards] = useState<AutoCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState<string | null>(null);

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
      </div>
    </div>
  );
}
