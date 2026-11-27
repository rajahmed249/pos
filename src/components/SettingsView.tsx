import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Globe, Image as ImageIcon, LayoutGrid, Mail, MapPin, Phone, QrCode, Settings as SettingsIcon, Store } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';

interface SettingsViewProps {
  settings: Record<string, string>;
  onRefreshBootstrap: () => void;
  onOpenMenuManager?: () => void;
}

function buildSettingsForm(settings: Record<string, string>) {
  return {
    shop_name: settings.shop_name || 'YOUTH IT POS',
    shop_address:
      settings.shop_address ||
      'Shop No.04, (Ground Floor), 820, Makkha Tower, West Shewrapara, Mirpur, Dhaka-1216',
    shop_phone: settings.shop_phone || '01674297522',
    shop_email: settings.shop_email || 'info@youthit.com.bd',
    shop_website: settings.shop_website || 'www.youthit.com.bd',
    shop_logo: settings.shop_logo || '/assets/images/logo.jpg',
    shop_favicon: settings.shop_favicon || '/assets/images/favicon.png',
    shop_qr:
      settings.shop_qr && !settings.shop_qr.includes('uploads/')
        ? settings.shop_qr
        : '/assets/images/shop_qr.png',
    currency: settings.currency || '৳',
    tax_rate: settings.tax_rate || '0',
    invoice_footer: settings.invoice_footer || 'No warranty will valid upon burn or physical damage cases.',
    sidebar_theme: settings.sidebar_theme || 'slate',
    primary_color: settings.primary_color || 'emerald',
    layout_mode: settings.layout_mode || 'comfortable',
  };
}

export function SettingsView({ settings, onRefreshBootstrap, onOpenMenuManager }: SettingsViewProps) {
  const [form, setForm] = useState(() => buildSettingsForm(settings));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(buildSettingsForm(settings));
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-[0_6px_18px_rgba(79,70,229,0.3)]"
          >
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 truncate">
              Shop, Branding &amp;{' '}
              <span className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] bg-clip-text text-transparent">
                Layout Settings
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Configure store identity, invoice branding, currency, theme &amp; printable receipt layout across full workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenMenuManager && (
            <button
              type="button"
              onClick={onOpenMenuManager}
              className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
            >
              Dynamic Menu Manager
            </button>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> Settings saved
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 text-sm">
        {/* Full-Width Brand Visual Assets Row */}
        <div className="bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                <ImageIcon className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900">Brand Visual Assets</h2>
                <p className="text-[11px] text-slate-500">Storefront logo, browser tab favicon &amp; receipt QR code</p>
              </div>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              <img
                src={form.shop_logo || '/assets/images/logo.jpg'}
                alt="Shop Logo"
                className="w-14 h-14 object-contain bg-white rounded-xl border border-slate-200 p-1 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Logo Path</label>
                <input
                  value={form.shop_logo}
                  onChange={(e) => setForm({ ...form, shop_logo: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              <img
                src={form.shop_favicon || '/assets/images/favicon.png'}
                alt="Favicon"
                className="w-14 h-14 object-contain bg-white rounded-xl border border-slate-200 p-1.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Favicon Path</label>
                <input
                  value={form.shop_favicon}
                  onChange={(e) => setForm({ ...form, shop_favicon: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
              <img
                src={form.shop_qr || '/assets/images/shop_qr.png'}
                alt="Shop QR Code"
                className="w-14 h-14 object-contain bg-white rounded-xl border border-slate-200 p-1 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" /> Invoice QR Code Path
                </label>
                <input
                  value={form.shop_qr}
                  onChange={(e) => setForm({ ...form, shop_qr: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 12-Col Settings Workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left 7 Cols: Storefront & Contact Information */}
          <div className="xl:col-span-7 bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/60 flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
              >
                <Store className="w-4 h-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900">Storefront Identity &amp; Invoice Header</h2>
                <p className="text-[11px] text-slate-500">Printed across POS invoices, estimates &amp; financial reports</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Name *</label>
                  <input
                    required
                    value={form.shop_name}
                    onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Currency *</label>
                  <input
                    required
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default VAT (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.tax_rate}
                    onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / Cell Number</label>
                  <input
                    value={form.shop_phone}
                    onChange={(e) => setForm({ ...form, shop_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    value={form.shop_email}
                    onChange={(e) => setForm({ ...form, shop_email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
                  <input
                    value={form.shop_website}
                    onChange={(e) => setForm({ ...form, shop_website: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Address</label>
                <input
                  value={form.shop_address}
                  onChange={(e) => setForm({ ...form, shop_address: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Footer / Warranty Note</label>
                <textarea
                  rows={2}
                  value={form.invoice_footer}
                  onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Appearance Preferences + Live Receipt Header Preview */}
          <div className="xl:col-span-5 flex flex-col gap-5">
            <div className="bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-violet-50/60 flex items-center gap-2.5">
                <span
                  className="w-8 h-8 rounded-lg text-white flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  <LayoutGrid className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="font-display text-sm font-bold text-slate-900">Appearance &amp; Workspace Layout</h2>
                  <p className="text-[11px] text-slate-500">Customize sidebar palette, accent &amp; density</p>
                </div>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sidebar Theme</label>
                  <select
                    value={form.sidebar_theme}
                    onChange={(e) => setForm({ ...form, sidebar_theme: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="slate">Dark Navy &amp; Gold</option>
                    <option value="light">Clean Light</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Accent</label>
                  <select
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="emerald">Indigo / Emerald</option>
                    <option value="indigo">Indigo</option>
                    <option value="blue">Blue</option>
                    <option value="slate">Slate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Layout Density</label>
                  <select
                    value={form.layout_mode}
                    onChange={(e) => setForm({ ...form, layout_mode: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-white outline-none focus:border-indigo-500"
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Live Receipt Header Preview */}
            <div className="bg-white border border-slate-200/90 rounded-[20px] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden flex-1 flex flex-col justify-between">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-600" /> Live Invoice Header Preview
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10.5px] font-semibold">
                  {form.currency} · {form.layout_mode}
                </span>
              </div>
              <div className="p-5 flex items-start gap-3.5 bg-gradient-to-br from-slate-50/60 to-white flex-1">
                <img
                  src={form.shop_logo || '/assets/images/logo.jpg'}
                  alt="Preview Logo"
                  className="w-12 h-12 rounded-xl border border-slate-200 bg-white object-contain p-1 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-display text-sm font-extrabold text-slate-900 truncate">
                    {form.shop_name || 'YOUTH IT POS'}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-start gap-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                    <span className="line-clamp-2">{form.shop_address || 'Store address'}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 pt-0.5">
                    {form.shop_phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" /> {form.shop_phone}
                      </span>
                    )}
                    {form.shop_email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" /> {form.shop_email}
                      </span>
                    )}
                    {form.shop_website && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-400" /> {form.shop_website}
                      </span>
                    )}
                  </div>
                  {form.invoice_footer && (
                    <div className="pt-2 mt-2 border-t border-dashed border-slate-200 text-[10.5px] italic text-slate-400">
                      “{form.invoice_footer}”
                    </div>
                  )}
                </div>
                <img
                  src={form.shop_qr || '/assets/images/shop_qr.png'}
                  alt="QR Preview"
                  className="w-11 h-11 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shrink-0"
                />
              </div>

              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex justify-end">
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold shadow-[0_6px_16px_rgba(79,70,229,0.28)] hover:opacity-95 transition cursor-pointer"
                >
                  Save Dynamic Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
