import { useEffect, useState } from 'react';
import {
  Ban,
  Box,
  Boxes,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Edit3,
  FileText,
  List,
  MoreVertical,
  Package,
  PlusCircle,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { BootstrapPayload, Product } from '../types/pos.ts';

interface ProductsViewProps {
  bootstrap: BootstrapPayload;
  initialTab?: 'products' | 'units' | 'categories' | 'brands' | 'catalog';
  onRefreshBootstrap: () => void;
}

export function ProductsView({ bootstrap, initialTab = 'products', onRefreshBootstrap }: ProductsViewProps) {
  const cur = bootstrap.settings.currency || '৳';
  const [tab, setTab] = useState<'products' | 'add' | 'edit' | 'units' | 'categories' | 'brands' | 'catalog'>(
    initialTab
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [gotoInput, setGotoInput] = useState('1');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<{ id: number; top: number; left: number } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_id: '',
    brand_id: '',
    purchase_price: '',
    selling_price: '',
    quantity: '0',
    alert_quantity: '5',
    warranty: '1 Year',
  });

  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newWarranty, setNewWarranty] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    function closeMenu() {
      setOpenMenu(null);
    }
    document.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  function loadProducts() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (query.trim()) params.set('q', query.trim());
    apiFetch<{ items: Product[]; total: number }>(`/api/products?${params.toString()}`)
      .then((res) => {
        setProducts(res.items);
        setTotal(res.total);
        setGotoInput(String(page));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, [page, limit, query]);

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    const pp = Number(form.purchase_price);
    const sp = Number(form.selling_price);
    const qty = Number(form.quantity);
    if (pp < 0 || sp < 0 || qty < 0) {
      setToast({ type: 'error', message: 'Prices and stock quantity cannot be negative.' });
      return;
    }
    try {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          purchase_price: pp,
          selling_price: sp,
          quantity: qty,
          alert_quantity: Math.max(0, Number(form.alert_quantity)),
        }),
      });
      setForm({
        name: '',
        sku: '',
        barcode: '',
        category_id: '',
        brand_id: '',
        purchase_price: '',
        selling_price: '',
        quantity: '0',
        alert_quantity: '5',
        warranty: '1 Year',
      });
      setTab('products');
      setToast({ type: 'success', message: 'Product added successfully!' });
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create product.' });
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const pp = Number(form.purchase_price);
    const sp = Number(form.selling_price);
    if (pp < 0 || sp < 0) {
      setToast({ type: 'error', message: 'Prices cannot be negative.' });
      return;
    }
    try {
      await apiFetch(`/api/products/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          sku: form.sku,
          category_id: form.category_id || null,
          brand_id: form.brand_id || null,
          purchase_price: pp,
          selling_price: sp,
          alert_quantity: Math.max(0, Number(form.alert_quantity)),
          warranty: form.warranty,
        }),
      });
      setEditTarget(null);
      setTab('products');
      setToast({ type: 'success', message: 'Product updated successfully!' });
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update product.' });
    }
  }

  async function handleAdjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    const newQty = Number(adjustQty);
    if (!Number.isFinite(newQty) || newQty < 0) {
      setToast({ type: 'error', message: 'Stock quantity cannot be negative.' });
      return;
    }
    try {
      await apiFetch(`/api/products/${adjustTarget.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ new_quantity: newQty, reason: adjustReason }),
      });
      setAdjustTarget(null);
      setToast({ type: 'success', message: 'Stock quantity adjusted successfully!' });
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to adjust stock.' });
    }
  }

  async function handleToggleStatus(product: Product) {
    try {
      await apiFetch(`/api/products/${product.id}/toggle`, { method: 'PATCH' });
      setToast({ type: 'success', message: `Product "${product.name}" status updated.` });
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to toggle status.' });
    }
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      setToast({ type: 'success', message: `Product "${deleteTarget.name}" archived.` });
      setDeleteTarget(null);
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete product.' });
    }
  }

  async function addCatalogItem(kind: 'categories' | 'brands' | 'units' | 'warranties', name: string, clear: () => void) {
    if (!name.trim()) return;
    try {
      await apiFetch(`/api/catalog/${kind}`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), duration: name.trim() }),
      });
      clear();
      setToast({ type: 'success', message: 'Catalog item saved!' });
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add catalog item.' });
    }
  }

  function startEditProduct(p: Product) {
    setEditTarget(p);
    setForm({
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      category_id: p.category_id ? String(p.category_id) : '',
      brand_id: p.brand_id ? String(p.brand_id) : '',
      purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price),
      quantity: String(p.quantity),
      alert_quantity: String(p.alert_quantity ?? 5),
      warranty: p.warranty || 'No Warranty',
    });
    setTab('edit');
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  const now = new Date();
  const dateDisplay = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeDisplay = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-l-4 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
              : 'bg-red-50 border-red-500 text-red-800'
          }`}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modern Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            className="w-11 h-11 sm:w-[56px] sm:h-[56px] rounded-2xl flex items-center justify-center text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            <Boxes className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-[26px] font-extrabold text-[#0f172a] tracking-tight truncate">
              Product{' '}
              <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">
                Management
              </span>
            </h1>
            <p className="text-xs sm:text-[13px] text-[#64748b] flex flex-wrap items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" /> {dateDisplay} &bull; <Clock className="w-3.5 h-3.5 shrink-0" /> {timeDisplay}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditTarget(null);
            setForm({
              name: '',
              sku: '',
              barcode: '',
              category_id: '',
              brand_id: '',
              purchase_price: '',
              selling_price: '',
              quantity: '0',
              alert_quantity: '5',
              warranty: '1 Year',
            });
            setTab('add');
          }}
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 shrink-0" /> Add Product
        </button>
      </div>

      {/* Reference Tabs Bar */}
      <div className="bg-white rounded-[20px] p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] flex sm:inline-flex flex-wrap gap-1 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => setTab('products')}
          style={tab === 'products' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            tab === 'products'
              ? 'text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
              : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]'
          }`}
        >
          <List className="w-4 h-4 shrink-0" /> Products
        </button>
        <button
          type="button"
          onClick={() => {
            setEditTarget(null);
            setTab('add');
          }}
          style={tab === 'add' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            tab === 'add'
              ? 'text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
              : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]'
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" /> Add Product
        </button>
        {tab === 'edit' && editTarget && (
          <button
            type="button"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 sm:gap-2 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]"
          >
            <Edit3 className="w-4 h-4 shrink-0" /> Edit Product
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('categories')}
          style={tab === 'categories' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            tab === 'categories'
              ? 'text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
              : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" /> Categories
        </button>
        <button
          type="button"
          onClick={() => setTab('brands')}
          style={tab === 'brands' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            tab === 'brands'
              ? 'text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
              : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" /> Brand
        </button>
        <button
          type="button"
          onClick={() => setTab('units')}
          style={tab === 'units' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
          className={`px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
            tab === 'units'
              ? 'text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]'
              : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]'
          }`}
        >
          <Shield className="w-4 h-4 shrink-0" /> Unit &amp; Warranty
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'products' && (
        <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] overflow-visible">
          {/* Table Header with Inline Search */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] rounded-t-[20px] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <List className="w-5 h-5 text-[#4f46e5] shrink-0" />
              <h3 className="text-base font-semibold text-[#1e293b]">Product List</h3>
              <span
                className="px-3 py-0.5 rounded-full text-xs font-medium text-white tabular-nums"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {total.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto sm:flex-1 sm:max-w-[460px] justify-end">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setPage(1);
                    setQuery(e.target.value);
                  }}
                  placeholder="Search by Name, SKU, Category, Brand..."
                  className="w-full pl-9 pr-8 py-2 border-2 border-[#e2e8f0] rounded-lg text-[13px] text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      setQuery('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4 shrink-0" />
                  </button>
                )}
              </div>
              <div className="text-[13px] text-[#64748b] whitespace-nowrap px-3 py-1.5 bg-[#f8fafc] rounded-md border border-[#e2e8f0] hidden md:flex items-center gap-1.5 tabular-nums shrink-0">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <strong className="text-[#334155]">{products.length}</strong> of{' '}
                <strong className="text-[#334155]">{total.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto px-1">
            <table className="w-full text-[13px] border-collapse">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] w-10">
                    #
                  </th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] w-16">
                    Image
                  </th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] min-w-[200px]">
                    Product
                  </th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Category
                  </th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Brand
                  </th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Warranty
                  </th>
                  <th className="py-3.5 px-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Price
                  </th>
                  <th className="py-3.5 px-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Cost
                  </th>
                  <th className="py-3.5 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Stock
                  </th>
                  <th className="py-3.5 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#f1f5f9]">
                      <td colSpan={10} className="px-4 py-3.5">
                        <div className="h-6 bg-slate-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : products.length > 0 ? (
                  products.map((p, idx) => {
                    const qty = Number(p.quantity ?? 0);
                    const alertQty = Number(p.alert_quantity ?? 5);
                    const stockState = qty <= 0 ? 'out' : qty <= alertQty ? 'low' : 'in';
                    const hasWarranty = Boolean(p.warranty && p.warranty !== 'No Warranty');

                    return (
                      <tr key={p.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                        <td className="py-3 px-4 text-[#64748b] tabular-nums">{offset + idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="w-12 h-12 rounded-[10px] bg-[#f1f5f9] flex items-center justify-center text-[#94a3b8] overflow-hidden shrink-0">
                            <Box className="w-5 h-5" />
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1e293b] text-sm">{p.name}</div>
                          <div className="text-[11px] text-[#94a3b8]">
                            SKU: {p.sku || 'N/A'}
                            {p.barcode ? ` | ${p.barcode}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-medium bg-[#eef2ff] text-[#4f46e5]">
                            {p.category_name || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f5f9] text-[#475569]">
                            {p.brand_name || 'No Brand'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {hasWarranty ? (
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-medium bg-[#eef2ff] text-[#4f46e5]">
                              <Shield className="w-3 h-3" /> {p.warranty}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f5f9] text-[#94a3b8]">
                              <Ban className="w-3 h-3" /> No Warranty
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#1e293b] tabular-nums whitespace-nowrap">
                          {formatMoney(p.selling_price, cur)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#64748b] tabular-nums whitespace-nowrap">
                          {formatMoney(p.purchase_price, cur)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-semibold ${
                              stockState === 'in'
                                ? 'bg-[#d1fae5] text-[#059669]'
                                : stockState === 'low'
                                  ? 'bg-[#fef3c7] text-[#d97706]'
                                  : 'bg-[#fee2e2] text-[#dc2626]'
                            }`}
                          >
                            <span
                              className={`w-[7px] h-[7px] rounded-full ${
                                stockState === 'in'
                                  ? 'bg-[#059669]'
                                  : stockState === 'low'
                                    ? 'bg-[#d97706]'
                                    : 'bg-[#dc2626]'
                              }`}
                            />
                            {stockState === 'in' ? 'In Stock' : stockState === 'low' ? 'Low Stock' : 'Out of Stock'}
                            <span className="font-bold">({qty.toLocaleString()})</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenu?.id === p.id) {
                                setOpenMenu(null);
                                return;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuWidth = 192;
                              const estimatedHeight = 168;
                              const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const top = spaceBelow >= estimatedHeight + 8 ? rect.bottom + 6 : Math.max(12, rect.top - estimatedHeight - 6);
                              setOpenMenu({ id: p.id, top, left });
                            }}
                            className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#4f46e5] cursor-pointer"
                            aria-label="Product actions"
                          >
                            <MoreVertical className="w-4 h-4 shrink-0" />
                          </button>

                          {openMenu?.id === p.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ top: openMenu.top, left: openMenu.left }}
                              className="fixed w-48 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.16)] border border-[#e2e8f0] py-1.5 z-50 text-left"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setAdjustTarget(p);
                                  setAdjustQty(String(p.quantity));
                                  setAdjustReason('');
                                }}
                                className="w-full px-4 py-2 text-[13px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#4f46e5] flex items-center gap-2.5 cursor-pointer"
                              >
                                <Package className="w-4 h-4 shrink-0" /> Adjust Stock
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  startEditProduct(p);
                                }}
                                className="w-full px-4 py-2 text-[13px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#4f46e5] flex items-center gap-2.5 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4 shrink-0" /> Edit Product
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  handleToggleStatus(p);
                                }}
                                className="w-full px-4 py-2 text-[13px] text-[#f59e0b] hover:bg-[#fef3c7] hover:text-[#d97706] flex items-center gap-2.5 cursor-pointer"
                              >
                                <Ban className="w-4 h-4 shrink-0" /> Deactivate
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setDeleteTarget(p);
                                }}
                                className="w-full px-4 py-2 text-[13px] text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#dc2626] flex items-center gap-2.5 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 shrink-0" /> Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Package className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-[#334155]">No Products Found</h3>
                      <p className="text-sm text-[#94a3b8] mt-1">Try adjusting your search criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Full Pagination Bar */}
          <div className="px-5 py-4 border-t border-[#f1f5f9] bg-[#f8fafc] rounded-b-[20px] flex flex-wrap items-center justify-between gap-3.5 text-[13px]">
            <div className="text-[#64748b] tabular-nums">
              <strong>{total === 0 ? 0 : offset + 1}</strong> – <strong>{Math.min(offset + limit, total)}</strong> of{' '}
              <strong>{total.toLocaleString()}</strong>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                className="min-w-[38px] h-[38px] px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-w-[38px] h-[38px] px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {startPage > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    className="min-w-[38px] h-[38px] px-3 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] cursor-pointer"
                  >
                    1
                  </button>
                  {startPage > 2 && <span className="px-1 text-[#94a3b8]">…</span>}
                </>
              )}

              {pageNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  style={num === page ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
                  className={`min-w-[38px] h-[38px] px-3 border rounded-lg font-medium cursor-pointer ${
                    num === page
                      ? 'text-white border-[#4f46e5] shadow-[0_2px_8px_rgba(79,70,229,0.3)]'
                      : 'border-[#e2e8f0] bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5]'
                  }`}
                >
                  {num}
                </button>
              ))}

              {endPage < totalPages && (
                <>
                  {endPage < totalPages - 1 && <span className="px-1 text-[#94a3b8]">…</span>}
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className="min-w-[38px] h-[38px] px-3 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] cursor-pointer"
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="min-w-[38px] h-[38px] px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                className="min-w-[38px] h-[38px] px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-[#64748b]">
                <span>Show:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setPage(1);
                    setLimit(Number(e.target.value));
                  }}
                  className="px-2.5 py-1.5 border border-[#e2e8f0] rounded-md bg-white text-[#334155]"
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-[#64748b]">
                <span>Go:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={gotoInput}
                  onChange={(e) => setGotoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = Math.min(totalPages, Math.max(1, Number(gotoInput) || 1));
                      setPage(target);
                    }
                  }}
                  className="w-14 px-2 py-1.5 border border-[#e2e8f0] rounded-md text-center bg-white tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => {
                    const target = Math.min(totalPages, Math.max(1, Number(gotoInput) || 1));
                    setPage(target);
                  }}
                  className="px-3.5 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-md font-medium cursor-pointer"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === 'add' || tab === 'edit') && (
        <div className="bg-white rounded-[20px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] max-w-2xl">
          <h2 className="text-lg font-bold text-[#1e293b] mb-4 pb-3 border-b border-[#f1f5f9]">
            {tab === 'edit' && editTarget ? `Edit Product: ${editTarget.name}` : 'Add New Product'}
          </h2>
          <form onSubmit={tab === 'edit' ? handleUpdateProduct : handleAddProduct} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="Enter product name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">SKU</label>
                <input
                  type="text"
                  placeholder="Optional SKU"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Barcode</label>
                <input
                  type="text"
                  placeholder="Optional barcode"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="">Select Category</option>
                  {bootstrap.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Brand</label>
                <select
                  value={form.brand_id}
                  onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                  className="w-full px-3 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
                >
                  <option value="">Select Brand</option>
                  {bootstrap.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cost / Purchase Price ({cur}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.purchase_price}
                  onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Selling Price ({cur}) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.selling_price}
                  onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tab === 'add' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Stock *</label>
                  <input
                    type="number"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Low Stock Alert</label>
                <input
                  type="number"
                  value={form.alert_quantity}
                  onChange={(e) => setForm({ ...form, alert_quantity: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Warranty</label>
                <input
                  type="text"
                  value={form.warranty}
                  onChange={(e) => setForm({ ...form, warranty: e.target.value })}
                  placeholder="1 Year / No Warranty"
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setEditTarget(null);
                  setTab('products');
                }}
                className="px-5 py-2.5 rounded-[10px] bg-slate-100 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-6 py-2.5 rounded-[10px] text-white font-semibold text-xs shadow-[0_4px_12px_rgba(79,70,229,0.3)] cursor-pointer"
              >
                {tab === 'edit' ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {(tab === 'catalog' || tab === 'categories' || tab === 'brands' || tab === 'units') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(tab === 'catalog' || tab === 'categories') && (
          <div className="min-w-0 bg-white border border-[#f1f5f9] rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h3 className="font-display text-sm font-bold text-[#1e293b] mb-3">
              Categories ({bootstrap.categories.length})
            </h3>
            <div className="flex gap-2 mb-3 text-sm min-w-0">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                className="flex-1 min-w-0 px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => addCatalogItem('categories', newCategory, () => setNewCategory(''))}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-4 py-2 text-white rounded-[10px] text-xs font-semibold shrink-0 cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-sm">
              {bootstrap.categories.map((c) => (
                <div key={c.id} className="py-2 flex justify-between gap-2">
                  <span className="text-slate-700 font-medium truncate">{c.name}</span>
                  <span className="text-xs font-mono text-slate-400 shrink-0">#{c.id}</span>
                </div>
              ))}
            </div>
          </div>
          )}

          {(tab === 'catalog' || tab === 'brands') && (
          <div className="min-w-0 bg-white border border-[#f1f5f9] rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h3 className="font-display text-sm font-bold text-[#1e293b] mb-3">
              Brands ({bootstrap.brands.length})
            </h3>
            <div className="flex gap-2 mb-3 text-sm min-w-0">
              <input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="New brand name"
                className="flex-1 min-w-0 px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => addCatalogItem('brands', newBrand, () => setNewBrand(''))}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-4 py-2 text-white rounded-[10px] text-xs font-semibold shrink-0 cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-sm">
              {bootstrap.brands.map((b) => (
                <div key={b.id} className="py-2 flex justify-between gap-2">
                  <span className="text-slate-700 font-medium truncate">{b.name}</span>
                  <span className="text-xs font-mono text-slate-400 shrink-0">#{b.id}</span>
                </div>
              ))}
            </div>
          </div>
          )}

          {(tab === 'catalog' || tab === 'units') && (
          <div className="min-w-0 bg-white border border-[#f1f5f9] rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h3 className="font-display text-sm font-bold text-[#1e293b] mb-3">
              Units ({bootstrap.units.length})
            </h3>
            <div className="flex gap-2 mb-3 text-sm min-w-0">
              <input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="New unit (e.g. set)"
                className="flex-1 min-w-0 px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => addCatalogItem('units', newUnit, () => setNewUnit(''))}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-4 py-2 text-white rounded-[10px] text-xs font-semibold shrink-0 cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {bootstrap.units.map((u) => (
                <div key={u.id} className="py-2 flex justify-between gap-2">
                  <span className="text-slate-700 font-medium truncate">{u.name}</span>
                  <span className="text-xs text-emerald-600 font-semibold shrink-0">Active</span>
                </div>
              ))}
            </div>
          </div>
          )}

          {(tab === 'catalog' || tab === 'units') && (
          <div className="min-w-0 bg-white border border-[#f1f5f9] rounded-[20px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <h3 className="font-display text-sm font-bold text-[#1e293b] mb-3">
              Warranties ({bootstrap.warranties.length})
            </h3>
            <div className="flex gap-2 mb-3 text-sm min-w-0">
              <input
                value={newWarranty}
                onChange={(e) => setNewWarranty(e.target.value)}
                placeholder="e.g. 10 Years"
                className="flex-1 min-w-0 px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => addCatalogItem('warranties', newWarranty, () => setNewWarranty(''))}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-4 py-2 text-white rounded-[10px] text-xs font-semibold shrink-0 cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              {bootstrap.warranties.map((w) => (
                <div key={w.id} className="py-2 flex justify-between gap-2">
                  <span className="text-slate-700 font-medium truncate">{w.name}</span>
                  <span className="text-xs text-slate-500 shrink-0">{w.duration}</span>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAdjustTarget(null)}
        >
          <form
            onSubmit={handleAdjustStock}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[20px] p-6 w-full max-w-sm space-y-4 text-sm shadow-2xl"
          >
            <h3 className="font-display font-bold text-slate-900 text-base">
              Adjust Stock &middot; {adjustTarget.name}
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">New Quantity</label>
              <input
                type="number"
                min={0}
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
              <input
                type="text"
                placeholder="Physical count correction"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] focus:outline-none focus:border-[#4f46e5]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-5 py-2 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Save Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[20px] p-6 w-full max-w-sm space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-slate-900 text-base">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
            <p className="text-xs text-slate-500">This will archive the product from active inventory lists.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
