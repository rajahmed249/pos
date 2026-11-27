import { useEffect, useState } from 'react';
import { Pencil, PlusCircle, Search, Truck, Users, X } from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { Customer, Supplier } from '../types/pos.ts';
import { PaginationBar } from './PaginationBar.tsx';

interface PartiesViewProps {
  mode: 'customers' | 'suppliers';
  currency: string;
}

export function PartiesView({ mode, currency }: PartiesViewProps) {
  const [rows, setRows] = useState<Array<Customer & Supplier>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [editModal, setEditModal] = useState<{
    id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
  } | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isCustomer = mode === 'customers';
  const label = isCustomer ? 'Customer' : 'Supplier';

  const theme = isCustomer
    ? {
        grad: 'linear-gradient(135deg, #2563eb, #4f46e5)',
        kpiGrad: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
        shadow: 'rgba(37,99,235,0.28)',
        titleFrom: 'from-[#2563eb]',
        titleTo: 'to-[#4f46e5]',
        tint: 'from-blue-50/80 via-white to-indigo-50/60',
        pill: 'bg-blue-50 text-blue-700 border-blue-100',
        focus: 'focus:border-blue-500',
        hoverEdit: 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700',
      }
    : {
        grad: 'linear-gradient(135deg, #0891b2, #0d9488)',
        kpiGrad: 'linear-gradient(135deg, #0891b2 0%, #0d9488 100%)',
        shadow: 'rgba(8,145,178,0.28)',
        titleFrom: 'from-[#0891b2]',
        titleTo: 'to-[#0d9488]',
        tint: 'from-cyan-50/80 via-white to-teal-50/60',
        pill: 'bg-cyan-50 text-cyan-700 border-cyan-100',
        focus: 'focus:border-cyan-600',
        hoverEdit: 'hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700',
      };

  function load() {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (query) params.set('q', query);
    apiFetch<{ items: Array<Customer & Supplier>; total: number }>(`/api/${mode}?${params.toString()}`)
      .then((res) => {
        if (res.items.length === 0 && res.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(res.total / limit)));
          return;
        }
        setRows(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setNotice({ type: 'error', text: err instanceof Error ? err.message : `Failed to load ${mode}.` });
      });
  }

  useEffect(() => {
    setPage(1);
    setQuery('');
    setNotice(null);
    setEditModal(null);
  }, [mode]);

  useEffect(() => {
    load();
  }, [mode, page, limit, query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!form.name.trim()) {
      setNotice({ type: 'error', text: `${label} name is required.` });
      return;
    }
    try {
      await apiFetch(`/api/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ name: '', phone: '', email: '', address: '' });
      setNotice({ type: 'success', text: `${label} saved successfully!` });
      load();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save record.' });
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    setNotice(null);
    try {
      await apiFetch(`/api/${mode}/${editModal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editModal.name,
          phone: editModal.phone,
          email: editModal.email,
          address: editModal.address,
        }),
      });
      setEditModal(null);
      setNotice({ type: 'success', text: `${label} updated successfully!` });
      load();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : `Failed to update ${label.toLowerCase()}.` });
    }
  }

  const pageVolume = rows.reduce((s, r) => s + Number(isCustomer ? r.billed ?? 0 : r.purchased ?? 0), 0);
  const pageDue = rows.reduce((s, r) => s + Number(r.due ?? 0), 0);

  return (
    <div className="space-y-5">
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

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{ background: theme.grad, boxShadow: `0 6px 18px ${theme.shadow}` }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
          >
            {isCustomer ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
              {label}{' '}
              <span className={`bg-gradient-to-r ${theme.titleFrom} ${theme.titleTo} bg-clip-text text-transparent`}>
                Directory
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              {isCustomer
                ? 'Manage customer contacts, billed totals & receivable balances'
                : 'Manage wholesale vendors, purchase totals & payable balances'}
            </p>
          </div>
        </div>
        <span className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold tabular-nums ${theme.pill}`}>
          {total.toLocaleString()} {isCustomer ? 'Customers' : 'Suppliers'}
        </span>
      </div>

      {/* Compact KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div
          style={{ background: theme.kpiGrad, boxShadow: `0 6px 16px ${theme.shadow}` }}
          className="rounded-xl px-3.5 py-2.5 text-white"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">
            Total {isCustomer ? 'Customers' : 'Suppliers'}
          </div>
          <div className="mt-1 text-lg font-display font-bold tabular-nums">{total.toLocaleString()}</div>
          <div className="mt-0.5 text-[10px] text-white/80">Registered {isCustomer ? 'Buyer' : 'Vendor'} Accounts</div>
        </div>
        <div
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
          className="rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">
            {isCustomer ? 'Page Billed Total' : 'Page Purchased Total'}
          </div>
          <div className="mt-1 text-lg font-display font-bold tabular-nums">{formatMoney(pageVolume, currency)}</div>
          <div className="mt-0.5 text-[10px] text-white/80">{rows.length} entries shown</div>
        </div>
        <div
          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}
          className="rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(225,29,72,0.20)]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85">
            {isCustomer ? 'Page Receivable Due' : 'Page Payable Due'}
          </div>
          <div className="mt-1 text-lg font-display font-bold tabular-nums">{formatMoney(pageDue, currency)}</div>
          <div className="mt-0.5 text-[10px] text-white/80">
            {isCustomer ? 'Uncollected Customer Balances' : 'Outstanding Vendor Dues'}
          </div>
        </div>
      </div>

      {/* TOP FULL-WIDTH: Add Customer / Supplier Form */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className={`px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r ${theme.tint} flex items-center gap-2.5`}>
          <span
            className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
            style={{ background: theme.grad }}
          >
            <PlusCircle className="w-4 h-4" />
          </span>
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900">Add {label}</h2>
            <p className="text-[11px] text-slate-500">
              {isCustomer ? 'Register a new buyer account' : 'Register a vendor or distributor'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end text-sm">
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">{label} Name *</label>
            <input
              type="text"
              required
              placeholder={isCustomer ? 'Full name or business' : 'Company or vendor name'}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white outline-none ${theme.focus}`}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="01XXXXXXXXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white outline-none ${theme.focus}`}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              placeholder={isCustomer ? 'customer@example.com' : 'vendor@example.com'}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white outline-none ${theme.focus}`}
            />
          </div>
          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              placeholder={isCustomer ? 'Street, area, city' : 'Office or warehouse address'}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={`w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white outline-none ${theme.focus}`}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <button
              type="submit"
              style={{ background: theme.grad, boxShadow: `0 6px 16px ${theme.shadow}` }}
              className="w-full py-2.5 px-4 text-white rounded-xl font-semibold hover:opacity-95 transition cursor-pointer"
            >
              Save {label}
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM FULL-WIDTH: Search + Directory Table */}
      <div className="w-full bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">{label}s List</h2>
            <p className="text-[11px] text-slate-500">
              {isCustomer ? 'Page Billed' : 'Page Purchased'}:{' '}
              <strong className="tabular-nums text-slate-800">{formatMoney(pageVolume, currency)}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setPage(1);
                  setQuery(e.target.value);
                }}
                placeholder={`Search ${mode}...`}
                className={`w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white outline-none ${theme.focus}`}
              />
            </div>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setQuery('');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">{label}</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                  {isCustomer ? 'Billed' : 'Purchased'}
                </th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                  {isCustomer ? 'Due Balance' : 'Payable Due'}
                </th>
                <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">{r.name}</div>
                    {r.address && <div className="text-[11px] text-slate-400 truncate max-w-[260px]">{r.address}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                    <div className="font-mono text-slate-700">{r.phone || '—'}</div>
                    {r.email && <div className="text-[11px] text-slate-400">{r.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                    {formatMoney(isCustomer ? r.billed : r.purchased, currency)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums whitespace-nowrap ${
                      Number(r.due ?? 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {formatMoney(r.due ?? 0, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        setEditModal({
                          id: r.id,
                          name: r.name || '',
                          phone: r.phone || '',
                          email: r.email || '',
                          address: r.address || '',
                        })
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer ${theme.hoverEdit}`}
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                    No {mode} found.
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

      {/* Edit Modal */}
      {editModal && (
        <div
          onClick={() => setEditModal(null)}
          className="fixed inset-0 z-[120] bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className={`px-5 py-4 border-b border-slate-100 bg-gradient-to-r ${theme.tint} flex items-center justify-between`}>
              <h3 className="font-display text-base font-bold text-slate-900">Edit {label}</h3>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="p-5 space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                  className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none ${theme.focus}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editModal.phone}
                  onChange={(e) => setEditModal({ ...editModal, phone: e.target.value })}
                  className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none ${theme.focus}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editModal.email}
                  onChange={(e) => setEditModal({ ...editModal, email: e.target.value })}
                  className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none ${theme.focus}`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={editModal.address}
                  onChange={(e) => setEditModal({ ...editModal, address: e.target.value })}
                  className={`w-full px-3.5 py-2 border border-slate-300 rounded-xl outline-none ${theme.focus}`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: theme.grad }}
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
