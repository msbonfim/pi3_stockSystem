// API service para comunicação com Django backend
// Detecta automaticamente se está em localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : 'https://pi2-stocksystem-backend.onrender.com');

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  expiration_date: string;
  category: number; // ID da categoria
  category_name?: string; // Nome da categoria
  batch?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  quantity: number;
  expiration_date: string;
  category?: number;
  batch?: string;
}

export interface DashboardStats {
  total_products: number;
  expired_products: number;
  expiring_soon: number;
  low_stock: number;
  good_products: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: 'expiring_soon' | 'expired' | 'low_stock';
  read: boolean;
  product?: number;
  product_name?: string;
  created_at: string;
}

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Products endpoints
  async getProducts(): Promise<Product[]> {
    return this.request<Product[]>('/api/products/');
  }

  async getProduct(id: number): Promise<Product> {
    return this.request<Product>(`/api/products/${id}/`);
  }

  async createProduct(product: CreateProductRequest): Promise<Product> {
    return this.request<Product>('/api/products/', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: number, product: Partial<CreateProductRequest>): Promise<Product> {
    return this.request<Product>(`/api/products/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }

  async deleteProduct(id: number): Promise<void> {
    return this.request<void>(`/api/products/${id}/`, {
      method: 'DELETE',
    });
  }

  // Alerts endpoints
  async getExpiringProducts(): Promise<Product[]> {
    return this.request<Product[]>('/api/products/expiring-soon/');
  }

  async getExpiredProducts(): Promise<Product[]> {
    return this.request<Product[]>('/api/products/expired/');
  }

  // Categories endpoints
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/api/categories/');
  }

  async createCategory(name: string): Promise<Category> {
    return this.request<Category>('/api/categories/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // Dashboard stats
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/dashboard/stats/');
  }

  // Notifications endpoints
  async getNotifications(read?: boolean): Promise<Notification[]> {
    const params = read !== undefined ? `?read=${read}` : '';
    return this.request<Notification[]>(`/api/notifications${params}`);
  }

  async markNotificationRead(id: number): Promise<void> {
    return this.request<void>(`/api/notifications/${id}/read/`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/api/notifications/read-all/', {
      method: 'POST',
    });
  }
}

export const apiService = new ApiService();