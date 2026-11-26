import fs from 'node:fs';
import path from 'node:path';
import type { SqlRow } from './sqlParser.ts';

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

export interface PosStoreData {
  settings: Record<string, string>;
  menus: DynamicMenu[];
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    phone: string;
    address: string;
    profile_image?: string | null;
    password_hash?: string;
    is_active: boolean;
    created_at: string;
  }>;
  categories: SqlRow[];
  brands: SqlRow[];
  units: SqlRow[];
  warranties: SqlRow[];
  products: SqlRow[];
  stock_movements: SqlRow[];
  customers: SqlRow[];
  suppliers: SqlRow[];
  owners: SqlRow[];
  employees: SqlRow[];
  bank_accounts: SqlRow[];
  bank_transactions: SqlRow[];
  cash_transactions: SqlRow[];
  expense_categories: SqlRow[];
  expenses: SqlRow[];
  sales: SqlRow[];
  sale_items: SqlRow[];
  payments: SqlRow[];
  purchases: SqlRow[];
  purchase_items: SqlRow[];
  supplier_payments: SqlRow[];
  estimates: SqlRow[];
  estimate_items: SqlRow[];
  returns: SqlRow[];
  damages: SqlRow[];
}

const DEFAULT_MENUS: DynamicMenu[] = [
  { id: 1, parent_id: null, title: 'Dashboard', group_label: 'Main', route_key: 'dashboard', url: '/dashboard', icon: 'layout-dashboard', sort_order: 1, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 2, parent_id: null, title: 'Owners', group_label: 'Main', route_key: 'owners', url: '/owners', icon: 'user-check', sort_order: 2, roles: ['admin', 'manager'], is_active: true },
  { id: 3, parent_id: null, title: 'Bank Accounts', group_label: 'Main', route_key: 'accounts', url: '/accounts', icon: 'landmark', sort_order: 3, roles: ['admin', 'manager'], is_active: true },
  { id: 4, parent_id: null, title: 'Cash Book', group_label: 'Main', route_key: 'cashbook', url: '/cashbook', icon: 'book-open', sort_order: 4, roles: ['admin', 'manager'], is_active: true },

  { id: 5, parent_id: null, title: 'POS', group_label: 'Main', route_key: 'pos', url: '/pos', icon: 'shopping-cart', sort_order: 5, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 6, parent_id: null, title: 'Sales', group_label: 'Main', route_key: 'sales', url: '/sales', icon: 'receipt', sort_order: 6, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 12, parent_id: null, title: 'Products', group_label: 'Main', route_key: 'products', url: '/products', icon: 'package', sort_order: 7, roles: ['admin', 'manager', 'staff'], is_active: true },

  { id: 7, parent_id: null, title: 'Returns', group_label: 'Sales & Purchase', route_key: 'returns', url: '/returns', icon: 'rotate-ccw', sort_order: 8, roles: ['admin', 'manager'], is_active: true },
  { id: 8, parent_id: null, title: 'Estimate', group_label: 'Sales & Purchase', route_key: 'estimates', url: '/estimates', icon: 'file-text', sort_order: 9, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 9, parent_id: null, title: 'Purchase', group_label: 'Sales & Purchase', route_key: 'purchases', url: '/purchases', icon: 'truck', sort_order: 10, roles: ['admin', 'manager'], is_active: true },
  { id: 10, parent_id: null, title: 'Stock', group_label: 'Sales & Purchase', route_key: 'stock', url: '/stock', icon: 'boxes', sort_order: 11, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 11, parent_id: null, title: 'Damages', group_label: 'Sales & Purchase', route_key: 'damages', url: '/damages', icon: 'alert-triangle', sort_order: 12, roles: ['admin', 'manager'], is_active: true },

  { id: 13, parent_id: null, title: 'Add Product', group_label: 'Product Information', route_key: 'add-product', url: '/add-product', icon: 'plus-circle', sort_order: 13, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 14, parent_id: null, title: 'Categories', group_label: 'Product Information', route_key: 'categories', url: '/categories', icon: 'folder-tree', sort_order: 14, roles: ['admin', 'manager'], is_active: true },
  { id: 15, parent_id: null, title: 'Brand', group_label: 'Product Information', route_key: 'brands', url: '/brands', icon: 'tag', sort_order: 15, roles: ['admin', 'manager'], is_active: true },
  { id: 16, parent_id: null, title: 'Unit', group_label: 'Product Information', route_key: 'units', url: '/units', icon: 'ruler', sort_order: 16, roles: ['admin', 'manager'], is_active: true },

  { id: 17, parent_id: null, title: 'Expenses', group_label: 'Expenses & Payment', route_key: 'expenses', url: '/expenses', icon: 'wallet', sort_order: 17, roles: ['admin', 'manager'], is_active: true },
  { id: 18, parent_id: null, title: 'Payments', group_label: 'Expenses & Payment', route_key: 'payments', url: '/payments', icon: 'credit-card', sort_order: 18, roles: ['admin', 'manager'], is_active: true },

  { id: 19, parent_id: null, title: 'Customers', group_label: 'Peoples', route_key: 'customers', url: '/customers', icon: 'users', sort_order: 19, roles: ['admin', 'manager', 'staff'], is_active: true },
  { id: 20, parent_id: null, title: 'Suppliers', group_label: 'Peoples', route_key: 'suppliers', url: '/suppliers', icon: 'building-2', sort_order: 20, roles: ['admin', 'manager'], is_active: true },
  { id: 21, parent_id: null, title: 'Employee & Salary', group_label: 'Peoples', route_key: 'employees', url: '/employees', icon: 'badge-dollar-sign', sort_order: 21, roles: ['admin', 'manager'], is_active: true },

  { id: 22, parent_id: null, title: 'Reports', group_label: 'Reports', route_key: 'reports', url: '/reports', icon: 'bar-chart-3', sort_order: 22, roles: ['admin', 'manager'], is_active: true },

  { id: 23, parent_id: null, title: 'Shop Settings', group_label: 'Settings & Customize', route_key: 'settings', url: '/settings', icon: 'sliders', sort_order: 23, roles: ['admin'], is_active: true },
  { id: 24, parent_id: null, title: 'User Management', group_label: 'Settings & Customize', route_key: 'users', url: '/users', icon: 'user-cog', sort_order: 24, roles: ['admin'], is_active: true },
  { id: 25, parent_id: null, title: 'Backup & Restore', group_label: 'Settings & Customize', route_key: 'backup', url: '/backup', icon: 'database-backup', sort_order: 25, roles: ['admin'], is_active: true },
];

