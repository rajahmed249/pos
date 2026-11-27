import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, Search, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { Product, Purchase, Supplier } from '../types/pos.ts';
import { PaginationBar } from './PaginationBar.tsx';

interface PurchasesViewProps {
  currency: string;
  onRefreshBootstrap: () => void;
}

interface PurchaseCartItem {
  product_id: number;
  name: string;
  sku: string;
  stock: number;
  price: number;
  quantity: number;
}

export function PurchasesView({ currency, onRefreshBootstrap }: PurchasesViewProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Multi-product purchase state
  const [supplierId, setSupplierId] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [productQuery, setProductQuery] = useState('');
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [cart, setCart] = useState<PurchaseCartItem[]>([]);

  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');

  const supplierBoxRef = useRef<HTMLDivElement>(null);
  const productBoxRef = useRef<HTMLDivElement>(null);

  const [payModal, setPayModal] = useState<{
    purchase: Purchase;
    amount: string;
    payment_method: string;
  } | null>(null);

  function loadPurchases() {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (query) params.set('q', query);
    apiFetch<{ items: Purchase[]; total: number }>(`/api/purchases?${params.toString()}`)
      .then((res) => {
        if (res.items.length === 0 && res.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(res.total / limit)));
          return;
        }
        setPurchases(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load purchases.' });
      });
  }

  function loadCatalog() {
    Promise.all([
      apiFetch<{ items: Supplier[] }>('/api/suppliers?all=1'),
      apiFetch<{ items: Product[] }>('/api/products?all=1'),
    ])
      .then(([supRes, prodRes]) => {
        setSuppliers(supRes.items);
        setProducts(prodRes.items);
        if (supRes.items[0]) {
          setSupplierId((prev) => prev || String(supRes.items[0].id));
          setSupplierQuery((prev) => prev || supRes.items[0].name);
        }
      })
      .catch((err) => {
        setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load suppliers/products.' });
      });
  }

  useEffect(() => {
    loadPurchases();
  }, [page, limit, query]);

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    if (!notice || notice.type !== 'success') return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target as Node)) {
        setShowSupplierDrop(false);
      }
      if (productBoxRef.current && !productBoxRef.current.contains(e.target as Node)) {
        setShowProductDrop(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    const active = suppliers.find((s) => String(s.id) === supplierId);
    if (!q || (active && active.name.toLowerCase() === q)) return suppliers.slice(0, 12);
    return suppliers
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.phone || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [suppliers, supplierQuery, supplierId]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 15);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [products, productQuery]);

  function addProductToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku || '',
          stock: Number(product.quantity ?? 0),
          price: Number(product.purchase_price ?? 0),
          quantity: 1,
        },
      ];
    });
    setProductQuery('');
    setShowProductDrop(false);
  }

  function updateCartRow(productId: number, field: 'price' | 'quantity', rawValue: string) {
    const val = Number(rawValue);
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        if (field === 'quantity') {
          return { ...item, quantity: Math.max(1, Math.floor(Number.isFinite(val) ? val : 1)) };
        }
        return { ...item, price: Math.max(0, Number.isFinite(val) ? val : 0) };
      })
    );
  }

  function removeCartItem(productId: number) {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountNum = Math.max(0, Math.min(subtotal, Number(discount || 0)));
  const netTotal = Math.max(0, subtotal - discountNum);
  const paidNum = Math.max(0, Math.min(netTotal, Number(paid || 0)));
  const dueNum = Math.max(0, netTotal - paidNum);

  async function handleCreatePurchase(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!supplierId) {
      setNotice({ type: 'error', text: 'Please select a supplier first.' });
      return;
    }
    if (cart.length === 0) {
      setNotice({ type: 'error', text: 'Cart is empty. Search and add at least one product.' });
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          purchase_date: purchaseDate,
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })),
          discount: discountNum,
          paid: paidNum,
          payment_method: paymentMethod,
          note,
        }),
      });
      setCart([]);
      setDiscount('0');
      setPaid('0');
      setNote('');
      setNotice({ type: 'success', text: `Purchase recorded (${cart.length} item${cart.length > 1 ? 's' : ''}) and stock updated!` });
      loadPurchases();
      loadCatalog();
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save purchase.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayDueSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setNotice(null);
    try {
      await apiFetch(`/api/purchases/${payModal.purchase.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payModal.amount),
          payment_method: payModal.payment_method,
        }),
      });
      setNotice({ type: 'success', text: `Due payment recorded for ${payModal.purchase.invoice_no}.` });
      setPayModal(null);
      loadPurchases();
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to settle purchase due.' });
    }
  }

  const pageTotal = purchases.reduce((s, p) => s + Number(p.total ?? 0), 0);
  const pagePaid = purchases.reduce((s, p) => s + Number(p.paid ?? 0), 0);
  const pageDue = purchases.reduce((s, p) => s + Number(p.due ?? 0), 0);
  const selectedSupplier = suppliers.find((s) => String(s.id) === supplierId);

  return (
    <div className="w-full space-y-5">
      {notice && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-between gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span className="flex items-center gap-2">
            {notice.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            <span>{notice.text}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(79,70,229,0.3)]"
          >
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
              Stock{' '}
              <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">
                Purchases
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Multi-product purchase cart on top &amp; supplier invoice history below
            </p>
          </div>
        </div>
        <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-semibold tabular-nums">
          {total.toLocaleString()} Total Purchases
        </span>
      </div>

      {/* Compact KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
          className="rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(79,70,229,0.20)]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Page Purchase Total</div>
          <div className="mt-1 text-lg font-display font-bold tabular-nums">{formatMoney(pageTotal, currency)}</div>
          <div className="mt-0.5 text-[10px] text-white/80">{purchases.length} entries shown</div>
        </div>
        <div
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
          className="rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Paid to Suppliers</div>
          <div className="mt-1 text-lg font-display font-bold tabular-nums">{formatMoney(pagePaid, currency)}</div>
          <div className="mt-0.5 text-[10px] text-white/80">Settled on Current Page</div>
        </div>
        <div
          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}
          className="rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(225,29,72,0.20)]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Payable Due</div>
          <div className="mt-1 text-lg font-display font-bold tabular-nums">{formatMoney(pageDue, currency)}</div>
          <div className="mt-0.5 text-[10px] text-white/80">Supplier Balances Due</div>
        </div>
      </div>

      {/* TOP FULL-WIDTH: New Purchase Entry (Multi-Product Cart) */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-visible">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/70 rounded-t-[20px] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              <ShoppingCart className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">Purchase Items</h2>
              <p className="text-[11px] text-slate-500">Search supplier &amp; add multiple products to a single purchase invoice</p>
            </div>
          </div>
          {cart.length > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700 tabular-nums">
              {cart.length} {cart.length === 1 ? 'product' : 'products'} in cart
            </span>
          )}
        </div>

        <form onSubmit={handleCreatePurchase} className="p-5 space-y-4 text-sm">
          {/* Row 1: Searchable Supplier & Purchase Date */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 relative" ref={supplierBoxRef}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={supplierQuery}
                  onFocus={() => setShowSupplierDrop(true)}
                  onChange={(e) => {
                    setSupplierQuery(e.target.value);
                    setShowSupplierDrop(true);
                  }}
                  placeholder="Search supplier by name, phone or email..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none pr-36"
                />
                {selectedSupplier && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10.5px] font-semibold text-indigo-700 max-w-[140px] truncate">
                    {selectedSupplier.name}
                  </span>
                )}
              </div>
              {showSupplierDrop && (
                <div className="absolute z-40 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSupplierId(String(s.id));
                        setSupplierQuery(s.name);
                        setShowSupplierDrop(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left text-xs hover:bg-indigo-50 flex items-center justify-between gap-2 cursor-pointer ${
                        String(s.id) === supplierId ? 'bg-indigo-50/70 font-semibold text-indigo-800' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">{s.phone || s.email || ''}</span>
                    </button>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <div className="px-3.5 py-3 text-xs text-slate-400">No matching suppliers found.</div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Row 2: Searchable Product Picker */}
          <div className="relative" ref={productBoxRef}>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={productQuery}
                onFocus={() => setShowProductDrop(true)}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setShowProductDrop(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length > 0) {
                    e.preventDefault();
                    addProductToCart(filteredProducts[0]);
                  }
                }}
                placeholder="Search product by name or barcode..."
                className="w-full pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            {showProductDrop && (
              <div className="absolute z-40 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToCart(p)}
                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-indigo-50 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {p.sku || 'No SKU'} {p.barcode ? `· ${p.barcode}` : ''} · Stock: {p.quantity ?? 0}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-indigo-700 tabular-nums">
                        {formatMoney(p.purchase_price, currency)}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold">+ Add</div>
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="px-4 py-4 text-xs text-slate-400">No matching products found.</div>
                )}
              </div>
            )}
          </div>

          {/* Row 3: Dynamic Multi-Product Cart Table */}
          <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold w-12">SL</th>
                    <th className="px-4 py-2.5 font-semibold">PRODUCT</th>
                    <th className="px-4 py-2.5 font-semibold text-right w-36">RATE ({currency})</th>
                    <th className="px-4 py-2.5 font-semibold text-center w-28">QTY</th>
                    <th className="px-4 py-2.5 font-semibold text-right w-36">SUB TOTAL</th>
                    <th className="px-4 py-2.5 font-semibold text-center w-20">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <tr key={item.product_id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {item.sku ? `${item.sku} · ` : ''}In stock: {item.stock}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.price}
                          onChange={(e) => updateCartRow(item.product_id, 'price', e.target.value)}
                          className="w-28 ml-auto px-2.5 py-1.5 text-right font-mono text-xs border border-slate-200 rounded-lg bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateCartRow(item.product_id, 'quantity', e.target.value)}
                          className="w-20 mx-auto px-2.5 py-1.5 text-center font-mono text-xs border border-slate-200 rounded-lg bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatMoney(item.price * item.quantity, currency)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.product_id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                          <ShoppingCart className="w-9 h-9 text-slate-300" />
                          <p className="text-xs font-medium text-slate-500">Cart is empty. Search and add products.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Row 4: Payment Details (Left) & Totals Summary (Right) */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Paid ({currency})</label>
                  {netTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaid(netTotal.toFixed(2))}
                      className="text-[10.5px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                    >
                      Full Paid
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-emerald-500 outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note / Challan</label>
                <input
                  type="text"
                  placeholder="Optional reference..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col items-end space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between w-full sm:w-72">
                <span className="text-slate-500 font-medium">Subtotal:</span>
                <span className="font-mono font-bold text-slate-800 tabular-nums">{formatMoney(subtotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between w-full sm:w-72">
                <span className="text-slate-500 font-medium">Discount:</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-28 px-2.5 py-1 text-right font-mono text-xs border border-slate-200 rounded-lg bg-white focus:border-indigo-500 outline-none tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between w-full sm:w-72 pt-2 border-t border-slate-200">
                <span className="font-bold text-indigo-700">Total:</span>
                <span className="font-mono text-base font-extrabold text-indigo-700 tabular-nums">
                  {formatMoney(netTotal, currency)}
                </span>
              </div>
              {netTotal > 0 && (
                <div className="flex items-center justify-between w-full sm:w-72 text-xs">
                  <span className="text-slate-500">Supplier Due:</span>
                  <span className={`font-mono font-bold tabular-nums ${dueNum > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatMoney(dueNum, currency)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Full-Width Emerald Payment CTA */}
          <button
            type="submit"
            disabled={submitting || !suppliers.length || !products.length}
            style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
            className="w-full py-3 rounded-xl text-white font-semibold shadow-[0_6px_18px_rgba(5,150,105,0.28)] hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>{submitting ? 'Recording Purchase...' : 'Payment & Record Purchase'}</span>
          </button>
        </form>
      </div>

      {/* BOTTOM FULL-WIDTH: Purchase History */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Purchase History</h2>
            <p className="text-[11px] text-slate-500">All supplier invoices, multi-product items &amp; due settlement</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Search invoice, supplier, or product..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Invoice &amp; Date</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold">Products</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Paid</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Due</th>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="font-mono text-xs font-bold text-indigo-700">{p.invoice_no}</div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {String(p.purchase_date || '').slice(0, 10) || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900 text-xs sm:text-sm">{p.supplier_name}</div>
                    <div className="text-[11px] text-slate-400 uppercase">{p.payment_method || 'cash'}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[260px]">
                    {p.items && p.items.length > 0 ? (
                      <div className="space-y-0.5">
                        {p.items.slice(0, 2).map((it, i) => (
                          <div key={i} className="truncate">
                            <span className="font-medium text-slate-800">{it.product_name}</span>{' '}
                            <span className="text-slate-400">&times;{it.quantity}</span>
                          </div>
                        ))}
                        {p.items.length > 2 && (
                          <span className="inline-block text-[10.5px] font-semibold text-indigo-600">
                            +{p.items.length - 2} more items
                          </span>
                        )}
                      </div>
                    ) : (
                      <span>{p.items_summary || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                    {formatMoney(p.total, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                    {formatMoney(p.paid, currency)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums whitespace-nowrap ${
                      Number(p.due) > 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {formatMoney(p.due, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {Number(p.due) > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPayModal({
                            purchase: p,
                            amount: Number(p.due).toFixed(2),
                            payment_method: 'cash',
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Pay Due</span>
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-semibold">
                        Paid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    No purchase invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          total={total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

      {/* Pay Supplier Due Modal */}
      {payModal && (
        <div
          onClick={() => setPayModal(null)}
          className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Pay Supplier Due</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {payModal.purchase.invoice_no} · {payModal.purchase.supplier_name} (Due:{' '}
                  {formatMoney(payModal.purchase.due, currency)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePayDueSubmit} className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({currency}) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(payModal.purchase.due)}
                  required
                  value={payModal.amount}
                  onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl tabular-nums outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payModal.payment_method}
                  onChange={(e) => setPayModal({ ...payModal, payment_method: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
