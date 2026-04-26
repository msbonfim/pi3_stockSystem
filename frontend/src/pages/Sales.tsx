import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "https://pi2-stocksystem-backend.onrender.com/api";

type Product = {
  id: number;
  name: string;
  quantity: number;
  price: number | string;
};

type SaleItem = {
  id: number;
  product: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Sale = {
  id: number;
  sold_at: string;
  gross_revenue: number;
  notes?: string | null;
  items: SaleItem[];
};

type DraftItem = {
  productId: string;
  quantity: string;
  unitPrice: string;
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<DraftItem[]>([{ productId: "", quantity: "1", unitPrice: "" }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsById = useMemo(
    () => new Map(products.map((p) => [String(p.id), { ...p, price: Number(p.price) || 0 }])),
    [products],
  );

  const totalDraft = useMemo(
    () =>
      items.reduce((sum, i) => {
        const q = Number(i.quantity) || 0;
        const p = Number(i.unitPrice) || 0;
        return sum + q * p;
      }, 0),
    [items],
  );

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, salesRes] = await Promise.all([fetch(`${API_BASE}/products/`), fetch(`${API_BASE}/sales/`)]);
      const productsJson = await productsRes.json();
      const salesJson = await salesRes.json();
      const productRows = productsJson?.results || productsJson;
      setProducts(Array.isArray(productRows) ? productRows : []);
      setSales(Array.isArray(salesJson) ? salesJson : []);
    } catch {
      setError("Não foi possível carregar vendas e produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function onProductChange(index: number, productId: string) {
    const selected = productsById.get(productId);
    updateItem(index, {
      productId,
      unitPrice: selected ? String(selected.price) : "",
    });
  }

  function addLine() {
    setItems((prev) => [...prev, { productId: "", quantity: "1", unitPrice: "" }]);
  }

  function removeLine(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function saveSale() {
    const parsedItems = items
      .map((i) => ({
        product: Number(i.productId),
        quantity: Number(i.quantity),
        unit_price: Number(i.unitPrice),
      }))
      .filter((i) => i.product > 0 && i.quantity > 0 && i.unit_price >= 0);

    if (!parsedItems.length) {
      setError("Adicione ao menos um item válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sales/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null, items: parsedItems }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.items?.[0] || json?.error || `Falha ao salvar venda (${res.status}).`);
        return;
      }

      setItems([{ productId: "", quantity: "1", unitPrice: "" }]);
      setNotes("");
      await loadAll();
    } catch {
      setError("Erro de rede ao salvar venda.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelSale(saleId: number) {
    if (!window.confirm("Estornar esta venda? O estoque será devolvido.")) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sales/${saleId}/`, { method: "DELETE" });
      if (!res.ok) {
        setError("Não foi possível estornar a venda.");
        return;
      }
      await loadAll();
    } catch {
      setError("Erro de rede ao estornar venda.");
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendas</h1>
            <p className="text-muted-foreground">Lance vendas com baixa automática de estoque.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/">Estoque</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/relatorios">Análises</Link>
            </Button>
          </div>
        </div>

        {error && (
          <Card>
            <CardContent className="pt-4 text-destructive">{error}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Nova venda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((row, i) => {
              const selected = productsById.get(row.productId);
              const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
              return (
                <div key={`line-${i}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-12">
                  <div className="md:col-span-5">
                    <Label>Produto</Label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={row.productId}
                      onChange={(e) => onProductChange(i, e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {selected && (
                      <p className="mt-1 text-xs text-muted-foreground">Estoque atual: {selected.quantity}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Qtd</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Preço unit.</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.unitPrice}
                      onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Total item</Label>
                    <Input value={money(lineTotal)} disabled />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button variant="ghost" onClick={() => removeLine(i)} className="w-full" disabled={items.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={addLine}>
                Adicionar item
              </Button>
              <div className="text-lg font-semibold">Total da venda: {money(totalDraft)}</div>
            </div>

            <div>
              <Label>Observações</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>

            <Button onClick={saveSale} disabled={saving}>
              {saving ? "Salvando..." : "Registrar venda"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendas recentes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>#{s.id}</TableCell>
                      <TableCell>{new Date(s.sold_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        {s.items.slice(0, 2).map((it) => `${it.product_name} x${it.quantity}`).join(", ")}
                        {s.items.length > 2 ? ` +${s.items.length - 2}` : ""}
                      </TableCell>
                      <TableCell className="text-right">{money(Number(s.gross_revenue) || 0)}</TableCell>
                      <TableCell>
                        <Button variant="destructive" size="sm" onClick={() => cancelSale(s.id)}>
                          Estornar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!sales.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Nenhuma venda registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
