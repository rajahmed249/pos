import { useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  BookOpen,
  Boxes,
  CheckCircle2,
  CreditCard,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { BootstrapPayload, Product } from '../types/pos.ts';

interface OperationsViewProps {
  section: 'owners' | 'cashbook' | 'stock' | 'payments' | 'employees';
  bootstrap: BootstrapPayload;
  onRefreshBootstrap: () => void;
}

export function OperationsView({ section, bootstrap, onRefreshBootstrap }: OperationsViewProps) {
  const cur = bootstrap.settings.currency || '৳';
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Owners
  const [owners, setOwners] = useState<Array<{ id: number; name: string; phone: string; email: string; address: string; share_percent: number; is_active: boolean }>>([]);
  const [ownerForm, setOwnerForm] = useState({ name: '', phone: '', email: '', address: '', share_percent: '50' });

  // Cash Book
  const [cashData, setCashData] = useState<{
    items: Array<{ id: number; type: string; amount: number; description: string; transaction_date: string }>;
    totalIn: number;
    totalOut: number;
    balance: number;
  }>({ items: [], totalIn: 0, totalOut: 0, balance: 0 });
  const [cashForm, setCashForm] = useState({
    type: 'in',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().slice(0, 10),
  });

  // Stock
  const [stockData, setStockData] = useState<{
    products: Product[];
    movements: Array<{ id: number; product_name: string; old_quantity: number; new_quantity: number; difference: number; reason: string; created_at: string }>;
  }>({ products: [], movements: [] });
  const [stockQuery, setStockQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [adjForm, setAdjForm] = useState({ product_id: '', quantity: '', reason: 'Manual Stock Adjustment' });

  // Payments
  const [payData, setPayData] = useState<{
    customerPayments: Array<{ id: number; invoice_no: string; party_name: string; amount: number; payment_date: string; payment_method: string; note: string }>;
    supplierPayments: Array<{ id: number; invoice_no: string; party_name: string; amount: number; payment_date: string; payment_method: string; note: string }>;
    dueSales: Array<{ id: number; invoice_no: string; customer_name: string; due: number }>;
    duePurchases: Array<{ id: number; invoice_no: string; supplier_name: string; due: number }>;
  }>({ customerPayments: [], supplierPayments: [], dueSales: [], duePurchases: [] });
  const [payMode, setPayMode] = useState<'customer' | 'supplier'>('customer');
  const [collectForm, setCollectForm] = useState({
    target_id: '',
    account_id: String(bootstrap.bankAccounts[0]?.id ?? ''),
    amount: '',
    note: '',
  });

  // Employees
  const [employees, setEmployees] = useState<Array<{ id: number; employee_id: string; name: string; phone: string; email: string; designation: string; department: string; salary: number; status: number }>>([]);
  const [empForm, setEmpForm] = useState({ name: '', phone: '', designation: 'Sales Executive', department: 'Sales', salary: '15000', joining_date: new Date().toISOString().slice(0, 10) });

  function loadSection() {
    if (section === 'owners') {
      apiFetch<typeof owners>('/api/owners').then(setOwners);
    } else if (section === 'cashbook') {
      apiFetch<typeof cashData>('/api/cashbook').then(setCashData);
    } else if (section === 'stock') {
      const qs = new URLSearchParams({ filter: stockFilter });
      if (stockQuery.trim()) qs.set('q', stockQuery.trim());
      apiFetch<typeof stockData>(`/api/stock?${qs.toString()}`).then((r) => {
        setStockData(r);
        setAdjForm((prev) => {
          const matched = r.products.find((x) => String(x.id) === prev.product_id);
          if (matched) {
            return { ...prev, quantity: String(matched.quantity) };
          }
          if (r.products[0]) {
            return {
              ...prev,
              product_id: String(r.products[0].id),
              quantity: String(r.products[0].quantity),
            };
          }
          return { ...prev, product_id: '', quantity: '' };
        });
      });
    } else if (section === 'payments') {
      apiFetch<typeof payData>('/api/payments').then((r) => {
        setPayData(r);
        if (payMode === 'customer' && r.dueSales[0]) {
          setCollectForm((prev) => ({ ...prev, target_id: String(r.dueSales[0].id), amount: String(r.dueSales[0].due) }));
        } else if (payMode === 'supplier' && r.duePurchases[0]) {
          setCollectForm((prev) => ({ ...prev, target_id: String(r.duePurchases[0].id), amount: String(r.duePurchases[0].due) }));
        } else {
          setCollectForm((prev) => ({ ...prev, target_id: '', amount: '' }));
        }
      });
    } else if (section === 'employees') {
      apiFetch<typeof employees>('/api/employees').then(setEmployees);
    }
  }

  useEffect(() => {
    setNotice(null);
    loadSection();
  }, [section, stockFilter, stockQuery]);

  useEffect(() => {
    if (!bootstrap.bankAccounts.length) {
      setCollectForm((prev) => ({ ...prev, account_id: '' }));
      return;
    }
    const exists = bootstrap.bankAccounts.some((a) => String(a.id) === collectForm.account_id);
    if (!exists) {
      setCollectForm((prev) => ({ ...prev, account_id: String(bootstrap.bankAccounts[0].id) }));
    }
  }, [bootstrap.bankAccounts, collectForm.account_id]);

  const banner = notice && (
    <div
      className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-semibold border ${
        notice.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      {notice.text}
    </div>
  );

  if (section === 'owners') {
    const totalShare = owners.filter((o) => o.is_active).reduce((s, o) => s + Number(o.share_percent || 0), 0);
    return (
      <div className="space-y-6">
        {banner}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <UserCheck className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Owners Management</h1>
              <p className="text-xs text-slate-500">Active equity allocated: {totalShare.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-5 h-fit shadow-xs">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3">Add Partner / Owner</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNotice(null);
                try {
                  await apiFetch('/api/owners', { method: 'POST', body: JSON.stringify(ownerForm) });
                  setOwnerForm({ name: '', phone: '', email: '', address: '', share_percent: '50' });
                  setNotice({ type: 'success', text: 'Owner added successfully.' });
                  loadSection();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add owner.' });
                }
              }}
              className="space-y-3 text-sm"
            >
              <input required placeholder="Owner Name *" value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder="Phone" value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input type="email" placeholder="Email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input type="number" step="0.01" min={0} max={100} required placeholder="Share %" value={ownerForm.share_percent} onChange={(e) => setOwnerForm({ ...ownerForm, share_percent: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
              <input placeholder="Address" value={ownerForm.address} onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <button type="submit" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} className="w-full py-2.5 text-white rounded-xl font-semibold cursor-pointer">
                Add Owner
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Owner</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Share %</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {owners.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{o.name}</div>
                        {o.address && <div className="text-xs text-slate-400">{o.address}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{o.phone || '—'}</div>
                        <div className="text-slate-400">{o.email || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">{Number(o.share_percent).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/owners/${o.id}/toggle`, { method: 'PATCH' });
                            loadSection();
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer ${
                            o.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {o.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/owners/${o.id}`, { method: 'DELETE' });
                            loadSection();
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Delete Owner"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {owners.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">No owners added yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'cashbook') {
    return (
      <div className="space-y-6">
        {banner}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash In</div>
            <div className="mt-1 text-xl font-display font-bold text-emerald-600 tabular-nums">{formatMoney(cashData.totalIn, cur)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Out</div>
            <div className="mt-1 text-xl font-display font-bold text-red-600 tabular-nums">{formatMoney(cashData.totalOut, cur)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cash Book Balance</div>
            <div className="mt-1 text-xl font-display font-bold text-indigo-600 tabular-nums">{formatMoney(cashData.balance, cur)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-5 h-fit shadow-xs">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" /> New Cash Entry
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNotice(null);
                try {
                  await apiFetch('/api/cashbook', { method: 'POST', body: JSON.stringify(cashForm) });
                  setCashForm({ ...cashForm, amount: '', description: '' });
                  setNotice({ type: 'success', text: 'Cash book entry saved.' });
                  loadSection();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save entry.' });
                }
              }}
              className="space-y-3 text-sm"
            >
              <select value={cashForm.type} onChange={(e) => setCashForm({ ...cashForm, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="in">Cash In (+)</option>
                <option value="out">Cash Out (-)</option>
              </select>
              <input type="number" step="0.01" min="0.01" required placeholder="Amount *" value={cashForm.amount} onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
              <input type="date" value={cashForm.transaction_date} onChange={(e) => setCashForm({ ...cashForm, transaction_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder="Description / Note" value={cashForm.description} onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <button type="submit" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} className="w-full py-2.5 text-white rounded-xl font-semibold cursor-pointer">
                Record Entry
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 text-left whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cashData.items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-xs tabular-nums whitespace-nowrap">{row.transaction_date}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${row.type === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                          {row.type === 'in' ? 'Cash In' : 'Cash Out'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.description || '—'}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${row.type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {row.type === 'in' ? '+' : '-'}{formatMoney(row.amount, cur)}
                      </td>
                    </tr>
                  ))}
                  {cashData.items.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-500">No cash book entries recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'stock') {
    return (
      <div className="space-y-6">
        {banner}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Products</div>
            <div className="mt-1 text-xl font-display font-bold text-slate-900 tabular-nums">{bootstrap.metrics.productCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Cost Value</div>
            <div className="mt-1 text-xl font-display font-bold text-indigo-600 tabular-nums">{formatMoney(bootstrap.metrics.stockCostValue, cur)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-[18px] p-4 shadow-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Retail Value</div>
            <div className="mt-1 text-xl font-display font-bold text-emerald-600 tabular-nums">{formatMoney(bootstrap.metrics.stockRetailValue, cur)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex flex-wrap items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-600 shrink-0" />
                <h2 className="font-display text-sm font-bold text-slate-900">Stock Ledger</h2>
                {(['all', 'low', 'out'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStockFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                      stockFilter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
                <input
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  placeholder="Search product / SKU..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Product</th>
                    <th className="px-4 py-2.5 text-left">Category</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Cost</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockData.products.map((p) => {
                    const qty = Number(p.quantity ?? 0);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{p.sku}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{p.category_name}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums">{formatMoney(p.purchase_price, cur)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${qty <= 0 ? 'bg-red-50 text-red-700' : qty <= (p.alert_quantity ?? 5) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {qty}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-xs">
              <h3 className="font-display text-sm font-bold text-slate-900 mb-3">Quick Stock Adjustment</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  if (!adjForm.product_id) {
                    setNotice({ type: 'error', text: 'Please select a product to adjust.' });
                    return;
                  }
                  try {
                    await apiFetch(`/api/products/${adjForm.product_id}/adjust`, {
                      method: 'POST',
                      body: JSON.stringify({ new_quantity: Number(adjForm.quantity), reason: adjForm.reason }),
                    });
                    setNotice({ type: 'success', text: 'Stock quantity updated.' });
                    loadSection();
                    onRefreshBootstrap();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Stock adjustment failed.' });
                  }
                }}
                className="space-y-3 text-sm"
              >
                <select
                  value={adjForm.product_id}
                  onChange={(e) => {
                    const p = stockData.products.find((x) => String(x.id) === e.target.value);
                    setAdjForm({ ...adjForm, product_id: e.target.value, quantity: p ? String(p.quantity) : adjForm.quantity });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {stockData.products.length === 0 && <option value="">-- Select Product --</option>}
                  {stockData.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (Current: {p.quantity})</option>
                  ))}
                </select>
                <input type="number" min={0} required placeholder="New Stock Quantity" value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
                <input placeholder="Reason" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                <button type="submit" disabled={!stockData.products.length} style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} className="w-full py-2.5 text-white rounded-xl font-semibold disabled:opacity-50 cursor-pointer">
                  Update Stock
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-[20px] p-5 shadow-xs">
              <h3 className="font-display text-sm font-bold text-slate-900 mb-3">Recent Stock Movements</h3>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs space-y-1">
                {stockData.movements.slice(0, 15).map((m) => (
                  <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{m.product_name}</div>
                      <div className="text-slate-400 truncate">{m.reason}</div>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${Number(m.difference) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Number(m.difference) >= 0 ? `+${m.difference}` : m.difference}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'payments') {
    const activeDueList = payMode === 'customer' ? payData.dueSales : payData.duePurchases;
    return (
      <div className="space-y-6">
        {banner}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-5 h-fit shadow-xs">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" /> Record Payment
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setPayMode('customer');
                  setCollectForm((prev) => ({
                    ...prev,
                    target_id: payData.dueSales[0] ? String(payData.dueSales[0].id) : '',
                    amount: payData.dueSales[0] ? String(payData.dueSales[0].due) : '',
                  }));
                }}
                className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${payMode === 'customer' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Customer Receive
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayMode('supplier');
                  setCollectForm((prev) => ({
                    ...prev,
                    target_id: payData.duePurchases[0] ? String(payData.duePurchases[0].id) : '',
                    amount: payData.duePurchases[0] ? String(payData.duePurchases[0].due) : '',
                  }));
                }}
                className={`py-2 rounded-lg text-xs font-semibold cursor-pointer ${payMode === 'supplier' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                Supplier Pay
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNotice(null);
                if (!collectForm.target_id) {
                  setNotice({ type: 'error', text: 'No due invoice/purchase selected.' });
                  return;
                }
                try {
                  const url =
                    payMode === 'customer'
                      ? `/api/sales/${collectForm.target_id}/payments`
                      : `/api/purchases/${collectForm.target_id}/payments`;
                  await apiFetch(url, {
                    method: 'POST',
                    body: JSON.stringify({
                      account_id: Number(collectForm.account_id),
                      amount: Number(collectForm.amount),
                      note: collectForm.note,
                    }),
                  });
                  setNotice({ type: 'success', text: 'Payment recorded successfully!' });
                  loadSection();
                  onRefreshBootstrap();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Payment failed.' });
                }
              }}
              className="space-y-3 text-sm"
            >
              <select
                value={collectForm.target_id}
                onChange={(e) => {
                  const item = activeDueList.find((x) => String(x.id) === e.target.value);
                  setCollectForm({ ...collectForm, target_id: e.target.value, amount: item ? String(item.due) : '' });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                {activeDueList.length === 0 && <option value="">No pending dues</option>}
                {activeDueList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.invoice_no} — {'customer_name' in item ? item.customer_name : item.supplier_name} (Due: {formatMoney(item.due, cur)})
                  </option>
                ))}
              </select>
              <select value={collectForm.account_id} onChange={(e) => setCollectForm({ ...collectForm, account_id: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs">
                {bootstrap.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
              </select>
              <input type="number" step="0.01" min="0.01" required placeholder="Amount *" value={collectForm.amount} onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
              <input placeholder="Note / Reference" value={collectForm.note} onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <button type="submit" disabled={!activeDueList.length} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }} className="w-full py-2.5 text-white rounded-xl font-semibold disabled:opacity-50 cursor-pointer">
                Confirm Payment
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 min-w-0 space-y-6">
            <div className="bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 font-display text-sm font-bold text-slate-800">
                Customer Payment History ({payData.customerPayments.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">Date</th>
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">Invoice</th>
                      <th className="px-4 py-2.5 text-left">Customer</th>
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">Method</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payData.customerPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-xs tabular-nums whitespace-nowrap">{String(p.payment_date || '').slice(0, 10)}</td>
                        <td className="px-4 py-2 font-mono text-xs text-indigo-600 whitespace-nowrap">{p.invoice_no}</td>
                        <td className="px-4 py-2 font-medium">{p.party_name}</td>
                        <td className="px-4 py-2 text-xs uppercase text-slate-500">{p.payment_method}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-600 tabular-nums whitespace-nowrap">{formatMoney(p.amount, cur)}</td>
                      </tr>
                    ))}
                    {payData.customerPayments.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">No customer payments recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 font-display text-sm font-bold text-slate-800">
                Supplier Payment History ({payData.supplierPayments.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">Date</th>
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">Ref</th>
                      <th className="px-4 py-2.5 text-left">Supplier</th>
                      <th className="px-4 py-2.5 text-left whitespace-nowrap">Method</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payData.supplierPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-xs tabular-nums whitespace-nowrap">{String(p.payment_date || '').slice(0, 10)}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{p.invoice_no}</td>
                        <td className="px-4 py-2 font-medium">{p.party_name}</td>
                        <td className="px-4 py-2 text-xs uppercase text-slate-500">{p.payment_method}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-amber-600 tabular-nums whitespace-nowrap">{formatMoney(p.amount, cur)}</td>
                      </tr>
                    ))}
                    {payData.supplierPayments.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-500">No supplier payments recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Employees & Salary
  const totalPayroll = employees.filter((e) => Number(e.status ?? 1) === 1).reduce((s, e) => s + Number(e.salary || 0), 0);
  return (
    <div className="space-y-6">
      {banner}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <Users className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Employee &amp; Salary Management</h1>
            <p className="text-xs text-slate-500">Active Monthly Payroll: {formatMoney(totalPayroll, cur)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-5 h-fit shadow-xs">
          <h2 className="font-display text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600 shrink-0" /> Add Employee
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/employees', { method: 'POST', body: JSON.stringify(empForm) });
                setEmpForm({ name: '', phone: '', designation: 'Sales Executive', department: 'Sales', salary: '15000', joining_date: new Date().toISOString().slice(0, 10) });
                setNotice({ type: 'success', text: 'Employee added successfully.' });
                loadSection();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add employee.' });
              }
            }}
            className="space-y-3 text-sm"
          >
            <input required placeholder="Full Name *" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <input placeholder="Phone" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input placeholder="Designation" value={empForm.designation} onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              <input placeholder="Department" value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input type="number" step="0.01" min={0} required placeholder="Monthly Salary" value={empForm.salary} onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg tabular-nums" />
              <input type="date" value={empForm.joining_date} onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} className="w-full py-2.5 text-white rounded-xl font-semibold cursor-pointer">
              Save Employee
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Role / Dept</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Salary</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-xs text-slate-400">{emp.employee_id} · {emp.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{emp.designation} · {emp.department}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap">{formatMoney(emp.salary, cur)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/employees/${emp.id}/toggle`, { method: 'PATCH' });
                          loadSection();
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer ${Number(emp.status) === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {Number(emp.status) === 1 ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiFetch(`/api/employees/${emp.id}/pay-salary`, {
                                method: 'POST',
                                body: JSON.stringify({ amount: emp.salary }),
                              });
                              setNotice({ type: 'success', text: `Salary (${formatMoney(emp.salary, cur)}) paid to ${emp.name} and logged under Expenses.` });
                              onRefreshBootstrap();
                            } catch (err) {
                              setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to pay salary.' });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 cursor-pointer"
                        >
                          <BadgeDollarSign className="w-3.5 h-3.5 shrink-0" /> Pay Salary
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
                            loadSection();
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">No employees added yet. Add staff above and click Pay Salary to post payroll directly into Expenses.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