const STORE_PATH = path.resolve(process.cwd(), 'data/pos-store.json');

let cachedStore: PosStoreData | null = null;

function buildInitialStore(): PosStoreData {
  const settingsMap: Record<string, string> = {
    shop_name: 'YOUTH IT POS',
    shop_address: 'Shop No.04, (Ground Floor), 820, Makkha Tower, West Shewrapara, Mirpur, Dhaka-1216',
    shop_phone: '01674297522',
    shop_email: 'info@youthit.com.bd',
    shop_website: 'www.youthit.com.bd',
    shop_logo: '/assets/images/logo.jpg',
    shop_favicon: '/assets/images/favicon.png',
    shop_qr: '/assets/images/shop_qr.png',
    currency: '৳',
    tax_rate: '0',
    invoice_footer: 'Goods once sold cannot be returned unless defective under warranty.',
    sidebar_theme: 'slate',
    primary_color: 'emerald',
    layout_mode: 'comfortable',
  };

  return {
    settings: settingsMap,
    menus: DEFAULT_MENUS,
    users: [
      {
        id: 1,
        name: 'RAJ AHMED',
        email: 'rajahmed249@gmail.com',
        role: 'super_admin',
        phone: '+8801674297522',
        address: 'Dhaka, Bangladesh',
        is_active: true,
        profile_image: '/assets/aistudio/Raj_Ahmed_02078811.jpg',
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      },
    ],
    categories: [],
    brands: [],
    units: [],
    warranties: [],
    products: [],
    stock_movements: [],
    customers: [],
    suppliers: [],
    owners: [],
    employees: [],
    bank_accounts: [],
    bank_transactions: [],
    cash_transactions: [],
    expense_categories: [],
    expenses: [],
    sales: [],
    sale_items: [],
    payments: [],
    purchases: [],
    purchase_items: [],
    supplier_payments: [],
    estimates: [],
    estimate_items: [],
    returns: [],
    damages: [],
  };
}

export function getStore(): PosStoreData {
  if (cachedStore) {
    return cachedStore;
  }
  if (fs.existsSync(STORE_PATH)) {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const loaded = JSON.parse(raw) as PosStoreData;
    if (!Array.isArray(loaded.owners)) loaded.owners = [];
    if (!Array.isArray(loaded.employees)) loaded.employees = [];
    if (!Array.isArray(loaded.cash_transactions)) loaded.cash_transactions = [];
    if (!loaded.settings.shop_qr || loaded.settings.shop_qr.includes('uploads/')) {
      loaded.settings.shop_qr = '/assets/images/shop_qr.png';
    }
    let menusChanged = false;
    if (!Array.isArray(loaded.menus) || loaded.menus.length === 0) {
      loaded.menus = DEFAULT_MENUS;
      menusChanged = true;
    } else {
      const hasAddProduct = loaded.menus.some((m) => m.route_key === 'add-product');
      const productsMenu = loaded.menus.find((m) => m.route_key === 'products');
      const prodGroup = loaded.menus
        .filter((m) => m.group_label === 'Product Information')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => m.route_key);
      const expectedStart = ['add-product', 'categories', 'brands', 'units'];
      const needsProductReorder =
        !hasAddProduct ||
        !productsMenu ||
        productsMenu.group_label !== 'Main' ||
        expectedStart.some((key, idx) => prodGroup[idx] !== key);

      if (needsProductReorder) {
        const customMenus = loaded.menus.filter(
          (m) => !DEFAULT_MENUS.some((d) => d.route_key === m.route_key)
        );
        loaded.menus = [
          ...DEFAULT_MENUS,
          ...customMenus.map((m, idx) => ({
            ...m,
            sort_order: DEFAULT_MENUS.length + idx + 1,
          })),
        ];
        menusChanged = true;
      }
    }
    cachedStore = loaded;
    if (menusChanged) {
      saveStore(cachedStore);
    }
    return cachedStore;
  }
  cachedStore = buildInitialStore();
  saveStore(cachedStore);
  return cachedStore;
}

export function saveStore(store: PosStoreData): void {
  cachedStore = store;
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(STORE_PATH, JSON.stringify(store), 'utf8');
}

export function nextId(rows: Array<{ id?: unknown }>): number {
  let max = 0;
  for (const r of rows) {
    const val = Number(r.id ?? 0);
    if (val > max) {
      max = val;
    }
  }
  return max + 1;
}
