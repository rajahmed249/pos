import { useEffect, useRef, useState } from 'react';
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
  CloudUpload,
  Edit3,
  FileText,
  ImagePlus,
  Layers,
  List,
  MoreVertical,
  Package,
  Plus,
  PlusCircle,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import { showCenterPopup } from '../lib/popup.ts';
import type { BootstrapPayload, Product } from '../types/pos.ts';

interface ProductsViewProps {
  bootstrap: BootstrapPayload;
  initialTab?: 'products' | 'add' | 'units' | 'categories' | 'brands' | 'catalog';
  onTabNavigate?: (routeKey: string) => void;
  onRefreshBootstrap: () => void;
}

type QuickModalKind = 'category' | 'brand' | 'warranty' | 'unit' | null;

const EMPTY_FORM = {
  name: '',
  sku: '',
  barcode: '',
  category_id: '',
  brand_id: '',
  warranty_id: '',
  unit_id: '',
  purchase_price: '',
  selling_price: '',
  quantity: '0',
  alert_quantity: '5',
  warranty: '',
  description: '',
};

export function ProductsView({
  bootstrap,
  initialTab = 'products',
  onTabNavigate,
  onRefreshBootstrap,
}: ProductsViewProps) {
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

  const [form, setForm] = useState(EMPTY_FORM);
  const [imageData, setImageData] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [imageFileName, setImageFileName] = useState<string>('No file chosen');
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [quickModal, setQuickModal] = useState<QuickModalKind>(null);
  const [quickModalValue, setQuickModalValue] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newWarranty, setNewWarranty] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function selectTab(nextTab: 'products' | 'add' | 'units' | 'categories' | 'brands' | 'catalog') {
    setTab(nextTab);
    if (onTabNavigate) {
      const routeMap: Record<'products' | 'add' | 'units' | 'categories' | 'brands' | 'catalog', string> = {
        products: 'products',
        add: 'add-product',
        categories: 'categories',
        brands: 'brands',
        units: 'units',
        catalog: 'categories',
      };
      onTabNavigate(routeMap[nextTab]);
    }
  }

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

  function resetFormForAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setImageData('');
    setImagePreviewUrl('');
    setImageFileName('No file chosen');
    setRemoveExistingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleImageSelect(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showCenterPopup({
        type: 'error',
        title: 'File Too Large',
        message: 'Maximum product image size is 2MB. Please choose a smaller image.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      showCenterPopup({
        type: 'error',
        title: 'Invalid File Format',
        message: 'Only JPG, PNG, GIF, and WEBP images are allowed.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImageData(dataUrl);
      setImagePreviewUrl(dataUrl);
      setImageFileName(file.name);
      setRemoveExistingImage(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    const pp = Number(form.purchase_price || 0);
    const sp = Number(form.selling_price || 0);
    const qty = Number(form.quantity || 0);
    if (!form.name.trim()) {
      showCenterPopup({ type: 'warning', title: 'Missing Name', message: 'Product Name is required.' });
      return;
    }
    if (pp < 0 || sp < 0 || qty < 0) {
      const msg = 'Prices and stock quantity cannot be negative.';
      setToast({ type: 'error', message: msg });
      showCenterPopup({ type: 'error', title: 'Invalid Values', message: msg });
      return;
    }
    setSubmitting(true);
    try {
      const matchedWarranty = form.warranty_id
        ? bootstrap.warranties.find((w) => String(w.id) === String(form.warranty_id))
        : null;
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          purchase_price: pp,
          selling_price: sp,
          quantity: qty,
          alert_quantity: Math.max(1, Number(form.alert_quantity || 5)),
          warranty: matchedWarranty ? matchedWarranty.duration || matchedWarranty.name : form.warranty || 'No Warranty',
          image_data: imageData || undefined,
        }),
      });
      resetFormForAdd();
      selectTab('products');
      const msg = 'Product added successfully!';
      setToast({ type: 'success', message: msg });
      showCenterPopup({ type: 'success', title: 'Product Saved', message: msg });
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create product.';
      setToast({ type: 'error', message: msg });
      showCenterPopup({ type: 'error', title: 'Save Failed', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    const pp = Number(form.purchase_price || 0);
    const sp = Number(form.selling_price || 0);
    const qty = Number(form.quantity || 0);
    if (pp < 0 || sp < 0 || qty < 0) {
      const msg = 'Prices and stock quantity cannot be negative.';
      setToast({ type: 'error', message: msg });
      showCenterPopup({ type: 'error', title: 'Invalid Values', message: msg });
      return;
    }
    setSubmitting(true);
    try {
      const matchedWarranty = form.warranty_id
        ? bootstrap.warranties.find((w) => String(w.id) === String(form.warranty_id))
        : null;
      await apiFetch(`/api/products/${editTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          sku: form.sku,
          barcode: form.barcode,
          category_id: form.category_id || null,
          brand_id: form.brand_id || null,
          warranty_id: form.warranty_id || null,
          unit_id: form.unit_id || null,
          purchase_price: pp,
          selling_price: sp,
          quantity: qty,
          alert_quantity: Math.max(0, Number(form.alert_quantity || 5)),
          description: form.description,
          warranty: matchedWarranty ? matchedWarranty.duration || matchedWarranty.name : 'No Warranty',
          image_data: imageData || undefined,
          remove_image: removeExistingImage,
        }),
      });
      resetFormForAdd();
      selectTab('products');
      const msg = 'Product updated successfully!';
      setToast({ type: 'success', message: msg });
      showCenterPopup({ type: 'success', title: 'Product Updated', message: msg });
      loadProducts();
      onRefreshBootstrap();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update product.';
      setToast({ type: 'error', message: msg });
      showCenterPopup({ type: 'error', title: 'Update Failed', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickModalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickModal || !quickModalValue.trim()) return;
    setQuickSaving(true);
    try {
      const endpointMap = {
        category: 'categories',
        brand: 'brands',
        warranty: 'warranties',
        unit: 'units',
      } as const;
      const created = await apiFetch<{ id: number; name?: string; duration?: string }>(
        `/api/catalog/${endpointMap[quickModal]}`,
        {
          method: 'POST',
          body: JSON.stringify({ name: quickModalValue.trim(), duration: quickModalValue.trim() }),
        }
      );
      if (quickModal === 'category') setForm((f) => ({ ...f, category_id: String(created.id) }));
      if (quickModal === 'brand') setForm((f) => ({ ...f, brand_id: String(created.id) }));
      if (quickModal === 'warranty')
        setForm((f) => ({ ...f, warranty_id: String(created.id), warranty: created.duration || created.name || '' }));
      if (quickModal === 'unit') setForm((f) => ({ ...f, unit_id: String(created.id) }));
      setQuickModal(null);
      setQuickModalValue('');
      onRefreshBootstrap();
      setToast({ type: 'success', message: `Added ${quickModal} "${created.duration || created.name}"!` });
    } catch (err) {
      showCenterPopup({
        type: 'error',
        title: 'Save Failed',
        message: err instanceof Error ? err.message : 'Failed to create item.',
      });
    } finally {
      setQuickSaving(false);
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
    const matchingWarranty =
      p.warranty_id ||
      bootstrap.warranties.find(
        (w) =>
          (w.duration || w.name || '').toLowerCase() === String(p.warranty || '').toLowerCase()
      )?.id;
    setForm({
      name: p.name,
      sku: p.sku || '',
      barcode: p.barcode || '',
      category_id: p.category_id ? String(p.category_id) : '',
      brand_id: p.brand_id ? String(p.brand_id) : '',
      warranty_id: matchingWarranty ? String(matchingWarranty) : '',
      unit_id: p.unit_id ? String(p.unit_id) : '',
      purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price),
      quantity: String(p.quantity),
      alert_quantity: String(p.alert_quantity ?? 5),
      warranty: p.warranty || 'No Warranty',
      description: p.description || '',
    });
    setImageData('');
    setImagePreviewUrl(p.image || '');
    setImageFileName(p.image ? 'Current product image' : 'No file chosen');
    setRemoveExistingImage(false);
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

  const isAddOrEdit = tab === 'add' || tab === 'edit';

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
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
            {tab === 'add' ? (
              <PlusCircle className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            ) : tab === 'edit' ? (
              <Edit3 className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            ) : (
              <Boxes className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-[26px] font-extrabold text-[#0f172a] tracking-tight truncate">
              {tab === 'add' ? (
                <>
                  Add <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">Product</span>
                </>
              ) : tab === 'edit' ? (
                <>
                  Edit <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">Product</span>
                </>
              ) : (
                <>
                  Product <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">Management</span>
                </>
              )}
            </h1>
            <p className="text-xs sm:text-[13px] text-[#64748b] flex flex-wrap items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" /> {dateDisplay} &bull; <Clock className="w-3.5 h-3.5 shrink-0" /> {timeDisplay}
            </p>
          </div>
        </div>

        {isAddOrEdit ? (
          <button
            type="button"
            onClick={() => {
              resetFormForAdd();
              selectTab('products');
            }}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition-all shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" /> Back to Products
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              resetFormForAdd();
              selectTab('add');
            }}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition-all shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 shrink-0" /> Add Product
          </button>
        )}
      </div>

      {/* Reference Tabs Bar (Synced Live with Sidebar) */}
      <div className="bg-white rounded-[20px] p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] flex sm:inline-flex flex-wrap gap-1 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => selectTab('products')}
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
            resetFormForAdd();
            selectTab('add');
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
          onClick={() => selectTab('categories')}
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
          onClick={() => selectTab('brands')}
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
          onClick={() => selectTab('units')}
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

      {/* Product Directory List */}
      {tab === 'products' && (
        <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] overflow-visible">
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
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] w-10">#</th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] w-16">Image</th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] min-w-[200px]">Product</th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Category</th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Brand</th>
                  <th className="py-3.5 px-4 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Warranty</th>
                  <th className="py-3.5 px-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Price</th>
                  <th className="py-3.5 px-4 text-right text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Cost</th>
                  <th className="py-3.5 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Stock</th>
                  <th className="py-3.5 px-4 text-center text-[10px] font-bold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">Actions</th>
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
                          <div className="w-12 h-12 rounded-[10px] bg-[#f1f5f9] flex items-center justify-center text-[#94a3b8] overflow-hidden shrink-0 border border-slate-200/70">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Box className="w-5 h-5" />
                            )}
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

          {/* Pagination Bar */}
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
                      setPage(Math.min(totalPages, Math.max(1, Number(gotoInput) || 1)));
                    }
                  }}
                  className="w-14 px-2 py-1.5 border border-[#e2e8f0] rounded-md text-center bg-white tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, Math.max(1, Number(gotoInput) || 1)))}
                  className="px-3.5 py-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-md font-medium cursor-pointer"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Elevated Colorful Add / Edit Product Workspace */}
      {(tab === 'add' || tab === 'edit') && (() => {
        const purchaseVal = Number(form.purchase_price || 0);
        const sellingVal = Number(form.selling_price || 0);
        const unitProfit = sellingVal - purchaseVal;
        const marginPct = sellingVal > 0 ? Math.round((unitProfit / sellingVal) * 100) : 0;

        return (
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-slate-200/80 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#4f46e5] via-[#7c3aed] via-50% to-[#10b981]" />

            <div className="px-5 sm:px-8 py-5 bg-gradient-to-r from-indigo-50/70 via-white to-emerald-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-[0_6px_18px_rgba(79,70,229,0.28)] shrink-0"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  <Box className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] truncate">
                    {tab === 'edit' && editTarget ? `Edit Product — ${editTarget.name}` : 'Product Information'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fill in identity, stock levels, pricing &amp; product photo cleanly
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                <Sparkles className="w-3.5 h-3.5" />
                {tab === 'edit' ? 'Editing Mode' : 'New Item Entry'}
              </span>
            </div>

            <form onSubmit={tab === 'edit' ? handleUpdateProduct : handleAddProduct} className="p-5 sm:p-8 space-y-6 text-sm">
              {/* Section 1: Identity & Catalog Classification */}
              <div className="rounded-2xl border border-indigo-100/90 bg-gradient-to-br from-indigo-50/45 via-white to-violet-50/25 p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-indigo-100/80">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Identity &amp; Classification</h3>
                    <p className="text-[11px] text-slate-500">SKU code, product title, category, brand &amp; warranty</p>
                  </div>
                </div>

                {/* Row 1: SKU (25%) & Product Name (75%) */}
                <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-start">
                  <div className="w-full md:w-1/4 shrink-0">
                    <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                      Product Code / SKU
                    </label>
                    <input
                      type="text"
                      placeholder="Enter SKU..."
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                    />
                    <p className="text-[11px] text-[#94a3b8] mt-1">Unique identifier (optional)</p>
                  </div>

                  <div className="w-full md:flex-1">
                    <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                      Product Name <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter product name..."
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Row 2: Category & Brand (+ New Quick Modals) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                      Category <span className="text-[#ef4444]">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <select
                        required
                        value={form.category_id}
                        onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                        className="flex-1 min-w-0 px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                      >
                        <option value="">Select Category</option>
                        {bootstrap.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickModalValue('');
                          setQuickModal('category');
                        }}
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                        className="px-4 py-3 text-white rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(79,70,229,0.3)] transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4 shrink-0" /> New
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Brand</label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <select
                        value={form.brand_id}
                        onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                        className="flex-1 min-w-0 px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                      >
                        <option value="">Select Brand</option>
                        {bootstrap.brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickModalValue('');
                          setQuickModal('brand');
                        }}
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                        className="px-4 py-3 text-white rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(79,70,229,0.3)] transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4 shrink-0" /> New
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Warranty & Main Unit (+ New Quick Modals) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Warranty</label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <select
                        value={form.warranty_id}
                        onChange={(e) => setForm({ ...form, warranty_id: e.target.value })}
                        className="flex-1 min-w-0 px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                      >
                        <option value="">Select Warranty</option>
                        {bootstrap.warranties.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.duration || w.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickModalValue('');
                          setQuickModal('warranty');
                        }}
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                        className="px-4 py-3 text-white rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(79,70,229,0.3)] transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4 shrink-0" /> New
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Main Unit</label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <select
                        value={form.unit_id}
                        onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                        className="flex-1 min-w-0 px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                      >
                        <option value="">Select Unit</option>
                        {bootstrap.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickModalValue('');
                          setQuickModal('unit');
                        }}
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                        className="px-4 py-3 text-white rounded-xl text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(79,70,229,0.3)] transition-all cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4 shrink-0" /> New
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Inventory & Pricing Dual Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Stock Card */}
                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/55 via-white to-teal-50/35 p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-emerald-100">
                    <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                      <Layers className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Stock &amp; Alert Threshold</h3>
                      <p className="text-[11px] text-slate-500">Inventory opening count and low-stock warning</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                        {tab === 'edit' ? 'Stock Quantity' : 'Opening Stock'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      />
                      <p className="text-[11px] text-[#64748b] mt-1">
                        {tab === 'edit' ? 'Current inventory quantity' : 'Initial stock quantity'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">Alert Quantity</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="5"
                        value={form.alert_quantity}
                        onChange={(e) => setForm({ ...form, alert_quantity: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white tabular-nums focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                      />
                      <p className="text-[11px] text-[#64748b] mt-1">Notify when stock falls below this quantity</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Card */}
                <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/55 via-white to-orange-50/35 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-amber-500 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Pricing &amp; Profit</h3>
                        <p className="text-[11px] text-slate-500">Purchase cost vs customer retail rate</p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums ${
                        unitProfit >= 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      Profit: {formatMoney(unitProfit, cur)} ({marginPct}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                        Purchase Cost ({cur})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={form.purchase_price}
                        onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white tabular-nums focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[13px] font-semibold text-[#334155] mb-1.5">
                        Sale Price ({cur}) <span className="text-[#ef4444]">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        required
                        placeholder="0.00"
                        value={form.selling_price}
                        onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm font-semibold text-[#0f172a] bg-white tabular-nums focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Product Details & Studio Product Image Upload */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Product Details */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-slate-50/55 p-4 sm:p-6 flex flex-col">
                  <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200/70">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                        <FileText className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Product Details</h3>
                        <p className="text-[11px] text-slate-500">Specifications, model compatibility &amp; warranty notes</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                      {form.description.length} chars
                    </span>
                  </div>

                  <textarea
                    rows={7}
                    placeholder="Enter product description, hardware specs, model series, or warranty notes..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full flex-1 px-4 py-3 border-2 border-[#e2e8f0] rounded-xl text-sm text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all resize-y min-h-[180px]"
                  />
                </div>

                {/* Redesigned Product Image Studio Card */}
                <div className="lg:col-span-5 rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/65 via-white to-violet-50/65 p-4 sm:p-6 flex flex-col">
                  <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-indigo-100">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center shadow-xs"
                        style={{ background: 'linear-gradient(135deg, #4f46e5, #ec4899)' }}
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Product Image</h3>
                        <p className="text-[11px] text-slate-500">POS thumbnail &amp; catalog photo</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                      MAX 2MB
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files?.[0] || null)}
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={() => setIsDraggingImage(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(false);
                      handleImageSelect(e.dataTransfer.files?.[0] || null);
                    }}
                    className={`flex-1 rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[210px] ${
                      isDraggingImage
                        ? 'border-indigo-500 bg-indigo-50/90 scale-[1.01] shadow-inner'
                        : 'border-indigo-200 hover:border-indigo-400 bg-white/85 hover:bg-white'
                    }`}
                  >
                    {imagePreviewUrl ? (
                      <div
                        className="w-full flex flex-col items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="relative w-36 h-36 rounded-2xl bg-slate-100 border-2 border-indigo-200/80 shadow-md overflow-hidden p-1.5 bg-white">
                          <img
                            src={imagePreviewUrl}
                            alt="Product Preview"
                            className="w-full h-full rounded-xl object-cover"
                          />
                          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-xs">
                            Ready
                          </span>
                        </div>

                        <div className="text-xs font-medium text-slate-600 truncate max-w-[230px]">
                          {imageFileName}
                        </div>

                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                            className="px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs hover:opacity-95 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" /> Change Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImageData('');
                              setImagePreviewUrl('');
                              setImageFileName('No file chosen');
                              setRemoveExistingImage(true);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-[0_10px_25px_rgba(79,70,229,0.28)] mb-3.5 transition-transform group-hover:scale-105"
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899)' }}
                        >
                          <CloudUpload className="w-8 h-8" />
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          Drop product photo here
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          or click below to select from your device
                        </p>
                        <span
                          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                          className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm"
                        >
                          <Upload className="w-3.5 h-3.5" /> Browse Image
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
                          {['JPG', 'PNG', 'WEBP', 'GIF'].map((ext) => (
                            <span
                              key={ext}
                              className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100"
                            >
                              {ext}
                            </span>
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2">
                          Recommended: 300 × 300 px square photo
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-2 border-t-2 border-slate-100">
                <p className="text-xs text-slate-500">
                  Fields marked with <span className="text-red-500 font-bold">*</span> are required before saving.
                </p>
                <div className="flex flex-col-reverse sm:flex-row w-full sm:w-auto justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetFormForAdd();
                      selectTab('products');
                    }}
                    className="px-7 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4 shrink-0" /> Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    className="px-8 py-3 rounded-xl text-white font-semibold text-sm shadow-[0_6px_18px_rgba(16,185,129,0.32)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,185,129,0.4)] transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-4 h-4 shrink-0" />
                    <span>{submitting ? 'Saving...' : tab === 'edit' ? 'Update Product' : 'Submit'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Catalog Management Tabs */}
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

      {/* Quick-Add Inline Modal (Category / Brand / Warranty / Unit) */}
      {quickModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setQuickModal(null)}
        >
          <form
            onSubmit={handleQuickModalSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[20px] w-full max-w-[440px] shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="px-6 py-4 bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  {quickModal === 'warranty' ? (
                    <Shield className="w-5 h-5" />
                  ) : quickModal === 'unit' ? (
                    <Boxes className="w-5 h-5" />
                  ) : (
                    <Tag className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1e293b]">
                    {quickModal === 'category'
                      ? 'Add New Category'
                      : quickModal === 'brand'
                        ? 'Add New Brand'
                        : quickModal === 'warranty'
                          ? 'Add New Warranty'
                          : 'Add New Unit'}
                  </h3>
                  <p className="text-xs text-[#64748b]">
                    {quickModal === 'category'
                      ? 'Create a new product category'
                      : quickModal === 'brand'
                        ? 'Create a new product brand'
                        : quickModal === 'warranty'
                          ? 'Create a new warranty period'
                          : 'Create a new measurement unit'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickModal(null)}
                className="w-8 h-8 rounded-full bg-slate-200/70 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                {quickModal === 'warranty'
                  ? 'Warranty Duration'
                  : `${quickModal.charAt(0).toUpperCase() + quickModal.slice(1)} Name`}{' '}
                <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={quickModalValue}
                onChange={(e) => setQuickModalValue(e.target.value)}
                placeholder={
                  quickModal === 'category'
                    ? 'Enter category name...'
                    : quickModal === 'brand'
                      ? 'Enter brand name...'
                      : quickModal === 'warranty'
                        ? 'e.g., 1 Year, 6 Months...'
                        : 'e.g., PC, KG, Box...'
                }
                className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10"
              />
              <p className="text-[11px] text-[#94a3b8] mt-1.5">
                {quickModal === 'category'
                  ? 'Example: Monitor, CCTV Camera, Networking'
                  : quickModal === 'brand'
                    ? 'Example: Hikvision, Dahua, Dell, HP'
                    : quickModal === 'warranty'
                      ? 'Example: 1 Year, 6 Months, 2 Years, Lifetime'
                      : 'Example: PC, KG, Meter, Dozen, Box'}
              </p>
            </div>

            <div className="px-6 py-4 bg-[#fafbfc] border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setQuickModal(null)}
                className="px-5 py-2.5 rounded-lg bg-[#f1f5f9] text-[#475569] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickSaving}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-5 py-2.5 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{quickSaving ? 'Adding...' : 'Save & Select'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
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
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
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
