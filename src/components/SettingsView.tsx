import { useState } from 'react';
import { apiFetch } from '../lib/api.ts';

interface SettingsViewProps {
  settings: Record<string, string>;
  onRefreshBootstrap: () => void;
  onOpenMenuManager?: () => void;
}

export function SettingsView({ settings, onRefreshBootstrap, onOpenMenuManager }: SettingsViewProps) {
  const [form, setForm] = useState({
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
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  }

  return (
    <div className="max-w-3xl bg-white border border-slate-200 rounded-[20px] shadow-xs p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5 pb-4 border-b border-slate-100">
        <h2 className="font-display text-lg font-bold text-slate-900">Dynamic Shop, Branding &amp; Layout Settings</h2>
        <div className="flex items-center gap-2">
          {onOpenMenuManager && (
            <button
              type="button"
              onClick={onOpenMenuManager}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 cursor-pointer"
            >
              Dynamic Menu Manager
            </button>
          )}
          {saved && (
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 shrink-0">
              Settings saved
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <img
              src={form.shop_logo || '/assets/images/logo.jpg'}
              alt="Shop Logo"
              className="w-14 h-14 object-contain bg-white rounded-lg border border-slate-200 p-1 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Shop Logo Path</label>
              <input
                value={form.shop_logo}
                onChange={(e) => setForm({ ...form, shop_logo: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <img
              src={form.shop_favicon || '/assets/images/favicon.png'}
              alt="Favicon"
              className="w-14 h-14 object-contain bg-white rounded-lg border border-slate-200 p-1.5 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Favicon Path</label>
              <input
                value={form.shop_favicon}
                onChange={(e) => setForm({ ...form, shop_favicon: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <img
              src={form.shop_qr || '/assets/images/shop_qr.png'}
              alt="Shop QR Code"
              className="w-14 h-14 object-contain bg-white rounded-lg border border-slate-200 p-1 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Invoice QR Code</label>
              <input
                value={form.shop_qr}
                onChange={(e) => setForm({ ...form, shop_qr: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Shop Name</label>
            <input
              required
              value={form.shop_name}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Currency Symbol</label>
            <input
              required
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone / Cell Number</label>
            <input
              value={form.shop_phone}
              onChange={(e) => setForm({ ...form, shop_phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              value={form.shop_email}
              onChange={(e) => setForm({ ...form, shop_email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input
              value={form.shop_address}
              onChange={(e) => setForm({ ...form, shop_address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
            <input
              value={form.shop_website}
              onChange={(e) => setForm({ ...form, shop_website: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sidebar Theme</label>
            <select
              value={form.sidebar_theme}
              onChange={(e) => setForm({ ...form, sidebar_theme: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="slate">Dark Navy & Gold</option>
              <option value="light">Clean Light</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Primary Accent</label>
            <select
              value={form.primary_color}
              onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="emerald">Indigo / Emerald</option>
              <option value="indigo">Indigo</option>
              <option value="blue">Blue</option>
              <option value="slate">Slate</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Layout Density</label>
            <select
              value={form.layout_mode}
              onChange={(e) => setForm({ ...form, layout_mode: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Invoice Footer / Warranty Note</label>
          <textarea
            rows={2}
            value={form.invoice_footer}
            onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <button
          type="submit"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          className="px-5 py-2.5 rounded-xl text-white font-semibold shadow-sm hover:opacity-95 cursor-pointer"
        >
          Save Dynamic Settings
        </button>
      </form>
    </div>
  );
}
