import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Boxes,
  Calendar,
  CheckCircle2,
  CreditCard,
  HandCoins,
  Landmark,
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2-Column POS Layout matching reference */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        {/* Left Card: New Sale */}
        <div className="min-w-0 bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h3 className="inline-flex items-center gap-2 text-[18px] font-semibold text-[#667eea] pb-2.5 border-b-2 border-[#eef2f6]">
              <CreditCard className="w-5 h-5 shrink-0" />
              New Sale
            </h3>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Search Product Input + Dropdown */}
          <div ref={topSearchRef} className="relative mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={topSearch}
                onFocus={() => setTopDropdownOpen(true)}
                onChange={(e) => {
                  setTopSearch(e.target.value);
                  setTopDropdownOpen(true);
                }}
                placeholder="Search product by name or barcode..."
                className="w-full pl-10 pr-4 py-3 border border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#667eea] transition-colors"
              />
            </div>

            {topDropdownOpen && topSearch.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-lg max-h-[300px] overflow-y-auto z-30 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
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
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 border-b border-[#eef2f6] last:border-b-0 ${
                          out
                            ? 'opacity-60 bg-[#fef2f2] cursor-not-allowed'
                            : 'hover:bg-[#f0f3ff] cursor-pointer'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-slate-800 truncate">{product.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                            <span>SKU: {product.sku || 'N/A'}</span>
                            {product.warranty && product.warranty !== 'No Warranty' && (
                              <span className="text-[#667eea] inline-flex items-center gap-1">
                                <Shield className="w-3 h-3" /> {product.warranty}
                              </span>
                            )}
                            <span className={out ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}>
                              {out ? 'Stock Out (0)' : `In Stock: ${product.quantity}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[13px] font-bold text-[#10b981] tabular-nums">
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
                            className="bg-[#667eea] hover:bg-[#5a6fd6] disabled:bg-slate-400 text-white px-3 py-1 rounded text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-5 text-center text-sm text-slate-400">No matching products found</div>
                )}
              </div>
            )}
          </div>

          {/* Date & Searchable Customer Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            <div className="flex items-center gap-2.5 min-w-0 bg-[#f8fafc] px-3 py-2 rounded-[10px] border border-[#e2e8f0]">
              <Calendar className="w-4 h-4 text-[#667eea] shrink-0" />
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none text-sm text-slate-700 outline-none"
              />
            </div>

            <div ref={customerBoxRef} className="relative flex items-center gap-2.5 min-w-0 bg-[#f8fafc] px-3 py-2 rounded-[10px] border border-[#e2e8f0]">
              <User className="w-4 h-4 text-[#667eea] shrink-0" />
              <input
                type="text"
                readOnly
                value={selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                onClick={() => {
                  setCustomerSearch('');
                  setCustomerDropdownOpen((o) => !o);
                }}
                placeholder="Search customer..."
                className="flex-1 min-w-0 bg-transparent border-none text-sm text-slate-700 outline-none cursor-pointer truncate"
              />
              {previousDue > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 shrink-0">
                  Due: {formatMoney(previousDue, cur)}
                </span>
              )}

              {customerDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#e2e8f0] rounded-lg max-h-[300px] overflow-hidden z-30 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  <div className="p-2.5 border-b border-[#e2e8f0] bg-[#f8fafc] relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Type to search customer..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#e2e8f0] rounded-md text-[13px] outline-none focus:border-[#667eea]"
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
                                ? 'bg-[#dbeafe] border-l-[3px] border-[#667eea]'
                                : 'hover:bg-[#f0f3ff]'
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
          <div className="w-full overflow-x-auto">
            {cart.length === 0 ? (
              <div className="py-14 px-5 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
                <small className="text-xs text-slate-400">Search and add products to continue</small>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#475569] font-semibold">
                    <th className="py-3 px-2.5 text-left rounded-l-lg">Product</th>
                    <th className="py-3 px-2 text-left">Serial</th>
                    <th className="py-3 px-2 text-left">Warranty</th>
                    <th className="py-3 px-2 text-center">Qty</th>
                    <th className="py-3 px-2 text-right">Price</th>
                    <th className="py-3 px-2 text-right">Sub Total</th>
                    <th className="py-3 px-2 text-center rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((row, idx) => (
                    <tr key={row.product_id} className="border-b border-[#eef2f6]">
                      <td className="py-2.5 px-2.5 max-w-[190px]">
                        <div className="font-semibold text-slate-800 truncate">{row.name}</div>
                        <div className="text-[11px] text-slate-400">SKU: {row.sku}</div>
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          value={row.serial_no}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, serial_no: val } : it)));
                          }}
                          placeholder="Serial No"
                          className="w-24 sm:w-28 px-2 py-1 border border-[#e2e8f0] rounded text-xs focus:outline-none focus:border-[#667eea]"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        {row.warranty ? (
                          <span className="inline-block bg-[#eef2ff] text-[#667eea] px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">
                            {row.warranty}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="number"
                          min={1}
                          max={row.maxStock || undefined}
                          value={row.quantity}
                          onChange={(e) => {
                            const raw = Math.max(1, Math.round(Number(e.target.value) || 1));
                            const clamped = row.maxStock > 0 ? Math.min(row.maxStock, raw) : raw;
                            if (row.maxStock > 0 && raw > row.maxStock) {
                              setError(`Only ${row.maxStock} unit(s) of "${row.name}" available in stock.`);
                            }
                            setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: clamped } : it)));
                          }}
                          className="w-16 px-2 py-1 border border-[#e2e8f0] rounded text-center text-xs tabular-nums focus:outline-none focus:border-[#667eea]"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, price: val } : it)));
                          }}
                          className="w-24 px-2 py-1 border border-[#e2e8f0] rounded text-right text-xs tabular-nums focus:outline-none focus:border-[#667eea]"
                        />
                      </td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                        {(row.quantity * row.price).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                          className="bg-[#ef4444] hover:bg-[#dc2626] text-white p-1.5 rounded inline-flex items-center justify-center cursor-pointer"
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
          <div className="mt-5 pt-4 border-t-2 border-[#eef2f6] space-y-2">
            <div className="flex justify-between text-sm text-[#64748b]">
              <span>Subtotal:</span>
              <span className="font-semibold tabular-nums">{formatMoney(subtotal, cur)}</span>
            </div>
            <div className="flex justify-between text-[18px] font-bold text-[#667eea] pt-1">
              <span>Total:</span>
              <span className="tabular-nums">{formatMoney(subtotal, cur)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={openPaymentModal}
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            className="mt-4 w-full py-3.5 px-4 rounded-xl text-white text-base font-semibold flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(16,185,129,0.28)] hover:brightness-95 transition-all cursor-pointer"
          >
            <CreditCard className="w-5 h-5" />
            Proceed to Payment
          </button>
        </div>

        {/* Right Card: Product List */}
        <div className="min-w-0 bg-white rounded-[20px] p-4 sm:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100">
          <h3 className="inline-flex items-center gap-2 text-[18px] font-semibold text-[#667eea] mb-4 pb-2.5 border-b-2 border-[#eef2f6]">
            <Box className="w-5 h-5 shrink-0" />
            Product List
          </h3>

          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
            <h4 className="text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0">All Products</h4>
            <input
              type="text"
              value={sideSearch}
              onChange={(e) => setSideSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 min-w-[140px] sm:max-w-[200px] px-3 py-2 border border-[#e2e8f0] rounded-lg text-[13px] outline-none focus:border-[#667eea]"
            />
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-[#eef2f6] pr-1">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="py-3">
                  <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                </div>
              ))
            ) : sideProducts.length > 0 ? (
              sideProducts.map((p) => {
                const stockQty = Number(p.quantity ?? 0);
                const isStockOut = stockQty <= 0;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 py-3 px-1.5 rounded-lg transition-colors ${
                      isStockOut ? 'opacity-60 bg-[#fef2f2]' : 'hover:bg-[#f8fafc]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-[#1e293b] truncate">{p.name}</div>
                      <div className="text-[10px] text-[#94a3b8]">SKU: {p.sku || 'N/A'}</div>
                      {p.warranty && p.warranty !== 'No Warranty' && (
                        <div className="text-[10px] text-[#667eea] mt-0.5 inline-flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5 shrink-0" /> {p.warranty}
                        </div>
                      )}
                      <div
                        className={`text-[10px] font-medium mt-0.5 flex items-center gap-1 ${
                          isStockOut ? 'text-[#ef4444]' : 'text-[#10b981]'
                        }`}
                      >
                        <Boxes className="w-2.5 h-2.5 shrink-0" /> Stock: {stockQty}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="font-bold text-[#10b981] text-sm whitespace-nowrap tabular-nums">
                        {formatMoney(p.selling_price, cur)}
                      </div>

                      <button
                        type="button"
                        disabled={isStockOut}
                        onClick={() => addToCart(p)}
                        style={
                          isStockOut
                            ? undefined
                            : { background: 'linear-gradient(135deg, #667eea, #764ba2)' }
                        }
                        className={`px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium text-white whitespace-nowrap inline-flex items-center gap-1 shrink-0 ${
                          isStockOut ? 'bg-[#94a3b8] opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-95'
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

      {/* Payment Details Modal */}
      {paymentModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPaymentModalOpen(false)}
        >
          <div
            className="bg-white rounded-[20px] w-full max-w-[650px] max-h-[95vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Gradient Header */}
            <div
              className="px-5 py-4 text-white flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5" />
                <h4 className="text-base font-semibold m-0">Payment Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder}>
              {/* Order Summary Stat Cards */}
              <div className="p-5 bg-[#f8fafc] border-b border-[#eef2f6]">
                <h5 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#667eea]" /> Order Summary
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="min-w-0 bg-white p-2.5 rounded-[10px] border border-[#eef2f6] text-center">
                    <span className="block text-[10px] text-[#64748b] mb-0.5">Total Items</span>
                    <span className="block text-base font-bold text-[#1e293b] tabular-nums">{cart.length}</span>
                  </div>
                  <div className="min-w-0 bg-white p-2.5 rounded-[10px] border border-[#eef2f6] text-center">
                    <span className="block text-[10px] text-[#64748b] mb-0.5">Subtotal</span>
                    <span className="block text-base font-bold text-[#1e293b] tabular-nums truncate">
                      {formatMoney(subtotal, cur)}
                    </span>
                  </div>
                  <div className="min-w-0 bg-white p-2.5 rounded-[10px] border border-[#eef2f6] text-center">
                    <span className="block text-[10px] text-[#64748b] mb-0.5">Previous Due</span>
                    <span className="block text-base font-bold text-[#ef4444] tabular-nums truncate">
                      {formatMoney(previousDue, cur)}
                    </span>
                  </div>
                  <div
                    className="min-w-0 p-2.5 rounded-[10px] text-center text-white"
                    style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                  >
                    <span className="block text-[10px] text-white/80 mb-0.5">Total Amount</span>
                    <span className="block text-base font-bold tabular-nums truncate">{formatMoney(netPayable, cur)}</span>
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
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] mb-1">
                      <Percent className="w-3.5 h-3.5 text-[#667eea] shrink-0" /> Discount Amount
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
                      className="w-full px-3 py-2 border-2 border-[#e2e8f0] rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#667eea]"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] mb-1">
                      <Percent className="w-3.5 h-3.5 text-[#667eea] shrink-0" /> Vat, Tax &amp; AIT
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
                      className="w-full px-3 py-2 border-2 border-[#e2e8f0] rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#667eea]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] mb-1">
                      <Landmark className="w-3.5 h-3.5 text-[#667eea] shrink-0" /> Payment Method / Account
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
                      className="w-full px-3 py-2 border-2 border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none focus:border-[#667eea]"
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
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] mb-1">
                      <HandCoins className="w-3.5 h-3.5 text-[#667eea] shrink-0" /> Received Amount
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
                        className="flex-1 min-w-0 px-3 py-2 border-2 border-[#e2e8f0] rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#667eea]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setModalError('');
                          setReceivedAmount(netPayable.toFixed(2));
                        }}
                        style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                        className="px-3.5 py-1.5 rounded-md text-[11px] font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        PAID
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] mb-1">
                    <StickyNote className="w-3.5 h-3.5 text-[#667eea] shrink-0" /> Note
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Write your note here..."
                    className="w-full px-3 py-2 border-2 border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none focus:border-[#667eea]"
                  />
                </div>

                {/* Live Payment Summary Card */}
                <div className="bg-[#f8fafc] rounded-[10px] p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0]">
                    <span className="text-slate-600">Subtotal:</span>
                    <strong className="tabular-nums text-slate-800">{formatMoney(subtotal, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[#ef4444]">
                    <span>Discount:</span>
                    <strong className="tabular-nums">{formatMoney(discountNum, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[#667eea]">
                    <span>Vat, Tax &amp; AIT:</span>
                    <strong className="tabular-nums">{formatMoney(vatNum, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center font-bold border-t border-[#e2e8f0] pt-2 mt-1 text-slate-800">
                    <span>Net Payable Amount:</span>
                    <strong className="tabular-nums">{formatMoney(netPayable, cur)}</strong>
                  </div>
                  {previousDue > 0 && (
                    <div className="flex justify-between items-center text-[#ef4444]">
                      <span>Previous Due Amount:</span>
                      <strong className="tabular-nums">{formatMoney(previousDue, cur)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[#10b981]">
                    <span>Received Amount:</span>
                    <strong className="tabular-nums">{formatMoney(receivedNum, cur)}</strong>
                  </div>
                  <div className="flex justify-between items-center font-bold border-t border-[#e2e8f0] pt-2 mt-1">
                    <span className="text-slate-800">Current Invoice Due:</span>
                    <strong className={`tabular-nums ${invoiceDue > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                      {formatMoney(invoiceDue, cur)}
                    </strong>
                  </div>
                  {previousDue > 0 && (
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Total Customer Balance:</span>
                      <strong className="tabular-nums text-[#ef4444]">{formatMoney(currentDue, cur)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="px-4 sm:px-5 py-3.5 bg-[#f8fafc] border-t border-[#eef2f6] flex flex-wrap justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-5 py-2.5 rounded-lg bg-[#f1f5f9] hover:bg-slate-200 text-[#475569] text-[13px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  className="px-6 py-2.5 rounded-lg text-white text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer"
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
