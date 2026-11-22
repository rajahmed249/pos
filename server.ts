import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { getStore, nextId, saveStore } from './server/posStore.ts';

const PORT = 3000;
const activeSessions = new Map<string, { userId: number; expiresAt: number }>();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hashHex, 'hex');
    return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function normalizePhoneDigits(phone: unknown): string {
  return String(phone ?? '').replace(/\D/g, '');
}

function sanitizeUser(u: {
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
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    address: u.address,
    profile_image: u.profile_image || null,
    is_active: u.is_active,
    has_password: Boolean(u.password_hash),
    created_at: u.created_at,
  };
}

function sanitizeSearch(q: unknown): string {
  return String(q ?? '').trim().toLowerCase();
}

function collectFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results.sort();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  const uploadsDir = path.resolve(process.cwd(), 'public/uploads/avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public/uploads')));

  // Initialize store on boot so real SQL data is ready immediately
  getStore();

  // ---- Bootstrap & Dashboard ----
  app.get('/api/bootstrap', (_req: Request, res: Response) => {
    const store = getStore();
    const todayStr = new Date().toISOString().slice(0, 10);

    let todaySales = 0;
    let todayProfit = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let customerDue = 0;

    for (const sale of store.sales) {
      if (String(sale.status ?? 'completed') !== 'completed') continue;
      const rec = Number(sale.receivable ?? 0);
      const prof = Number(sale.profit ?? 0);
      const due = Number(sale.due ?? 0);
      totalRevenue += rec;
      totalProfit += prof;
      customerDue += due;
      if (String(sale.date ?? '').startsWith(todayStr)) {
        todaySales += rec;
        todayProfit += prof;
      }
    }

    let supplierDue = 0;
    for (const pur of store.purchases) {
      supplierDue += Number(pur.due ?? 0);
    }

    let totalExpenses = 0;
    for (const exp of store.expenses) {
      totalExpenses += Number(exp.amount ?? 0);
    }

    const activeProducts = store.products.filter((p) => Number(p.status ?? 1) === 1);
    let stockCostValue = 0;
    let stockRetailValue = 0;
    for (const p of activeProducts) {
      const qty = Math.max(0, Number(p.quantity ?? 0));
      stockCostValue += qty * Number(p.purchase_price ?? 0);
      stockRetailValue += qty * Number(p.selling_price ?? 0);
    }

    const lowStock = activeProducts
      .filter((p) => Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5))
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 10);

    const recentSales = [...store.sales]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .slice(0, 10);

    // Monthly revenue trend (last 6 months in dataset)
    const monthTotals: Record<string, { month: string; revenue: number; profit: number; count: number }> = {};
    for (const s of store.sales) {
      if (String(s.status ?? 'completed') !== 'completed') continue;
      const m = String(s.date ?? '').slice(0, 7);
      if (!m) continue;
      if (!monthTotals[m]) {
        monthTotals[m] = { month: m, revenue: 0, profit: 0, count: 0 };
      }
      monthTotals[m].revenue += Number(s.receivable ?? 0);
      monthTotals[m].profit += Number(s.profit ?? 0);
      monthTotals[m].count += 1;
    }
    const monthlyTrend = Object.values(monthTotals)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    res.json({
      settings: store.settings,
      menus: [...store.menus].sort((a, b) => a.sort_order - b.sort_order),
      users: store.users.map(sanitizeUser),
      categories: store.categories,
      brands: store.brands,
      units: store.units,
      warranties: store.warranties,
      bankAccounts: store.bank_accounts,
      expenseCategories: store.expense_categories,
      metrics: {
        todaySales,
        todayProfit,
        totalRevenue,
        totalProfit,
        customerDue,
        supplierDue,
        totalExpenses,
        productCount: activeProducts.length,
        customerCount: store.customers.length,
        supplierCount: store.suppliers.length,
        saleCount: store.sales.length,
        purchaseCount: store.purchases.length,
        stockCostValue,
        stockRetailValue,
      },
      lowStock,
      recentSales,
      monthlyTrend,
    });
  });

  // ---- Products ----
  app.get('/api/products', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const brandId = req.query.brand_id ? Number(req.query.brand_id) : null;
    const lowStockOnly = req.query.low_stock === '1';
    const includeInactive = req.query.include_inactive === '1';
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 30)));

    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const brandMap = new Map(store.brands.map((b) => [Number(b.id), String(b.name ?? '')]));
    const warrantyMap = new Map(store.warranties.map((w) => [Number(w.id), String(w.duration ?? w.name ?? '')]));

    let items = includeInactive
      ? [...store.products]
      : store.products.filter((p) => Number(p.status ?? 1) === 1);
    if (q) {
      items = items.filter((p) => {
        const catName = (catMap.get(Number(p.category_id)) ?? '').toLowerCase();
        const brandName = (brandMap.get(Number(p.brand_id)) ?? '').toLowerCase();
        const wName = String(p.warranty || warrantyMap.get(Number(p.warranty_id)) || '').toLowerCase();
        return (
          String(p.name ?? '').toLowerCase().includes(q) ||
          String(p.sku ?? '').toLowerCase().includes(q) ||
          String(p.barcode ?? '').toLowerCase().includes(q) ||
          catName.includes(q) ||
          brandName.includes(q) ||
          wName.includes(q) ||
          String(p.selling_price ?? '').includes(q)
        );
      });
    }
    if (categoryId) items = items.filter((p) => Number(p.category_id) === categoryId);
    if (brandId) items = items.filter((p) => Number(p.brand_id) === brandId);
    if (lowStockOnly) items = items.filter((p) => Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5));

    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    const total = items.length;
    const sliced = items.slice((page - 1) * limit, page * limit).map((p) => ({
      ...p,
      warranty: String(p.warranty || warrantyMap.get(Number(p.warranty_id)) || 'No Warranty'),
      category_name: catMap.get(Number(p.category_id)) ?? 'Uncategorized',
      brand_name: brandMap.get(Number(p.brand_id)) ?? 'No Brand',
    }));

    res.json({ items: sliced, total, page, limit });
  });

  app.post('/api/products', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'Product name is required.' });
      return;
    }
    const purchasePrice = Number(body.purchase_price ?? 0);
    const sellingPrice = Number(body.selling_price ?? 0);
    const rawQty = Number(body.quantity ?? 0);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      res.status(400).json({ error: 'Purchase price and selling price must be 0 or greater.' });
      return;
    }
    if (!Number.isFinite(rawQty) || rawQty < 0) {
      res.status(400).json({ error: 'Quantity cannot be negative.' });
      return;
    }
    const qty = Math.round(rawQty);
    const newProduct = {
      id: nextId(store.products),
      name: String(body.name).trim(),
      sku: String(body.sku ?? '').trim() || `SKU-${Date.now().toString().slice(-6)}`,
      category_id: body.category_id ? Number(body.category_id) : null,
      brand_id: body.brand_id ? Number(body.brand_id) : null,
      warranty_id: body.warranty_id ? Number(body.warranty_id) : null,
      unit_id: body.unit_id ? Number(body.unit_id) : 4,
      purchase_price: purchasePrice,
      selling_price: sellingPrice,
      warranty_months: Number(body.warranty_months ?? 0),
      quantity: qty,
      stock_quantity: qty,
      alert_quantity: Math.max(0, Number(body.alert_quantity ?? 5)),
      description: String(body.description ?? ''),
      barcode: String(body.barcode ?? ''),
      image: null,
      status: 1,
      warranty: String(body.warranty ?? 'No Warranty'),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.products.unshift(newProduct);
    saveStore(store);
    res.status(201).json(newProduct);
  });

  app.put('/api/products/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== undefined) {
      if (!String(body.name).trim()) {
        res.status(400).json({ error: 'Product name cannot be empty.' });
        return;
      }
      product.name = String(body.name).trim();
    }
    if (body.purchase_price !== undefined) {
      const pp = Number(body.purchase_price);
      if (!Number.isFinite(pp) || pp < 0) {
        res.status(400).json({ error: 'Purchase price cannot be negative.' });
        return;
      }
      product.purchase_price = pp;
    }
    if (body.selling_price !== undefined) {
      const sp = Number(body.selling_price);
      if (!Number.isFinite(sp) || sp < 0) {
        res.status(400).json({ error: 'Selling price cannot be negative.' });
        return;
      }
      product.selling_price = sp;
    }
    if (body.sku !== undefined) product.sku = String(body.sku).trim();
    if (body.category_id !== undefined) product.category_id = body.category_id ? Number(body.category_id) : null;
    if (body.brand_id !== undefined) product.brand_id = body.brand_id ? Number(body.brand_id) : null;
    if (body.alert_quantity !== undefined) product.alert_quantity = Math.max(0, Number(body.alert_quantity));
    if (body.warranty !== undefined) product.warranty = String(body.warranty);
    saveStore(store);
    res.json(product);
  });

  app.post('/api/products/:id/adjust', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const newQty = Math.max(0, Math.round(Number(req.body?.new_quantity ?? 0)));
    const oldQty = Number(product.quantity ?? 0);
    product.quantity = newQty;
    product.stock_quantity = newQty;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: id,
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: newQty - oldQty,
      reason: String(req.body?.reason ?? 'Manual Stock Adjustment'),
      created_by: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
    saveStore(store);
    res.json(product);
  });

  app.delete('/api/products/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    product.status = 0;
    saveStore(store);
    res.json({ ok: true });
  });

  app.patch('/api/products/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const product = store.products.find((p) => Number(p.id) === id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    product.status = Number(product.status ?? 1) === 1 ? 0 : 1;
    saveStore(store);
    res.json(product);
  });

  // ---- Catalog (Categories, Brands, Units, Warranties) ----
  app.post('/api/catalog/:kind', (req: Request, res: Response) => {
    const store = getStore();
    const kind = req.params.kind;
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (kind === 'categories') {
      const row = { id: nextId(store.categories), name, description: String(req.body?.description ?? ''), status: 1, created_at: now };
      store.categories.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === 'brands') {
      const row = { id: nextId(store.brands), name, status: 1, created_at: now };
      store.brands.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === 'units') {
      const row = { id: nextId(store.units), name, description: String(req.body?.description ?? ''), status: 1, created_at: now };
      store.units.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    if (kind === 'warranties') {
      const row = { id: nextId(store.warranties), name, duration: String(req.body?.duration ?? name), status: 1, created_at: now };
      store.warranties.push(row);
      saveStore(store);
      res.status(201).json(row);
      return;
    }
    res.status(400).json({ error: 'Unknown catalog type.' });
  });

  app.delete('/api/catalog/:kind/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const kind = req.params.kind;
    if (kind === 'categories') store.categories = store.categories.filter((r) => Number(r.id) !== id);
    else if (kind === 'brands') store.brands = store.brands.filter((r) => Number(r.id) !== id);
    else if (kind === 'units') store.units = store.units.filter((r) => Number(r.id) !== id);
    else if (kind === 'warranties') store.warranties = store.warranties.filter((r) => Number(r.id) !== id);
    else {
      res.status(400).json({ error: 'Unknown catalog type.' });
      return;
    }
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Sales & POS Checkout ----
  app.get('/api/sales', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const paymentStatus = String(req.query.payment_status ?? '');
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 10)));

    const custPhoneMap = new Map(store.customers.map((c) => [Number(c.id), String(c.phone ?? '')]));
    const custNameMap = new Map(store.customers.map((c) => [Number(c.id), String(c.name ?? '')]));
    const productNameMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? '')]));
    const saleItemsMap = new Map<number, Array<{ product_name: string; quantity: number }>>();
    for (const it of store.sale_items) {
      const sid = Number(it.sale_id);
      const arr = saleItemsMap.get(sid) ?? [];
      const resolvedName = String(it.product_name || productNameMap.get(Number(it.product_id)) || 'Product');
      arr.push({
        product_name: resolvedName,
        quantity: Number(it.quantity ?? 1),
      });
      saleItemsMap.set(sid, arr);
    }

    let items: Array<Record<string, unknown>> = store.sales.map((s) => {
      const sid = Number(s.id);
      const cid = Number(s.customer_id ?? 0);
      const prods = saleItemsMap.get(sid) ?? [];
      return {
        ...s,
        customer_name: String(s.customer_name || (cid ? custNameMap.get(cid) : '') || 'Walk-in Customer'),
        customer_phone: cid ? (custPhoneMap.get(cid) ?? '') : '',
        products: prods,
      };
    });

    if (q) {
      items = items.filter((s) => {
        const prods = (s.products as Array<{ product_name: string }>) ?? [];
        return (
          String(s.invoice_no ?? '').toLowerCase().includes(q) ||
          String(s.customer_name ?? '').toLowerCase().includes(q) ||
          String(s.customer_phone ?? '').toLowerCase().includes(q) ||
          prods.some((p) => p.product_name.toLowerCase().includes(q))
        );
      });
    }
    if (paymentStatus) {
      items = items.filter((s) => String(s.payment_status ?? '') === paymentStatus);
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    const total = items.length;
    res.json({ items: items.slice((page - 1) * limit, page * limit), total, page, limit });
  });

  app.get('/api/sales/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const sale = store.sales.find((s) => Number(s.id) === id);
    if (!sale) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const productMap = new Map(store.products.map((p) => [Number(p.id), p]));
    const warrantyMap = new Map(store.warranties.map((w) => [Number(w.id), String(w.name || w.duration || '')]));

    const items = store.sale_items
      .filter((it) => Number(it.sale_id) === id)
      .map((it) => {
        const prod = it.product_id ? productMap.get(Number(it.product_id)) : undefined;
        const resolvedCat =
          it.category_name ||
          (prod?.category_id ? catMap.get(Number(prod.category_id)) : '') ||
          'Electronics';
        const resolvedWarranty =
          String(
            it.warranty ||
            it.warranty_name ||
            prod?.warranty ||
            (prod?.warranty_id ? warrantyMap.get(Number(prod.warranty_id)) : '') ||
            ''
          );
        return {
          ...it,
          product_name: String(it.product_name || prod?.name || 'Product'),
          category_name: String(resolvedCat),
          warranty: resolvedWarranty,
          serial_no: it.serial_no || it.serial_number || null,
        };
      });

    const payments = store.payments.filter((p) => Number(p.sale_id) === id);
    const customer = sale.customer_id ? store.customers.find((c) => Number(c.id) === Number(sale.customer_id)) : null;
    const customerOpening = Number(customer?.opening_balance ?? 0);
    const saleDue = Number(sale.due ?? 0);
    const previous_due = Math.max(0, customerOpening - saleDue);

    const creatorId = Number(sale.created_by ?? sale.user_id ?? 1);
    const creator = store.users.find((u) => Number(u.id) === creatorId);
    const sold_by = String(creator?.name ?? 'Youth IT');

    res.json({
      sale: {
        ...sale,
        customer_name: String(sale.customer_name || customer?.name || 'Walk-in Customer'),
        customer_phone: String(customer?.phone ?? sale.customer_phone ?? ''),
        customer_address: String(customer?.address ?? ''),
        previous_due,
        sold_by,
      },
      items,
      payments,
      customer,
    });
  });

  app.post('/api/sales', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    if (itemsInput.length === 0) {
      res.status(400).json({ error: 'At least one line item is required.' });
      return;
    }

    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const accountId = Number(body.account_id ?? store.bank_accounts[0]?.id ?? 21);
    const account = store.bank_accounts.find((a) => Number(a.id) === accountId) ?? store.bank_accounts[0];
    const customerId = body.customer_id ? Number(body.customer_id) : null;
    const customer = customerId ? store.customers.find((c) => Number(c.id) === customerId) : null;

    let subtotal = 0;
    let totalCost = 0;
    const prepared: Array<{
      product: (typeof store.products)[number];
      qty: number;
      price: number;
      lineTotal: number;
      lineCost: number;
      serialNo: string;
      warranty: string;
    }> = [];

    const requestedQtyMap = new Map<number, number>();
    for (const raw of itemsInput) {
      const product = store.products.find((p) => Number(p.id) === Number(raw.product_id));
      if (!product) {
        res.status(400).json({ error: `Product #${raw.product_id} not found.` });
        return;
      }
      const qty = Math.round(Number(raw.quantity ?? 0));
      if (!Number.isFinite(qty) || qty < 1) {
        res.status(400).json({ error: `Invalid quantity for "${product.name}". Quantity must be at least 1.` });
        return;
      }
      const price = Number(raw.price ?? product.selling_price ?? 0);
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: `Invalid unit price for "${product.name}".` });
        return;
      }
      const cumulativeQty = (requestedQtyMap.get(Number(product.id)) ?? 0) + qty;
      const availableStock = Number(product.quantity ?? 0);
      if (cumulativeQty > availableStock) {
        res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${cumulativeQty}.`,
        });
        return;
      }
      requestedQtyMap.set(Number(product.id), cumulativeQty);

      const lineTotal = qty * price;
      const lineCost = qty * Number(product.purchase_price ?? 0);
      subtotal += lineTotal;
      totalCost += lineCost;
      prepared.push({
        product,
        qty,
        price,
        lineTotal,
        lineCost,
        serialNo: String(raw.serial_no ?? ''),
        warranty: String(raw.warranty ?? product.warranty ?? 'No Warranty'),
      });
    }

    const discount = Number(body.discount ?? 0);
    const vat = Number(body.vat ?? 0);
    if (!Number.isFinite(discount) || discount < 0) {
      res.status(400).json({ error: 'Discount must be 0 or greater.' });
      return;
    }
    if (discount > subtotal + 0.009) {
      res.status(400).json({ error: `Discount cannot exceed Subtotal (${subtotal.toFixed(2)}).` });
      return;
    }
    if (!Number.isFinite(vat) || vat < 0) {
      res.status(400).json({ error: 'VAT / Tax must be 0 or greater.' });
      return;
    }

    const receivable = Math.max(0, subtotal - discount + vat);
    const rawPaid = body.paid !== undefined && body.paid !== '' ? Number(body.paid) : receivable;
    if (!Number.isFinite(rawPaid) || rawPaid < 0) {
      res.status(400).json({ error: 'Received amount must be 0 or greater.' });
      return;
    }
    const paid = Math.min(receivable, rawPaid);
    const due = Math.max(0, receivable - paid);
    const profit = receivable - totalCost;

    const isWalkIn =
      !customer || String(customer.name ?? '').trim().toLowerCase() === 'walk-in customer';
    if (isWalkIn && due > 0.009) {
      res.status(400).json({
        error: 'Walk-in Customer cannot have due balance! Please collect full payment or select a registered customer.',
      });
      return;
    }

    const saleId = nextId(store.sales);
    const nowIso = new Date().toISOString();
    const dateStr = body.sale_date ? String(body.sale_date).slice(0, 10) : nowIso.slice(0, 10);
    const dateTimeStr = `${dateStr} ${nowIso.slice(11, 19)}`;
    const invoiceNo = `INV-${dateStr.replace(/-/g, '')}-${String(saleId).padStart(4, '0')}`;
    const paymentMethod = String(body.payment_method ?? (account ? String(account.account_name).toLowerCase() : 'cash'));
    const saleNote = String(body.note ?? '');

    const sale = {
      id: saleId,
      invoice_no: invoiceNo,
      customer_id: customer ? Number(customer.id) : null,
      customer_name: customer ? String(customer.name) : (String(body.customer_name ?? '').trim() || 'Walk-in Customer'),
      date: dateStr,
      discount,
      vat,
      receivable,
      paid,
      due,
      purchase_cost: totalCost,
      profit,
      status: 'completed',
      created_at: dateTimeStr,
      sale_date: dateTimeStr,
      subtotal,
      account_id: account ? Number(account.id) : null,
      account_name: account ? String(account.account_name) : paymentMethod,
      payment_method: paymentMethod,
      note: saleNote,
      payment_status: due <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'due'),
    };
    store.sales.unshift(sale);

    const createdItems = [];
    for (const p of prepared) {
      const sItem = {
        id: nextId(store.sale_items),
        product_id: Number(p.product.id),
        sale_id: saleId,
        product_name: String(p.product.name),
        category_name: catMap.get(Number(p.product.category_id)) ?? null,
        quantity: p.qty,
        price: p.price,
        total: p.lineTotal,
        purchase_cost: p.lineCost,
        serial_no: p.serialNo || null,
        warranty: p.warranty,
        buying_price: Number(p.product.purchase_price ?? 0),
        warranty_id: p.product.warranty_id ?? null,
        warranty_name: p.warranty,
      };
      store.sale_items.push(sItem);
      createdItems.push(sItem);

      const oldQty = Number(p.product.quantity ?? 0);
      const newQty = Math.max(0, oldQty - p.qty);
      p.product.quantity = newQty;
      p.product.stock_quantity = newQty;

      store.stock_movements.unshift({
        id: nextId(store.stock_movements),
        product_id: Number(p.product.id),
        old_quantity: oldQty,
        new_quantity: newQty,
        difference: -p.qty,
        reason: `POS Sale ${invoiceNo}`,
        created_by: 1,
        created_at: dateTimeStr,
      });
    }

    if (paid > 0) {
      store.payments.unshift({
        id: nextId(store.payments),
        sale_id: saleId,
        customer_id: customer ? Number(customer.id) : null,
        amount: paid,
        payment_date: dateTimeStr,
        payment_method: account ? String(account.account_name).toLowerCase() : 'cash',
        reference_no: null,
        note: 'POS Checkout',
        created_by: 1,
        created_at: dateTimeStr,
      });
      if (account) {
        account.balance = Number(account.balance ?? 0) + paid;
      }
    }

    saveStore(store);
    res.status(201).json({ sale, items: createdItems });
  });

  app.post('/api/sales/:id/payments', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const sale = store.sales.find((s) => Number(s.id) === id);
    if (!sale) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }
    const currentDue = Number(sale.due ?? 0);
    if (currentDue <= 0) {
      res.status(400).json({ error: 'This invoice is already fully paid.' });
      return;
    }
    const rawAmount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: 'Valid positive payment amount required.' });
      return;
    }
    if (rawAmount > currentDue + 0.01) {
      res.status(400).json({ error: `Payment amount cannot exceed current due (${currentDue.toFixed(2)}).` });
      return;
    }
    const collect = Math.min(currentDue, rawAmount);
    const accountId = Number(req.body?.account_id ?? sale.account_id ?? store.bank_accounts[0]?.id);
    const account = store.bank_accounts.find((a) => Number(a.id) === accountId);

    sale.paid = Number(sale.paid ?? 0) + collect;
    sale.due = Math.max(0, Number(sale.receivable ?? 0) - Number(sale.paid));
    sale.payment_status = Number(sale.due) <= 0 ? 'paid' : 'partial';

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const payDate = req.body?.payment_date ? String(req.body.payment_date) : now;
    const payMethod = String(req.body?.payment_method ?? (account ? String(account.account_name).toLowerCase() : 'cash'));
    store.payments.unshift({
      id: nextId(store.payments),
      sale_id: id,
      customer_id: sale.customer_id ?? null,
      amount: collect,
      payment_date: payDate,
      payment_method: payMethod,
      reference_no: req.body?.reference_no ? String(req.body.reference_no) : null,
      note: String(req.body?.note ?? 'Due collection'),
      created_by: 1,
      created_at: now,
    });
    if (account) {
      account.balance = Number(account.balance ?? 0) + collect;
    }
    saveStore(store);
    res.json(sale);
  });

  app.delete('/api/sales/:id', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const idx = store.sales.findIndex((s) => Number(s.id) === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Sale not found.' });
      return;
    }
    const items = store.sale_items.filter((it) => Number(it.sale_id) === id);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    for (const item of items) {
      if (item.product_id) {
        const product = store.products.find((p) => Number(p.id) === Number(item.product_id));
        if (product) {
          const oldQty = Number(product.quantity ?? 0);
          const newQty = oldQty + Number(item.quantity ?? 0);
          product.quantity = newQty;
          product.stock_quantity = newQty;
          store.stock_movements.unshift({
            id: nextId(store.stock_movements),
            product_id: Number(product.id),
            old_quantity: oldQty,
            new_quantity: newQty,
            difference: Number(item.quantity ?? 0),
            reason: `Restored from deleted sale #${id}`,
            created_by: 1,
            created_at: now,
          });
        }
      }
    }
    store.sale_items = store.sale_items.filter((it) => Number(it.sale_id) !== id);
    store.payments = store.payments.filter((p) => Number(p.sale_id) !== id);
    store.sales.splice(idx, 1);
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Purchases ----
  app.get('/api/purchases', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 25)));
    const supMap = new Map(store.suppliers.map((s) => [Number(s.id), String(s.name ?? '')]));

    let items: Array<Record<string, unknown>> = store.purchases.map((p) => ({
      ...p,
      supplier_name: supMap.get(Number(p.supplier_id)) ?? 'Unknown Supplier',
    }));
    if (q) {
      items = items.filter((p) =>
        String(p.invoice_no ?? '').toLowerCase().includes(q) ||
        String(p.supplier_name ?? '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({ items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit });
  });

  app.post('/api/purchases', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    const product = store.products.find((p) => Number(p.id) === Number(body.product_id));
    if (!product) {
      res.status(400).json({ error: 'Valid product is required.' });
      return;
    }
    const supplierId = Number(body.supplier_id);
    const qty = Math.max(1, Math.round(Number(body.quantity ?? 1)));
    const price = Math.max(0, Number(body.price ?? product.purchase_price ?? 0));
    const subtotal = qty * price;
    const discount = Math.max(0, Number(body.discount ?? 0));
    const total = Math.max(0, subtotal - discount);
    const paid = Math.min(total, Math.max(0, Number(body.paid ?? 0)));
    const due = Math.max(0, total - paid);

    const purchaseId = nextId(store.purchases);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const invoiceNo = `PUR-${now.slice(0, 10).replace(/-/g, '')}-${String(purchaseId).padStart(4, '0')}`;

    const purchase = {
      id: purchaseId,
      invoice_no: invoiceNo,
      supplier_id: supplierId,
      purchase_date: now,
      total_amount: total,
      paid_amount: paid,
      due_amount: due,
      discount,
      payment_method: String(body.payment_method ?? 'cash'),
      note: String(body.note ?? ''),
      status: 1,
      user_id: 1,
      subtotal,
      total,
      paid,
      due,
      created_at: now,
    };
    store.purchases.unshift(purchase);
    store.purchase_items.push({
      id: nextId(store.purchase_items),
      purchase_id: purchaseId,
      product_id: Number(product.id),
      quantity: qty,
      price,
      warranty_months: 0,
      total: subtotal,
    });

    const oldQty = Number(product.quantity ?? 0);
    const newQty = oldQty + qty;
    product.quantity = newQty;
    product.stock_quantity = newQty;
    product.purchase_price = price;
    store.stock_movements.unshift({
      id: nextId(store.stock_movements),
      product_id: Number(product.id),
      old_quantity: oldQty,
      new_quantity: newQty,
      difference: qty,
      reason: `Purchase ${invoiceNo}`,
      created_by: 1,
      created_at: now,
    });

    if (paid > 0) {
      store.supplier_payments.unshift({
        id: nextId(store.supplier_payments),
        purchase_id: purchaseId,
        supplier_id: supplierId,
        amount: paid,
        payment_date: now,
        payment_method: String(body.payment_method ?? 'cash'),
        reference_no: null,
        note: 'Initial purchase payment',
        created_by: 1,
        created_at: now,
      });
    }
    saveStore(store);
    res.status(201).json(purchase);
  });

  app.post('/api/purchases/:id/payments', (req: Request, res: Response) => {
    const store = getStore();
    const id = Number(req.params.id);
    const purchase = store.purchases.find((p) => Number(p.id) === id);
    if (!purchase) {
      res.status(404).json({ error: 'Purchase not found.' });
      return;
    }
    const pay = Math.min(Number(purchase.due ?? 0), Math.max(0, Number(req.body?.amount ?? 0)));
    if (pay <= 0) {
      res.status(400).json({ error: 'Valid positive amount required.' });
      return;
    }
    purchase.paid = Number(purchase.paid ?? 0) + pay;
    purchase.paid_amount = purchase.paid;
    purchase.due = Math.max(0, Number(purchase.total ?? 0) - Number(purchase.paid));
    purchase.due_amount = purchase.due;

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    store.supplier_payments.unshift({
      id: nextId(store.supplier_payments),
      purchase_id: id,
      supplier_id: purchase.supplier_id ?? null,
      amount: pay,
      payment_date: now,
      payment_method: String(req.body?.payment_method ?? 'cash'),
      reference_no: null,
      note: 'Supplier due settlement',
      created_by: 1,
      created_at: now,
    });
    saveStore(store);
    res.json(purchase);
  });

  // ---- Customers & Suppliers ----
  app.get('/api/customers', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 30)));

    const totals = new Map<number, { billed: number; paid: number; due: number; invoices: number }>();
    for (const s of store.sales) {
      const cid = Number(s.customer_id ?? 0);
      if (!cid) continue;
      const cur = totals.get(cid) ?? { billed: 0, paid: 0, due: 0, invoices: 0 };
      cur.billed += Number(s.receivable ?? 0);
      cur.paid += Number(s.paid ?? 0);
      cur.due += Number(s.due ?? 0);
      cur.invoices += 1;
      totals.set(cid, cur);
    }

    let items: Array<Record<string, unknown>> = store.customers.map((c) => {
      const t = totals.get(Number(c.id)) ?? { billed: 0, paid: 0, due: 0, invoices: 0 };
      return { ...c, ...t };
    });
    if (q) {
      items = items.filter((c) =>
        String(c.name ?? '').toLowerCase().includes(q) ||
        String(c.phone ?? '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({ items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit });
  });

  app.post('/api/customers', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Customer name is required.' });
      return;
    }
    const row = {
      id: nextId(store.customers),
      name,
      email: String(req.body?.email ?? ''),
      phone: String(req.body?.phone ?? ''),
      address: String(req.body?.address ?? ''),
      city: String(req.body?.city ?? ''),
      state: '',
      zip_code: '',
      opening_balance: Number(req.body?.opening_balance ?? 0),
      status: 1,
      points: 0,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.customers.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });

  app.get('/api/suppliers', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 30)));

    const totals = new Map<number, { purchased: number; paid: number; due: number; orders: number }>();
    for (const p of store.purchases) {
      const sid = Number(p.supplier_id ?? 0);
      if (!sid) continue;
      const cur = totals.get(sid) ?? { purchased: 0, paid: 0, due: 0, orders: 0 };
      cur.purchased += Number(p.total ?? 0);
      cur.paid += Number(p.paid ?? 0);
      cur.due += Number(p.due ?? 0);
      cur.orders += 1;
      totals.set(sid, cur);
    }

    let items: Array<Record<string, unknown>> = store.suppliers.map((s) => {
      const t = totals.get(Number(s.id)) ?? { purchased: 0, paid: 0, due: 0, orders: 0 };
      return { ...s, ...t };
    });
    if (q) {
      items = items.filter((s) =>
        String(s.name ?? '').toLowerCase().includes(q) ||
        String(s.phone ?? '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    res.json({ items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit });
  });

  app.post('/api/suppliers', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    if (!name) {
      res.status(400).json({ error: 'Supplier name is required.' });
      return;
    }
    const row = {
      id: nextId(store.suppliers),
      name,
      email: String(req.body?.email ?? ''),
      phone: String(req.body?.phone ?? ''),
      address: String(req.body?.address ?? ''),
      city: '',
      state: '',
      zip_code: '',
      opening_balance: Number(req.body?.opening_balance ?? 0),
      status: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.suppliers.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });

  // ---- Estimates ----
  app.get('/api/estimates', (_req: Request, res: Response) => {
    const store = getStore();
    res.json({ items: [...store.estimates].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)) });
  });

  app.post('/api/estimates', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    const product = store.products.find((p) => Number(p.id) === Number(body.product_id));
    if (!product || !body.customer_name) {
      res.status(400).json({ error: 'Customer name and product are required.' });
      return;
    }
    const qty = Math.max(1, Math.round(Number(body.quantity ?? 1)));
    const price = Math.max(0, Number(body.price ?? product.selling_price ?? 0));
    const subtotal = qty * price;
    const discount = Math.max(0, Number(body.discount ?? 0));
    const total = Math.max(0, subtotal - discount);
    const estId = nextId(store.estimates);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const est = {
      id: estId,
      estimate_no: `EST-${now.slice(0, 10).replace(/-/g, '')}-${String(estId).padStart(4, '0')}`,
      customer_id: body.customer_id ? Number(body.customer_id) : null,
      customer_name: String(body.customer_name).trim(),
      customer_phone: String(body.customer_phone ?? ''),
      subtotal,
      discount,
      total,
      status: 'pending',
      valid_until: String(body.valid_until ?? ''),
      notes: String(body.notes ?? ''),
      product_name: String(product.name),
      quantity: qty,
      created_at: now,
    };
    store.estimates.unshift(est);
    saveStore(store);
    res.status(201).json(est);
  });

  app.patch('/api/estimates/:id', (req: Request, res: Response) => {
    const store = getStore();
    const est = store.estimates.find((e) => Number(e.id) === Number(req.params.id));
    if (!est) {
      res.status(404).json({ error: 'Estimate not found.' });
      return;
    }
    est.status = String(req.body?.status ?? 'approved');
    saveStore(store);
    res.json(est);
  });

  // ---- Accounts & Expenses ----
  app.get('/api/accounts', (_req: Request, res: Response) => {
    const store = getStore();
    const accMap = new Map(store.bank_accounts.map((a) => [Number(a.id), String(a.account_name ?? '')]));
    const transactions = [...store.bank_transactions]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .map((tx) => ({ ...tx, account_name: accMap.get(Number(tx.bank_account_id)) ?? 'Account' }));
    res.json({ accounts: store.bank_accounts, transactions });
  });

  app.post('/api/accounts/transactions', (req: Request, res: Response) => {
    const store = getStore();
    const acc = store.bank_accounts.find((a) => Number(a.id) === Number(req.body?.bank_account_id));
    if (!acc) {
      res.status(400).json({ error: 'Account not found.' });
      return;
    }
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Transaction amount must be greater than 0.' });
      return;
    }
    const type = req.body?.type === 'withdraw' ? 'withdraw' : 'deposit';
    const currentBalance = Number(acc.balance ?? 0);
    if (type === 'withdraw' && amount > currentBalance + 0.009) {
      res.status(400).json({
        error: `Insufficient balance in "${acc.account_name}" (${currentBalance.toFixed(2)} available).`,
      });
      return;
    }
    const tx = {
      id: nextId(store.bank_transactions),
      bank_account_id: Number(acc.id),
      type,
      amount,
      description: String(req.body?.description ?? ''),
      transaction_date: String(req.body?.transaction_date ?? new Date().toISOString().slice(0, 10)),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.bank_transactions.unshift(tx);
    acc.balance = type === 'deposit' ? currentBalance + amount : Math.max(0, currentBalance - amount);
    saveStore(store);
    res.status(201).json({ transaction: tx, account: acc });
  });

  app.get('/api/expenses', (_req: Request, res: Response) => {
    const store = getStore();
    res.json({
      items: [...store.expenses].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)),
      categories: store.expense_categories,
    });
  });

  app.post('/api/expenses', (req: Request, res: Response) => {
    const store = getStore();
    const amount = Math.max(0.01, Number(req.body?.amount ?? 0));
    const category = String(req.body?.category ?? 'Other');
    const exp = {
      id: nextId(store.expenses),
      category,
      description: String(req.body?.description ?? ''),
      amount,
      expense_date: String(req.body?.expense_date ?? new Date().toISOString().slice(0, 10)),
      created_by: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.expenses.unshift(exp);
    saveStore(store);
    res.status(201).json(exp);
  });

  // ---- Returns & Damages ----
  app.get('/api/returns-damages', (_req: Request, res: Response) => {
    const store = getStore();
    const prodMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? '')]));
    res.json({
      returns: store.returns.map((r) => ({ ...r, product_name: prodMap.get(Number(r.product_id)) ?? 'Product' })),
      damages: store.damages.map((d) => ({ ...d, product_name: prodMap.get(Number(d.product_id)) ?? 'Product' })),
    });
  });

  app.post('/api/returns', (req: Request, res: Response) => {
    const store = getStore();
    const sale = store.sales.find((s) => Number(s.id) === Number(req.body?.sale_id));
    const product = store.products.find((p) => Number(p.id) === Number(req.body?.product_id));
    if (!sale || !product) {
      res.status(400).json({ error: 'Valid sale and product are required.' });
      return;
    }
    const qty = Math.max(1, Math.round(Number(req.body?.quantity ?? 1)));
    const price = Math.max(0, Number(req.body?.price ?? product.selling_price ?? 0));
    const row = {
      id: nextId(store.returns),
      sale_id: Number(sale.id),
      invoice_no: String(sale.invoice_no),
      customer_id: sale.customer_id ?? null,
      product_id: Number(product.id),
      quantity: qty,
      price,
      total_amount: qty * price,
      reason: String(req.body?.reason ?? 'Customer Return'),
      return_date: new Date().toISOString().slice(0, 10),
      created_by: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.returns.unshift(row);
    product.quantity = Number(product.quantity ?? 0) + qty;
    product.stock_quantity = product.quantity;
    saveStore(store);
    res.status(201).json(row);
  });

  app.post('/api/damages', (req: Request, res: Response) => {
    const store = getStore();
    const product = store.products.find((p) => Number(p.id) === Number(req.body?.product_id));
    if (!product) {
      res.status(400).json({ error: 'Valid product is required.' });
      return;
    }
    const available = Number(product.quantity ?? 0);
    const reqQty = Math.round(Number(req.body?.quantity ?? 0));
    if (!Number.isFinite(reqQty) || reqQty < 1) {
      res.status(400).json({ error: 'Damage quantity must be at least 1.' });
      return;
    }
    if (reqQty > available) {
      res.status(400).json({
        error: `Insufficient stock for damage entry on "${product.name}". Available stock: ${available}.`,
      });
      return;
    }
    const row = {
      id: nextId(store.damages),
      product_id: Number(product.id),
      quantity: reqQty,
      reason: String(req.body?.reason ?? 'Damaged item'),
      loss_amount: reqQty * Number(product.purchase_price ?? 0),
      damage_date: new Date().toISOString().slice(0, 10),
      created_by: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.damages.unshift(row);
    product.quantity = available - reqQty;
    product.stock_quantity = product.quantity;
    saveStore(store);
    res.status(201).json(row);
  });

  // ---- Reports ----
  app.get('/api/reports', (req: Request, res: Response) => {
    const store = getStore();
    const from = String(req.query.from ?? '2026-01-01');
    const to = String(req.query.to ?? '2099-12-31');

    const periodSales = store.sales.filter((s) => {
      const d = String(s.date ?? '');
      return d >= from && d <= to && String(s.status ?? 'completed') === 'completed';
    });

    const summary = periodSales.reduce<{
      invoiceCount: number;
      revenue: number;
      collected: number;
      due: number;
      profit: number;
    }>(
      (acc, s) => {
        acc.invoiceCount += 1;
        acc.revenue += Number(s.receivable ?? 0);
        acc.collected += Number(s.paid ?? 0);
        acc.due += Number(s.due ?? 0);
        acc.profit += Number(s.profit ?? 0);
        return acc;
      },
      { invoiceCount: 0, revenue: 0, collected: 0, due: 0, profit: 0 }
    );

    const expensesTotal = store.expenses
      .filter((e) => {
        const d = String(e.expense_date ?? '');
        return d >= from && d <= to;
      })
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

    const custDuesMap = new Map<number, { id: number; name: string; phone: string; due: number }>();
    for (const c of store.customers) {
      custDuesMap.set(Number(c.id), { id: Number(c.id), name: String(c.name ?? ''), phone: String(c.phone ?? ''), due: 0 });
    }
    for (const s of store.sales) {
      const cid = Number(s.customer_id ?? 0);
      const entry = custDuesMap.get(cid);
      if (entry) entry.due += Number(s.due ?? 0);
    }
    const customerDues = [...custDuesMap.values()].filter((c) => c.due > 0).sort((a, b) => b.due - a.due).slice(0, 30);

    const supDuesMap = new Map<number, { id: number; name: string; phone: string; due: number }>();
    for (const sup of store.suppliers) {
      supDuesMap.set(Number(sup.id), { id: Number(sup.id), name: String(sup.name ?? ''), phone: String(sup.phone ?? ''), due: 0 });
    }
    for (const p of store.purchases) {
      const sid = Number(p.supplier_id ?? 0);
      const entry = supDuesMap.get(sid);
      if (entry) entry.due += Number(p.due ?? 0);
    }
    const supplierDues = [...supDuesMap.values()].filter((s) => s.due > 0).sort((a, b) => b.due - a.due).slice(0, 30);

    res.json({
      from,
      to,
      summary,
      expensesTotal,
      netProfit: summary.profit - expensesTotal,
      customerDues,
      supplierDues,
    });
  });

  // ---- Dynamic Menus & Settings ----
  app.get('/api/menus', (_req: Request, res: Response) => {
    const store = getStore();
    res.json([...store.menus].sort((a, b) => a.sort_order - b.sort_order));
  });

  app.post('/api/menus', (req: Request, res: Response) => {
    const store = getStore();
    const body = req.body ?? {};
    if (!body.title) {
      res.status(400).json({ error: 'Menu title is required.' });
      return;
    }
    const menu = {
      id: nextId(store.menus),
      parent_id: null,
      title: String(body.title).trim(),
      group_label: String(body.group_label ?? 'Custom').trim() || 'Custom',
      route_key: String(body.route_key ?? 'dashboard').trim(),
      url: String(body.url ?? '/dashboard').trim(),
      icon: String(body.icon ?? 'circle').trim(),
      sort_order: Number(body.sort_order ?? store.menus.length + 1),
      roles: Array.isArray(body.roles) && body.roles.length ? body.roles.map(String) : ['admin', 'manager', 'staff'],
      is_active: body.is_active !== false,
    };
    store.menus.push(menu);
    saveStore(store);
    res.status(201).json(menu);
  });

  app.put('/api/menus/:id', (req: Request, res: Response) => {
    const store = getStore();
    const menu = store.menus.find((m) => m.id === Number(req.params.id));
    if (!menu) {
      res.status(404).json({ error: 'Menu item not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.title !== undefined) menu.title = String(body.title).trim();
    if (body.group_label !== undefined) menu.group_label = String(body.group_label).trim();
    if (body.route_key !== undefined) menu.route_key = String(body.route_key).trim();
    if (body.icon !== undefined) menu.icon = String(body.icon).trim();
    if (body.sort_order !== undefined) menu.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) menu.is_active = Boolean(body.is_active);
    if (Array.isArray(body.roles)) menu.roles = body.roles.map(String);
    saveStore(store);
    res.json(menu);
  });

  app.post('/api/menus/reorder', (req: Request, res: Response) => {
    const store = getStore();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    ids.forEach((id: number, idx: number) => {
      const m = store.menus.find((item) => item.id === id);
      if (m) m.sort_order = idx + 1;
    });
    saveStore(store);
    res.json([...store.menus].sort((a, b) => a.sort_order - b.sort_order));
  });

  app.delete('/api/menus/:id', (req: Request, res: Response) => {
    const store = getStore();
    store.menus = store.menus.filter((m) => m.id !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    const store = getStore();
    const allowed = [
      'shop_name', 'shop_address', 'shop_phone', 'shop_email', 'shop_website',
      'shop_logo', 'shop_favicon', 'shop_qr',
      'currency', 'tax_rate', 'invoice_footer', 'sidebar_theme', 'primary_color', 'layout_mode',
    ];
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) {
        store.settings[key] = String(req.body[key]);
      }
    }
    saveStore(store);
    res.json(store.settings);
  });

  // ---- Auth & Password Recovery ----
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const store = getStore();
    const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!identifier || !password) {
      res.status(400).json({ error: 'Email or username and password are required.' });
      return;
    }

    const user = store.users.find(
      (u) => u.email.toLowerCase() === identifier || u.name.toLowerCase() === identifier
    );
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials. Please check your email/username and password.' });
      return;
    }
    if (!user.is_active) {
      res.status(403).json({ error: 'This account is currently disabled. Contact an administrator.' });
      return;
    }

    let firstTimeActivated = false;
    if (user.password_hash) {
      if (!verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Incorrect password. Use Forgot Password to recover access.' });
        return;
      }
    } else {
      if (password.length < 6) {
        res.status(400).json({ error: 'First-time password activation requires at least 6 characters.' });
        return;
      }
      user.password_hash = hashPassword(password);
      saveStore(store);
      firstTimeActivated = true;
    }

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      userId: user.id,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    res.json({
      token,
      firstTimeActivated,
      user: sanitizeUser(user),
    });
  });

  app.post('/api/auth/recover-password', (req: Request, res: Response) => {
    const store = getStore();
    const identifier = String(req.body?.identifier ?? req.body?.email ?? '').trim().toLowerCase();
    const phoneInput = normalizePhoneDigits(req.body?.phone);
    const newPassword = String(req.body?.new_password ?? '');

    if (!identifier || !phoneInput || !newPassword) {
      res.status(400).json({ error: 'Email/username, registered phone number, and new password are required.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const user = store.users.find(
      (u) => u.email.toLowerCase() === identifier || u.name.toLowerCase() === identifier
    );
    if (!user) {
      res.status(404).json({ error: 'No matching account found for that email or username.' });
      return;
    }
    if (!user.is_active) {
      res.status(403).json({ error: 'Disabled accounts cannot reset passwords.' });
      return;
    }

    const userPhone = normalizePhoneDigits(user.phone);
    const shopPhone = normalizePhoneDigits(store.settings.shop_phone);
    const tail = (digits: string) => (digits.length >= 8 ? digits.slice(-10) : digits);
    const phoneMatched =
      (userPhone.length >= 6 && tail(userPhone) === tail(phoneInput)) ||
      (user.role === 'admin' && shopPhone.length >= 6 && tail(shopPhone) === tail(phoneInput));

    if (!phoneMatched) {
      res.status(403).json({
        error: 'Phone number verification failed. Enter the registered phone number for this account.',
      });
      return;
    }

    user.password_hash = hashPassword(newPassword);
    saveStore(store);

    for (const [tok, sess] of activeSessions.entries()) {
      if (sess.userId === user.id) activeSessions.delete(tok);
    }

    res.json({
      ok: true,
      message: 'Password has been reset successfully. Please sign in with your new password.',
    });
  });

  app.post('/api/auth/change-password', (req: Request, res: Response) => {
    const store = getStore();
    const userId = Number(req.body?.user_id ?? 0);
    const currentPassword = String(req.body?.current_password ?? '');
    const newPassword = String(req.body?.new_password ?? '');

    if (!userId || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const user = store.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    if (user.password_hash && !verifyPassword(currentPassword, user.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    user.password_hash = hashPassword(newPassword);
    saveStore(store);
    res.json({ ok: true, user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization ?? '');
    if (authHeader.startsWith('Bearer ')) {
      activeSessions.delete(authHeader.slice(7).trim());
    }
    res.json({ ok: true });
  });

  // ---- Users (never expose password hashes) ----
  app.get('/api/users', (_req: Request, res: Response) => {
    const store = getStore();
    res.json(store.users.map(sanitizeUser));
  });

  app.post('/api/users', (req: Request, res: Response) => {
    const store = getStore();
    const { name, email, role, phone, address, password } = req.body ?? {};
    const cleanName = String(name ?? '').trim();
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      res.status(400).json({ error: 'Name and email are required.' });
      return;
    }
    if (store.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const cleanPassword = String(password ?? '');
    if (cleanPassword && cleanPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    const user = {
      id: nextId(store.users),
      name: cleanName,
      email: cleanEmail,
      role: ['admin', 'manager', 'staff'].includes(String(role)) ? String(role) : 'staff',
      phone: String(phone ?? '').trim(),
      address: String(address ?? '').trim(),
      ...(cleanPassword ? { password_hash: hashPassword(cleanPassword) } : {}),
      is_active: true,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.users.push(user);
    saveStore(store);
    res.status(201).json(sanitizeUser(user));
  });

  app.put('/api/users/:id', (req: Request, res: Response) => {
    const store = getStore();
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const body = req.body ?? {};
    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!n) {
        res.status(400).json({ error: 'Name cannot be empty.' });
        return;
      }
      user.name = n;
    }
    if (body.email !== undefined) {
      const e = String(body.email).trim().toLowerCase();
      if (!e) {
        res.status(400).json({ error: 'Email cannot be empty.' });
        return;
      }
      if (store.users.some((u) => u.id !== user.id && u.email.toLowerCase() === e)) {
        res.status(409).json({ error: 'Another user already uses this email.' });
        return;
      }
      user.email = e;
    }
    if (body.phone !== undefined) user.phone = String(body.phone).trim();
    if (body.address !== undefined) user.address = String(body.address).trim();
    if (body.profile_image === null || body.profile_image === '') {
      user.profile_image = null;
    } else if (typeof body.profile_image === 'string' && body.profile_image.startsWith('/uploads/')) {
      user.profile_image = body.profile_image;
    }
    if (body.role !== undefined && ['admin', 'manager', 'staff'].includes(String(body.role))) {
      user.role = String(body.role);
    }
    if (body.password !== undefined && String(body.password) !== '') {
      const p = String(body.password);
      if (p.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters.' });
        return;
      }
      user.password_hash = hashPassword(p);
    }
    saveStore(store);
    res.json(sanitizeUser(user));
  });

  app.post('/api/users/:id/avatar', (req: Request, res: Response) => {
    const store = getStore();
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const dataUrl = String(req.body?.image_data ?? '');
    if (!dataUrl) {
      user.profile_image = null;
      saveStore(store);
      res.json(sanitizeUser(user));
      return;
    }
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      res.status(400).json({ error: 'Please upload a valid PNG, JPG, or WEBP image.' });
      return;
    }
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Profile image must be under 2MB.' });
      return;
    }
    const fileName = `user-${user.id}-${Date.now()}.${ext}`;
    const targetPath = path.join(uploadsDir, fileName);
    fs.writeFileSync(targetPath, buffer);
    user.profile_image = `/uploads/avatars/${fileName}`;
    saveStore(store);
    res.json(sanitizeUser(user));
  });

  app.patch('/api/users/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const user = store.users.find((u) => u.id === Number(req.params.id));
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.is_active = !user.is_active;
    saveStore(store);
    res.json(sanitizeUser(user));
  });

  app.delete('/api/users/:id', (req: Request, res: Response) => {
    const store = getStore();
    const targetId = Number(req.params.id);
    if (targetId === 1) {
      res.status(400).json({ error: 'Primary administrator account cannot be deleted.' });
      return;
    }
    store.users = store.users.filter((u) => u.id !== targetId);
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Owners ----
  app.get('/api/owners', (_req: Request, res: Response) => {
    const store = getStore();
    res.json([...store.owners].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
  });

  app.post('/api/owners', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    const sharePercent = Number(req.body?.share_percent ?? 0);
    if (!name) {
      res.status(400).json({ error: 'Owner name is required.' });
      return;
    }
    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) {
      res.status(400).json({ error: 'Share percentage must be between 0 and 100.' });
      return;
    }
    const owner = {
      id: nextId(store.owners),
      name,
      phone: String(req.body?.phone ?? '').trim(),
      email: String(req.body?.email ?? '').trim(),
      address: String(req.body?.address ?? '').trim(),
      share_percent: sharePercent,
      is_active: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.owners.unshift(owner);
    saveStore(store);
    res.status(201).json(owner);
  });

  app.patch('/api/owners/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const owner = store.owners.find((o) => Number(o.id) === Number(req.params.id));
    if (!owner) {
      res.status(404).json({ error: 'Owner not found.' });
      return;
    }
    owner.is_active = Number(owner.is_active) === 1 ? 0 : 1;
    saveStore(store);
    res.json(owner);
  });

  app.delete('/api/owners/:id', (req: Request, res: Response) => {
    const store = getStore();
    store.owners = store.owners.filter((o) => Number(o.id) !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Bank Account Creation ----
  app.post('/api/accounts', (req: Request, res: Response) => {
    const store = getStore();
    const accountName = String(req.body?.account_name ?? '').trim();
    const bankName = String(req.body?.bank_name ?? '').trim();
    const openingBalance = Number(req.body?.opening_balance ?? 0);
    if (!accountName) {
      res.status(400).json({ error: 'Account name is required.' });
      return;
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      res.status(400).json({ error: 'Opening balance cannot be negative.' });
      return;
    }
    const acc = {
      id: nextId(store.bank_accounts),
      bank_name: bankName || accountName,
      account_name: accountName,
      branch: String(req.body?.branch ?? '').trim() || null,
      opening_balance: openingBalance,
      balance: openingBalance,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.bank_accounts.push(acc);
    saveStore(store);
    res.status(201).json(acc);
  });

  // ---- Cash Book ----
  app.get('/api/cashbook', (_req: Request, res: Response) => {
    const store = getStore();
    const rows = [...store.cash_transactions].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0));
    let totalIn = 0;
    let totalOut = 0;
    for (const r of rows) {
      if (String(r.type) === 'in') totalIn += Number(r.amount ?? 0);
      else totalOut += Number(r.amount ?? 0);
    }
    res.json({
      items: rows,
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
    });
  });

  app.post('/api/cashbook', (req: Request, res: Response) => {
    const store = getStore();
    const type = req.body?.type === 'out' ? 'out' : 'in';
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Cash transaction amount must be greater than 0.' });
      return;
    }
    let totalIn = 0;
    let totalOut = 0;
    for (const r of store.cash_transactions) {
      if (String(r.type) === 'in') totalIn += Number(r.amount ?? 0);
      else totalOut += Number(r.amount ?? 0);
    }
    const currentCash = totalIn - totalOut;
    if (type === 'out' && amount > currentCash + 0.009) {
      res.status(400).json({ error: `Insufficient cash book balance (${currentCash.toFixed(2)} available).` });
      return;
    }
    const row = {
      id: nextId(store.cash_transactions),
      type,
      amount,
      description: String(req.body?.description ?? '').trim(),
      transaction_date: String(req.body?.transaction_date ?? new Date().toISOString().slice(0, 10)),
      created_by: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.cash_transactions.unshift(row);
    saveStore(store);
    res.status(201).json(row);
  });

  // ---- Stock & Movements ----
  app.get('/api/stock', (req: Request, res: Response) => {
    const store = getStore();
    const q = sanitizeSearch(req.query.q);
    const filter = String(req.query.filter ?? 'all');
    const catMap = new Map(store.categories.map((c) => [Number(c.id), String(c.name ?? '')]));
    const prodMap = new Map(store.products.map((p) => [Number(p.id), String(p.name ?? 'Product')]));

    let products: Array<Record<string, unknown>> = store.products
      .filter((p) => Number(p.status ?? 1) === 1)
      .map((p) => ({
        ...p,
        category_name: catMap.get(Number(p.category_id)) ?? 'Uncategorized',
        quantity: Number(p.stock_quantity ?? p.quantity ?? 0),
      }));

    if (q) {
      products = products.filter(
        (p) =>
          String(p.name ?? '').toLowerCase().includes(q) ||
          String(p.sku ?? '').toLowerCase().includes(q) ||
          String(p.category_name ?? '').toLowerCase().includes(q)
      );
    }
    if (filter === 'low') {
      products = products.filter((p) => Number(p.quantity ?? 0) > 0 && Number(p.quantity ?? 0) <= Number(p.alert_quantity ?? 5));
    } else if (filter === 'out') {
      products = products.filter((p) => Number(p.quantity ?? 0) <= 0);
    }

    const movements = [...store.stock_movements]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .slice(0, 80)
      .map((m) => ({
        ...m,
        product_name: prodMap.get(Number(m.product_id)) ?? 'Product',
      }));

    res.json({ products, movements });
  });

  // ---- Payments (Customer Collections + Supplier Payments) ----
  app.get('/api/payments', (_req: Request, res: Response) => {
    const store = getStore();
    const saleMap = new Map(store.sales.map((s) => [Number(s.id), s]));
    const purMap = new Map(store.purchases.map((p) => [Number(p.id), p]));
    const custMap = new Map(store.customers.map((c) => [Number(c.id), String(c.name ?? '')]));
    const supMap = new Map(store.suppliers.map((s) => [Number(s.id), String(s.name ?? '')]));

    const customerPayments = [...store.payments]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .map((p) => {
        const s = saleMap.get(Number(p.sale_id));
        return {
          ...p,
          invoice_no: s ? String(s.invoice_no ?? '') : `#${p.sale_id}`,
          party_name:
            (s ? String(s.customer_name ?? '') : '') ||
            custMap.get(Number(p.customer_id)) ||
            'Walk-in Customer',
        };
      });

    const supplierPayments = [...store.supplier_payments]
      .sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0))
      .map((p) => {
        const pur = purMap.get(Number(p.purchase_id));
        return {
          ...p,
          invoice_no: pur ? String(pur.invoice_no ?? '') : `#${p.purchase_id}`,
          party_name: supMap.get(Number(p.supplier_id ?? pur?.supplier_id)) || 'Supplier',
        };
      });

    const dueSales = store.sales
      .filter((s) => Number(s.due ?? 0) > 0.009)
      .map((s) => ({
        id: Number(s.id),
        invoice_no: String(s.invoice_no ?? ''),
        customer_name: String(s.customer_name ?? 'Customer'),
        due: Number(s.due ?? 0),
      }));

    const duePurchases = store.purchases
      .filter((p) => Number(p.due ?? 0) > 0.009)
      .map((p) => ({
        id: Number(p.id),
        invoice_no: String(p.invoice_no ?? ''),
        supplier_name: supMap.get(Number(p.supplier_id)) || 'Supplier',
        due: Number(p.due ?? 0),
      }));

    res.json({ customerPayments, supplierPayments, dueSales, duePurchases });
  });

  // ---- Employees & Salary ----
  app.get('/api/employees', (_req: Request, res: Response) => {
    const store = getStore();
    res.json([...store.employees].sort((a, b) => Number(b.id ?? 0) - Number(a.id ?? 0)));
  });

  app.post('/api/employees', (req: Request, res: Response) => {
    const store = getStore();
    const name = String(req.body?.name ?? '').trim();
    const salary = Number(req.body?.salary ?? 0);
    if (!name) {
      res.status(400).json({ error: 'Employee name is required.' });
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      res.status(400).json({ error: 'Salary cannot be negative.' });
      return;
    }
    const emp = {
      id: nextId(store.employees),
      employee_id: String(req.body?.employee_id ?? '').trim() || `EMP-${String(nextId(store.employees)).padStart(3, '0')}`,
      name,
      email: String(req.body?.email ?? '').trim(),
      phone: String(req.body?.phone ?? '').trim(),
      address: String(req.body?.address ?? '').trim(),
      designation: String(req.body?.designation ?? '').trim() || 'Staff',
      department: String(req.body?.department ?? '').trim() || 'Operations',
      joining_date: String(req.body?.joining_date ?? new Date().toISOString().slice(0, 10)),
      salary,
      status: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.employees.unshift(emp);
    saveStore(store);
    res.status(201).json(emp);
  });

  app.post('/api/employees/:id/pay-salary', (req: Request, res: Response) => {
    const store = getStore();
    const emp = store.employees.find((e) => Number(e.id) === Number(req.params.id));
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    const amount = Number(req.body?.amount ?? emp.salary ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'Salary payment amount must be greater than 0.' });
      return;
    }
    const exp = {
      id: nextId(store.expenses),
      category: 'Salary',
      description: `Salary paid to ${emp.name} (${emp.designation || 'Staff'})${req.body?.note ? ` - ${req.body.note}` : ''}`,
      amount,
      expense_date: String(req.body?.date ?? new Date().toISOString().slice(0, 10)),
      created_by: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    store.expenses.unshift(exp);
    saveStore(store);
    res.status(201).json(exp);
  });

  app.patch('/api/employees/:id/toggle', (req: Request, res: Response) => {
    const store = getStore();
    const emp = store.employees.find((e) => Number(e.id) === Number(req.params.id));
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }
    emp.status = Number(emp.status ?? 1) === 1 ? 0 : 1;
    saveStore(store);
    res.json(emp);
  });

  app.delete('/api/employees/:id', (req: Request, res: Response) => {
    const store = getStore();
    store.employees = store.employees.filter((e) => Number(e.id) !== Number(req.params.id));
    saveStore(store);
    res.json({ ok: true });
  });

  // ---- Backup & Restore ----
  app.get('/api/backup/export', (_req: Request, res: Response) => {
    const store = getStore();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="youthit-pos-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(store, null, 2));
  });

  app.post('/api/backup/restore', (req: Request, res: Response) => {
    const payload = req.body?.backup;
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.products) || !Array.isArray(payload.sales)) {
      res.status(400).json({ error: 'Invalid backup JSON file. Required POS tables missing.' });
      return;
    }
    saveStore(payload);
    res.json({ ok: true, products: payload.products.length, sales: payload.sales.length });
  });

  // ---- Laravel 13 Codebase Inspector & ZIP Export ----
  const laravelRoot = path.resolve(process.cwd(), 'laravel');

  app.get('/api/laravel/tree', (_req: Request, res: Response) => {
    const files = collectFiles(laravelRoot, laravelRoot);
    res.json({ files });
  });

  app.get('/api/laravel/file', (req: Request, res: Response) => {
    const rel = String(req.query.path ?? '');
    const target = path.resolve(laravelRoot, rel);
    if (!target.startsWith(laravelRoot) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    const stats = fs.statSync(target);
    if (stats.size > 350_000) {
      res.json({ path: rel, content: `/* Large SQL file (${(stats.size / 1024).toFixed(1)} KB) — included in ZIP download */` });
      return;
    }
    res.json({ path: rel, content: fs.readFileSync(target, 'utf8') });
  });

  app.get('/api/laravel/download-zip', async (_req: Request, res: Response) => {
    const zip = new JSZip();
    const files = collectFiles(laravelRoot, laravelRoot);
    for (const rel of files) {
      const full = path.join(laravelRoot, rel);
      zip.file(`youthit-pos-laravel/${rel}`, fs.readFileSync(full));
    }
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="youthit-pos-laravel-13.zip"');
    res.send(buffer);
  });

  // ---- Vite / Static Frontend ----
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Youth IT POS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
