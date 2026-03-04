import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus } from "lucide-react";

export function SimpleDashboard() {
  const [products, setProducts] = useState([
    { id: 1, name: "Produto Teste", quantity: 10, expiryDate: "2024-12-31" }
  ]);
  
  // State for the new product form
  const [newProduct, setNewProduct] = useState({ name: "", quantity: "" });

  const handleAddProduct = () => {
    const quantityNum = Number(newProduct.quantity);
    // Ensure name is not empty and quantity is a valid number greater than 0
    if (newProduct.name && !isNaN(quantityNum) && quantityNum > 0) {
      setProducts([
        ...products,
        {
          id: products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1, // Safer ID generation
          name: newProduct.name,
          quantity: quantityNum,
          expiryDate: "2024-12-31" // Example date
        }
      ]);
      // Reset the form
      setNewProduct({ name: "", quantity: "" });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sistema de Estoque</h1>
            <p className="text-muted-foreground">Controle de validade e gestão de produtos</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Add Product Form */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Adicionar Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Produto</Label>
                <Input
                  id="name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Ex: Leite Integral"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={newProduct.quantity}
                  onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                  placeholder="Ex: 25"
                />
              </div>
              {/* Corrected the button to match its function */}
              <Button onClick={handleAddProduct} className="bg-gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Produto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Products List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Quantidade:</span>
                    <span className="font-semibold">{product.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Validade:</span>
                    <span className="font-semibold">{product.expiryDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}