import { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  History,
  Landmark,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { BootstrapPayload, Product } from '../types/pos.ts';

interface OperationsViewProps {
  section: 'owners' | 'cashbook' | 'stock' | 'payments' | 'employees';
  bootstrap: BootstrapPayload;
  onRefreshBootstrap: () => void;
}

interface OwnerRow {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  share_percent: number;
  invested?: number;
  withdrawn?: number;
  balance?: number;
  is_active: boolean | number;
}

export function OperationsView({ section, bootstrap, onRefreshBootstrap }: OperationsViewProps) {
  const cur = bootstrap.settings.currency || '৳';
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Owners
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [ownerForm, setOwnerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    share_percent: '50',
    invested: '0',
    withdrawn: '0',
  });
  const [ownerTab, setOwnerTab] = useState<'list' | 'add'>('list');
  const [ownerActionMenu, setOwnerActionMenu] = useState<{
    owner: OwnerRow;
    top: number;
    left: number;
  } | null>(null);
  const [ownerTxModal, setOwnerTxModal] = useState<{
    owner: OwnerRow;
    type: 'invest' | 'withdraw';
    amount: string;
    note: string;
    transaction_date: string;
  } | null>(null);
  const [ownerHistoryModal, setOwnerHistoryModal] = useState<{
    owner: OwnerRow;
    loading: boolean;
    transactions: Array<{ id: number; type: string; amount: number; note: string; transaction_date: string }>;
  } | null>(null);
  const [ownerEditModal, setOwnerEditModal] = useState<{
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    share_percent: string;
    invested: string;
    withdrawn: string;
  } | null>(null);

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
      apiFetch<typeof owners>('/api/owners')
        .then(setOwners)
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load owners.' }));
    } else if (section === 'cashbook') {
      apiFetch<typeof cashData>('/api/cashbook')
        .then(setCashData)
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load cash book.' }));
    } else if (section === 'stock') {
      const qs = new URLSearchParams({ filter: stockFilter });
      if (stockQuery.trim()) qs.set('q', stockQuery.trim());
      apiFetch<typeof stockData>(`/api/stock?${qs.toString()}`)
        .then((r) => {
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
        })
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load stock ledger.' }));
    } else if (section === 'payments') {
      apiFetch<typeof payData>('/api/payments')
        .then((r) => {
          setPayData(r);
          if (payMode === 'customer' && r.dueSales[0]) {
            setCollectForm((prev) => ({ ...prev, target_id: String(r.dueSales[0].id), amount: String(r.dueSales[0].due) }));
          } else if (payMode === 'supplier' && r.duePurchases[0]) {
            setCollectForm((prev) => ({ ...prev, target_id: String(r.duePurchases[0].id), amount: String(r.duePurchases[0].due) }));
          } else {
            setCollectForm((prev) => ({ ...prev, target_id: '', amount: '' }));
          }
        })
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load payments.' }));
    } else if (section === 'employees') {
      apiFetch<typeof employees>('/api/employees')
        .then(setEmployees)
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load employees.' }));
    }
  }

  useEffect(() => {
    setNotice(null);
    setOwnerActionMenu(null);
    loadSection();
  }, [section, stockFilter, stockQuery]);

  useEffect(() => {
    if (!notice || notice.type !== 'success') return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!ownerActionMenu) return;
    const closeMenu = () => setOwnerActionMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [ownerActionMenu]);

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
      className={`mb-4 px-4 py-3 rounded-xl text-xs font-semibold border flex items-center justify-between gap-3 transition-all ${
        notice.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      <span className="flex items-center gap-2">
        {notice.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
        <span>{notice.text}</span>
      </span>
      <button
        type="button"
        onClick={() => setNotice(null)}
        className="opacity-60 hover:opacity-100 cursor-pointer"
        aria-label="Dismiss message"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (section === 'owners') {
    const activeOwners = owners.filter((o) => Boolean(Number(o.is_active)));
    const totalShare = activeOwners.reduce((s, o) => s + Number(o.share_percent || 0), 0);
    const totalInvested = owners.reduce((s, o) => s + Number(o.invested ?? 0), 0);
    const totalWithdrawn = owners.reduce((s, o) => s + Number(o.withdrawn ?? 0), 0);
    const netBalance = totalInvested - totalWithdrawn;

    return (
      <div className="space-y-5">
        {banner}

        {/* Header + Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(79,70,229,0.3)]"
            >
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
                Business <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">Owners</span>
              </h1>
              <p className="text-xs text-slate-500">Partner capital investments, withdrawals &amp; transaction ledger</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-1 border border-slate-200/80 shadow-xs inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOwnerTab('list')}
              style={ownerTab === 'list' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                ownerTab === 'list' ? 'text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Owners List ({owners.length})
            </button>
            <button
              type="button"
              onClick={() => setOwnerTab('add')}
              style={ownerTab === 'add' ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                ownerTab === 'add' ? 'text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              + Add Owner
            </button>
          </div>
        </div>

        {/* Compact Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(79,70,229,0.20)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">Total Owners</span>
              <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <UserCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight">{owners.length}</div>
          </div>

          <div
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">Total Invested</span>
              <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight truncate">{formatMoney(totalInvested, cur)}</div>
          </div>

          <div
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(225,29,72,0.20)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">Total Withdrawn</span>
              <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight truncate">{formatMoney(totalWithdrawn, cur)}</div>
          </div>

          <div
            style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(2,132,199,0.20)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">Net Balance</span>
              <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                <Landmark className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight truncate">{formatMoney(netBalance, cur)}</div>
          </div>
        </div>

        {ownerTab === 'add' ? (
          <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/70 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                </span>
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">Add Business Owner</h2>
                  <p className="text-[11px] text-slate-500">Register partner details &amp; initial capital balance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOwnerTab('list')}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Back to List
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setNotice(null);
                try {
                  await apiFetch('/api/owners', { method: 'POST', body: JSON.stringify(ownerForm) });
                  setOwnerForm({
                    name: '',
                    phone: '',
                    email: '',
                    address: '',
                    share_percent: '50',
                    invested: '0',
                    withdrawn: '0',
                  });
                  setNotice({ type: 'success', text: 'Owner added successfully.' });
                  setOwnerTab('list');
                  loadSection();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add owner.' });
                }
              }}
              className="p-5 sm:p-6 space-y-4 text-sm"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Owner Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. Md. Raj Ahmed"
                    value={ownerForm.name}
                    onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile</label>
                  <input
                    placeholder="01XXXXXXXXX"
                    value={ownerForm.phone}
                    onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="owner@example.com"
                    value={ownerForm.email}
                    onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Share (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    placeholder="50"
                    value={ownerForm.share_percent}
                    onChange={(e) => setOwnerForm({ ...ownerForm, share_percent: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
                  />
                </div>
                <div className="lg:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    placeholder="Full address"
                    value={ownerForm.address}
                    onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Invested ({cur})</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={ownerForm.invested}
                    onChange={(e) => setOwnerForm({ ...ownerForm, invested: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-emerald-500 outline-none tabular-nums"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Withdrawn ({cur})</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={ownerForm.withdrawn}
                    onChange={(e) => setOwnerForm({ ...ownerForm, withdrawn: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-rose-500 outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOwnerTab('list')}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  className="px-6 py-2.5 text-white rounded-xl text-xs font-semibold shadow-[0_6px_16px_rgba(79,70,229,0.28)] hover:opacity-95 transition cursor-pointer"
                >
                  + Save Owner
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="min-w-0 bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Owners &amp; Capital Ledger</h2>
                <p className="text-[11px] text-slate-500">Manage partner investments, withdrawals, transaction history, and net balances</p>
              </div>
              <button
                type="button"
                onClick={() => setOwnerTab('add')}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs hover:opacity-95 transition cursor-pointer"
              >
                + Add Owner
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-12">#</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Mobile</th>
                    <th className="px-4 py-3 font-semibold">Address</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Invested</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Withdrawn</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Balance</th>
                    <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {owners.map((o, idx) => {
                    const invested = Number(o.invested ?? 0);
                    const withdrawn = Number(o.withdrawn ?? 0);
                    const balance = invested - withdrawn;
                    const isActive = Boolean(Number(o.is_active));
                    const initials = (o.name.trim().slice(0, 2) || 'OW').toUpperCase();

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 min-w-[170px]">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-xs"
                              style={{ background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)' }}
                            >
                              {initials}
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate">{o.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                    isActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                                      : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}
                                >
                                  {isActive ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-[10.5px] text-slate-400 tabular-nums">
                                  {Number(o.share_percent || 0).toFixed(1)}% share
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap tabular-nums">
                          {o.phone || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate" title={o.address}>
                          {o.address || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700 whitespace-nowrap tabular-nums">
                          {formatMoney(invested, cur)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-rose-600 whitespace-nowrap tabular-nums">
                          {formatMoney(withdrawn, cur)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-xs font-bold whitespace-nowrap tabular-nums ${
                            balance >= 0 ? 'text-indigo-700' : 'text-red-600'
                          }`}
                        >
                          {formatMoney(balance, cur)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (ownerActionMenu?.owner.id === o.id) {
                                setOwnerActionMenu(null);
                                return;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuWidth = 192;
                              const left = Math.min(
                                window.innerWidth - menuWidth - 12,
                                Math.max(12, rect.right - menuWidth)
                              );
                              const estHeight = 230;
                              const top =
                                rect.bottom + 6 + estHeight > window.innerHeight - 12
                                  ? Math.max(12, rect.top - estHeight - 6)
                                  : rect.bottom + 6;
                              setOwnerActionMenu({ owner: o, top, left });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
                          >
                            <span>Action</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {owners.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-500">
                        No owners added yet. Click &ldquo;+ Add Owner&rdquo; above to add a business owner.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Floating Action Dropdown Menu */}
        {ownerActionMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ top: ownerActionMenu.top, left: ownerActionMenu.left }}
            className="fixed z-[90] w-48 bg-white rounded-xl border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.18)] py-1.5 text-xs font-medium text-slate-700"
          >
            <button
              type="button"
              onClick={() => {
                const target = ownerActionMenu.owner;
                setOwnerActionMenu(null);
                setOwnerTxModal({
                  owner: target,
                  type: 'invest',
                  amount: '',
                  note: '',
                  transaction_date: new Date().toISOString().slice(0, 10),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>Invest (+)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = ownerActionMenu.owner;
                setOwnerActionMenu(null);
                setOwnerTxModal({
                  owner: target,
                  type: 'withdraw',
                  amount: '',
                  note: '',
                  transaction_date: new Date().toISOString().slice(0, 10),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-600" />
              <span>Withdraw (-)</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const target = ownerActionMenu.owner;
                setOwnerActionMenu(null);
                setOwnerHistoryModal({ owner: target, loading: true, transactions: [] });
                try {
                  const res = await apiFetch<{ transactions: Array<{ id: number; type: string; amount: number; note: string; transaction_date: string }> }>(
                    `/api/owners/${target.id}/history`
                  );
                  setOwnerHistoryModal({ owner: target, loading: false, transactions: res.transactions || [] });
                } catch (err) {
                  setOwnerHistoryModal(null);
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load history.' });
                }
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-sky-600" />
              <span>History</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = ownerActionMenu.owner;
                setOwnerActionMenu(null);
                setOwnerEditModal({
                  id: target.id,
                  name: target.name || '',
                  phone: target.phone || '',
                  email: target.email || '',
                  address: target.address || '',
                  share_percent: String(target.share_percent ?? 0),
                  invested: String(target.invested ?? 0),
                  withdrawn: String(target.withdrawn ?? 0),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-indigo-600" />
              <span>Edit Owner</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const target = ownerActionMenu.owner;
                setOwnerActionMenu(null);
                setNotice(null);
                try {
                  await apiFetch(`/api/owners/${target.id}/toggle`, { method: 'PATCH' });
                  setNotice({ type: 'success', text: 'Owner status updated.' });
                  loadSection();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update status.' });
                }
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{Number(ownerActionMenu.owner.is_active) ? 'Set Inactive' : 'Set Active'}</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={async () => {
                const target = ownerActionMenu.owner;
                setOwnerActionMenu(null);
                setNotice(null);
                try {
                  await apiFetch(`/api/owners/${target.id}`, { method: 'DELETE' });
                  setNotice({ type: 'success', text: `Owner "${target.name}" deleted.` });
                  loadSection();
                } catch (err) {
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete owner.' });
                }
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 text-red-600 hover:bg-red-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Owner</span>
            </button>
          </div>
        )}

        {/* Invest / Withdraw Modal */}
        {ownerTxModal && (
          <div
            onClick={() => setOwnerTxModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900">
                  {ownerTxModal.type === 'invest' ? 'Add Owner Investment (+)' : 'Record Owner Withdrawal (-)'}
                </h3>
                <button
                  type="button"
                  onClick={() => setOwnerTxModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch(`/api/owners/${ownerTxModal.owner.id}/transaction`, {
                      method: 'POST',
                      body: JSON.stringify({
                        type: ownerTxModal.type,
                        amount: Number(ownerTxModal.amount),
                        note: ownerTxModal.note,
                        transaction_date: ownerTxModal.transaction_date,
                      }),
                    });
                    const msg =
                      ownerTxModal.type === 'invest'
                        ? `Investment added for ${ownerTxModal.owner.name}.`
                        : `Withdrawal recorded for ${ownerTxModal.owner.name}.`;
                    setOwnerTxModal(null);
                    setNotice({ type: 'success', text: msg });
                    loadSection();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Transaction failed.' });
                  }
                }}
                className="p-5 space-y-3.5 text-sm"
              >
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                  Owner: <strong className="text-slate-900">{ownerTxModal.owner.name}</strong>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount ({cur}) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      autoFocus
                      placeholder="0.00"
                      value={ownerTxModal.amount}
                      onChange={(e) => setOwnerTxModal({ ...ownerTxModal, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl tabular-nums outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={ownerTxModal.transaction_date}
                      onChange={(e) => setOwnerTxModal({ ...ownerTxModal, transaction_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Note / Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly capital deposit or profit draw"
                    value={ownerTxModal.note}
                    onChange={(e) => setOwnerTxModal({ ...ownerTxModal, note: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOwnerTxModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer ${
                      ownerTxModal.type === 'invest'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {ownerTxModal.type === 'invest' ? 'Record Investment' : 'Record Withdrawal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Owner Transaction History Modal */}
        {ownerHistoryModal && (
          <div
            onClick={() => setOwnerHistoryModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Owner Transaction History</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{ownerHistoryModal.owner.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOwnerHistoryModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2.5 p-4 bg-slate-50/50 border-b border-slate-100 text-xs">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-emerald-700">Total Invested</div>
                  <div className="font-mono font-bold text-emerald-800 tabular-nums mt-0.5">
                    {formatMoney(Number(ownerHistoryModal.owner.invested ?? 0), cur)}
                  </div>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-200/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-rose-700">Total Withdrawn</div>
                  <div className="font-mono font-bold text-rose-800 tabular-nums mt-0.5">
                    {formatMoney(Number(ownerHistoryModal.owner.withdrawn ?? 0), cur)}
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-50 border border-indigo-200/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-indigo-700">Net Balance</div>
                  <div className="font-mono font-bold text-indigo-800 tabular-nums mt-0.5">
                    {formatMoney(Number(ownerHistoryModal.owner.invested ?? 0) - Number(ownerHistoryModal.owner.withdrawn ?? 0), cur)}
                  </div>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Note</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ownerHistoryModal.loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading history...</td>
                      </tr>
                    ) : ownerHistoryModal.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No deposit or withdrawal transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      ownerHistoryModal.transactions.map((tx) => {
                        const isInvest = tx.type === 'invest';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">{tx.transaction_date}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                                  isInvest ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {isInvest ? 'Deposit (+)' : 'Withdraw (-)'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{tx.note || '—'}</td>
                            <td
                              className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                                isInvest ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isInvest ? '+' : '-'}
                              {formatMoney(tx.amount, cur)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Edit Owner Modal */}
        {ownerEditModal && (
          <div
            onClick={() => setOwnerEditModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="font-display text-base font-bold text-slate-900">Edit Owner Details</h3>
                <button
                  type="button"
                  onClick={() => setOwnerEditModal(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch(`/api/owners/${ownerEditModal.id}`, {
                      method: 'PUT',
                      body: JSON.stringify(ownerEditModal),
                    });
                    setOwnerEditModal(null);
                    setNotice({ type: 'success', text: 'Owner updated successfully.' });
                    loadSection();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update owner.' });
                  }
                }}
                className="p-5 space-y-3.5 text-sm"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name *</label>
                  <input
                    required
                    value={ownerEditModal.name}
                    onChange={(e) => setOwnerEditModal({ ...ownerEditModal, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile</label>
                    <input
                      value={ownerEditModal.phone}
                      onChange={(e) => setOwnerEditModal({ ...ownerEditModal, phone: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Share (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={ownerEditModal.share_percent}
                      onChange={(e) => setOwnerEditModal({ ...ownerEditModal, share_percent: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    value={ownerEditModal.address}
                    onChange={(e) => setOwnerEditModal({ ...ownerEditModal, address: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Invested ({cur})</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={ownerEditModal.invested}
                      onChange={(e) => setOwnerEditModal({ ...ownerEditModal, invested: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Withdrawn ({cur})</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={ownerEditModal.withdrawn}
                      onChange={(e) => setOwnerEditModal({ ...ownerEditModal, withdrawn: e.target.value })}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-xl tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={ownerEditModal.email}
                    onChange={(e) => setOwnerEditModal({ ...ownerEditModal, email: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOwnerEditModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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

        {/* TOP FULL-WIDTH: New Cash Entry */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">New Cash Entry</h2>
              <p className="text-[11px] text-slate-500">Log cash deposit or physical drawer payout</p>
            </div>
          </div>
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
            className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
          >
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Type *</label>
              <select
                value={cashForm.type}
                onChange={(e) => setCashForm({ ...cashForm, type: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none"
              >
                <option value="in">Cash In (+)</option>
                <option value="out">Cash Out (-)</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({cur}) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={cashForm.amount}
                onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={cashForm.transaction_date}
                onChange={(e) => setCashForm({ ...cashForm, transaction_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Note</label>
              <input
                placeholder="e.g. Petty cash, opening float..."
                value={cashForm.description}
                onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="w-full py-2.5 px-4 text-white rounded-xl font-semibold shadow-[0_6px_16px_rgba(79,70,229,0.28)] hover:opacity-95 transition cursor-pointer"
              >
                Record Entry
              </button>
            </div>
          </form>
        </div>

        {/* BOTTOM FULL-WIDTH: Cash Book Ledger */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Cash Book Ledger</h2>
              <p className="text-[11px] text-slate-500">Latest {cashData.items.length} drawer entries</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
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
                    <td className="px-4 py-2.5 text-xs font-mono tabular-nums whitespace-nowrap">{row.transaction_date}</td>
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
                  {stockData.products.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                        No matching products found.
                      </td>
                    </tr>
                  )}
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
                {stockData.movements.length === 0 && (
                  <div className="py-4 text-center text-xs text-slate-500">No recent stock movements recorded.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'payments') {
    const activeDueList = payMode === 'customer' ? payData.dueSales : payData.duePurchases;
    const custReceiptSum = payData.customerPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const supPaymentSum = payData.supplierPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

    return (
      <div className="space-y-5">
        {banner}

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(5,150,105,0.28)]"
            >
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
                Customer &amp; Supplier{' '}
                <span className="bg-gradient-to-r from-[#059669] to-[#0d9488] bg-clip-text text-transparent">
                  Payments
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Collect customer due balances, settle supplier payables &amp; audit ledgers
              </p>
            </div>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Customer Receipts</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{formatMoney(custReceiptSum, cur)}</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {payData.customerPayments.length} entries
            </span>
          </div>
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(79,70,229,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Supplier Payments</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{formatMoney(supPaymentSum, cur)}</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {payData.supplierPayments.length} entries
            </span>
          </div>
        </div>

        {/* TOP FULL-WIDTH: Record Payment Form */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
              >
                <CreditCard className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900">Record Payment</h2>
                <p className="text-[11px] text-slate-500">Receive customer due or pay supplier balance</p>
              </div>
            </div>

            <div className="inline-grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  payMode === 'customer' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                  payMode === 'supplier' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Supplier Pay
              </button>
            </div>
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
                    account_id: collectForm.account_id ? Number(collectForm.account_id) : null,
                    amount: Number(collectForm.amount),
                    note: collectForm.note,
                  }),
                });
                setCollectForm((prev) => ({ ...prev, note: '' }));
                setNotice({ type: 'success', text: 'Payment recorded successfully!' });
                loadSection();
                onRefreshBootstrap();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Payment failed.' });
              }
            }}
            className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
          >
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {payMode === 'customer' ? 'Due Sale Invoice *' : 'Due Supplier Purchase *'}
              </label>
              <select
                value={collectForm.target_id}
                onChange={(e) => {
                  const item = activeDueList.find((x) => String(x.id) === e.target.value);
                  setCollectForm({ ...collectForm, target_id: e.target.value, amount: item ? String(item.due) : '' });
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-emerald-500 outline-none text-xs"
              >
                {activeDueList.length === 0 && <option value="">No pending dues</option>}
                {activeDueList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.invoice_no} — {'customer_name' in item ? item.customer_name : item.supplier_name} (Due: {formatMoney(item.due, cur)})
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account</label>
              <select
                value={collectForm.account_id}
                onChange={(e) => setCollectForm({ ...collectForm, account_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-emerald-500 outline-none text-xs"
              >
                {bootstrap.bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({cur}) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={collectForm.amount}
                onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-emerald-500 outline-none tabular-nums"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note / Reference</label>
              <input
                placeholder="Receipt / voucher note"
                value={collectForm.note}
                onChange={(e) => setCollectForm({ ...collectForm, note: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                disabled={!activeDueList.length}
                style={{
                  background:
                    payMode === 'customer'
                      ? 'linear-gradient(135deg, #059669, #10b981)'
                      : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                }}
                className="w-full py-2.5 px-4 text-white rounded-xl font-semibold shadow-sm hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
              >
                Confirm Payment
              </button>
            </div>
          </form>
        </div>

        {/* BOTTOM FULL-WIDTH: Payment History Ledgers */}
        <div className="w-full space-y-5">
          <div className="bg-white border border-slate-200/90 rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 flex items-center justify-between">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Customer Receipts</h2>
              <span className="text-xs text-slate-500">Latest {payData.customerPayments.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Invoice</th>
                    <th className="px-4 py-2.5 font-semibold">Customer</th>
                    <th className="px-4 py-2.5 font-semibold">Method</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payData.customerPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {String(p.payment_date || '').slice(0, 10) || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-emerald-700 font-semibold whitespace-nowrap">{p.invoice_no}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{p.party_name}</td>
                      <td className="px-4 py-2.5 uppercase text-slate-500">{p.payment_method}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                        {formatMoney(p.amount, cur)}
                      </td>
                    </tr>
                  ))}
                  {payData.customerPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No customer payments recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/50 flex items-center justify-between">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Supplier Payments</h2>
              <span className="text-xs text-slate-500">Latest {payData.supplierPayments.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Purchase</th>
                    <th className="px-4 py-2.5 font-semibold">Supplier</th>
                    <th className="px-4 py-2.5 font-semibold">Method</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payData.supplierPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {String(p.payment_date || '').slice(0, 10) || '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-indigo-600 font-semibold whitespace-nowrap">{p.invoice_no}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{p.party_name}</td>
                      <td className="px-4 py-2.5 uppercase text-slate-500">{p.payment_method}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600 tabular-nums whitespace-nowrap">
                        {formatMoney(p.amount, cur)}
                      </td>
                    </tr>
                  ))}
                  {payData.supplierPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No supplier payments recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

      {/* TOP FULL-WIDTH: Add Employee */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            <Plus className="w-4 h-4" />
          </span>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">Add Employee</h2>
            <p className="text-[11px] text-slate-500">Onboard team member &amp; monthly payroll</p>
          </div>
        </div>
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
          className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
        >
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <input required placeholder="Full Name" value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
            <input placeholder="01XXXXXXXXX" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
            <input placeholder="Designation" value={empForm.designation} onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none" />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Salary *</label>
            <input type="number" step="0.01" min={0} required placeholder="0.00" value={empForm.salary} onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none tabular-nums" />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Joined</label>
            <input type="date" value={empForm.joining_date} onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })} className="w-full px-2.5 py-2 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-indigo-500 outline-none text-xs" />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <button type="submit" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }} className="w-full py-2.5 px-4 text-white rounded-xl font-semibold shadow-[0_6px_16px_rgba(79,70,229,0.28)] hover:opacity-95 transition cursor-pointer">
              Save Employee
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM FULL-WIDTH: Staff Roster & Payroll */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Staff Roster &amp; Payroll</h2>
          <span className="text-xs text-slate-500">{employees.length} employees</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
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
                        setNotice(null);
                        try {
                          await apiFetch(`/api/employees/${emp.id}/toggle`, { method: 'PATCH' });
                          loadSection();
                        } catch (err) {
                          setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update employee status.' });
                        }
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
                          setNotice(null);
                          try {
                            await apiFetch(`/api/employees/${emp.id}`, { method: 'DELETE' });
                            setNotice({ type: 'success', text: `Employee "${emp.name}" removed.` });
                            loadSection();
                          } catch (err) {
                            setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete employee.' });
                          }
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
  );
}
