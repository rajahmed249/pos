import { useState } from 'react';
import { Code2, DatabaseBackup, Download, Upload } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import { LaravelCodeView } from './LaravelCodeView.tsx';

interface BackupRestoreViewProps {
  onRefreshBootstrap: () => void;
}

export function BackupRestoreView({ onRefreshBootstrap }: BackupRestoreViewProps) {
  const [subTab, setSubTab] = useState<'backup' | 'laravel'>('backup');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleFileRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    setRestoring(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const res = await apiFetch<{ products: number; sales: number }>('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ backup: parsed }),
      });
      setNotice({
        type: 'success',
        text: `Backup restored successfully! (${res.products} products, ${res.sales} sales loaded)`,
      });
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Invalid backup file.' });
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <DatabaseBackup className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Backup &amp; Restore</h1>
            <p className="text-xs text-slate-500">Export full database JSON backup, restore records, or export Laravel 13 Blade project</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('backup')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              subTab === 'backup' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            <DatabaseBackup className="w-4 h-4 shrink-0" /> JSON Backup &amp; Restore
          </button>
          <button
            type="button"
            onClick={() => setSubTab('laravel')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              subTab === 'laravel' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            <Code2 className="w-4 h-4 shrink-0" /> Laravel 13 Blade ZIP
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-semibold border ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {subTab === 'backup' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-6 shadow-xs space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">Download Full Database Backup</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Export all products, sales, invoices, customers, suppliers, purchases, accounts, expenses, owners, employees, menus, and settings as a single JSON snapshot.
            </p>
            <a
              href="/api/backup/export"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm"
            >
              <Download className="w-4 h-4 shrink-0" /> Download Backup (.json)
            </a>
          </div>

          <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-6 shadow-xs space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">Restore Database From Backup</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Select a previously downloaded Youth IT POS <code className="bg-slate-100 px-1 rounded">.json</code> backup file to restore all records immediately.
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <Upload className="w-4 h-4 shrink-0" />
              <span>{restoring ? 'Restoring...' : 'Upload & Restore JSON'}</span>
              <input type="file" accept=".json,application/json" onChange={handleFileRestore} className="hidden" disabled={restoring} />
            </label>
          </div>
        </div>
      ) : (
        <LaravelCodeView />
      )}
    </div>
  );
}
