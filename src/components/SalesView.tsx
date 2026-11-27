import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileText,
  List,
  MoreVertical,
  Phone,
  PlusCircle,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiFetch, formatMoney } from '../lib/api.ts';
import { PaginationBar } from './PaginationBar.tsx';
import type { BankAccount, Sale } from '../types/pos.ts';

interface SalesViewProps {
  currency: string;
  accounts: BankAccount[];
  onOpenInvoice: (saleId: number, autoPrint?: boolean) => void;
  onNewSale: () => void;
  onRefreshBootstrap: () => void;
}

function formatSaleDate(dateStr?: string) {
  if (!dateStr) return { date: '—', time: '' };
  const parsed = new Date(dateStr.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return { date: dateStr.slice(0, 10), time: '' };
  const date = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = dateStr.includes(':')
    ? parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '12:00 PM';
  return { date, time };
}

export function SalesView({
  currency,
  accounts,
  onOpenInvoice,
  onNewSale,
  onRefreshBootstrap,
}: SalesViewProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedSales, setExpandedSales] = useState<Record<number, boolean>>({});
  const [openMenu, setOpenMenu] = useState<{ id: number; top: number; left: number } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Payment Modal State
  const [collectSale, setCollectSale] = useState<Sale | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [collectAccount, setCollectAccount] = useState(String(accounts[0]?.id ?? ''));
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo] = useState('');
  const [note, setNote] = useState('');
  const [collectError, setCollectError] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadSales() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (query.trim()) params.set('q', query.trim());
    if (statusFilter) params.set('payment_status', statusFilter);

    apiFetch<{ items: Sale[]; total: number }>(`/api/sales?${params.toString()}`)
      .then((res) => {
        if (res.items.length === 0 && res.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(res.total / limit)));
          return;
        }
        setSales(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load sales.' });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSales();
  }, [page, limit, query, statusFilter]);

  useEffect(() => {
    if (!accounts.length) {
      setCollectAccount('');
      return;
    }
    const exists = accounts.some((a) => String(a.id) === collectAccount);
    if (!exists) {
      setCollectAccount(String(accounts[0].id));
    }
  }, [accounts, collectAccount]);

  useEffect(() => {
    function closeMenus() {
      setOpenMenu(null);
    }
    document.addEventListener('click', closeMenus);
    window.addEventListener('scroll', closeMenus, true);
    return () => {
      document.removeEventListener('click', closeMenus);
      window.removeEventListener('scroll', closeMenus, true);
    };
  }, []);

  async function submitCollect(e: React.FormEvent) {
    e.preventDefault();
    if (!collectSale) return;
    const amt = Number(collectAmount);
    const maxDue = Number(collectSale.due ?? 0);
    if (!Number.isFinite(amt) || amt <= 0 || amt > maxDue + 0.009) {
      setCollectError(`Amount must be between 0.01 and ${formatMoney(maxDue, currency)}`);
      return;
    }
    setCollectError('');
    setPaySubmitting(true);
    try {
      await apiFetch(`/api/sales/${collectSale.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          account_id: collectAccount ? Number(collectAccount) : null,
          payment_method: paymentMethod,
          payment_date: paymentDate,
          reference_no: referenceNo.trim() || null,
          note: note.trim() || 'Due collection',
        }),
      });
      setCollectSale(null);
      setReferenceNo('');
      setNote('');
      setToast({ type: 'success', message: 'Payment recorded successfully!' });
      loadSales();
      onRefreshBootstrap();
    } catch (err) {
      setCollectError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function confirmDeleteSale() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/sales/${deleteTarget.id}`, { method: 'DELETE' });
      setToast({
        type: 'success',
        message: `Sale ${deleteTarget.invoice_no} deleted and product stock restored.`,
      });
      setDeleteTarget(null);
      loadSales();
      onRefreshBootstrap();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to delete sale.' });
    } finally {
      setDeleting(false);
    }
  }

  const offset = (page - 1) * limit;

  const now = new Date();
  const dateDisplay = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeDisplay = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-l-4 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
              : 'bg-red-50 border-red-500 text-red-800'
          }`}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modern Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div
            className="w-11 h-11 sm:w-[52px] sm:h-[52px] rounded-xl flex items-center justify-center text-white shadow-[0_8px_24px_rgba(79,70,229,0.3)] shrink-0"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight truncate">Sales Management</h1>
            <p className="text-xs sm:text-[13px] text-[#64748b] flex flex-wrap items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" /> {dateDisplay} &bull; <Clock className="w-3.5 h-3.5 shrink-0" /> {timeDisplay}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewSale}
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-[10px] text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(79,70,229,0.4)] transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 shrink-0" /> New Sale
        </button>
      </div>

      {/* Live Search Card */}
      <div className="bg-white rounded-[20px] p-3.5 sm:px-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search by Invoice No, Customer Name, Phone or Product..."
            className="w-full pl-10 pr-4 py-2.5 sm:py-3 border-2 border-[#e2e8f0] rounded-[10px] text-sm text-[#334155] focus:outline-none focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.1)] transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="w-full sm:w-auto px-3.5 py-2.5 sm:py-3 border-2 border-[#e2e8f0] rounded-[10px] text-[13px] font-medium text-[#334155] bg-white focus:outline-none focus:border-[#4f46e5]"
        >
          <option value="">All Status</option>
          <option value="paid">Completed (Paid)</option>
          <option value="partial">Pending (Partial)</option>
          <option value="due">Pending (Due)</option>
        </select>
      </div>

      {/* Sales Table Card */}
      <div className="bg-white rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f1f5f9] overflow-visible">
        <div className="px-5 py-4 border-b border-[#f1f5f9] bg-[#f8fafc] rounded-t-[20px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <List className="w-5 h-5 text-[#4f46e5]" />
            <h3 className="text-base font-semibold text-[#1e293b]">Sales List</h3>
            <span
              className="px-3 py-0.5 rounded-full text-xs font-medium text-white tabular-nums"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            >
              {total.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-[#64748b] flex items-center gap-1.5 tabular-nums">
            <FileText className="w-3.5 h-3.5" />
            Showing {sales.length} of {total.toLocaleString()}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="py-2.5 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] w-9">
                  #
                </th>
                <th className="py-2.5 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Invoice &amp; Date
                </th>
                <th className="py-2.5 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0]">
                  Customer
                </th>
                <th className="py-2.5 px-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] min-w-[175px]">
                  Products
                </th>
                <th className="py-2.5 px-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Amount
                </th>
                <th className="py-2.5 px-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Paid
                </th>
                <th className="py-2.5 px-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Due
                </th>
                <th className="py-2.5 px-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Profit
                </th>
                <th className="py-2.5 px-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Status
                </th>
                <th className="py-2.5 px-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[#64748b] border-b-2 border-[#e2e8f0] whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#f1f5f9]">
                    <td colSpan={10} className="px-3 py-3">
                      <div className="h-5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : sales.length > 0 ? (
                sales.map((sale, idx) => {
                  const due = Number(sale.due ?? 0);
                  const receivable = Number(sale.receivable ?? 0);
                  const purchaseCost = Number(sale.purchase_cost ?? 0);
                  const profitVal =
                    Math.abs(Number(sale.profit ?? 0)) > 0.001
                      ? Number(sale.profit ?? 0)
                      : purchaseCost > 0
                        ? receivable - purchaseCost
                        : 0;
                  const completed = due <= 0;
                  const dt = formatSaleDate(sale.created_at || sale.date);
                  const productsList = sale.products ?? [];
                  const isExpanded = Boolean(expandedSales[sale.id]);
                  const visibleProducts = isExpanded ? productsList : productsList.slice(0, 3);

                  return (
                    <tr key={sale.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors align-top">
                      <td className="py-2.5 px-2.5 text-[#64748b] tabular-nums">{offset + idx + 1}</td>
                      <td className="py-2.5 px-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenInvoice(sale.id)}
                          className="text-[#4f46e5] font-bold text-[12px] hover:underline cursor-pointer block leading-tight text-left"
                        >
                          {sale.invoice_no}
                        </button>
                        <div className="text-[10.5px] text-[#64748b] tabular-nums mt-0.5">
                          {dt.date}{dt.time ? ` · ${dt.time}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <div className="font-semibold text-[#1e293b] leading-tight max-w-[155px] truncate" title={sale.customer_name || 'Walk-in Customer'}>
                          {sale.customer_name || 'Walk-in Customer'}
                        </div>
                        {sale.customer_phone && (
                          <div className="text-[10.5px] text-[#94a3b8] inline-flex items-center gap-1 mt-0.5 tabular-nums">
                            <Phone className="w-2.5 h-2.5" /> {sale.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5">
                        {productsList.length > 0 ? (
                          <div>
                            <ul className="list-disc pl-3.5 space-y-0.5 m-0">
                              {visibleProducts.map((it, i) => (
                                <li key={i} className="text-[11px] text-[#475569] leading-snug">
                                  {it.product_name}{' '}
                                  <span className="text-[#94a3b8] font-medium">×{it.quantity}</span>
                                </li>
                              ))}
                            </ul>
                            {productsList.length > 3 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSales((prev) => ({ ...prev, [sale.id]: !prev[sale.id] }))
                                }
                                className="mt-1 text-[11px] text-[#4f46e5] hover:text-[#4338ca] font-semibold hover:underline cursor-pointer"
                              >
                                {isExpanded ? 'Show less' : `+${productsList.length - 3} more items`}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                        {formatMoney(receivable, currency)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-semibold text-[#10b981] tabular-nums whitespace-nowrap">
                        {formatMoney(sale.paid, currency)}
                      </td>
                      <td
                        className={`py-2.5 px-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                          due > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'
                        }`}
                      >
                        {formatMoney(due, currency)}
                      </td>
                      <td
                        className={`py-2.5 px-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                          profitVal >= 0 ? 'text-[#059669]' : 'text-[#ef4444]'
                        }`}
                      >
                        {formatMoney(profitVal, currency)}
                      </td>
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                            completed
                              ? 'bg-[#d1fae5] text-[#065f46]'
                              : 'bg-[#fee2e2] text-[#991b1b]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              completed ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                            }`}
                          />
                          {completed ? 'Completed' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openMenu?.id === sale.id) {
                              setOpenMenu(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 192;
                            const estimatedHeight = due > 0 ? 168 : 132;
                            const left = Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const top = spaceBelow >= estimatedHeight + 8 ? rect.bottom + 6 : Math.max(12, rect.top - estimatedHeight - 6);
                            setOpenMenu({ id: sale.id, top, left });
                          }}
                          className="p-1.5 rounded-lg text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#4f46e5] cursor-pointer"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-4 h-4 shrink-0" />
                        </button>

                        {openMenu?.id === sale.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ top: openMenu.top, left: openMenu.left }}
                            className="fixed w-48 bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.16)] border border-[#e2e8f0] py-1.5 z-50 text-left"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onOpenInvoice(sale.id, false);
                              }}
                              className="w-full px-4 py-2 text-[13px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#4f46e5] flex items-center gap-2.5 cursor-pointer"
                            >
                              <Eye className="w-4 h-4 shrink-0" /> View Invoice
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onOpenInvoice(sale.id, true);
                              }}
                              className="w-full px-4 py-2 text-[13px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#4f46e5] flex items-center gap-2.5 cursor-pointer"
                            >
                              <Printer className="w-4 h-4 shrink-0" /> Print Invoice
                            </button>
                            {due > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setCollectError('');
                                  setCollectSale(sale);
                                  setCollectAmount(String(due));
                                  setPaymentMethod('cash');
                                  setPaymentDate(new Date().toISOString().slice(0, 10));
                                  setReferenceNo('');
                                  setNote('');
                                }}
                                className="w-full px-4 py-2 text-[13px] text-[#334155] hover:bg-[#f8fafc] hover:text-[#4f46e5] flex items-center gap-2.5 cursor-pointer"
                              >
                                <CreditCard className="w-4 h-4 shrink-0" /> Add Payment
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                setDeleteTarget(sale);
                              }}
                              className="w-full px-4 py-2 text-[13px] text-[#ef4444] hover:bg-[#fee2e2] hover:text-[#dc2626] flex items-center gap-2.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" /> Delete Sale
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <FileText className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-[#334155]">No Sales Found</h3>
                    <p className="text-sm text-[#94a3b8] mt-1">Try adjusting your search or create a new sale.</p>
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

      {/* Add Payment Modal */}
      {collectSale && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCollectSale(null)}
        >
          <div
            className="bg-white rounded-[20px] w-full max-w-[440px] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 pt-5 pb-4 text-center bg-gradient-to-b from-[#f8fafc] to-white border-b border-[#f1f5f9]">
              <div
                className="w-[52px] h-[52px] rounded-full mx-auto mb-2.5 flex items-center justify-center text-white shadow-[0_8px_24px_rgba(79,70,229,0.25)]"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#1e293b]">Add Payment</h3>
              <button
                type="button"
                onClick={() => setCollectSale(null)}
                className="absolute top-3.5 right-4 text-[#94a3b8] hover:text-[#475569] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitCollect} className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {collectError && (
                <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {collectError}
                </div>
              )}

              <div className="bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] rounded-xl p-3.5 border border-[#e2e8f0]">
                <div className="flex justify-between items-center pb-2 mb-1.5 border-b border-[#e2e8f0]">
                  <span className="text-xs font-medium text-[#64748b]">Invoice No</span>
                  <span className="text-sm font-semibold text-[#1e293b]">{collectSale.invoice_no}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-[#64748b]">Remaining Due</span>
                  <span className="text-lg font-bold text-[#ef4444] tabular-nums">
                    {formatMoney(collectSale.due, currency)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(collectSale.due)}
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] text-xl font-bold text-[#1e293b] tabular-nums focus:outline-none focus:border-[#4f46e5]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#4f46e5]"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_banking">Mobile Banking</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Bank Account</label>
                  <select
                    value={collectAccount}
                    onChange={(e) => setCollectAccount(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#4f46e5]"
                  >
                    <option value="">-- Select Account --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1">Reference No</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2.5 border-2 border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#4f46e5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">Note</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional payment note"
                  className="w-full px-3 py-2 border-2 border-[#e2e8f0] rounded-[10px] text-sm focus:outline-none focus:border-[#4f46e5]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCollectSale(null)}
                  className="px-6 py-2.5 rounded-full bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] text-[13px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  className="px-7 py-2.5 rounded-full text-white text-[13px] font-semibold inline-flex items-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.25)] disabled:opacity-60 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {paySubmitting ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-[20px] w-full max-w-sm p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Sale {deleteTarget.invoice_no}?</h3>
                <p className="text-xs text-slate-500">Sold quantities will be restored back into product stock.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteSale}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete & Restore Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
