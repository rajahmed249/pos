import { useEffect } from 'react';
import { ArrowLeft, Printer, X } from 'lucide-react';
import type { Sale, SaleItem } from '../types/pos.ts';

interface InvoiceModalProps {
  sale: Sale;
  items: SaleItem[];
  settings: Record<string, string>;
  autoPrint?: boolean;
  onClose: () => void;
}

function numberToWordsBD(raw: number): string {
  const num = Number(raw);
  if (!Number.isFinite(num)) return 'Zero';
  if (num < 0) return `Negative ${numberToWordsBD(Math.abs(num))}`;

  const dictionary: Record<number, string> = {
    0: 'Zero',
    1: 'One',
    2: 'Two',
    3: 'Three',
    4: 'Four',
    5: 'Five',
    6: 'Six',
    7: 'Seven',
    8: 'Eight',
    9: 'Nine',
    10: 'Ten',
    11: 'Eleven',
    12: 'Twelve',
    13: 'Thirteen',
    14: 'Fourteen',
    15: 'Fifteen',
    16: 'Sixteen',
    17: 'Seventeen',
    18: 'Eighteen',
    19: 'Nineteen',
    20: 'Twenty',
    30: 'Thirty',
    40: 'Forty',
    50: 'Fifty',
    60: 'Sixty',
    70: 'Seventy',
    80: 'Eighty',
    90: 'Ninety',
    100: 'Hundred',
  };

  const twoDigits = (n: number): string => {
    const val = Math.floor(n);
    if (val < 21) return dictionary[val] ?? '';
    const tens = Math.floor(val / 10) * 10;
    const units = val % 10;
    return units ? `${dictionary[tens]}-${dictionary[units]}` : dictionary[tens];
  };

  const integerPart = Math.floor(num);
  const fraction = Math.round((num - integerPart) * 100);

  let str = '';
  if (integerPart === 0) {
    str = 'Zero';
  } else {
    const crore = Math.floor(integerPart / 10000000);
    const lac = Math.floor((integerPart % 10000000) / 100000);
    const thousand = Math.floor((integerPart % 100000) / 1000);
    const hundred = Math.floor((integerPart % 1000) / 100);
    const rest = integerPart % 100;

    const parts: string[] = [];
    if (crore > 0) parts.push(`${numberToWordsBD(crore)} Crore`);
    if (lac > 0) parts.push(`${twoDigits(lac)} Lac`);
    if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
    if (hundred > 0) parts.push(`${dictionary[hundred]} Hundred`);
    if (rest > 0) {
      parts.push(parts.length > 0 ? `and ${twoDigits(rest)}` : twoDigits(rest));
    }
    str = parts.join(' ');
  }

  if (fraction > 0) {
    str += ` point ${twoDigits(fraction)}`;
  }
  return str;
}

function formatInvoiceDate(sale: Sale): string {
  const candidates = [sale.sale_date, sale.date, sale.created_at];
  for (const c of candidates) {
    if (!c) continue;
    const str = String(c).trim();
    if (!str || str.startsWith('0000-00-00')) continue;
    const parsed = new Date(str.includes('T') ? str : str.replace(' ', 'T'));
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 1990) {
      const dd = String(parsed.getDate()).padStart(2, '0');
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const yyyy = parsed.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  }
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
}

