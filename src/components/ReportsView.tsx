import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Crown,
  Download,
  Printer,
  ShoppingBag,
  Tags,
  TrendingUp,
  Trophy,
  Truck,
  UserCheck,
} from 'lucide-react';
import { apiFetch, downloadCsv, formatMoney } from '../lib/api.ts';

interface ReportsViewProps {
  currency: string;
}

type ReportKey =
  | 'customer_due'
  | 'supplier_due'
  | 'purchase'
  | 'profit_loss'
  | 'today'
  | 'current_month'
  | 'summary'
  | 'daily'
  | 'low_stock'
  | 'top_customer'
  | 'top_product'
  | 'top_product_all'
  | 'category_wise';

const REPORT_TABS: Array<{ key: ReportKey; label: string; icon: typeof BarChart3 }> = [
  { key: 'customer_due', label: 'Customer Due Report', icon: UserCheck },
  { key: 'supplier_due', label: 'Supplier Due Report', icon: Truck },
  { key: 'purchase', label: 'Purchase Report', icon: ShoppingBag },
  { key: 'profit_loss', label: 'Profit Loss Report', icon: TrendingUp },
  { key: 'today', label: 'Today Report', icon: Calendar },
  { key: 'current_month', label: 'Current Month Report', icon: CalendarDays },
  { key: 'summary', label: 'Summary Report', icon: ClipboardList },
  { key: 'daily', label: 'Daily Report', icon: CalendarRange },
  { key: 'low_stock', label: 'Low Stock Report', icon: AlertTriangle },
  { key: 'top_customer', label: 'Top Customer', icon: Crown },
  { key: 'top_product', label: 'Top Product', icon: Award },
  { key: 'top_product_all', label: 'Top Product (All Time)', icon: Trophy },
  { key: 'category_wise', label: 'Category Wise Report', icon: Tags },
];

interface ReportPayload {
  from: string;
  to: string;
  summary: {
    invoiceCount: number;
    revenue: number;
    collected: number;
    due: number;
    profit: number;
    purchaseCost: number;
    discount: number;
  };
  expensesTotal: number;
  damagesTotal: number;
  returnsTotal: number;
  netProfit: number;
  expenseBreakdown: Array<{ category: string; amount: number }>;
  customerDues: Array<{ id: number; name: string; phone: string; invoices: number; total_billed: number; paid: number; due: number }>;
  supplierDues: Array<{ id: number; name: string; phone: string; purchases: number; total_billed: number; paid: number; due: number }>;
  purchaseReport: Array<{ id: number; invoice_no: string; date: string; supplier_name: string; total: number; paid: number; due: number }>;
  purchaseSummary: { count: number; total: number; paid: number; due: number };
  todayReport: {
    date: string;
    sales_count: number;
    revenue: number;
    collected: number;
    due: number;
    profit: number;
    expenses: number;
    purchases: number;
    payments_received: number;
    invoices: Array<{ invoice_no: string; customer_name: string; receivable: number; paid: number; due: number; profit: number }>;
  };
  currentMonthReport: {
    month: string;
    sales_count: number;
    revenue: number;
    collected: number;
    due: number;
    profit: number;
    expenses: number;
    purchases: number;
    daily_rows: Array<{ date: string; invoices: number; revenue: number; collected: number; due: number; profit: number }>;
  };
  summaryReport: {
    total_revenue: number;
    total_profit: number;
    total_purchases: number;
    total_expenses: number;
    customer_due_total: number;
    supplier_due_total: number;
    bank_balance: number;
    cash_balance: number;
    stock_cost_value: number;
    stock_retail_value: number;
    active_products: number;
    total_customers: number;
    total_suppliers: number;
  };
  dailyReport: Array<{ date: string; invoices: number; revenue: number; collected: number; due: number; profit: number; expenses: number }>;
  lowStockReport: Array<{ id: number; name: string; sku: string; category_name: string; quantity: number; alert_quantity: number; purchase_price: number; selling_price: number }>;
  topCustomers: Array<{ id: number; name: string; phone: string; invoices: number; total_spent: number; paid: number; due: number }>;
  topProducts: Array<{ product_id: number; name: string; sku: string; category_name: string; qty_sold: number; revenue: number; profit: number }>;
  topProductsAllTime: Array<{ product_id: number; name: string; sku: string; category_name: string; qty_sold: number; revenue: number; profit: number }>;
  categoryWiseReport: Array<{ category: string; product_count: number; stock_qty: number; qty_sold: number; sales_revenue: number; estimated_profit: number }>;
}

