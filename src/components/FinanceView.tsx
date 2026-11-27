import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
  FileText,
  History,
  Landmark,
  MinusCircle,
  Pencil,
  PlusCircle,
  Receipt,
  RotateCcw,
  X,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { BankAccount, BootstrapPayload, Customer, Product, Sale } from '../types/pos.ts';

interface FinanceViewProps {
  section: 'estimates' | 'accounts' | 'expenses' | 'returns' | 'damages';
  bootstrap: BootstrapPayload;
  onRefreshBootstrap: () => void;
}

export function FinanceView({ section, bootstrap, onRefreshBootstrap }: FinanceViewProps) {
  const cur = bootstrap.settings.currency || '৳';
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Estimates state
  const [estimates, setEstimates] = useState<
    Array<{
      id: number;
      estimate_no: string;
      customer_name: string;
      product_name: string;
      quantity?: number;
      total: number;
      status: string;
      valid_until?: string;
    }>
  >([]);
  const [estForm, setEstForm] = useState({
    customer_id: '',
    customer_name: '',
    product_id: '',
    quantity: '1',
    price: '',
    discount: '0',
    valid_until: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  // Accounts state
  const [accounts, setAccounts] = useState<BankAccount[]>(bootstrap.bankAccounts);
  const [transactions, setTransactions] = useState<
    Array<{
      id: number;
      bank_account_id?: number;
      account_name: string;
      type: string;
      amount: number;
      description: string;
      transaction_date: string;
    }>
  >([]);
  const [newAccForm, setNewAccForm] = useState({
    account_name: '',
    bank_name: '',
    branch: '',
    opening_balance: '',
  });
  const [accMenu, setAccMenu] = useState<{ account: BankAccount; top: number; left: number } | null>(null);
  const [accEditModal, setAccEditModal] = useState<{
    account: BankAccount;
    account_name: string;
    bank_name: string;
    branch: string;
    opening_balance: string;
  } | null>(null);
  const [accTxModal, setAccTxModal] = useState<{
    account: BankAccount;
    type: 'deposit' | 'withdraw';
    amount: string;
    description: string;
    transaction_date: string;
  } | null>(null);
  const [transferModal, setTransferModal] = useState<{
    from_account_id: string;
    to_account_id: string;
    amount: string;
    description: string;
    transaction_date: string;
  } | null>(null);
  const [accHistoryModal, setAccHistoryModal] = useState<{
    account: BankAccount;
    loading: boolean;
    transactions: Array<{ id: number; type: string; amount: number; description: string; transaction_date: string }>;
  } | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<
    Array<{ id: number; category: string; amount: number; expense_date: string; description: string }>
  >([]);
  const [expForm, setExpForm] = useState({
    category: bootstrap.expenseCategories[0]?.name ?? 'Other',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
  });

  // Returns & Damages state
  const [returnsList, setReturnsList] = useState<
    Array<{
      id: number;
      invoice_no: string;
      product_name: string;
      quantity: number;
      total_amount: number;
      reason?: string;
      return_date?: string;
    }>
  >([]);
  const [damagesList, setDamagesList] = useState<
    Array<{
      id: number;
      product_name: string;
      quantity: number;
      loss_amount: number;
      reason?: string;
      damage_date?: string;
    }>
  >([]);
  const [retForm, setRetForm] = useState({ sale_id: '', product_id: '', quantity: '1', price: '0', reason: '' });
  const [dmgForm, setDmgForm] = useState({ product_id: '', quantity: '1', reason: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function loadSection() {
    if (section === 'estimates') {
      apiFetch<{ items: typeof estimates }>('/api/estimates')
        .then((r) => setEstimates(r.items))
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load estimates.' }));
    } else if (section === 'accounts') {
      apiFetch<{ accounts: BankAccount[]; transactions: typeof transactions }>('/api/accounts')
        .then((r) => {
          setAccounts(r.accounts);
          setTransactions(r.transactions);
        })
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load accounts.' }));
    } else if (section === 'expenses') {
      apiFetch<{ items: typeof expenses }>('/api/expenses')
        .then((r) => setExpenses(r.items))
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load expenses.' }));
    } else if (section === 'returns' || section === 'damages') {
      apiFetch<{ returns: typeof returnsList; damages: typeof damagesList }>('/api/returns-damages')
        .then((r) => {
          setReturnsList(r.returns);
          setDamagesList(r.damages);
        })
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load returns and damages.' }));
    }
  }

  useEffect(() => {
    setNotice(null);
    loadSection();
    if (section === 'estimates' || section === 'returns' || section === 'damages') {
      apiFetch<{ items: Product[] }>('/api/products?all=1')
        .then((r) => {
          setProducts(r.items);
          if (r.items[0]) {
            setEstForm((prev) => ({
              ...prev,
              product_id: prev.product_id || String(r.items[0].id),
              price: prev.price || String(r.items[0].selling_price),
            }));
            setRetForm((prev) => ({
              ...prev,
              product_id: prev.product_id || String(r.items[0].id),
              price: prev.price !== '0' ? prev.price : String(r.items[0].selling_price),
            }));
            setDmgForm((prev) => ({ ...prev, product_id: prev.product_id || String(r.items[0].id) }));
          }
        })
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load products catalog.' }));
    }
    if (section === 'estimates') {
      apiFetch<{ items: Customer[] }>('/api/customers?all=1')
        .then((r) => setCustomers(r.items))
        .catch(() => {});
    }
    if (section === 'returns') {
      apiFetch<{ items: Sale[] }>('/api/sales?all=1')
        .then((r) => {
          setSales(r.items);
          if (r.items[0]) setRetForm((prev) => ({ ...prev, sale_id: prev.sale_id || String(r.items[0].id) }));
        })
        .catch((err) => setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load sales list.' }));
    }
  }, [section]);

  useEffect(() => {
    if (!accMenu) return;
    const close = () => setAccMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [accMenu]);

  useEffect(() => {
    if (!bootstrap.expenseCategories.length) return;
    const exists = bootstrap.expenseCategories.some((c) => c.name === expForm.category);
    if (!exists) {
      setExpForm((prev) => ({ ...prev, category: bootstrap.expenseCategories[0].name }));
    }
  }, [bootstrap.expenseCategories, expForm.category]);

  const noticeBar = notice ? (
    <div
      className={`px-4 py-2.5 rounded-xl text-xs font-semibold border ${
        notice.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-red-50 border-red-200 text-red-700'
      }`}
    >
      {notice.text}
    </div>
  ) : null;

  if (section === 'estimates') {
    const totalQuotationVal = estimates.reduce((s, e) => s + Number(e.total ?? 0), 0);
    const approvedCount = estimates.filter((e) => e.status === 'approved').length;
    const estPreview = Math.max(
      0,
      Number(estForm.quantity || 0) * Number(estForm.price || 0) - Number(estForm.discount || 0)
    );

    return (
      <div className="space-y-5">
        {noticeBar}

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ background: 'linear-gradient(135deg, #0d9488, #059669)' }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(13,148,136,0.28)]"
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
                Estimates &amp;{' '}
                <span className="bg-gradient-to-r from-[#0d9488] to-[#059669] bg-clip-text text-transparent">
                  Quotations
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Prepare formal price quotations for clients &amp; track approval statuses
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 text-xs font-semibold tabular-nums">
            {estimates.length} Total Quotations
          </span>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(13,148,136,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Total Quotation Value</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{formatMoney(totalQuotationVal, cur)}</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {estimates.length} quotes
            </span>
          </div>
          <div
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Approved Quotations</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{approvedCount} Approved</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {estimates.length - approvedCount} other
            </span>
          </div>
        </div>

        {/* TOP FULL-WIDTH: Create Estimate Form */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 via-white to-emerald-50/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #0d9488, #059669)' }}
              >
                <PlusCircle className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900">Create Estimate</h2>
                <p className="text-[11px] text-slate-500">Generate a formal price quotation</p>
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-teal-50 border border-teal-100 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase text-teal-700">Estimated Total:</span>
              <span className="font-mono text-sm font-bold text-teal-900 tabular-nums">{formatMoney(estPreview, cur)}</span>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/estimates', { method: 'POST', body: JSON.stringify(estForm) });
                setEstForm((prev) => ({ ...prev, customer_id: '', customer_name: '', quantity: '1', discount: '0' }));
                setNotice({ type: 'success', text: 'Estimate created successfully!' });
                loadSection();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create estimate.' });
              }
            }}
            className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
          >
            {customers.length > 0 && (
              <div className="lg:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Existing Customer</label>
                <select
                  value={estForm.customer_id}
                  onChange={(e) => {
                    const c = customers.find((x) => String(x.id) === e.target.value);
                    setEstForm({
                      ...estForm,
                      customer_id: e.target.value,
                      customer_name: c ? c.name : estForm.customer_name,
                    });
                  }}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none"
                >
                  <option value="">-- Custom / Walk-in --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` (${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={customers.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
              <input
                required
                placeholder="Customer or company name"
                value={estForm.customer_name}
                onChange={(e) => setEstForm({ ...estForm, customer_name: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none"
              />
            </div>

            <div className={customers.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product *</label>
              <select
                value={estForm.product_id}
                onChange={(e) => {
                  const p = products.find((x) => String(x.id) === e.target.value);
                  setEstForm({
                    ...estForm,
                    product_id: e.target.value,
                    price: p ? String(p.selling_price) : estForm.price,
                  });
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none"
              >
                {products.length === 0 && <option value="">-- Select Product --</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatMoney(p.selling_price, cur)})
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Qty *</label>
              <input
                type="number"
                min={1}
                required
                value={estForm.quantity}
                onChange={(e) => setEstForm({ ...estForm, quantity: e.target.value })}
                className="w-full px-2.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none tabular-nums"
              />
            </div>

            <div className={customers.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Rate ({cur}) *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={estForm.price}
                onChange={(e) => setEstForm({ ...estForm, price: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none tabular-nums"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Discount ({cur})</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={estForm.discount}
                onChange={(e) => setEstForm({ ...estForm, discount: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none tabular-nums"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until</label>
              <input
                type="date"
                value={estForm.valid_until}
                onChange={(e) => setEstForm({ ...estForm, valid_until: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-teal-600 outline-none"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-6 flex justify-end">
              <button
                type="submit"
                disabled={!products.length}
                style={{ background: 'linear-gradient(135deg, #0d9488, #059669)' }}
                className="w-full sm:w-auto px-8 py-2.5 text-white rounded-xl font-semibold shadow-[0_6px_16px_rgba(13,148,136,0.26)] hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
              >
                Save Estimate
              </button>
            </div>
          </form>
        </div>

        {/* BOTTOM FULL-WIDTH: Quotations List */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Quotations List</h2>
              <p className="text-[11px] text-slate-500">Track pending, approved, or rejected estimates</p>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Estimate #</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estimates.map((e) => {
                  const statusCls =
                    e.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : e.status === 'rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : e.status === 'converted'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200';
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-bold text-teal-700">{e.estimate_no}</div>
                        <div className="text-[11px] text-slate-400 tabular-nums">Valid: {e.valid_until || '—'}</div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900 text-xs sm:text-sm">{e.customer_name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {e.product_name}{' '}
                        <span className="text-slate-400">&times;{e.quantity ?? 1}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatMoney(e.total, cur)}
                      </td>
                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                        <select
                          value={e.status}
                          onChange={async (ev) => {
                            const nextStatus = ev.target.value;
                            try {
                              await apiFetch(`/api/estimates/${e.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: nextStatus }),
                              });
                              setNotice({ type: 'success', text: `Estimate ${e.estimate_no} marked ${nextStatus}.` });
                              loadSection();
                            } catch (err) {
                              setNotice({
                                type: 'error',
                                text: err instanceof Error ? err.message : 'Failed to update status.',
                              });
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold uppercase cursor-pointer outline-none ${statusCls}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="converted">Converted</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
                {estimates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                      No estimates created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'accounts') {
    const totalOpening = accounts.reduce((s, a) => s + Number(a.opening_balance ?? 0), 0);
    const totalCurrent = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0);

    return (
      <div className="space-y-5">
        {noticeBar}

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(79,70,229,0.3)]"
          >
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900">
              Bank &amp; Cash <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">Accounts</span>
            </h1>
            <p className="text-xs text-slate-500">Create accounts, edit account details, add/withdraw funds, transfer &amp; inspect history</p>
          </div>
        </div>

        {/* Compact KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(79,70,229,0.20)]"
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Total Accounts</div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight">{accounts.length}</div>
          </div>
          <div
            style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(2,132,199,0.20)]"
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Total Opening Balance</div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight">{formatMoney(totalOpening, cur)}</div>
          </div>
          <div
            style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)]"
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Total Current Balance</div>
            <div className="mt-1 text-lg sm:text-xl font-display font-bold tabular-nums leading-tight">{formatMoney(totalCurrent, cur)}</div>
          </div>
        </div>

        {/* New Account Card */}
        <div className="bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              <PlusCircle className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">New Account</h2>
              <p className="text-[11px] text-slate-500">Add a cash drawer, bank account, or mobile banking account</p>
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/accounts', {
                  method: 'POST',
                  body: JSON.stringify({
                    account_name: newAccForm.account_name,
                    bank_name: newAccForm.bank_name,
                    branch: newAccForm.branch,
                    opening_balance: newAccForm.opening_balance === '' ? 0 : Number(newAccForm.opening_balance),
                  }),
                });
                setNewAccForm({ account_name: '', bank_name: '', branch: '', opening_balance: '' });
                setNotice({ type: 'success', text: 'Account saved successfully!' });
                loadSection();
                onRefreshBootstrap();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create account.' });
              }
            }}
            className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
          >
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                placeholder="e.g. Cash Drawer, bKash, City Bank"
                value={newAccForm.account_name}
                onChange={(e) => setNewAccForm({ ...newAccForm, account_name: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank / Provider (Optional)</label>
              <input
                placeholder="e.g. Dutch-Bangla, bKash"
                value={newAccForm.bank_name}
                onChange={(e) => setNewAccForm({ ...newAccForm, bank_name: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch (Optional)</label>
              <input
                placeholder="e.g. Motijheel"
                value={newAccForm.branch}
                onChange={(e) => setNewAccForm({ ...newAccForm, branch: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={newAccForm.opening_balance}
                onChange={(e) => setNewAccForm({ ...newAccForm, opening_balance: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                className="w-full py-2.5 px-4 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-[0_6px_16px_rgba(79,70,229,0.28)] hover:opacity-95 transition whitespace-nowrap cursor-pointer"
              >
                Save Account
              </button>
            </div>
          </form>
        </div>

        {/* Accounts List Table */}
        <div className="bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Accounts List</h2>
              <p className="text-[11px] text-slate-500">Add balance, withdraw, transfer, edit account info, or check history</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold w-12">#</th>
                  <th className="px-4 py-3 font-semibold">Account Name</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Opening Balance</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Current Balance</th>
                  <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc, idx) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono font-semibold text-slate-500 tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{acc.account_name}</div>
                      {acc.bank_name && (
                        <div className="text-[11px] text-slate-400">
                          {acc.bank_name}
                          {acc.branch ? ` · ${acc.branch}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap">
                      {formatMoney(Number(acc.opening_balance ?? 0), cur)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono text-xs font-bold tabular-nums whitespace-nowrap ${
                        Number(acc.balance) >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatMoney(acc.balance, cur)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (accMenu?.account.id === acc.id) {
                            setAccMenu(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const menuWidth = 192;
                          const left = Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth));
                          const estHeight = 216;
                          const top =
                            rect.bottom + 6 + estHeight > window.innerHeight - 12
                              ? Math.max(12, rect.top - estHeight - 6)
                              : rect.bottom + 6;
                          setAccMenu({ account: acc, top, left });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
                      >
                        <span>Actions</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                      No accounts created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Bank Transactions Ledger */}
        <div className="bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900">Recent Account Transactions</h2>
            <span className="text-xs text-slate-500">Latest {transactions.length} entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Account</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Note</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.slice(0, 25).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">{tx.transaction_date}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{tx.account_name}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase ${
                          tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{tx.description || '—'}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                        tx.type === 'deposit' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {tx.type === 'deposit' ? '+' : '-'}
                      {formatMoney(tx.amount, cur)}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No bank transactions logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Floating Dropdown Menu */}
        {accMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ top: accMenu.top, left: accMenu.left }}
            className="fixed z-[90] w-48 bg-white rounded-xl border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.18)] py-1.5 text-xs font-medium text-slate-700"
          >
            <button
              type="button"
              onClick={() => {
                const target = accMenu.account;
                setAccMenu(null);
                setAccTxModal({
                  account: target,
                  type: 'deposit',
                  amount: '',
                  description: '',
                  transaction_date: new Date().toISOString().slice(0, 10),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add Balance</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = accMenu.account;
                setAccMenu(null);
                setAccTxModal({
                  account: target,
                  type: 'withdraw',
                  amount: '',
                  description: '',
                  transaction_date: new Date().toISOString().slice(0, 10),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            >
              <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Withdraw Balance</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = accMenu.account;
                setAccMenu(null);
                const other = accounts.find((a) => a.id !== target.id);
                setTransferModal({
                  from_account_id: String(target.id),
                  to_account_id: other ? String(other.id) : '',
                  amount: '',
                  description: '',
                  transaction_date: new Date().toISOString().slice(0, 10),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
              <span>Transfer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = accMenu.account;
                setAccMenu(null);
                setAccEditModal({
                  account: target,
                  account_name: target.account_name || '',
                  bank_name: target.bank_name || '',
                  branch: target.branch || '',
                  opening_balance: Number(target.opening_balance ?? 0).toFixed(2),
                });
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-amber-600" />
              <span>Edit Account</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                const target = accMenu.account;
                setAccMenu(null);
                setAccHistoryModal({ account: target, loading: true, transactions: [] });
                try {
                  const res = await apiFetch<{ transactions: Array<{ id: number; type: string; amount: number; description: string; transaction_date: string }> }>(
                    `/api/accounts?account_id=${target.id}`
                  );
                  setAccHistoryModal({ account: target, loading: false, transactions: res.transactions || [] });
                } catch (err) {
                  setAccHistoryModal(null);
                  setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load history.' });
                }
              }}
              className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-sky-600" />
              <span>History</span>
            </button>
          </div>
        )}

        {/* Edit Account Info Modal */}
        {accEditModal && (
          <div
            onClick={() => setAccEditModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/50 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Edit Account Information</h3>
                  <p className="text-[11px] text-slate-500">Update account name, bank details, or opening balance</p>
                </div>
                <button type="button" onClick={() => setAccEditModal(null)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch(`/api/accounts/${accEditModal.account.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        account_name: accEditModal.account_name,
                        bank_name: accEditModal.bank_name,
                        branch: accEditModal.branch,
                        opening_balance: accEditModal.opening_balance === '' ? 0 : Number(accEditModal.opening_balance),
                      }),
                    });
                    setAccEditModal(null);
                    setNotice({ type: 'success', text: 'Account updated successfully!' });
                    loadSection();
                    onRefreshBootstrap();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update account.' });
                  }
                }}
                className="p-5 space-y-3.5 text-sm"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Name *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={accEditModal.account_name}
                    onChange={(e) => setAccEditModal({ ...accEditModal, account_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bank / Provider</label>
                    <input
                      type="text"
                      placeholder="Optional bank or provider"
                      value={accEditModal.bank_name}
                      onChange={(e) => setAccEditModal({ ...accEditModal, bank_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                    <input
                      type="text"
                      placeholder="Optional branch"
                      value={accEditModal.branch}
                      onChange={(e) => setAccEditModal({ ...accEditModal, branch: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance ({cur})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={accEditModal.opening_balance}
                    onChange={(e) => setAccEditModal({ ...accEditModal, opening_balance: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl tabular-nums outline-none focus:border-indigo-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Changing the opening balance adjusts the current balance by the difference.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAccEditModal(null)}
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

        {/* Add / Withdraw Balance Modal */}
        {accTxModal && (
          <div
            onClick={() => setAccTxModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900">
                  {accTxModal.type === 'deposit' ? 'Add Balance (+)' : 'Withdraw Balance (-)'}
                </h3>
                <button type="button" onClick={() => setAccTxModal(null)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch('/api/accounts/transactions', {
                      method: 'POST',
                      body: JSON.stringify({
                        bank_account_id: accTxModal.account.id,
                        type: accTxModal.type,
                        amount: Number(accTxModal.amount),
                        description: accTxModal.description,
                        transaction_date: accTxModal.transaction_date,
                      }),
                    });
                    setAccTxModal(null);
                    setNotice({ type: 'success', text: 'Account transaction recorded!' });
                    loadSection();
                    onRefreshBootstrap();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Transaction failed.' });
                  }
                }}
                className="p-5 space-y-3.5 text-sm"
              >
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex justify-between items-center">
                  <span className="text-slate-600">
                    Account: <strong className="text-slate-900">{accTxModal.account.account_name}</strong>
                  </span>
                  <span className="font-mono font-bold text-emerald-700">{formatMoney(accTxModal.account.balance, cur)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({cur}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      autoFocus
                      placeholder="0.00"
                      value={accTxModal.amount}
                      onChange={(e) => setAccTxModal({ ...accTxModal, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl tabular-nums outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={accTxModal.transaction_date}
                      onChange={(e) => setAccTxModal({ ...accTxModal, transaction_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Note</label>
                  <input
                    type="text"
                    placeholder="Optional note"
                    value={accTxModal.description}
                    onChange={(e) => setAccTxModal({ ...accTxModal, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAccTxModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer ${
                      accTxModal.type === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {accTxModal.type === 'deposit' ? 'Add Balance' : 'Withdraw Balance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Modal */}
        {transferModal && (
          <div
            onClick={() => setTransferModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900">Transfer Between Accounts</h3>
                <button type="button" onClick={() => setTransferModal(null)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setNotice(null);
                  try {
                    await apiFetch('/api/accounts/transfer', {
                      method: 'POST',
                      body: JSON.stringify({
                        from_account_id: Number(transferModal.from_account_id),
                        to_account_id: Number(transferModal.to_account_id),
                        amount: Number(transferModal.amount),
                        description: transferModal.description,
                        transaction_date: transferModal.transaction_date,
                      }),
                    });
                    setTransferModal(null);
                    setNotice({ type: 'success', text: 'Balance transferred successfully!' });
                    loadSection();
                    onRefreshBootstrap();
                  } catch (err) {
                    setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Transfer failed.' });
                  }
                }}
                className="p-5 space-y-3.5 text-sm"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">From Account *</label>
                  <select
                    required
                    value={transferModal.from_account_id}
                    onChange={(e) => setTransferModal({ ...transferModal, from_account_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_name} ({formatMoney(a.balance, cur)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">To Account *</label>
                  <select
                    required
                    value={transferModal.to_account_id}
                    onChange={(e) => setTransferModal({ ...transferModal, to_account_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">-- Select Destination Account --</option>
                    {accounts
                      .filter((a) => String(a.id) !== transferModal.from_account_id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_name} ({formatMoney(a.balance, cur)})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount ({cur}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={transferModal.amount}
                      onChange={(e) => setTransferModal({ ...transferModal, amount: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl tabular-nums outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={transferModal.transaction_date}
                      onChange={(e) => setTransferModal({ ...transferModal, transaction_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Cash deposited into bank"
                    value={transferModal.description}
                    onChange={(e) => setTransferModal({ ...transferModal, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTransferModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!transferModal.to_account_id}
                    style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                  >
                    Transfer Now
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Per-Account History Modal */}
        {accHistoryModal && (
          <div
            onClick={() => setAccHistoryModal(null)}
            className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Account Transaction History</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{accHistoryModal.account.account_name}</p>
                </div>
                <button type="button" onClick={() => setAccHistoryModal(null)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/50 border-b border-slate-100 text-xs">
                <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Opening Balance</div>
                  <div className="font-mono font-bold text-slate-800 tabular-nums mt-0.5">
                    {formatMoney(Number(accHistoryModal.account.opening_balance ?? 0), cur)}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200/70 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-emerald-700">Current Balance</div>
                  <div className="font-mono font-bold text-emerald-800 tabular-nums mt-0.5">
                    {formatMoney(accHistoryModal.account.balance, cur)}
                  </div>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Date</th>
                      <th className="px-4 py-2.5 font-semibold">Type</th>
                      <th className="px-4 py-2.5 font-semibold">Description</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accHistoryModal.loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading history...</td>
                      </tr>
                    ) : accHistoryModal.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No transactions logged for this account yet.
                        </td>
                      </tr>
                    ) : (
                      accHistoryModal.transactions.map((tx) => {
                        const isDep = tx.type === 'deposit';
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">{tx.transaction_date}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold uppercase ${
                                  isDep ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{tx.description || '—'}</td>
                            <td
                              className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                                isDep ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {isDep ? '+' : '-'}
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
      </div>
    );
  }

  if (section === 'expenses') {
    const totalExpenseSum = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const catTotals = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount ?? 0);
      return acc;
    }, {});
    const topCategoryEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    return (
      <div className="space-y-5">
        {noticeBar}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ background: 'linear-gradient(135deg, #e11d48, #f97316)' }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(225,29,72,0.28)]"
            >
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
                Business{' '}
                <span className="bg-gradient-to-r from-[#e11d48] to-[#f97316] bg-clip-text text-transparent">
                  Expenses
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Track operating costs, utilities, rent &amp; miscellaneous vouchers
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-xs font-semibold tabular-nums">
            {expenses.length} Voucher Entries
          </span>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(225,29,72,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Total Expenses Logged</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{formatMoney(totalExpenseSum, cur)}</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {expenses.length} records
            </span>
          </div>
          <div
            style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(234,88,12,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Top Expense Category</div>
              <div className="mt-0.5 text-lg font-display font-bold truncate">
                {topCategoryEntry ? topCategoryEntry[0] : 'No Expenses'}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {topCategoryEntry ? formatMoney(topCategoryEntry[1], cur) : formatMoney(0, cur)}
            </span>
          </div>
        </div>

        {/* TOP FULL-WIDTH: Record Expense Form */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-white to-amber-50/60 flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #e11d48, #f97316)' }}
            >
              <PlusCircle className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">Record Expense</h2>
              <p className="text-[11px] text-slate-500">Log daily operating outflow</p>
            </div>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(expForm) });
                setExpForm((prev) => ({ ...prev, amount: '', description: '' }));
                setNotice({ type: 'success', text: 'Expense recorded successfully!' });
                loadSection();
                onRefreshBootstrap();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save expense.' });
              }
            }}
            className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
          >
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
              <select
                value={expForm.category}
                onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none"
              >
                {bootstrap.expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                {bootstrap.expenseCategories.length === 0 && <option value="Other">Other</option>}
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
                value={expForm.amount}
                onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none tabular-nums"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={expForm.expense_date}
                onChange={(e) => setExpForm({ ...expForm, expense_date: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none"
              />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note / Voucher Particulars</label>
              <input
                type="text"
                placeholder="Optional particulars..."
                value={expForm.description}
                onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                style={{ background: 'linear-gradient(135deg, #e11d48, #f97316)' }}
                className="w-full py-2.5 px-4 text-white rounded-xl font-semibold shadow-[0_6px_16px_rgba(225,29,72,0.24)] hover:opacity-95 transition cursor-pointer"
              >
                Save Expense
              </button>
            </div>
          </form>
        </div>

        {/* BOTTOM FULL-WIDTH: Expense Ledger Table */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Expense Ledger</h2>
              <p className="text-[11px] text-slate-500">All recorded shop &amp; administrative expenses</p>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {ex.expense_date || '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                        {ex.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{ex.description || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-rose-600 tabular-nums whitespace-nowrap">
                      {formatMoney(ex.amount, cur)}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-500">
                      No expenses logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (section === 'returns') {
    const totalReturnVal = returnsList.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    const totalReturnUnits = returnsList.reduce((s, r) => s + Number(r.quantity ?? 0), 0);

    return (
      <div className="space-y-5">
        {noticeBar}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(2,132,199,0.28)]"
            >
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
                Sales{' '}
                <span className="bg-gradient-to-r from-[#0284c7] to-[#2563eb] bg-clip-text text-transparent">
                  Returns
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Process customer product returns &amp; automatically restore sellable stock
              </p>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            style={{ background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(2,132,199,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Total Returned Value</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{formatMoney(totalReturnVal, cur)}</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
              {returnsList.length} returns
            </span>
          </div>
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' }}
            className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(79,70,229,0.20)] flex items-center justify-between"
          >
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Units Restored to Stock</div>
              <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{totalReturnUnits} pcs</div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold">Inventory Credited</span>
          </div>
        </div>

        {/* TOP FULL-WIDTH: Process Sales Return Form */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 via-white to-blue-50/60 flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
            >
              <RotateCcw className="w-4 h-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">Process Sales Return</h2>
              <p className="text-[11px] text-slate-500">Restores returned quantity to product stock</p>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setNotice(null);
              try {
                await apiFetch('/api/returns', { method: 'POST', body: JSON.stringify(retForm) });
                setRetForm((prev) => ({ ...prev, quantity: '1', reason: '' }));
                setNotice({ type: 'success', text: 'Sales return processed and stock restored!' });
                loadSection();
                onRefreshBootstrap();
              } catch (err) {
                setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to process return.' });
              }
            }}
            className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
          >
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Invoice *</label>
              <select
                value={retForm.sale_id}
                onChange={(e) => setRetForm({ ...retForm, sale_id: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-sky-500 outline-none"
              >
                {sales.length === 0 && <option value="">-- Select Sale --</option>}
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoice_no} — {s.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Returned Product *</label>
              <select
                value={retForm.product_id}
                onChange={(e) => {
                  const chosen = products.find((p) => String(p.id) === e.target.value);
                  setRetForm({
                    ...retForm,
                    product_id: e.target.value,
                    price: chosen ? String(chosen.selling_price) : retForm.price,
                  });
                }}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-sky-500 outline-none"
              >
                {products.length === 0 && <option value="">-- Select Product --</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Qty *</label>
              <input
                type="number"
                min={1}
                required
                value={retForm.quantity}
                onChange={(e) => setRetForm({ ...retForm, quantity: e.target.value })}
                className="w-full px-2.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-sky-500 outline-none tabular-nums"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Rate ({cur}) *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={retForm.price}
                onChange={(e) => setRetForm({ ...retForm, price: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-sky-500 outline-none tabular-nums"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
              <input
                type="text"
                placeholder="Optional reason..."
                value={retForm.reason}
                onChange={(e) => setRetForm({ ...retForm, reason: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-sky-500 outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <button
                type="submit"
                disabled={!sales.length || !products.length}
                style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
                className="w-full py-2.5 px-3 text-white rounded-xl text-xs font-semibold shadow-[0_6px_16px_rgba(2,132,199,0.24)] hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
              >
                Return
              </button>
            </div>
          </form>
        </div>

        {/* BOTTOM FULL-WIDTH: Returns Table */}
        <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Recent Sales Returns</h2>
              <p className="text-[11px] text-slate-500">Customer refund entries credited back to stock</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">Invoice &amp; Date</th>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Refund Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnsList.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold text-sky-700">{r.invoice_no || '—'}</div>
                      <div className="text-[11px] text-slate-400 tabular-nums">{r.return_date || '—'}</div>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900 text-xs sm:text-sm">{r.product_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{r.quantity}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{r.reason || 'Customer Return'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-sky-700 tabular-nums whitespace-nowrap">
                      {formatMoney(r.total_amount, cur)}
                    </td>
                  </tr>
                ))}
                {returnsList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                      No returns recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Damages section
  const totalDamageLoss = damagesList.reduce((s, d) => s + Number(d.loss_amount ?? 0), 0);
  const totalDamagedUnits = damagesList.reduce((s, d) => s + Number(d.quantity ?? 0), 0);

  return (
    <div className="space-y-5">
      {noticeBar}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{ background: 'linear-gradient(135deg, #e11d48, #f59e0b)' }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(225,29,72,0.28)]"
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
              Damaged{' '}
              <span className="bg-gradient-to-r from-[#e11d48] to-[#f59e0b] bg-clip-text text-transparent">
                Stock
              </span>
            </h1>
            <p className="text-xs text-slate-500">Write off broken or defective inventory and track purchase cost loss</p>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}
          className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(225,29,72,0.20)] flex items-center justify-between"
        >
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Damaged Write-Off Loss</div>
            <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{formatMoney(totalDamageLoss, cur)}</div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold tabular-nums">
            {damagesList.length} entries
          </span>
        </div>
        <div
          style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}
          className="rounded-xl px-4 py-3 text-white shadow-[0_6px_16px_rgba(217,119,6,0.20)] flex items-center justify-between"
        >
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">Damaged Units Logged</div>
            <div className="mt-0.5 text-lg font-display font-bold tabular-nums">{totalDamagedUnits} pcs</div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-semibold">Deducted from Stock</span>
        </div>
      </div>

      {/* TOP FULL-WIDTH: Record Damage Form */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-white to-amber-50/60 flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #e11d48, #f59e0b)' }}
          >
            <AlertTriangle className="w-4 h-4" />
          </span>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">Record Damaged Stock</h2>
            <p className="text-[11px] text-slate-500">Deducts stock automatically and computes cost loss</p>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setNotice(null);
            try {
              await apiFetch('/api/damages', { method: 'POST', body: JSON.stringify(dmgForm) });
              setDmgForm((prev) => ({ ...prev, quantity: '1', reason: '' }));
              setNotice({ type: 'success', text: 'Damaged stock recorded!' });
              loadSection();
              onRefreshBootstrap();
            } catch (err) {
              setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to record damage.' });
            }
          }}
          className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm"
        >
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product *</label>
            <select
              value={dmgForm.product_id}
              onChange={(e) => setDmgForm({ ...dmgForm, product_id: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none"
            >
              {products.length === 0 && <option value="">-- Select Product --</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.quantity})
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Damaged Qty *</label>
            <input
              type="number"
              min={1}
              required
              value={dmgForm.quantity}
              onChange={(e) => setDmgForm({ ...dmgForm, quantity: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none tabular-nums"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Transit breakage, expired..."
              value={dmgForm.reason}
              onChange={(e) => setDmgForm({ ...dmgForm, reason: e.target.value })}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:border-rose-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              disabled={!products.length}
              style={{ background: 'linear-gradient(135deg, #e11d48, #f97316)' }}
              className="w-full py-2.5 px-4 text-white rounded-xl font-semibold shadow-[0_6px_16px_rgba(225,29,72,0.24)] hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
            >
              Record Damage
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM FULL-WIDTH: Log Table */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">Damaged Product Log</h2>
            <p className="text-[11px] text-slate-500">Latest {damagesList.length} damage entries</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold text-right">Qty</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold text-right">Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {damagesList.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                    {d.damage_date || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{d.product_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">{d.quantity}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-600">{d.reason || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-rose-600 tabular-nums whitespace-nowrap">
                    -{formatMoney(d.loss_amount, cur)}
                  </td>
                </tr>
              ))}
              {damagesList.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                    No damaged stock entries recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
