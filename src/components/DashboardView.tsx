import {
  AlertTriangle,
  Building2,
  CreditCard,
  Landmark,
  Package,
  Percent,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
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
      {/* 2-Row x 5-Card Vibrant Compact KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {/* Row 1: Today's Sales */}
        <button
          type="button"
          onClick={() => onNavigate('sales')}
          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(37,99,235,0.20)] hover:shadow-[0_10px_22px_rgba(37,99,235,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Today&apos;s Sales
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <ShoppingCart className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {formatMoney(m.todaySales, cur)}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Total Revenue: {formatMoney(m.totalRevenue, cur)}
          </div>
        </button>

        {/* Row 1: Today's Profit */}
        <button
          type="button"
          onClick={() => onNavigate('reports')}
          style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(5,150,105,0.20)] hover:shadow-[0_10px_22px_rgba(5,150,105,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Today&apos;s Profit
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {formatMoney(m.todayProfit, cur)}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Total Profit: {formatMoney(m.totalProfit, cur)}
          </div>
        </button>

        {/* Row 1: Today's Expense */}
        <button
          type="button"
          onClick={() => onNavigate('expenses')}
          style={{ background: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(225,29,72,0.20)] hover:shadow-[0_10px_22px_rgba(225,29,72,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Today&apos;s Expense
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <Wallet className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {formatMoney(m.todayExpense, cur)}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            All Expenses: {formatMoney(m.totalExpenses, cur)}
          </div>
        </button>

        {/* Row 1: Today's Margin */}
        <button
          type="button"
          onClick={() => onNavigate('reports')}
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(124,58,237,0.20)] hover:shadow-[0_10px_22px_rgba(124,58,237,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Today&apos;s Margin
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <Percent className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {Number(m.todayMargin ?? 0).toFixed(1)}%
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Gross Profit Ratio
          </div>
        </button>

        {/* Row 1: Customer Due */}
        <button
          type="button"
          onClick={() => onNavigate('customers')}
          style={{ background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(217,119,6,0.20)] hover:shadow-[0_10px_22px_rgba(217,119,6,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Customer Due
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {formatMoney(m.customerDue, cur)}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Supplier Payable: {formatMoney(m.supplierDue, cur)}
          </div>
        </button>

        {/* Row 2: Total Products */}
        <button
          type="button"
          onClick={() => onNavigate('products')}
          style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(2,132,199,0.20)] hover:shadow-[0_10px_22px_rgba(2,132,199,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Total Products
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {m.productCount.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Active SKUs in Store
          </div>
        </button>

        {/* Row 2: Total Customers */}
        <button
          type="button"
          onClick={() => onNavigate('customers')}
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(13,148,136,0.20)] hover:shadow-[0_10px_22px_rgba(13,148,136,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Total Customers
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {m.customerCount.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Registered Buyers
          </div>
        </button>

        {/* Row 2: Total Suppliers */}
        <button
          type="button"
          onClick={() => onNavigate('suppliers')}
          style={{ background: 'linear-gradient(135deg, #334155 0%, #475569 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(51,65,85,0.20)] hover:shadow-[0_10px_22px_rgba(51,65,85,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Total Suppliers
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {m.supplierCount.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Active Vendors
          </div>
        </button>

        {/* Row 2: Low Stock */}
        <button
          type="button"
          onClick={() => onNavigate('stock')}
          style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(234,88,12,0.20)] hover:shadow-[0_10px_22px_rgba(234,88,12,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Low Stock
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {Number(m.lowStockCount ?? 0).toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Needs Restocking Soon
          </div>
        </button>

        {/* Row 2: Out of Stock */}
        <button
          type="button"
          onClick={() => onNavigate('stock')}
          style={{ background: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' }}
          className="group relative min-w-0 text-left overflow-hidden rounded-xl px-3.5 py-2.5 text-white shadow-[0_6px_16px_rgba(185,28,28,0.20)] hover:shadow-[0_10px_22px_rgba(185,28,28,0.28)] hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-white/85 truncate">
              Out of Stock
            </span>
            <span className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0">
              <XCircle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-1.5 text-[15px] sm:text-[17px] font-display font-bold tabular-nums tracking-tight leading-tight truncate">
            {Number(m.outOfStockCount ?? 0).toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-white/80 tabular-nums truncate">
            Zero Stock SKUs
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
