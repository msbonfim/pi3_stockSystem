import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Calendar, Package, LogIn, Search, Filter, TrendingUp, Clock, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Product, CreateProductRequest } from "@/services/api";

// This should point to your backend. Remember to change it back to the Render URL before deploying.
// Detecta automaticamente se está em localhost
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? "http://localhost:8000/api"
  : "https://pi2-stocksystem-backend.onrender.com/api");

export function InventoryDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState({
    total_products: 0,
    expired_products: 0,
    critical_products: 0,
    expiring_soon: 0,
    good_products: 0,
    no_expiry_products: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<Partial<CreateProductRequest>>({});

  const [activeFilter, setActiveFilter] = useState('total');

  const processProductData = (productsData: any[]) => {
    return productsData.map(product => ({
      ...product,
      price: Number(product.price) || 0,
      quantity: Number(product.quantity) || 0,
      expiration_date: product.expiration_date,
      category_name: product.category_name || 'Sem categoria'
    }));
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const productsResponse = await fetch(`${API_BASE_URL}/products/`);
      if (!productsResponse.ok) throw new Error(`Falha ao carregar produtos: ${productsResponse.status}`);
      
      const productsData = await productsResponse.json();
      const productList = productsData.results || productsData;
      const processedProducts = processProductData(productList);
      setProducts(processedProducts);

      const statsResponse = await fetch(`${API_BASE_URL}/dashboard/stats/`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const noExpiryCount = processedProducts.filter(p => !p.expiration_date).length;
        setStats({ ...statsData, no_expiry_products: noExpiryCount });
      } else {
        console.error('Endpoint de estatísticas não encontrado.');
      }
    } catch (err: any) {
      setError('Erro ao carregar dados. Verifique se o backend está rodando.');
      console.error('Erro geral:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getExpiryStatus = (expirationDate: string | null | undefined) => {
    if (!expirationDate) {
      return 'no_expiry';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expirationDate + 'T00:00:00');
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'critical';
    if (diffDays <= 7) return 'warning';
    return 'good';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'bg-gradient-purple shadow-purple border-purple';
      case 'critical': return 'bg-gradient-danger shadow-danger border-danger';
      case 'warning': return 'bg-gradient-warning shadow-alert border-warning';
      case 'good': return 'bg-gradient-success shadow-success border-success';
      case 'no_expiry': return 'bg-gradient-to-br from-gray-600 to-gray-800 shadow-gray-800/50 border-gray-600';
      default: return 'bg-card';
    }
  };

  const getStatusBadge = (status: string, days: number) => {
    switch (status) {
      case 'expired': return <Badge className="bg-purple-800 text-white border-purple-900">Vencido</Badge>;
      case 'critical': return <Badge variant="destructive">{days} dia{days !== 1 ? 's' : ''}</Badge>;
      case 'warning': return <Badge className="bg-warning text-warning-foreground">{days} dias</Badge>;
      case 'good': return <Badge className="bg-success text-success-foreground">{days}+ dias</Badge>;
      case 'no_expiry': return <Badge variant="secondary">N/A</Badge>;
      default: return null;
    }
  };

  const filteredProducts = useMemo(() => {
    const statusFiltered = products.filter(product => {
        if (activeFilter === 'total') return true;
        
        const status = getExpiryStatus(product.expiration_date);

        if (activeFilter === 'good') {
            return status === 'good';
        }
        if (activeFilter === 'no_expiry') {
            return status === 'no_expiry';
        }
        
        const filterMap: { [key: string]: string } = {
            'expired': 'expired',
            'critical': 'critical',
            'warning': 'warning'
        };
        return status === filterMap[activeFilter];
    });

    return statusFiltered.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === "" || product.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory, activeFilter]);

  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.category_name).filter(Boolean))];
  }, [products]);

  const handleAddProduct = async () => { 
    // This function is defined but not currently used since the "Add Product" button is commented out.
    // If you add the button back, this is where its logic goes.
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sistema de Estoque</h1>
            <p className="text-muted-foreground">Controle de validade e gestão de produtos</p>
          </div>
          
          <a href="https://pi2-stocksystem-backend.onrender.com/admin/" target="_blank" rel="noopener noreferrer">
            <Button className="bg-gradient-primary shadow-lg">
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Button>
          </a>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card 
            className={cn("shadow-card cursor-pointer transition-all", activeFilter === 'total' && "ring-2 ring-primary")}
            onClick={() => setActiveFilter('total')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats.total_products}</div>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer transition-all border-l-4 border-l-purple", activeFilter === 'expired' && "ring-2 ring-purple")}
            onClick={() => setActiveFilter('expired')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-purple" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple">{isLoading ? "..." : stats.expired_products}</div>
              <p className="text-xs text-muted-foreground">Atenção imediata</p>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer transition-all border-l-4 border-l-danger", activeFilter === 'critical' && "ring-2 ring-danger")}
            onClick={() => setActiveFilter('critical')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Críticos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-danger" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-danger">{isLoading ? "..." : stats.critical_products}</div>
              <p className="text-xs text-muted-foreground">0-3 dias</p>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer transition-all border-l-4 border-l-warning", activeFilter === 'warning' && "ring-2 ring-warning")}
            onClick={() => setActiveFilter('warning')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencendo em Breve</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{isLoading ? "..." : stats.expiring_soon}</div>
              <p className="text-xs text-muted-foreground">4-7 dias</p>
            </CardContent>
          </Card>

          <Card 
            className={cn("shadow-card cursor-pointer transition-all border-l-4 border-l-success", activeFilter === 'good' && "ring-2 ring-success")}
            onClick={() => setActiveFilter('good')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Bom Estado</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{isLoading ? "..." : stats.good_products}</div>
              <p className="text-xs text-muted-foreground">Mais de 7 dias</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn("shadow-card cursor-pointer transition-all border-l-4 border-l-secondary", activeFilter === 'no_expiry' && "ring-2 ring-secondary-foreground")}
            onClick={() => setActiveFilter('no_expiry')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sem Validade</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "..." : stats.no_expiry_products}</div>
              <p className="text-xs text-muted-foreground">Não perecíveis</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className="sr-only">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="md:w-48">
                <Label htmlFor="category" className="sr-only">Categoria</Label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Carregando produtos...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
            <Button onClick={loadData} className="mt-4">Tentar Novamente</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => {
              const status = getExpiryStatus(product.expiration_date);
              let daysUntilExpiry = 0;
              if (product.expiration_date) {
                const expiryDate = new Date(product.expiration_date + 'T00:00:00');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              }
              
              return (
                <Card key={product.id} className={cn("shadow-card transition-all hover:scale-105", getStatusColor(status))}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg text-white">{product.name}</CardTitle>
                        <CardDescription className="text-white/80">{product.category_name || 'Sem categoria'}</CardDescription>
                      </div>
                      {getStatusBadge(status, Math.abs(daysUntilExpiry))}
                    </div>
                  </CardHeader>
                  <CardContent className="text-white/90">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Quantidade:</span>
                        <span className="font-semibold">{product.quantity || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Preço:</span>
                        <span className="font-semibold">R$ {product.price.toFixed(2)}</span>
                      </div>
                      {product.expiration_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Validade:</span>
                          <span className="font-semibold flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(product.expiration_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      {product.batch && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Lote:</span>
                          <span className="font-semibold">{product.batch}</span>
                        </div>
                      )}
                      {product.description && (
                        <p className="text-sm text-white/70 mt-3">{product.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}