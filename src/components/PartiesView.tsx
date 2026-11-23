import { useEffect, useState } from 'react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import type { Customer, Supplier } from '../types/pos.ts';

interface PartiesViewProps {
  mode: 'customers' | 'suppliers';
  currency: string;
}

export function PartiesView({ mode, currency }: PartiesViewProps) {
  const [rows, setRows] = useState<Array<Customer & Supplier>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function load() {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (query) params.set('q', query);
    apiFetch<{ items: Array<Customer & Supplier>; total: number }>(`/api/${mode}?${params.toString()}`).then((res) => {
      if (res.items.length === 0 && res.total > 0 && page > 1) {
        setPage(Math.max(1, Math.ceil(res.total / 25)));
        return;
      }
      setRows(res.items);
      setTotal(res.total);
    });
  }

  useEffect(() => {
    setPage(1);
    setQuery('');
    setNotice(null);
  }, [mode]);

  useEffect(() => {
    load();
  }, [mode, page, query]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!form.name.trim()) {
      setNotice({ type: 'error', text: `${mode === 'customers' ? 'Customer' : 'Supplier'} name is required.` });
      return;
    }
    try {
      await apiFetch(`/api/${mode}`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({ name: '', phone: '', email: '', address: '' });
      setNotice({ type: 'success', text: `${mode === 'customers' ? 'Customer' : 'Supplier'} saved!` });
      load();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save record.' });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));
  const label = mode === 'customers' ? 'Customer' : 'Supplier';

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
          <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Add {label}</h2>
          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <input
              type="text"
              required
              placeholder={`${label} name`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
            />
            <input
              type="text"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
            />
            <textarea
              rows={2}
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-md"
            />
            <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium cursor-pointer">
              Save {label}
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
              placeholder={`Search ${mode} by name or phone...`}
              className="w-full sm:w-64 min-w-0 px-3 py-1.5 text-sm border border-slate-300 rounded-md"
            />
            <span className="text-xs text-slate-500 tabular-nums shrink-0">{total} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">{label}</th>
                  <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-right font-medium">{mode === 'customers' ? 'Billed' : 'Purchased'}</th>
                  <th className="px-4 py-2.5 text-right font-medium">Due Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{r.name}</div>
                      {r.address && <div className="text-xs text-slate-500 truncate max-w-xs">{r.address}</div>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{r.phone || '-'}</td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                      {formatMoney(mode === 'customers' ? r.billed : r.purchased, currency)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${
                        Number(r.due ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {formatMoney(r.due ?? 0, currency)}
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
