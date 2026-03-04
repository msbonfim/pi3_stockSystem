import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, Product, CreateProductRequest, DashboardStats } from '@/services/api';
import { toast } from '@/components/ui/use-toast';

// Query keys
const QUERY_KEYS = {
  products: ['products'] as const,
  product: (id: number) => ['products', id] as const,
  expiringProducts: (days: number) => ['products', 'expiring', days] as const,
  expiredProducts: ['products', 'expired'] as const,
  dashboardStats: ['dashboard', 'stats'] as const,
};

// Products list hook
export const useProducts = () => {
  return useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: apiService.getProducts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Single product hook
export const useProduct = (id: number) => {
  return useQuery({
    queryKey: QUERY_KEYS.product(id),
    queryFn: () => apiService.getProduct(id),
    enabled: !!id,
  });
};

// Expiring products hook
export const useExpiringProducts = () => {
  return useQuery({
    queryKey: QUERY_KEYS.expiringProducts(30),
    queryFn: () => apiService.getExpiringProducts(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Expired products hook
export const useExpiredProducts = () => {
  return useQuery({
    queryKey: QUERY_KEYS.expiredProducts,
    queryFn: apiService.getExpiredProducts,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Dashboard stats hook
export const useDashboardStats = () => {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardStats,
    queryFn: () => apiService.getDashboardStats(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Create product mutation
export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (product: CreateProductRequest) => apiService.createProduct(product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardStats });
      toast({
        title: "Produto criado",
        description: "Produto adicionado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao criar produto: " + error.message,
        variant: "destructive",
      });
    },
  });
};

// Update product mutation
export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateProductRequest> }) =>
      apiService.updateProduct(id, data),
    onSuccess: (updatedProduct) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.product(updatedProduct.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardStats });
      toast({
        title: "Produto atualizado",
        description: "Produto editado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao atualizar produto: " + error.message,
        variant: "destructive",
      });
    },
  });
};

// Delete product mutation
export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => apiService.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.products });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardStats });
      toast({
        title: "Produto excluído",
        description: "Produto removido com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Falha ao excluir produto: " + error.message,
        variant: "destructive",
      });
    },
  });
};