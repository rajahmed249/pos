export interface DynamicMenu {
  id: number;
  parent_id: number | null;
  title: string;
  group_label: string;
  route_key: string;
  url: string;
  icon: string;
  sort_order: number;
  roles: string[];
  is_active: boolean;
}

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string;
  address: string;
  profile_image?: string | null;
  is_active: boolean;
  has_password?: boolean;
  created_at?: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category_id: number | null;
  brand_id: number | null;
  warranty_id: number | null;
  unit_id: number | null;
  category_name?: string;
  brand_name?: string;
  purchase_price: number;
  selling_price: number;
  quantity: number;
  alert_quantity: number;
  barcode: string;
  warranty: string;
  image?: string | null;
  status: number;
}

export interface Sale {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  date: string;
  created_at?: string;
  sale_date?: string;
  subtotal: number;
  discount: number;
  vat?: number;
  receivable: number;
  paid: number;
  due: number;
  previous_due?: number;
  sold_by?: string;
  payment_method?: string;
  purchase_cost: number;
  profit: number;
  status: string;
  account_id: number | null;
  account_name: string;
  payment_status: string;
  products?: Array<{ product_name: string; quantity: number }>;
}

export interface SaleItem {
  id: number;
  product_id: number | null;
  sale_id: number;
  product_name: string;
  category_name: string | null;
  quantity: number;
  price: number;
  total: number;
  serial_no: string | null;
  warranty: string | null;
}

export interface BankAccount {
  id: number;
  bank_name: string;
  account_name: string;
  branch: string | null;
  opening_balance: number;
  balance: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Unit {
  id: number;
  name: string;
}

export interface Warranty {
  id: number;
  name: string;
  duration: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  opening_balance?: number;
  billed?: number;
  paid?: number;
  due?: number;
  invoices?: number;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  purchased?: number;
  paid?: number;
  due?: number;
  orders?: number;
}

export interface Purchase {
  id: number;
  invoice_no: string;
  supplier_id: number | null;
  supplier_name?: string;
  purchase_date: string;
  total: number;
  paid: number;
  due: number;
  payment_method: string;
}

export interface BootstrapPayload {
  settings: Record<string, string>;
  menus: DynamicMenu[];
  users?: UserAccount[];
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  warranties: Warranty[];
  bankAccounts: BankAccount[];
  expenseCategories: Array<{ id: number; name: string }>;
  metrics: {
    todaySales: number;
    todayProfit: number;
    totalRevenue: number;
    totalProfit: number;
    customerDue: number;
    supplierDue: number;
    totalExpenses: number;
    productCount: number;
    customerCount: number;
    supplierCount: number;
    saleCount: number;
    purchaseCount: number;
    stockCostValue: number;
    stockRetailValue: number;
  };
  lowStock: Product[];
  recentSales: Sale[];
  monthlyTrend: Array<{ month: string; revenue: number; profit: number; count: number }>;
}
