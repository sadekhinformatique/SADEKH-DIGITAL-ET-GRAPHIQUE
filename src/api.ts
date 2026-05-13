/// <reference types="vite/client" />
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('admin_token');
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Erreur serveur');
    }
    return res.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{ token: string; email: string }>('POST', '/auth/login', { email, password });
  }

  checkAuth() {
    return this.request<{ email: string; id: number }>('GET', '/auth/me');
  }

  // Settings
  getSettings() {
    return this.request<any>('GET', '/settings');
  }

  updateSettings(data: any) {
    return this.request<any>('PUT', '/settings', data);
  }

  // Categories
  getCategories() {
    return this.request<any[]>('GET', '/categories');
  }

  createCategory(data: { name: string; description?: string }) {
    return this.request<any>('POST', '/categories', data);
  }

  updateCategory(id: string, data: any) {
    return this.request<any>('PUT', `/categories/${id}`, data);
  }

  deleteCategory(id: string) {
    return this.request<any>('DELETE', `/categories/${id}`);
  }

  // Services
  getServices() {
    return this.request<any[]>('GET', '/services');
  }

  createService(data: any) {
    return this.request<any>('POST', '/services', data);
  }

  updateService(id: string, data: any) {
    return this.request<any>('PUT', `/services/${id}`, data);
  }

  deleteService(id: string) {
    return this.request<any>('DELETE', `/services/${id}`);
  }

  // Orders
  getOrders() {
    return this.request<any[]>('GET', '/orders');
  }

  createOrder(data: any) {
    return this.request<any>('POST', '/orders', data);
  }

  updateOrderStatus(id: string, status: string) {
    return this.request<any>('PATCH', `/orders/${id}/status`, { status });
  }
}

export const api = new ApiClient();
