import { AlertTriangle, ArrowUpRight, Landmark, PackageCheck, TrendingUp, Users } from 'lucide-react';
import { formatMoney } from '../lib/api.ts';
import type { BootstrapPayload } from '../types/pos.ts';

interface DashboardViewProps {
  data: BootstrapPayload;
  onNavigate: (routeKey: string) => void;
  onOpenInvoice: (saleId: number) => void;
}

export function DashboardView({ data, onNavigate, onOpenInvoice }: DashboardViewProps) {
  const cur = data.settings.currency || '৳';
  const m = data.metrics;
  const maxMonthRev = Math.max(1, ...data.monthlyTrend.map((t) => t.revenue));

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <button
          type="button"
          onClick={() => onNavigate('sales')}
          className="group relative min-w-0 text-left overflow-hidden bg-gradient-to-br from-white via-white to-indigo-50/55 border border-indigo-100/90 hover:border-indigo-300 rounded-2xl px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500/70 to-transparent" />
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[12px] font-medium text-slate-600 truncate">
              Total Revenue ({m.saleCount.toLocaleString()})
            </span>
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:ring-indigo-600 transition-colors">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 text-lg sm:text-[19px] font-display font-bold tabular-nums tracking-tight text-slate-900 leading-snug truncate">
            {formatMoney(m.totalRevenue, cur)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-emerald-700 tabular-nums">
            <span className="truncate">Gross Profit: {formatMoney(m.totalProfit, cur)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('sales')}
          className="group relative min-w-0 text-left overflow-hidden bg-gradient-to-br from-white via-white to-emerald-50/55 border border-emerald-100/90 hover:border-emerald-300 rounded-2xl px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-500/70 to-transparent" />
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[12px] font-medium text-slate-600 truncate">
              Today&apos;s Sales
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white group-hover:ring-emerald-600 transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 text-lg sm:text-[19px] font-display font-bold tabular-nums tracking-tight text-slate-900 leading-snug truncate">
            {formatMoney(m.todaySales, cur)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600 tabular-nums">
            <span className="truncate">Today&apos;s Profit: {formatMoney(m.todayProfit, cur)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('customers')}
          className="group relative min-w-0 text-left overflow-hidden bg-gradient-to-br from-white via-white to-amber-50/55 border border-amber-100/90 hover:border-amber-300 rounded-2xl px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500 via-orange-400/70 to-transparent" />
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[12px] font-medium text-slate-600 truncate">
              Customer Receivable Due
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white group-hover:ring-amber-500 transition-colors">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 text-lg sm:text-[19px] font-display font-bold tabular-nums tracking-tight text-amber-700 leading-snug truncate">
            {formatMoney(m.customerDue, cur)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-600 tabular-nums">
            <span className="truncate">Supplier Payable: {formatMoney(m.supplierDue, cur)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('stock')}
          className="group relative min-w-0 text-left overflow-hidden bg-gradient-to-br from-white via-white to-sky-50/55 border border-sky-100/90 hover:border-sky-300 rounded-2xl px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
        >
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500 via-cyan-500/70 to-transparent" />
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[12px] font-medium text-slate-600 truncate">
              Stock Valuation ({m.productCount} SKUs)
            </span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white group-hover:ring-sky-600 transition-colors">
              <PackageCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-1.5 text-lg sm:text-[19px] font-display font-bold tabular-nums tracking-tight text-slate-900 leading-snug truncate">
            {formatMoney(m.stockCostValue, cur)}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-sky-700 tabular-nums">
            <span className="truncate">Retail Value: {formatMoney(m.stockRetailValue, cur)}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0 space-y-6">
          <div className="bg-white border border-slate-100 rounded-[20px] p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-sm font-bold text-slate-800">Monthly Revenue &amp; Profit Trend</h2>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 shrink-0">
                Last {data.monthlyTrend.length} active months
              </span>
            </div>
            <div className="space-y-3.5">
              {data.monthlyTrend.map((row) => {
                const pct = Math.max(4, Math.round((row.revenue / maxMonthRev) * 100));
                return (
                  <div key={row.month} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                      <span className="font-mono font-semibold text-slate-700">{row.month} · {row.count} sales</span>
                      <span className="tabular-nums text-slate-900 font-semibold">
                        {formatMoney(row.revenue, cur)}{' '}
                        <span className="text-emerald-600 font-medium">({formatMoney(row.profit, cur)} profit)</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {data.monthlyTrend.length === 0 && (
                <div className="py-4 text-xs text-slate-500">No monthly sales recorded yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[20px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-slate-800">Recent Invoices</h2>
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                View all invoices
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Invoice</th>
                    <th className="px-5 py-3 text-left font-semibold">Customer</th>
                    <th className="px-5 py-3 text-left font-semibold">Date</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                    <th className="px-5 py-3 text-right font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(sale.id)}
                          className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                        >
                          {sale.invoice_no}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-slate-700 font-medium">{sale.customer_name || 'Walk-in'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">{sale.date}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-800">{formatMoney(sale.receivable, cur)}</td>
                      <td
                        className={`px-5 py-3 text-right tabular-nums font-semibold ${
                          Number(sale.due) > 0 ? 'text-red-500' : 'text-emerald-600'
                        }`}
                      >
                        {formatMoney(sale.due, cur)}
                      </td>
                    </tr>
                  ))}
                  {data.recentSales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-xs text-slate-500">
                        No recent invoices found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="bg-white border border-slate-100 rounded-[20px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Landmark className="w-4 h-4 text-indigo-600 shrink-0" />
                <h2 className="font-display text-sm font-bold text-slate-800 truncate">Cash &amp; Bank Accounts</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('accounts')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 shrink-0 cursor-pointer"
              >
                Manage
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {data.bankAccounts.map((acc) => (
                <div key={acc.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 text-sm hover:bg-slate-50/60">
                  <span className="text-slate-700 font-medium truncate">{acc.account_name}</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 shrink-0">
                    {formatMoney(acc.balance, cur)}
                  </span>
                </div>
              ))}
              {data.bankAccounts.length === 0 && (
                <div className="px-4 sm:px-5 py-4 text-xs text-slate-500">No cash or bank accounts configured yet.</div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[20px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <h2 className="font-display text-sm font-bold text-slate-800 truncate">Low Stock Alerts</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                Inventory
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {data.lowStock.map((item) => (
                <div key={item.id} className="px-5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/60">
                  <span className="text-slate-700 font-medium truncate pr-3">{item.name}</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-mono tabular-nums font-semibold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {item.quantity} left
                  </span>
                </div>
              ))}
              {data.lowStock.length === 0 && (
                <div className="px-5 py-4 text-xs text-slate-500">All products are above alert threshold.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
