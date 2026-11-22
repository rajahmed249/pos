import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  HandCoins,
  Landmark,
  Minus,
  Percent,
  Plus,
  Search,
  Shield,
  ShoppingCart,
  StickyNote,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import { showCenterPopup } from '../lib/popup.ts';
import type { BootstrapPayload, Customer, Product, Sale, SaleItem } from '../types/pos.ts';

interface PosTerminalViewProps {
  bootstrap: BootstrapPayload;
  onSaleComplete: (sale: Sale, items: SaleItem[]) => void;
}

interface CartRow {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  serial_no: string;
  warranty: string;
  maxStock: number;
}

export function PosTerminalView({ bootstrap, onSaleComplete }: PosTerminalViewProps) {
  const cur = bootstrap.settings.currency || '৳';
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [topSearch, setTopSearch] = useState('');
  const [topDropdownOpen, setTopDropdownOpen] = useState(false);
  const [sideSearch, setSideSearch] = useState('');

  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);

  const [cart, setCart] = useState<CartRow[]>([]);
  const [error, setError] = useState('');

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [vat, setVat] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [accountId, setAccountId] = useState(String(bootstrap.bankAccounts[0]?.id ?? ''));
  const [receivedAmount, setReceivedAmount] = useState('');
  const [note, setNote] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const topSearchRef = useRef<HTMLDivElement | null>(null);
  const customerBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiFetch<{ items: Product[] }>('/api/products?limit=200'),
      apiFetch<{ items: Customer[] }>('/api/customers?limit=200'),
    ])
      .then(([prodRes, custRes]) => {
        if (!active) return;
        setProducts(prodRes.items);
        setCustomers(custRes.items);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (topSearchRef.current && !topSearchRef.current.contains(e.target as Node)) {
        setTopDropdownOpen(false);
      }
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const topSearchResults = useMemo(() => {
    const q = topSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [products, topSearch]);

  const sideProducts = useMemo(() => {
    const q = sideSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, sideSearch]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => Number(c.id) === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const previousDue = useMemo(() => {
    if (!selectedCustomer) return 0;
    return Number(selectedCustomer.due ?? selectedCustomer.opening_balance ?? 0);
  }, [selectedCustomer]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const walkIn = { id: 0, name: 'Walk-in Customer', phone: '', email: '', address: '' } as Customer;
    if (!q) return [walkIn, ...customers];
    const matches = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
    if ('walk-in customer'.includes(q) || 'walkin'.includes(q)) {
      return [walkIn, ...matches];
    }
    return matches;
  }, [customers, customerSearch]);

  function addToCart(product: Product) {
    const avail = Number(product.quantity ?? 0);
    if (avail <= 0) return;
    const existing = cart.find((r) => r.product_id === product.id);
    if (existing && existing.quantity >= avail) {
      const msg = `Only ${avail} unit(s) of "${product.name}" available in stock.`;
      setError(msg);
      showCenterPopup({ type: 'warning', title: 'Stock Limit Reached', message: msg });
      return;
    }
    setError('');
    setCart((prev) => {
      const found = prev.find((r) => r.product_id === product.id);
      if (found) {
        const nextQty = Math.min(avail, found.quantity + 1);
        return prev.map((r) =>
          r.product_id === product.id ? { ...r, quantity: nextQty } : r
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku || 'N/A',
          quantity: 1,
          price: Number(product.selling_price),
          serial_no: '',
          warranty: product.warranty && product.warranty !== 'No Warranty' ? product.warranty : '',
          maxStock: avail,
        },
      ];
    });
  }

  const isWalkInCustomer =
    !selectedCustomer || selectedCustomer.name.trim().toLowerCase() === 'walk-in customer';
  const subtotal = cart.reduce((sum, r) => sum + r.quantity * r.price, 0);
  const discountNum = Math.max(0, Number(discount) || 0);
  const vatNum = Math.max(0, Number(vat) || 0);
  const netPayable = Math.max(0, subtotal - discountNum + vatNum);
  const receivedNum = Math.max(0, Number(receivedAmount) || 0);
  const invoiceDue = Math.max(0, netPayable - receivedNum);
  const currentDue = invoiceDue + previousDue;

  function openPaymentModal() {
    if (cart.length === 0) {
      const msg = 'Cart is empty! Search and add products before proceeding to payment.';
      setError(msg);
      showCenterPopup({ type: 'warning', title: 'Cart Is Empty', message: msg });
      return;
    }
    setError('');
    setModalError('');
    // Never pre-fill/suggest amount until user types or clicks PAID
    setReceivedAmount('');
    setPaymentModalOpen(true);
  }

  async function handleConfirmOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) {
      const msg = 'Cart is empty!';
      setModalError(msg);
      showCenterPopup({ type: 'warning', title: 'Cart Is Empty', message: msg });
      return;
    }
    for (const row of cart) {
      if (row.quantity < 1 || row.quantity > row.maxStock) {
        const msg = `Quantity for "${row.name}" must be between 1 and ${row.maxStock}.`;
        setModalError(msg);
        showCenterPopup({ type: 'warning', title: 'Invalid Quantity', message: msg });
        return;
      }
    }
    if (discountNum > subtotal + 0.009) {
      const msg = `Discount cannot exceed Subtotal (${formatMoney(subtotal, cur)}).`;
      setModalError(msg);
      showCenterPopup({ type: 'error', title: 'Invalid Discount', message: msg });
      return;
    }
    if (isWalkInCustomer && invoiceDue > 0.009) {
      const msg =
        'Walk-in Customer cannot have due balance! Please collect full payment or select a registered customer.';
      setModalError(msg);
      showCenterPopup({ type: 'error', title: 'Full Payment Required', message: msg });
      return;
    }

    setSubmitting(true);
    setError('');
    setModalError('');
    try {
      const result = await apiFetch<{ sale: Sale; items: SaleItem[] }>('/api/sales', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: selectedCustomerId > 0 ? selectedCustomerId : null,
          customer_name: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
          account_id: Number(accountId || bootstrap.bankAccounts[0]?.id || 21),
          payment_method: paymentMethod,
          sale_date: saleDate,
          discount: discountNum,
          vat: vatNum,
          paid: receivedNum,
          note: note.trim(),
          items: cart.map((c) => ({
            product_id: c.product_id,
            quantity: c.quantity,
            price: c.price,
            serial_no: c.serial_no,
            warranty: c.warranty || 'No Warranty',
          })),
        }),
      });
      setPaymentModalOpen(false);
      setCart([]);
      setDiscount('0');
      setVat('0');
      setReceivedAmount('');
      setNote('');
      setSelectedCustomerId(0);
      onSaleComplete(result.sale, result.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete order.';
      setModalError(msg);
      showCenterPopup({ type: 'error', title: 'Checkout Failed', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const totalCartUnits = cart.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium shadow-xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2-Column POS Layout: Left New Sale Workspace + Right Product List Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_400px] gap-5 items-start">
        {/* Left Card: New Sale */}
        <div className="min-w-0 bg-white rounded-[22px] shadow-[0_8px_28px_rgba(15,23,42,0.06)] border border-slate-200/80 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#065AA4] via-[#4f46e5] to-[#10b981]" />

          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-indigo-50/75 via-white to-sky-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-[0_4px_14px_rgba(79,70,229,0.3)] shrink-0"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight truncate">
                  New Sale
                </h3>
                <p className="text-[11px] text-slate-500">Scan barcode, assign customer &amp; bill</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 tabular-nums">
                {cart.length} {cart.length === 1 ? 'Item' : 'Items'} &bull; {totalCartUnits} Qty
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Search Product Input + Rich Dropdown */}
            <div ref={topSearchRef} className="relative mb-4">
              <div className="relative flex items-center">
                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center absolute left-2 pointer-events-none">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={topSearch}
                  onFocus={() => setTopDropdownOpen(true)}
                  onChange={(e) => {
                    setTopSearch(e.target.value);
                    setTopDropdownOpen(true);
                  }}
                  placeholder="Search product by name, SKU, or barcode..."
                  className="w-full pl-12 pr-9 py-3 border-2 border-slate-200 bg-slate-50/60 focus:bg-white rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 transition-all"
                />
                {topSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopSearch('');
                      setTopDropdownOpen(false);
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {topDropdownOpen && topSearch.trim().length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl max-h-[320px] overflow-y-auto z-30 shadow-[0_18px_40px_rgba(15,23,42,0.14)] divide-y divide-slate-100">
                  {topSearchResults.length > 0 ? (
                    topSearchResults.map((product) => {
                      const out = Number(product.quantity) <= 0;
                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            if (!out) {
                              addToCart(product);
                              setTopSearch('');
                              setTopDropdownOpen(false);
                            }
                          }}
                          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors ${
                            out
                              ? 'opacity-60 bg-red-50/60 cursor-not-allowed'
                              : 'hover:bg-indigo-50/60 cursor-pointer'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Box className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-bold text-slate-800 truncate">{product.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                              <span>SKU: {product.sku || 'N/A'}</span>
                              {product.warranty && product.warranty !== 'No Warranty' && (
                                <span className="text-indigo-600 font-medium inline-flex items-center gap-1">
                                  <Shield className="w-3 h-3" /> {product.warranty}
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                  out ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {out ? 'Out of Stock' : `Stock: ${product.quantity}`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="text-[13px] font-extrabold text-emerald-600 tabular-nums">
                              {formatMoney(product.selling_price, cur)}
                            </span>
                            <button
                              type="button"
                              disabled={out}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product);
                                setTopSearch('');
                                setTopDropdownOpen(false);
                              }}
                              style={!out ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
                              className="disabled:bg-slate-300 text-white px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-sm text-slate-400">No matching products found</div>
                  )}
                </div>
              )}
            </div>

            {/* Date & Searchable Customer Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
              <div className="flex items-center gap-2.5 min-w-0 bg-indigo-50/35 px-3 py-2 rounded-xl border border-indigo-100/90 focus-within:border-[#4f46e5] focus-within:bg-white transition-all">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">
                    Sale Date
                  </span>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full min-w-0 bg-transparent border-none text-xs sm:text-sm font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div
                ref={customerBoxRef}
                className="relative flex items-center gap-2.5 min-w-0 bg-indigo-50/35 px-3 py-2 rounded-xl border border-indigo-100/90 hover:border-indigo-300 transition-all"
              >
                <span className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </span>
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    setCustomerSearch('');
                    setCustomerDropdownOpen((o) => !o);
                  }}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">
                    Customer
                  </span>
                  <input
                    type="text"
                    readOnly
                    value={selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                    placeholder="Search customer..."
                    className="w-full min-w-0 bg-transparent border-none text-xs sm:text-sm font-semibold text-slate-800 outline-none cursor-pointer truncate"
                  />
                </div>
                {previousDue > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0 tabular-nums">
                    Due: {formatMoney(previousDue, cur)}
                  </span>
                )}

                {customerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl max-h-[300px] overflow-hidden z-30 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Type to search customer..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[#4f46e5]"
                      />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((c) => {
                          const isSelected = Number(c.id) === selectedCustomerId;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(Number(c.id));
                                setCustomerDropdownOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between text-[13px] transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 border-l-4 border-[#4f46e5]'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="truncate pr-2">
                                <strong className="text-slate-800">{c.name}</strong>
                                {c.phone && <small className="text-slate-400 ml-1.5">({c.phone})</small>}
                              </div>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400">No customers found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Table */}
            <div className="w-full overflow-x-auto rounded-2xl border border-slate-100">
              {cart.length === 0 ? (
                <div className="py-14 px-5 text-center text-slate-400 bg-gradient-to-br from-slate-50/70 via-white to-indigo-50/40">
                  <div
                    className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-indigo-600 shadow-xs"
                    style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.14))' }}
                  >
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Cart is empty</p>
                  <small className="text-xs text-slate-500">Search or click &ldquo;Add&rdquo; from the Product List to start billing</small>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/70">
                      <th className="py-3 px-3 text-left">Product</th>
                      <th className="py-3 px-2 text-left">Serial</th>
                      <th className="py-3 px-2 text-left">Warranty</th>
                      <th className="py-3 px-2 text-center">Qty</th>
                      <th className="py-3 px-2 text-right">Price</th>
                      <th className="py-3 px-2 text-right">Sub Total</th>
                      <th className="py-3 px-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((row, idx) => (
                      <tr key={row.product_id} className="hover:bg-indigo-50/25 transition-colors">
                        <td className="py-3 px-3 max-w-[190px]">
                          <div className="font-bold text-slate-800 truncate">{row.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">SKU: {row.sku} &bull; Max: {row.maxStock}</div>
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={row.serial_no}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, serial_no: val } : it)));
                            }}
                            placeholder="Serial No"
                            className="w-24 sm:w-28 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#4f46e5]"
                          />
                        </td>
                        <td className="py-3 px-2">
                          {row.warranty ? (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
                              <Shield className="w-3 h-3 shrink-0" /> {row.warranty}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setCart((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))
                                );
                              }}
                              className="px-2 py-1.5 text-slate-600 hover:bg-slate-200/70 hover:text-indigo-700 cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={row.maxStock || undefined}
                              value={row.quantity}
                              onChange={(e) => {
                                const raw = Math.max(1, Math.round(Number(e.target.value) || 1));
                                const clamped = row.maxStock > 0 ? Math.min(row.maxStock, raw) : raw;
                                if (row.maxStock > 0 && raw > row.maxStock) {
                                  const msg = `Only ${row.maxStock} unit(s) of "${row.name}" available in stock.`;
                                  setError(msg);
                                  showCenterPopup({ type: 'warning', title: 'Stock Limit Reached', message: msg });
                                }
                                setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: clamped } : it)));
                              }}
                              className="w-11 py-1 bg-white text-center text-xs font-bold text-slate-800 tabular-nums focus:outline-none border-x border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (row.maxStock > 0 && row.quantity >= row.maxStock) {
                                  const msg = `Only ${row.maxStock} unit(s) of "${row.name}" available in stock.`;
                                  setError(msg);
                                  showCenterPopup({ type: 'warning', title: 'Stock Limit Reached', message: msg });
                                  return;
                                }
                                setCart((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it))
                                );
                              }}
                              className="px-2 py-1.5 text-slate-600 hover:bg-slate-200/70 hover:text-indigo-700 cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={row.price}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, price: val } : it)));
                            }}
                            className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-right text-xs font-semibold bg-white tabular-nums focus:outline-none focus:border-[#4f46e5]"
                          />
                        </td>
                        <td className="py-3 px-2 text-right font-extrabold text-indigo-700 tabular-nums whitespace-nowrap">
                          {(row.quantity * row.price).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                            className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200/70 p-1.5 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Cart Total & Proceed to Payment */}
            <div className="mt-5 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/35 to-emerald-50/45 border border-slate-200/80 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs sm:text-sm text-slate-600">
                <span>Subtotal ({cart.length} items)</span>
                <span className="font-semibold tabular-nums text-slate-800">{formatMoney(subtotal, cur)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/70">
                <span className="text-base sm:text-lg font-extrabold text-slate-900">Total</span>
                <span className="text-lg sm:text-xl font-black text-[#4f46e5] tabular-nums">
                  {formatMoney(subtotal, cur)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={openPaymentModal}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              className="mt-4 w-full py-3.5 px-5 rounded-xl text-white text-sm sm:text-base font-bold flex items-center justify-between shadow-[0_6px_18px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,185,129,0.38)] transition-all cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Proceed to Payment
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold tabular-nums">
                {formatMoney(subtotal, cur)}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </div>
        </div>

        {/* Right Card: Product List */}
        <div className="min-w-0 bg-white rounded-[22px] shadow-[0_8px_28px_rgba(15,23,42,0.06)] border border-slate-200/80 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#4f46e5] via-[#7c3aed] to-[#ec4899]" />

          <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-indigo-50/60 via-white to-violet-50/50 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                <Box className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight truncate">Product List</h3>
                <p className="text-[11px] text-slate-500">Quick-add inventory items</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 tabular-nums shrink-0">
              {sideProducts.length}
            </span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="relative mb-3.5">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sideSearch}
                onChange={(e) => setSideSearch(e.target.value)}
                placeholder="Filter products..."
                className="w-full pl-9 pr-8 py-2.5 border-2 border-slate-200 bg-slate-50/60 focus:bg-white rounded-xl text-[13px] outline-none focus:border-[#4f46e5] transition-all"
              />
              {sideSearch && (
                <button
                  type="button"
                  onClick={() => setSideSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-[540px] overflow-y-auto space-y-2 pr-1">
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))
              ) : sideProducts.length > 0 ? (
                sideProducts.map((p) => {
                  const stockQty = Number(p.quantity ?? 0);
                  const isStockOut = stockQty <= 0;
                  const inCart = cart.find((c) => c.product_id === p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all ${
                        isStockOut
                          ? 'opacity-65 bg-red-50/60 border-red-100'
                          : inCart
                            ? 'bg-indigo-50/45 border-indigo-200 shadow-xs'
                            : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/25'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/70 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <Box className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[12.5px] text-[#0f172a] truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">SKU: {p.sku || 'N/A'}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 ${
                              isStockOut ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            <Boxes className="w-2.5 h-2.5 shrink-0" /> {stockQty}
                          </span>
                          {p.warranty && p.warranty !== 'No Warranty' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 inline-flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5 shrink-0" /> {p.warranty}
                            </span>
                          )}
                          {inCart && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white">
                              ×{inCart.quantity}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <div className="font-extrabold text-emerald-600 text-xs sm:text-[13px] whitespace-nowrap tabular-nums">
                          {formatMoney(p.selling_price, cur)}
                        </div>

                        <button
                          type="button"
                          disabled={isStockOut}
                          onClick={() => addToCart(p)}
                          style={
                            isStockOut
                              ? undefined
                              : { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white whitespace-nowrap inline-flex items-center gap-1 shrink-0 shadow-xs ${
                            isStockOut
                              ? 'bg-slate-400 opacity-55 cursor-not-allowed'
                              : 'cursor-pointer hover:brightness-105'
                          }`}
                        >
                          <Plus className="w-3 h-3 shrink-0" /> Add
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">No products match your filter.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details Modal */}
      {paymentModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="bg-white rounded-[22px] w-full max-w-[660px] max-h-[95vh] overflow-y-auto shadow-[0_28px_70px_rgba(15,23,42,0.32)] border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Gradient Header */}
            <div
              className="px-5 py-4 text-white flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5" />
                <h4 className="text-base font-bold m-0">Payment Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder}>
              {/* Order Summary Stat Cards */}
              <div className="p-5 bg-gradient-to-r from-slate-50 via-indigo-50/35 to-slate-50 border-b border-slate-100">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#4f46e5]" /> Order Summary
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="min-w-0 bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
                    <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Total Items</span>
                    <span className="block text-base font-extrabold text-slate-900 tabular-nums">{cart.length}</span>
                  </div>
                  <div className="min-w-0 bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
                    <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Subtotal</span>
                    <span className="block text-base font-extrabold text-slate-900 tabular-nums truncate">
                      {formatMoney(subtotal, cur)}
                    </span>
                  </div>
                  <div className="min-w-0 bg-white p-3 rounded-xl border border-slate-200/80 text-center shadow-2xs">
                    <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">Previous Due</span>
                    <span className="block text-base font-extrabold text-red-600 tabular-nums truncate">
                      {formatMoney(previousDue, cur)}
                    </span>
                  </div>
                  <div
                    className="min-w-0 p-3 rounded-xl text-center text-white shadow-sm"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  >
                    <span className="block text-[10px] text-white/80 font-semibold mb-0.5">Total Amount</span>
                    <span className="block text-base font-black tabular-nums truncate">{formatMoney(netPayable, cur)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Form Fields */}
              <div className="p-4 sm:p-5 space-y-3.5">
                {isWalkInCustomer && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                    Walk-in Customer selected: full payment ({formatMoney(netPayable, cur)}) is required. Due billing is only allowed for registered customers.
                  </div>
                )}

                {modalError && (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                    <span>{modalError}</span>
                    <button type="button" onClick={() => setModalError('')} className="shrink-0 text-red-500 hover:text-red-700 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
                      <Percent className="w-3.5 h-3.5 text-[#4f46e5] shrink-0" /> Discount Amount
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      step="0.01"
                      value={discount}
                      onChange={(e) => {
                        setModalError('');
                        setDiscount(e.target.value);
                      }}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[13px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
                      <Percent className="w-3.5 h-3.5 text-[#4f46e5] shrink-0" /> Vat, Tax &amp; AIT
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={vat}
                      onChange={(e) => {
                        setModalError('');
                        setVat(e.target.value);
                      }}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[13px] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
                      <Landmark className="w-3.5 h-3.5 text-[#4f46e5] shrink-0" /> Payment Method / Account
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPaymentMethod(val);
                        const match = bootstrap.bankAccounts.find(
                          (a) => a.account_name.toLowerCase().replace(/\s+/g, '_') === val
                        );
                        if (match) setAccountId(String(match.id));
                      }}
                      className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:border-[#4f46e5]"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="mobile_banking">Mobile Banking</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      {bootstrap.bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.account_name.toLowerCase().replace(/\s+/g, '_')}>
                          {acc.account_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
                      <HandCoins className="w-3.5 h-3.5 text-[#4f46e5] shrink-0" /> Received Amount
                    </label>
                    <div className="flex gap-2 min-w-0">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={receivedAmount}
                        onChange={(e) => {
                          setModalError('');
                          setReceivedAmount(e.target.value);
                        }}
                        placeholder="Click PAID or enter amount"
                        className="flex-1 min-w-0 px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[13px] font-semibold tabular-nums focus:outline-none focus:border-[#4f46e5]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setModalError('');
                          setReceivedAmount(netPayable.toFixed(2));
                        }}
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold text-white whitespace-nowrap shrink-0 shadow-xs cursor-pointer hover:brightness-95"
                      >
                        PAID
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 mb-1">
                    <StickyNote className="w-3.5 h-3.5 text-[#4f46e5] shrink-0" /> Note
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Write your note here..."
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>

                {/* Live Payment Summary Card */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200/70 p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                    <span className="text-slate-600">Subtotal:</span>
                    <strong className="tabular-nums text-slate-800">{formatMoney(subtotal, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-red-600">
                    <span>Discount:</span>
                    <strong className="tabular-nums">{formatMoney(discountNum, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-indigo-600">
                    <span>Vat, Tax &amp; AIT:</span>
                    <strong className="tabular-nums">{formatMoney(vatNum, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center font-bold border-t border-slate-200/80 pt-2 mt-1 text-slate-900">
                    <span>Net Payable Amount:</span>
                    <strong className="tabular-nums">{formatMoney(netPayable, cur)}</strong>
                  </div>
                  {previousDue > 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>Previous Due Amount:</span>
                      <strong className="tabular-nums">{formatMoney(previousDue, cur)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-emerald-600">
                    <span>Received Amount:</span>
                    <strong className="tabular-nums">{formatMoney(receivedNum, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center font-extrabold border-t border-slate-200/80 pt-2 mt-1">
                    <span className="text-slate-900">Current Invoice Due:</span>
                    <strong className={`tabular-nums ${invoiceDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatMoney(invoiceDue, cur)}
                    </strong>
                  </div>
                  {previousDue > 0 && (
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Total Customer Balance:</span>
                      <strong className="tabular-nums text-red-600">{formatMoney(currentDue, cur)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-[13px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  className="px-6 py-2.5 rounded-xl text-white text-[13px] font-bold inline-flex items-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {submitting ? 'Processing...' : 'Confirm Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
