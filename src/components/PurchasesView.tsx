import { useEffect, useState } from 'react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { Product, Purchase, Supplier } from '../types/pos.ts';

interface PurchasesViewProps {
  currency: string;
  onRefreshBootstrap: () => void;
}

export function PurchasesView({ currency, onRefreshBootstrap }: PurchasesViewProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    supplier_id: '',
    product_id: '',
    quantity: '1',
    price: '',
    paid: '0',
    payment_method: 'cash',
  });

  function loadPurchases() {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (query) params.set('q', query);
    apiFetch<{ items: Purchase[]; total: number }>(`/api/purchases?${params.toString()}`).then((res) => {
      setPurchases(res.items);
      setTotal(res.total);
    });
  }

  useEffect(() => {
    loadPurchases();
  }, [page, query]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: Supplier[] }>('/api/suppliers?limit=150'),
      apiFetch<{ items: Product[] }>('/api/products?limit=200'),
    ]).then(([supRes, prodRes]) => {
      setSuppliers(supRes.items);
      setProducts(prodRes.items);
      setForm((prev) => ({
        ...prev,
        supplier_id: prev.supplier_id || String(supRes.items[0]?.id ?? ''),
        product_id: prev.product_id || String(prodRes.items[0]?.id ?? ''),
        price: prev.price || String(prodRes.items[0]?.purchase_price ?? '0'),
      }));
    });
  }, []);

  async function handleCreatePurchase(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const qty = Number(form.quantity);
    const price = Number(form.price);
    const paid = Number(form.paid);
    if (!form.supplier_id || !form.product_id) {
      setNotice({ type: 'error', text: 'Supplier and product are required.' });
      return;
    }
    if (qty < 1 || price < 0 || paid < 0) {
      setNotice({ type: 'error', text: 'Quantity must be at least 1 and amounts cannot be negative.' });
      return;
    }
    try {
      await apiFetch('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(form.supplier_id),
          product_id: Number(form.product_id),
          quantity: qty,
          price,
          paid,
          payment_method: form.payment_method,
        }),
      });
      setNotice({ type: 'success', text: 'Purchase recorded and stock updated!' });
      loadPurchases();
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save purchase.' });
    }
  }

  async function settleDue(p: Purchase) {
    setNotice(null);
    try {
      await apiFetch(`/api/purchases/${p.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(p.due), payment_method: 'cash' }),
      });
      setNotice({ type: 'success', text: `Due settled for ${p.invoice_no}.` });
      loadPurchases();
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to settle purchase due.' });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="min-w-0 bg-white border border-slate-200 rounded-lg p-4 h-fit">
        <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Record Purchase</h2>
        <form onSubmit={handleCreatePurchase} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Product</label>
            <select
              value={form.product_id}
              onChange={(e) => {
                const chosen = products.find((p) => String(p.id) === e.target.value);
                setForm({ ...form, product_id: e.target.value, price: chosen ? String(chosen.purchase_price) : form.price });
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-xs text-slate-600 mb-1">Qty</label>
              <input type="number" min={1} required value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums" />
            </div>
            <div className="min-w-0">
              <label className="block text-xs text-slate-600 mb-1">Unit Cost</label>
              <input type="number" step="0.01" min={0} required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <label className="block text-xs text-slate-600 mb-1">Paid</label>
              <input type="number" step="0.01" min={0} required value={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md tabular-nums" />
            </div>
            <div className="min-w-0">
              <label className="block text-xs text-slate-600 mb-1">Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md">
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="bkash">bKash</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium cursor-pointer">
            Save Purchase
          </button>
        </form>
      </div>

      <div className="lg:col-span-3 min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search purchase invoice or supplier..."
            className="w-full sm:w-64 min-w-0 px-3 py-1.5 text-sm border border-slate-300 rounded-md"
          />
          <span className="text-xs text-slate-500 tabular-nums shrink-0">{total} purchases</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Invoice</th>
                <th className="px-4 py-2.5 text-left font-medium">Supplier</th>
                <th className="px-4 py-2.5 text-left font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                <th className="px-4 py-2.5 text-right font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">{p.invoice_no}</td>
                  <td className="px-4 py-2 text-slate-800">{p.supplier_name}</td>
                  <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">{String(p.purchase_date).slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(p.total, currency)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(p.paid, currency)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${Number(p.due) > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                    {formatMoney(p.due, currency)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {Number(p.due) > 0 && (
                      <button type="button" onClick={() => settleDue(p)} className="text-amber-700 hover:underline font-medium">
                        Pay Full Due
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40 cursor-pointer">Prev</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40 cursor-pointer">Next</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
