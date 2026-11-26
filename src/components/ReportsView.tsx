import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { apiFetch, downloadCsv, formatMoney } from '../lib/api.ts';

interface ReportsViewProps {
  currency: string;
}

interface ReportPayload {
  from: string;
  to: string;
  summary: {
    invoiceCount: number;
    revenue: number;
    collected: number;
    due: number;
    profit: number;
  };
  expensesTotal: number;
  netProfit: number;
  customerDues: Array<{ id: number; name: string; phone: string; due: number }>;
  supplierDues: Array<{ id: number; name: string; phone: string; due: number }>;
}

export function ReportsView({ currency }: ReportsViewProps) {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    const effectiveFrom = from && to && from > to ? to : from;
    const effectiveTo = from && to && from > to ? from : to;
    apiFetch<ReportPayload>(`/api/reports?from=${effectiveFrom}&to=${effectiveTo}`)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load financial reports.');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, [from, to]);

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center justify-between gap-4 text-sm text-red-700">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="h-48 bg-white border border-slate-200 rounded-lg animate-pulse" />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end justify-between gap-4 text-sm">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-md" />
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `youthit-customer-dues-${from}-to-${to}.csv`,
              ['Customer', 'Phone', 'Due Amount'],
              data.customerDues.map((c) => [c.name, c.phone, c.due.toFixed(2)])
            )
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          Export Customer Dues CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Period Revenue ({data.summary.invoiceCount} invoices)</div>
          <div className="mt-1 text-xl font-display font-bold tabular-nums">{formatMoney(data.summary.revenue, currency)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Collected Cash</div>
          <div className="mt-1 text-xl font-display font-bold tabular-nums text-emerald-700">{formatMoney(data.summary.collected, currency)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Gross Profit</div>
          <div className="mt-1 text-xl font-display font-bold tabular-nums">{formatMoney(data.summary.profit, currency)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Net Profit (After Expenses)</div>
          <div className="mt-1 text-xl font-display font-bold tabular-nums text-slate-900">{formatMoney(data.netProfit, currency)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-display text-sm font-semibold">Top Customer Receivables</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.customerDues.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{c.phone}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600 font-medium whitespace-nowrap">{formatMoney(c.due, currency)}</td>
                  </tr>
                ))}
                {data.customerDues.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-xs text-slate-500">
                      No outstanding customer receivables.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 font-display text-sm font-semibold">Top Supplier Payables</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {data.supplierDues.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{s.phone}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-700 font-medium whitespace-nowrap">{formatMoney(s.due, currency)}</td>
                  </tr>
                ))}
                {data.supplierDues.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-xs text-slate-500">
                      No outstanding supplier payables.
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
