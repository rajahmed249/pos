import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { DynamicMenu } from '../types/pos.ts';

interface MenuManagerViewProps {
  menus: DynamicMenu[];
  onRefreshBootstrap: () => void;
}

const AVAILABLE_ROUTES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'pos', label: 'POS Terminal' },
  { key: 'sales', label: 'Sales & Invoices' },
  { key: 'estimates', label: 'Estimates' },
  { key: 'products', label: 'Products' },
  { key: 'catalog', label: 'Catalog & Warranties' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'accounts', label: 'Bank & Cash Accounts' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'returns', label: 'Returns & Damages' },
  { key: 'reports', label: 'Reports' },
  { key: 'menus', label: 'Menu Manager' },
  { key: 'settings', label: 'Settings & Layout' },
  { key: 'users', label: 'Users & Staff' },
  { key: 'laravel', label: 'Laravel Blade & Export' },
];

export function MenuManagerView({ menus, onRefreshBootstrap }: MenuManagerViewProps) {
  const [form, setForm] = useState({
    title: '',
    group_label: 'Custom',
    route_key: 'dashboard',
    icon: 'circle',
    roles: ['admin', 'manager', 'staff'],
  });

  const sorted = [...menus].sort((a, b) => a.sort_order - b.sort_order);
  const [error, setError] = useState('');

  async function addMenu(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/menus', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          url: `/${form.route_key}`,
          is_active: true,
        }),
      });
      setForm({ ...form, title: '' });
      onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add menu item.');
    }
  }

  async function toggleActive(menu: DynamicMenu) {
    try {
      await apiFetch(`/api/menus/${menu.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !menu.is_active }),
      });
      onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menu.');
    }
  }

  async function moveMenu(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const copy = [...sorted];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    try {
      await apiFetch('/api/menus/reorder', {
        method: 'POST',
        body: JSON.stringify({ ids: copy.map((m) => m.id) }),
      });
      onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder menu.');
    }
  }

  async function deleteMenu(id: number) {
    try {
      await apiFetch(`/api/menus/${id}`, { method: 'DELETE' });
      onRefreshBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete menu.');
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="min-w-0 bg-white border border-slate-200 rounded-lg p-5 h-fit">
          <h2 className="font-display text-sm font-semibold text-slate-900 mb-3">Add Dynamic Sidebar Menu</h2>
          <form onSubmit={addMenu} className="space-y-3 text-sm">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Menu Label</label>
              <input type="text" required placeholder="e.g. Quick Billing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Group Section</label>
              <input type="text" value={form.group_label} onChange={(e) => setForm({ ...form, group_label: e.target.value })} className="w-full px-3 py-1.5 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Target Module Route</label>
              <select value={form.route_key} onChange={(e) => setForm({ ...form, route_key: e.target.value })} className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md">
                {AVAILABLE_ROUTES.map((r) => <option key={r.key} value={r.key}>{r.label} (/{r.key})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Visible Roles</label>
              <div className="flex flex-wrap gap-3 text-xs">
                {(['admin', 'manager', 'staff'] as const).map((r) => (
                  <label key={r} className="inline-flex items-center gap-1.5 capitalize">
                    <input
                      type="checkbox"
                      checked={form.roles.includes(r)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.roles, r]
                          : form.roles.filter((x) => x !== r);
                        setForm({ ...form, roles: next });
                      }}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-md font-medium cursor-pointer">Add Menu Item</button>
          </form>
        </div>

        <div className="lg:col-span-2 min-w-0 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-slate-900">Database Menu Hierarchy ({sorted.length})</h2>
            <span className="text-xs text-slate-500">Changes update the sidebar immediately</span>
          </div>
          <div className="divide-y divide-slate-100">
            {sorted.map((m, idx) => (
              <div key={m.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">{m.title}</div>
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {m.group_label} · /{m.route_key} · {m.roles.join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => moveMenu(idx, -1)} disabled={idx === 0} className="p-1.5 border border-slate-200 rounded disabled:opacity-30 cursor-pointer" title="Move Up">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <button type="button" onClick={() => moveMenu(idx, 1)} disabled={idx === sorted.length - 1} className="p-1.5 border border-slate-200 rounded disabled:opacity-30 cursor-pointer" title="Move Down">
                    <ArrowDown className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(m)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer ${
                      m.is_active ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}
                  >
                    {m.is_active ? 'Visible' : 'Hidden'}
                  </button>
                  {m.route_key !== 'menus' && (
                    <button type="button" onClick={() => deleteMenu(m.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded cursor-pointer" title="Delete">
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
