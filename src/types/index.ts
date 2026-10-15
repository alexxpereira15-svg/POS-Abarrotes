export interface Category {
  id: string;
  name: string;
  code_prefix: string;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  sku_code: string;
  name: string;
  price: number;
  cost_price?: number;
  stock: number;
  min_stock: number;
  image_url?: string;
  is_active: boolean;
}

export interface Customer {
  id: string;
  full_name: string;
  phone?: string;
  credit_limit: number;
  current_balance: number;
  created_at: string;
}

export type PaymentMethod = 'EFECTIVO' | 'TRANSFERENCIA' | 'CREDITO';

export interface Sale {
  id: string;
  sale_code: string;
  customer_id?: string;
  payment_type: PaymentMethod;
  total_amount: number;
  status: 'PAGADA' | 'PENDIENTE_PAGO' | 'CANCELADA';
  created_at: string;
}
