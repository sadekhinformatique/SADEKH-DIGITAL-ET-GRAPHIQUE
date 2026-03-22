export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  created_at: any;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total: number;
  status: 'En attente' | 'Confirmée' | 'Terminée' | 'Livrée';
  created_at: any;
}

export interface OrderItem {
  id: string;
  order: string;
  service: string;
  quantity: number;
  price: number;
  service_name?: string; // For display
}

export interface ShopSettings {
  id: string;
  shop_name: string;
  logo?: string;
  description?: string;
  phone_number?: string;
  whatsapp_number: string;
  email?: string;
  address?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
}

export interface CartItem {
  service: Service;
  quantity: number;
}