export function ReportsView({ currency }: ReportsViewProps) {
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeReport, setActiveReport] = useState<ReportKey>('profit_loss');
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    setError('');
    const effectiveFrom = from && to && from > to ? to : from;
    const effectiveTo = from && to && from > to ? from : to;
    apiFetch<ReportPayload>(`/api/reports?from=${effectiveFrom}&to=${effectiveTo}`)
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load financial reports.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [from, to]);

  function handleExportCsv() {
    if (!data) return;
    const file = `youthit-${activeReport}-${data.from}-to-${data.to}.csv`;
    switch (activeReport) {
      case 'customer_due':
        return downloadCsv(file, ['Customer', 'Phone', 'Invoices', 'Billed', 'Paid', 'Due'], data.customerDues.map((r) => [r.name, r.phone, String(r.invoices), r.total_billed.toFixed(2), r.paid.toFixed(2), r.due.toFixed(2)]));
      case 'supplier_due':
        return downloadCsv(file, ['Supplier', 'Phone', 'Purchases', 'Total Billed', 'Paid', 'Due'], data.supplierDues.map((r) => [r.name, r.phone, String(r.purchases), r.total_billed.toFixed(2), r.paid.toFixed(2), r.due.toFixed(2)]));
      case 'purchase':
        return downloadCsv(file, ['Invoice', 'Date', 'Supplier', 'Total', 'Paid', 'Due'], data.purchaseReport.map((r) => [r.invoice_no, r.date, r.supplier_name, r.total.toFixed(2), r.paid.toFixed(2), r.due.toFixed(2)]));
      case 'today':
        return downloadCsv(file, ['Invoice', 'Customer', 'Amount', 'Paid', 'Due', 'Profit'], data.todayReport.invoices.map((r) => [r.invoice_no, r.customer_name, r.receivable.toFixed(2), r.paid.toFixed(2), r.due.toFixed(2), r.profit.toFixed(2)]));
      case 'current_month':
        return downloadCsv(file, ['Date', 'Invoices', 'Revenue', 'Collected', 'Due', 'Profit'], data.currentMonthReport.daily_rows.map((r) => [r.date, String(r.invoices), r.revenue.toFixed(2), r.collected.toFixed(2), r.due.toFixed(2), r.profit.toFixed(2)]));
      case 'daily':
        return downloadCsv(file, ['Date', 'Invoices', 'Revenue', 'Collected', 'Due', 'Profit', 'Expenses'], data.dailyReport.map((r) => [r.date, String(r.invoices), r.revenue.toFixed(2), r.collected.toFixed(2), r.due.toFixed(2), r.profit.toFixed(2), r.expenses.toFixed(2)]));
      case 'low_stock':
        return downloadCsv(file, ['Product', 'SKU', 'Category', 'Stock', 'Alert Qty', 'Purchase Price', 'Sale Price'], data.lowStockReport.map((r) => [r.name, r.sku, r.category_name, String(r.quantity), String(r.alert_quantity), r.purchase_price.toFixed(2), r.selling_price.toFixed(2)]));
      case 'top_customer':
        return downloadCsv(file, ['Customer', 'Phone', 'Invoices', 'Total Spent', 'Paid', 'Due'], data.topCustomers.map((r) => [r.name, r.phone, String(r.invoices), r.total_spent.toFixed(2), r.paid.toFixed(2), r.due.toFixed(2)]));
      case 'top_product':
        return downloadCsv(file, ['Product', 'SKU', 'Category', 'Qty Sold', 'Revenue', 'Profit'], data.topProducts.map((r) => [r.name, r.sku, r.category_name, String(r.qty_sold), r.revenue.toFixed(2), r.profit.toFixed(2)]));
      case 'top_product_all':
        return downloadCsv(file, ['Product', 'SKU', 'Category', 'Qty Sold', 'Revenue', 'Profit'], data.topProductsAllTime.map((r) => [r.name, r.sku, r.category_name, String(r.qty_sold), r.revenue.toFixed(2), r.profit.toFixed(2)]));
      case 'category_wise':
        return downloadCsv(file, ['Category', 'SKUs', 'Current Stock', 'Qty Sold', 'Sales Revenue', 'Est. Profit'], data.categoryWiseReport.map((r) => [r.category, String(r.product_count), String(r.stock_qty), String(r.qty_sold), r.sales_revenue.toFixed(2), r.estimated_profit.toFixed(2)]));
      case 'summary':
        return downloadCsv(file, ['Metric', 'Value'], [
          ['Total Revenue', data.summaryReport.total_revenue.toFixed(2)],
          ['Total Gross Profit', data.summaryReport.total_profit.toFixed(2)],
          ['Total Purchases', data.summaryReport.total_purchases.toFixed(2)],
          ['Total Expenses', data.summaryReport.total_expenses.toFixed(2)],
          ['Customer Due', data.summaryReport.customer_due_total.toFixed(2)],
          ['Supplier Due', data.summaryReport.supplier_due_total.toFixed(2)],
          ['Bank Balance', data.summaryReport.bank_balance.toFixed(2)],
          ['Cash Balance', data.summaryReport.cash_balance.toFixed(2)],
          ['Stock Cost Value', data.summaryReport.stock_cost_value.toFixed(2)],
          ['Stock Retail Value', data.summaryReport.stock_retail_value.toFixed(2)],
        ]);
      default:
        return downloadCsv(file, ['Line Item', 'Amount'], [
          ['Sales Revenue', data.summary.revenue.toFixed(2)],
          ['COGS', data.summary.purchaseCost.toFixed(2)],
          ['Gross Profit', data.summary.profit.toFixed(2)],
          ['Expenses', data.expensesTotal.toFixed(2)],
          ['Damages', data.damagesTotal.toFixed(2)],
          ['Net Profit', data.netProfit.toFixed(2)],
        ]);
    }
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center justify-between gap-4 text-sm text-red-700">
        <span>{error}</span>
        <button type="button" onClick={load} className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer shrink-0">
          Retry
        </button>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="h-48 bg-white border border-slate-200 rounded-[20px] animate-pulse" />;
  }

  if (!data) return null;

  const currentTabMeta = REPORT_TABS.find((t) => t.key === activeReport) ?? REPORT_TABS[3];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            className="w-11 h-11 sm:w-[50px] sm:h-[50px] shrink-0 rounded-xl flex items-center justify-center text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] truncate">Business Reports</h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              {currentTabMeta.label} &bull; {data.from} to {data.to}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-slate-200 bg-white text-slate-700 hover:border-indigo-500 hover:text-indigo-600 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-white text-xs font-semibold shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="no-print bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs p-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] mb-1">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] text-xs text-[#334155] focus:outline-none focus:border-[#4f46e5]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#64748b] mb-1">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] text-xs text-[#334155] focus:outline-none focus:border-[#4f46e5]" />
          </div>
        </div>
        <div className="text-xs text-[#64748b]">
          Showing <strong className="text-[#0f172a]">{currentTabMeta.label}</strong>
        </div>
      </div>

      {/* All 13 Report Tabs */}
      <div className="no-print bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs p-2.5 flex flex-wrap gap-1.5">
        {REPORT_TABS.map((rt) => {
          const Icon = rt.icon;
          const isSel = rt.key === activeReport;
          return (
            <button
              key={rt.key}
              type="button"
              onClick={() => setActiveReport(rt.key)}
              style={isSel ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer ${
                isSel
                  ? 'text-white shadow-[0_4px_12px_rgba(79,70,229,0.28)]'
                  : 'text-[#475569] bg-slate-50/70 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{rt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Report Body */}
      {activeReport === 'customer_due' && (
        <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#1e293b]">Customer Due Report ({data.customerDues.length} Customers)</h3>
            <span className="text-xs font-bold text-red-600 tabular-nums">
              Total Receivable Due: {formatMoney(data.customerDues.reduce((s, r) => s + r.due, 0), currency)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2.5 px-4 text-left">#</th>
                  <th className="py-2.5 px-4 text-left">Customer</th>
                  <th className="py-2.5 px-4 text-left">Phone</th>
                  <th className="py-2.5 px-4 text-center">Invoices</th>
                  <th className="py-2.5 px-4 text-right">Billed</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Due Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.customerDues.map((r, i) => (
                  <tr key={r.id} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{r.name}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{r.phone || '—'}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{r.invoices}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{formatMoney(r.total_billed, currency)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(r.paid, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-red-600 tabular-nums">{formatMoney(r.due, currency)}</td>
                  </tr>
                ))}
                {data.customerDues.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">No outstanding customer receivables.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'supplier_due' && (
        <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#1e293b]">Supplier Due Report ({data.supplierDues.length} Suppliers)</h3>
            <span className="text-xs font-bold text-amber-700 tabular-nums">
              Total Payable Due: {formatMoney(data.supplierDues.reduce((s, r) => s + r.due, 0), currency)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2.5 px-4 text-left">#</th>
                  <th className="py-2.5 px-4 text-left">Supplier</th>
                  <th className="py-2.5 px-4 text-left">Phone</th>
                  <th className="py-2.5 px-4 text-center">Purchases</th>
                  <th className="py-2.5 px-4 text-right">Total Billed</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Due Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.supplierDues.map((r, i) => (
                  <tr key={r.id} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{r.name}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{r.phone || '—'}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{r.purchases}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{formatMoney(r.total_billed, currency)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(r.paid, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-amber-700 tabular-nums">{formatMoney(r.due, currency)}</td>
                  </tr>
                ))}
                {data.supplierDues.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">No outstanding supplier payables.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'purchase' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Total Purchases</div><div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{data.purchaseSummary.count} Invoices</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Purchase Amount</div><div className="text-lg font-bold text-indigo-700 mt-1 tabular-nums">{formatMoney(data.purchaseSummary.total, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Paid to Suppliers</div><div className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">{formatMoney(data.purchaseSummary.paid, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Supplier Due</div><div className="text-lg font-bold text-red-600 mt-1 tabular-nums">{formatMoney(data.purchaseSummary.due, currency)}</div></div>
          </div>
          <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Purchase Ledger ({data.from} – {data.to})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <tr><th className="py-2.5 px-4 text-left">#</th><th className="py-2.5 px-4 text-left">Invoice No</th><th className="py-2.5 px-4 text-left">Date</th><th className="py-2.5 px-4 text-left">Supplier</th><th className="py-2.5 px-4 text-right">Total</th><th className="py-2.5 px-4 text-right">Paid</th><th className="py-2.5 px-4 text-right">Due</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.purchaseReport.map((r, i) => (
                    <tr key={r.id} className="hover:bg-[#f8fafc]">
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-indigo-700">{r.invoice_no}</td>
                      <td className="py-2.5 px-4 text-slate-600 tabular-nums">{r.date}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{r.supplier_name}</td>
                      <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatMoney(r.total, currency)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(r.paid, currency)}</td>
                      <td className={`py-2.5 px-4 text-right font-semibold tabular-nums ${r.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(r.due, currency)}</td>
                    </tr>
                  ))}
                  {data.purchaseReport.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">No purchases found in this range.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeReport === 'profit_loss' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Sales Revenue ({data.summary.invoiceCount})</div><div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{formatMoney(data.summary.revenue, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Purchase COGS</div><div className="text-lg font-bold text-slate-700 mt-1 tabular-nums">{formatMoney(data.summary.purchaseCost, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Gross Profit</div><div className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">{formatMoney(data.summary.profit, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Expenses &amp; Damages</div><div className="text-lg font-bold text-amber-600 mt-1 tabular-nums">{formatMoney(data.expensesTotal + data.damagesTotal, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Net Profit</div><div className={`text-lg font-bold mt-1 tabular-nums ${data.netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatMoney(data.netProfit, currency)}</div></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Profit &amp; Loss Statement</div>
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-100">
                  <tr><td className="py-3 px-5 text-slate-600">Total Sales Revenue</td><td className="py-3 px-5 text-right font-semibold tabular-nums">{formatMoney(data.summary.revenue, currency)}</td></tr>
                  <tr><td className="py-3 px-5 text-slate-600">Cost of Goods Sold (COGS)</td><td className="py-3 px-5 text-right font-semibold text-slate-700 tabular-nums">{formatMoney(data.summary.purchaseCost, currency)}</td></tr>
                  <tr><td className="py-3 px-5 text-slate-600">Discounts Given</td><td className="py-3 px-5 text-right font-semibold text-slate-500 tabular-nums">{formatMoney(data.summary.discount, currency)}</td></tr>
                  <tr className="bg-emerald-50/50"><td className="py-3 px-5 font-bold text-emerald-800">Gross Profit</td><td className="py-3 px-5 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(data.summary.profit, currency)}</td></tr>
                  <tr><td className="py-3 px-5 text-slate-600">Operating Expenses</td><td className="py-3 px-5 text-right font-semibold text-amber-700 tabular-nums">- {formatMoney(data.expensesTotal, currency)}</td></tr>
                  <tr><td className="py-3 px-5 text-slate-600">Damaged Stock Loss</td><td className="py-3 px-5 text-right font-semibold text-red-600 tabular-nums">- {formatMoney(data.damagesTotal, currency)}</td></tr>
                  <tr><td className="py-3 px-5 text-slate-600">Sales Returns (Reference)</td><td className="py-3 px-5 text-right font-medium text-slate-500 tabular-nums">{formatMoney(data.returnsTotal, currency)}</td></tr>
                  <tr className="bg-indigo-50/60"><td className="py-3.5 px-5 font-bold text-slate-900">Net Profit</td><td className={`py-3.5 px-5 text-right text-base font-extrabold tabular-nums ${data.netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatMoney(data.netProfit, currency)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Expense Breakdown by Category</div>
              <table className="w-full text-[13px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <tr><th className="py-2.5 px-5 text-left">Category</th><th className="py-2.5 px-5 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.expenseBreakdown.map((ex) => (
                    <tr key={ex.category}><td className="py-2.5 px-5 font-medium text-slate-700">{ex.category}</td><td className="py-2.5 px-5 text-right font-semibold text-amber-700 tabular-nums">{formatMoney(ex.amount, currency)}</td></tr>
                  ))}
                  {data.expenseBreakdown.length === 0 && (
                    <tr><td colSpan={2} className="py-8 text-center text-slate-400">No expenses recorded in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeReport === 'today' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Invoices Today</div><div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{data.todayReport.sales_count}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Today Sales</div><div className="text-lg font-bold text-indigo-700 mt-1 tabular-nums">{formatMoney(data.todayReport.revenue, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Collected</div><div className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">{formatMoney(data.todayReport.collected, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Today Due</div><div className="text-lg font-bold text-red-600 mt-1 tabular-nums">{formatMoney(data.todayReport.due, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Today Profit</div><div className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">{formatMoney(data.todayReport.profit, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Today Expense</div><div className="text-lg font-bold text-amber-700 mt-1 tabular-nums">{formatMoney(data.todayReport.expenses, currency)}</div></div>
          </div>
          <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Today&apos;s Invoices ({data.todayReport.date})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <tr><th className="py-2.5 px-4 text-left">#</th><th className="py-2.5 px-4 text-left">Invoice</th><th className="py-2.5 px-4 text-left">Customer</th><th className="py-2.5 px-4 text-right">Amount</th><th className="py-2.5 px-4 text-right">Paid</th><th className="py-2.5 px-4 text-right">Due</th><th className="py-2.5 px-4 text-right">Profit</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.todayReport.invoices.map((inv, i) => (
                    <tr key={inv.invoice_no + i} className="hover:bg-[#f8fafc]">
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-indigo-700">{inv.invoice_no}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">{inv.customer_name}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{formatMoney(inv.receivable, currency)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(inv.paid, currency)}</td>
                      <td className={`py-2.5 px-4 text-right tabular-nums ${inv.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(inv.due, currency)}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700 tabular-nums">{formatMoney(inv.profit, currency)}</td>
                    </tr>
                  ))}
                  {data.todayReport.invoices.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">No sales invoices recorded today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeReport === 'current_month' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Invoices ({data.currentMonthReport.month})</div><div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{data.currentMonthReport.sales_count}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Month Revenue</div><div className="text-lg font-bold text-indigo-700 mt-1 tabular-nums">{formatMoney(data.currentMonthReport.revenue, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Collected</div><div className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">{formatMoney(data.currentMonthReport.collected, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Month Profit</div><div className="text-lg font-bold text-emerald-700 mt-1 tabular-nums">{formatMoney(data.currentMonthReport.profit, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Purchases</div><div className="text-lg font-bold text-slate-700 mt-1 tabular-nums">{formatMoney(data.currentMonthReport.purchases, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Expenses</div><div className="text-lg font-bold text-amber-700 mt-1 tabular-nums">{formatMoney(data.currentMonthReport.expenses, currency)}</div></div>
          </div>
          <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Daily Breakdown — {data.currentMonthReport.month}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <tr><th className="py-2.5 px-4 text-left">Date</th><th className="py-2.5 px-4 text-center">Invoices</th><th className="py-2.5 px-4 text-right">Revenue</th><th className="py-2.5 px-4 text-right">Collected</th><th className="py-2.5 px-4 text-right">Due</th><th className="py-2.5 px-4 text-right">Profit</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.currentMonthReport.daily_rows.map((r) => (
                    <tr key={r.date} className="hover:bg-[#f8fafc]">
                      <td className="py-2.5 px-4 font-semibold text-slate-800 tabular-nums">{r.date}</td>
                      <td className="py-2.5 px-4 text-center tabular-nums">{r.invoices}</td>
                      <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatMoney(r.revenue, currency)}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(r.collected, currency)}</td>
                      <td className="py-2.5 px-4 text-right text-red-600 tabular-nums">{formatMoney(r.due, currency)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(r.profit, currency)}</td>
                    </tr>
                  ))}
                  {data.currentMonthReport.daily_rows.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">No sales in current month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeReport === 'summary' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">All-Time Revenue</div><div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{formatMoney(data.summaryReport.total_revenue, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">All-Time Gross Profit</div><div className="text-lg font-bold text-emerald-600 mt-1 tabular-nums">{formatMoney(data.summaryReport.total_profit, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Stock Valuation (Cost)</div><div className="text-lg font-bold text-indigo-700 mt-1 tabular-nums">{formatMoney(data.summaryReport.stock_cost_value, currency)}</div></div>
            <div className="bg-white rounded-xl border border-[#f1f5f9] p-4 shadow-xs"><div className="text-[11px] font-bold uppercase text-slate-500">Stock Valuation (Retail)</div><div className="text-lg font-bold text-violet-700 mt-1 tabular-nums">{formatMoney(data.summaryReport.stock_retail_value, currency)}</div></div>
          </div>
          <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Overall Business Summary</div>
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-slate-100">
                <tr><td className="py-3 px-5 text-slate-600">Total All-Time Sales Revenue</td><td className="py-3 px-5 text-right font-bold tabular-nums">{formatMoney(data.summaryReport.total_revenue, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Total All-Time Gross Profit</td><td className="py-3 px-5 text-right font-bold text-emerald-600 tabular-nums">{formatMoney(data.summaryReport.total_profit, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Total Purchases</td><td className="py-3 px-5 text-right font-semibold tabular-nums">{formatMoney(data.summaryReport.total_purchases, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Total Expenses</td><td className="py-3 px-5 text-right font-semibold text-amber-700 tabular-nums">{formatMoney(data.summaryReport.total_expenses, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Total Customer Due Receivable</td><td className="py-3 px-5 text-right font-bold text-red-600 tabular-nums">{formatMoney(data.summaryReport.customer_due_total, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Total Supplier Due Payable</td><td className="py-3 px-5 text-right font-bold text-amber-700 tabular-nums">{formatMoney(data.summaryReport.supplier_due_total, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Bank Accounts Balance</td><td className="py-3 px-5 text-right font-bold text-indigo-700 tabular-nums">{formatMoney(data.summaryReport.bank_balance, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Cash Book Net Balance</td><td className="py-3 px-5 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(data.summaryReport.cash_balance, currency)}</td></tr>
                <tr><td className="py-3 px-5 text-slate-600">Active Products / Customers / Suppliers</td><td className="py-3 px-5 text-right font-semibold tabular-nums">{data.summaryReport.active_products} SKUs / {data.summaryReport.total_customers} Customers / {data.summaryReport.total_suppliers} Suppliers</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeReport === 'daily' && (
        <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Daily Report ({data.from} to {data.to})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <tr><th className="py-2.5 px-4 text-left">Date</th><th className="py-2.5 px-4 text-center">Invoices</th><th className="py-2.5 px-4 text-right">Sales</th><th className="py-2.5 px-4 text-right">Collected</th><th className="py-2.5 px-4 text-right">Due</th><th className="py-2.5 px-4 text-right">Profit</th><th className="py-2.5 px-4 text-right">Expenses</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.dailyReport.map((r) => (
                  <tr key={r.date} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-4 font-semibold text-slate-800 tabular-nums">{r.date}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{r.invoices}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatMoney(r.revenue, currency)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(r.collected, currency)}</td>
                    <td className="py-2.5 px-4 text-right text-red-600 tabular-nums">{formatMoney(r.due, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(r.profit, currency)}</td>
                    <td className="py-2.5 px-4 text-right text-amber-700 tabular-nums">{formatMoney(r.expenses, currency)}</td>
                  </tr>
                ))}
                {data.dailyReport.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">No daily records in selected range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'low_stock' && (
        <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Low Stock &amp; Out of Stock Products ({data.lowStockReport.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <tr><th className="py-2.5 px-4 text-left">#</th><th className="py-2.5 px-4 text-left">Product</th><th className="py-2.5 px-4 text-left">SKU</th><th className="py-2.5 px-4 text-left">Category</th><th className="py-2.5 px-4 text-center">Stock</th><th className="py-2.5 px-4 text-center">Alert Qty</th><th className="py-2.5 px-4 text-right">Purchase Price</th><th className="py-2.5 px-4 text-right">Sale Price</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lowStockReport.map((r, i) => (
                  <tr key={r.id} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{r.name}</td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">{r.sku || 'N/A'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.category_name}</td>
                    <td className="py-2.5 px-4 text-center"><span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${r.quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{r.quantity}</span></td>
                    <td className="py-2.5 px-4 text-center text-slate-500 tabular-nums">{r.alert_quantity}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{formatMoney(r.purchase_price, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatMoney(r.selling_price, currency)}</td>
                  </tr>
                ))}
                {data.lowStockReport.length === 0 && (
                  <tr><td colSpan={8} className="py-10 text-center text-emerald-600 font-medium">All active products are well stocked!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'top_customer' && (
        <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Top Customers ({data.from} to {data.to})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <tr><th className="py-2.5 px-4 text-left">#</th><th className="py-2.5 px-4 text-left">Customer</th><th className="py-2.5 px-4 text-left">Phone</th><th className="py-2.5 px-4 text-center">Invoices</th><th className="py-2.5 px-4 text-right">Total Spent</th><th className="py-2.5 px-4 text-right">Paid</th><th className="py-2.5 px-4 text-right">Due</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.topCustomers.map((r, i) => (
                  <tr key={r.name + i} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{r.name}</td>
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{r.phone || '—'}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{r.invoices}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-indigo-700 tabular-nums">{formatMoney(r.total_spent, currency)}</td>
                    <td className="py-2.5 px-4 text-right text-emerald-600 tabular-nums">{formatMoney(r.paid, currency)}</td>
                    <td className={`py-2.5 px-4 text-right tabular-nums ${r.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(r.due, currency)}</td>
                  </tr>
                ))}
                {data.topCustomers.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">No customer sales in selected period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeReport === 'top_product' || activeReport === 'top_product_all') && (() => {
        const rows = activeReport === 'top_product_all' ? data.topProductsAllTime : data.topProducts;
        return (
          <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">
              {activeReport === 'top_product_all' ? 'Top Selling Products (All Time)' : `Top Selling Products (${data.from} to ${data.to})`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                  <tr><th className="py-2.5 px-4 text-left">#</th><th className="py-2.5 px-4 text-left">Product</th><th className="py-2.5 px-4 text-left">SKU</th><th className="py-2.5 px-4 text-left">Category</th><th className="py-2.5 px-4 text-center">Qty Sold</th><th className="py-2.5 px-4 text-right">Revenue</th><th className="py-2.5 px-4 text-right">Est. Profit</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={r.name + i} className="hover:bg-[#f8fafc]">
                      <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{r.name}</td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">{r.sku || 'N/A'}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.category_name}</td>
                      <td className="py-2.5 px-4 text-center"><span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs tabular-nums">{r.qty_sold}</span></td>
                      <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatMoney(r.revenue, currency)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(r.profit, currency)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">No product sales recorded for this view.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeReport === 'category_wise' && (
        <div className="bg-white rounded-[20px] border border-[#f1f5f9] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] font-bold text-sm text-[#1e293b]">Category Wise Sales &amp; Stock Report ({data.from} to {data.to})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#64748b] border-b border-[#e2e8f0]">
                <tr><th className="py-2.5 px-4 text-left">#</th><th className="py-2.5 px-4 text-left">Category</th><th className="py-2.5 px-4 text-center">Active SKUs</th><th className="py-2.5 px-4 text-center">Current Stock</th><th className="py-2.5 px-4 text-center">Qty Sold</th><th className="py-2.5 px-4 text-right">Sales Revenue</th><th className="py-2.5 px-4 text-right">Est. Profit</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.categoryWiseReport.map((r, i) => (
                  <tr key={r.category} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-4 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{r.category}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{r.product_count}</td>
                    <td className="py-2.5 px-4 text-center tabular-nums">{r.stock_qty}</td>
                    <td className="py-2.5 px-4 text-center font-semibold text-indigo-700 tabular-nums">{r.qty_sold}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatMoney(r.sales_revenue, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-700 tabular-nums">{formatMoney(r.estimated_profit, currency)}</td>
                  </tr>
                ))}
                {data.categoryWiseReport.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-slate-400">No categories available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