function fmtTk(amount: number): string {
  return Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InvoiceModal({ sale, items, settings, autoPrint = false, onClose }: InvoiceModalProps) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [autoPrint, sale.id]);

  const companyName = (settings.shop_name || 'YOUTH IT POS').trim();
  const companyUpper = companyName.toUpperCase();
  const hasYouthIt = companyUpper.includes('YOUTH IT');
  const youthItPart = hasYouthIt ? 'YOUTH IT' : companyUpper;
  const posPart = hasYouthIt ? companyUpper.replace('YOUTH IT', '').trim() : '';

  const companyAddress =
    settings.shop_address ||
    'Shop No.04, (Ground Floor), 820, Makkha Tower, West Shewrapara, Mirpur, Dhaka-1216';
  const companyPhone = settings.shop_phone || '01674297522';
  const companyEmail = settings.shop_email || 'info@youthit.com.bd';
  const companyWebsite = (settings.shop_website || 'www.youthit.com.bd').replace(/^https?:\/\//i, '');

  const rawLogo = settings.shop_logo || '/assets/images/logo.jpg';
  const logoSrc = rawLogo.startsWith('http') || rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`;
  const rawQr =
    settings.shop_qr && !settings.shop_qr.includes('uploads/')
      ? settings.shop_qr
      : '/assets/images/shop_qr.png';
  const qrSrc = rawQr.startsWith('http') || rawQr.startsWith('/') ? rawQr : `/${rawQr}`;

  const calculatedSubtotal = items.reduce((acc, it) => acc + Number(it.total ?? 0), 0);
  const totalAmount = Number(sale.subtotal ?? 0) > 0 ? Number(sale.subtotal) : calculatedSubtotal;
  const vatAmount = Number(sale.vat ?? 0);
  const discountAmount = Number(sale.discount ?? 0);
  const netPayable = Math.max(
    0,
    Number(sale.receivable ?? 0) > 0 && vatAmount === 0 && totalAmount === Number(sale.receivable) + discountAmount
      ? Number(sale.receivable)
      : totalAmount - discountAmount + vatAmount
  );
  const paidAmount = Number(sale.paid ?? 0);
  const dueAmount = Math.max(0, netPayable - paidAmount);
  const previousDue = Number(sale.previous_due ?? 0);

  const rawMethod = sale.payment_method || sale.account_name || 'Cash';
  const paymentMethod = rawMethod.charAt(0).toUpperCase() + rawMethod.slice(1);
  const soldBy = sale.sold_by || 'Youth IT';
  const totalInWords = `${numberToWordsBD(netPayable)} Taka Only`;

  return (
    <div
      className="invoice-print-backdrop fixed inset-0 z-50 bg-[#eef2f6]/95 overflow-y-auto py-7 px-3.5"
      onClick={onClose}
    >
      <div
        className="invoice-print-wrapper max-w-[1000px] mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Utility Bar */}
        <div className="no-print flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-semibold text-slate-600">
            Invoice Preview · <span className="font-mono text-[#065AA4]">{sale.invoice_no}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>

        {/* Invoice Card (matches invoice_c27fdf21.php) */}
        <div
          className="invoice-print-card bg-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden text-[#1e293b]"
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          {/* Header Section */}
          <div className="px-[25px] py-[18px] border-b-2 border-[#eef2f6] relative">
            <div className="flex justify-between items-center gap-4">
              {/* Company Logo */}
              <div className="shrink-0 w-[100px]">
                <img
                  src={logoSrc}
                  alt="Youth IT Logo"
                  className="max-h-[70px] max-w-[90px] w-auto h-auto object-contain"
                />
              </div>

              {/* Centered QR Code Image */}
              <div className="hidden sm:block print:block sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                <div className="w-[74px] h-[74px] bg-white flex items-center justify-center border border-[#cbd5e1] rounded-[8px] p-1 overflow-hidden">
                  <img
                    src={qrSrc}
                    alt="Shop QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Company Details */}
              <div className="text-right flex-1">
                <h1 className="m-0 text-[22px] sm:text-[24px] font-extrabold tracking-[1px] leading-tight">
                  <span style={{ color: '#065AA4' }}>{youthItPart}</span>
                  {posPart && <span style={{ color: '#1e293b' }}> {posPart}</span>}
                </h1>
                <p className="mt-[6px] mb-0 text-[11px] text-[#64748b] leading-[1.35]">
                  {companyAddress}
                </p>
                <p className="mt-[4px] mb-0 text-[11px] text-[#64748b]">
                  📞 Cell: {companyPhone}
                </p>
                <p className="mt-[4px] mb-0 text-[11px] text-[#64748b]">
                  ✉️ {companyEmail} | 🌐 {companyWebsite}
                </p>
              </div>
            </div>
          </div>

          {/* INVOICE Title Banner */}
          <div
            className="px-[25px] py-[5px] border-b border-[#eef2f6] text-center"
            style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
          >
            <h2 className="m-0 text-[22px] font-extrabold tracking-[2px] text-[#1e293b]">
              INVOICE
            </h2>
          </div>

          {/* To Section */}
          <div className="px-[25px] py-[12px] border-b border-[#eef2f6]">
            <div className="flex justify-between flex-wrap gap-4">
              <div className="flex-1 min-w-[220px]">
                <p className="m-0 text-[13px] font-semibold text-[#1e293b]">To,</p>
                <div className="mt-[5px] text-[12px] text-[#475569] leading-[1.45]">
                  <div className="font-semibold text-[#1e293b]">
                    {sale.customer_name || 'Walk-in Customer'}
                  </div>
                  <div>{sale.customer_address || '—'}</div>
                  <div>{sale.customer_phone || '—'}</div>
                </div>
              </div>

              <div className="text-left">
                <div className="flex items-center mb-1">
                  <span className="text-[12px] font-semibold text-[#1e293b] min-w-[98px]">Invoice No</span>
                  <span className="text-[12px] font-semibold text-[#1e293b] mx-2 min-w-[8px] text-center">:</span>
                  <span className="text-[12px] text-[#475569] font-medium">{sale.invoice_no}</span>
                </div>
                <div className="flex items-center mb-1">
                  <span className="text-[12px] font-semibold text-[#1e293b] min-w-[98px]">Date</span>
                  <span className="text-[12px] font-semibold text-[#1e293b] mx-2 min-w-[8px] text-center">:</span>
                  <span className="text-[12px] text-[#475569]">{formatInvoiceDate(sale)}</span>
                </div>
                <div className="flex items-center mb-1">
                  <span className="text-[12px] font-semibold text-[#1e293b] min-w-[98px]">Sold By</span>
                  <span className="text-[12px] font-semibold text-[#1e293b] mx-2 min-w-[8px] text-center">:</span>
                  <span className="text-[12px] text-[#475569]">{soldBy}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[12px] font-semibold text-[#1e293b] min-w-[98px]">Payment Method</span>
                  <span className="text-[12px] font-semibold text-[#1e293b] mx-2 min-w-[8px] text-center">:</span>
                  <span className="text-[12px] text-[#475569]">{paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="px-[25px] py-[12px] overflow-x-auto">
            <table className="invoice-table w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f1f5f9] border-b-2 border-[#e2e8f0]">
                  <th className="py-[8px] px-[6px] text-center font-semibold text-[#1e293b] w-[40px]">S.N</th>
                  <th className="py-[8px] px-[6px] text-left font-semibold text-[#1e293b] w-[100px]">Component</th>
                  <th className="py-[8px] px-[6px] text-left font-semibold text-[#1e293b]">
                    Product Name &amp; Specification
                  </th>
                  <th className="py-[8px] px-[6px] text-center font-semibold text-[#1e293b] w-[95px]">Warranty</th>
                  <th className="py-[8px] px-[6px] text-center font-semibold text-[#1e293b] w-[55px]">Qty</th>
                  <th className="py-[8px] px-[6px] text-right font-semibold text-[#1e293b] w-[100px]">Unit Price</th>
                  <th className="py-[8px] px-[6px] text-right font-semibold text-[#1e293b] w-[105px]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const warrantyText = (item.warranty || '').trim();
                  const hasWarranty =
                    warrantyText !== '' && warrantyText !== '—' && warrantyText !== 'No Warranty';
                  return (
                    <tr key={item.id ?? idx} className="border-b border-[#f1f5f9]">
                      <td className="py-[6px] px-[6px] text-center">{idx + 1}</td>
                      <td className="py-[6px] px-[6px] text-left text-[#475569]">
                        {item.category_name || 'Electronics'}
                      </td>
                      <td className="py-[6px] px-[6px] text-left">
                        <div className="text-[#1e293b]">{item.product_name}</div>
                        {item.serial_no && (
                          <div className="text-[10px] text-[#2563eb] mt-[3px]">
                            S.N: {item.serial_no}
                          </div>
                        )}
                      </td>
                      <td className="py-[6px] px-[6px] text-center">
                        {hasWarranty ? (
                          <span className="inline-block bg-[#eef2ff] text-[#667eea] px-2 py-0.5 rounded-[12px] text-[10px] font-medium">
                            {warrantyText}
                          </span>
                        ) : (
                          <span className="text-[#94a3b8] text-[10px]">No Warranty</span>
                        )}
                      </td>
                      <td className="py-[6px] px-[6px] text-center tabular-nums">
                        {item.quantity} pc
                      </td>
                      <td className="py-[6px] px-[6px] text-right tabular-nums">
                        {fmtTk(item.price)} Tk
                      </td>
                      <td className="py-[6px] px-[6px] text-right tabular-nums font-medium">
                        {fmtTk(item.total)} Tk
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="px-[25px] py-[10px] bg-white border-t border-[#eef2f6]">
            <div className="flex justify-end">
              <div className="w-[320px]">
                <div className="flex justify-between py-1">
                  <span className="text-[12px] font-medium text-[#475569]">Total Amount</span>
                  <span className="text-[12px] font-semibold text-[#1e293b] tabular-nums">
                    {fmtTk(totalAmount)} Tk
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[12px] font-medium text-[#475569]">Vat, Tax &amp; AIT</span>
                  <span className="text-[12px] font-semibold text-[#1e293b] tabular-nums">
                    {fmtTk(vatAmount)} Tk
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[12px] font-medium text-[#475569]">Discount</span>
                  <span className="text-[12px] font-semibold text-[#ef4444] tabular-nums">
                    - {fmtTk(discountAmount)} Tk
                  </span>
                </div>
                <div className="flex justify-between py-2 mt-1 border-t-2 border-[#e2e8f0]">
                  <span className="text-[12px] font-semibold text-[#1e293b]">Net Payable Amount</span>
                  <span className="text-[12px] font-semibold text-[#667eea] tabular-nums">
                    {fmtTk(netPayable)} Tk
                  </span>
                </div>
                {previousDue > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-[12px] font-medium text-[#475569]">Previous Due Amount</span>
                    <span className="text-[12px] font-semibold text-[#ef4444] tabular-nums">
                      {fmtTk(previousDue)} Tk
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-[12px] font-medium text-[#475569]">Received Amount</span>
                  <span className="text-[12px] font-semibold text-[#10b981] tabular-nums">
                    {fmtTk(paidAmount)} Tk
                  </span>
                </div>
                <div className="flex justify-between py-2 mt-1 border-t border-[#eef2f6]">
                  <span className="text-[12px] font-semibold text-[#1e293b]">Current Due Amount</span>
                  <span className="text-[12px] font-semibold text-[#ef4444] tabular-nums">
                    {fmtTk(dueAmount)} Tk
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div className="px-[25px] py-[10px] bg-white border-b border-[#eef2f6]">
            <p className="m-0 text-[12px] text-[#475569]">
              <strong className="text-[#1e293b]">In words:</strong> {totalInWords}
            </p>
          </div>

          {/* Signature Section */}
          <div className="px-[25px] pt-[15px] pb-[12px] bg-white">
            <div className="flex justify-between flex-wrap gap-6">
              <div className="text-left flex-1">
                <p className="m-0 text-[11px] text-[#64748b]">Customer&apos;s Signature</p>
                <div className="mt-[35px] border-t border-dashed border-[#cbd5e1] w-[180px]" />
              </div>
              <div className="text-right flex-1">
                <p className="m-0 text-[11px] text-[#64748b]">Authority Signature</p>
                <div className="mt-[35px] border-t border-dashed border-[#cbd5e1] w-[180px] ml-auto" />
              </div>
            </div>
          </div>

          {/* Warranty Note Footer */}
          <div className="px-[25px] pt-[8px] pb-[12px] bg-white text-center border-t border-[#eef2f6]">
            <p className="m-0 text-[11px] text-[#94a3b8] italic">
              No warranty will valid upon burn or physical damage cases.
            </p>
          </div>
        </div>

        {/* Bottom Print / Back Buttons */}
        <div className="no-print flex gap-[15px] justify-center mt-[20px]">
          <button
            type="button"
            onClick={() => window.print()}
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            className="inline-flex items-center gap-2 text-white border-0 px-[30px] py-[10px] rounded-[8px] cursor-pointer font-semibold shadow-sm hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)] transition-all"
          >
            <Printer className="w-4 h-4" /> Print Invoice
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0] px-[30px] py-[10px] rounded-[8px] font-semibold hover:bg-[#e2e8f0] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Sales
          </button>
        </div>
      </div>
    </div>
  );
}
