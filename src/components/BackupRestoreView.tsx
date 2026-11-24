import { useState } from 'react';
import { AlertTriangle, Archive, Code2, Database, DatabaseBackup, Download, FileCode, FileUp, Trash2, Upload } from 'lucide-react';
import { apiDownload, apiFetch } from '../lib/api.ts';
import { LaravelCodeView } from './LaravelCodeView.tsx';

interface BackupRestoreViewProps {
  onRefreshBootstrap: () => void;
}

export function BackupRestoreView({ onRefreshBootstrap }: BackupRestoreViewProps) {
  const [subTab, setSubTab] = useState<'backup' | 'laravel'>('backup');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [importingSql, setImportingSql] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<'full-zip' | 'laravel-zip' | 'sql' | 'json' | null>(null);

  async function triggerDownload(
    key: 'full-zip' | 'laravel-zip' | 'sql' | 'json',
    url: string,
    filename: string
  ) {
    setNotice(null);
    setDownloadingKey(key);
    try {
      await apiDownload(url, filename);
      setNotice({ type: 'success', text: `Downloaded ${filename} successfully.` });
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Download failed.' });
    } finally {
      setDownloadingKey(null);
    }
  }

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

  async function handleSqlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    setImportingSql(true);
    try {
      const sql = await file.text();
      const res = await apiFetch<{
        tablesImported: number;
        truncated: boolean;
        counts: {
          products: number;
          categories: number;
          customers: number;
          suppliers: number;
          sales: number;
          purchases: number;
        };
      }>('/api/backup/import-sql', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      });
      setNotice({
        type: res.truncated ? 'error' : 'success',
        text: res.truncated
          ? `SQL file was partially truncated, imported ${res.tablesImported} tables (${res.counts.products} products, ${res.counts.sales} sales). Please verify the complete .sql file.`
          : `MySQL database imported successfully! (${res.tablesImported} tables · ${res.counts.products} products · ${res.counts.customers} customers · ${res.counts.sales} sales · ${res.counts.purchases} purchases)`,
      });
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to import SQL file.' });
    } finally {
      setImportingSql(false);
      e.target.value = '';
    }
  }

  async function handleClearDatabase() {
    setNotice(null);
    setClearing(true);
    try {
      await apiFetch('/api/backup/clear', { method: 'POST' });
      setConfirmClearOpen(false);
      setNotice({
        type: 'success',
        text: 'All database records have been cleared cleanly (Settings, Menus & Users preserved).',
      });
      onRefreshBootstrap();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Failed to clear database.' });
    } finally {
      setClearing(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            <DatabaseBackup className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">Backup &amp; Restore</h1>
            <p className="text-xs text-slate-500">Download full hosting project ZIP, MySQL .sql database, JSON snapshot, or Laravel 13 Blade package</p>
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
            <DatabaseBackup className="w-4 h-4 shrink-0" /> Hosting &amp; Database Backup
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
        <div className="space-y-6">
          <div className="bg-white border border-indigo-200/80 rounded-[20px] p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Archive className="w-5 h-5 shrink-0" />
                  <h2 className="font-display text-base font-bold text-slate-900">Hosting Upload Packages (Full Project + Database)</h2>
                </div>
                <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                  Download ready-to-upload ZIP archives containing source code, public assets, live database (<code className="bg-slate-100 px-1 rounded">.sql</code> &amp; <code className="bg-slate-100 px-1 rounded">.json</code>), and step-by-step hosting instructions. Secret <code className="bg-slate-100 px-1 rounded">.env</code> files are excluded; configure <code className="bg-slate-100 px-1 rounded">.env.example</code> on your server.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <Archive className="w-4 h-4 text-indigo-600 shrink-0" />
                    Full Project + Database (.zip)
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Complete Node.js + React + built frontend + Laravel 13 + live store + MySQL <code className="bg-white px-1 rounded">.sql</code> dump.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={downloadingKey !== null}
                  onClick={() =>
                    void triggerDownload(
                      'full-zip',
                      '/api/backup/download-full-project-zip',
                      'youthit-pos-full-project.zip'
                    )
                  }
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  {downloadingKey === 'full-zip' ? 'Preparing Full ZIP...' : 'Download Full Project (.zip)'}
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <FileCode className="w-4 h-4 text-emerald-600 shrink-0" />
                    cPanel PHP / Laravel 13 (.zip)
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Native Laravel 13 PHP/Blade codebase with shop logos, uploads, and live MySQL <code className="bg-white px-1 rounded">.sql</code> database bundled.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={downloadingKey !== null}
                  onClick={() =>
                    void triggerDownload(
                      'laravel-zip',
                      '/api/laravel/download-zip',
                      'youthit-pos-laravel-13.zip'
                    )
                  }
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  {downloadingKey === 'laravel-zip' ? 'Preparing Laravel ZIP...' : 'Download Laravel 13 + DB (.zip)'}
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                    <Database className="w-4 h-4 text-sky-600 shrink-0" />
                    Full MySQL Database (.sql)
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Standalone phpMyAdmin / MySQL 8 SQL dump containing all tables, settings, users, catalog, sales, and accounts.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={downloadingKey !== null}
                  onClick={() =>
                    void triggerDownload(
                      'sql',
                      '/api/backup/export-sql',
                      `youthit-pos-database-${today}.sql`
                    )
                  }
                  style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  {downloadingKey === 'sql' ? 'Exporting SQL...' : 'Download MySQL Database (.sql)'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <Download className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-base font-bold text-slate-900">Download JSON Backup</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Export all products, sales, invoices, customers, suppliers, purchases, accounts, expenses, owners, employees, menus, and settings as a single JSON snapshot.
              </p>
              <button
                type="button"
                disabled={downloadingKey !== null}
                onClick={() =>
                  void triggerDownload(
                    'json',
                    '/api/backup/export',
                    `youthit-pos-backup-${today}.json`
                  )
                }
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer disabled:opacity-60"
              >
                <Download className="w-4 h-4 shrink-0" />
                {downloadingKey === 'json' ? 'Exporting...' : 'Download Backup (.json)'}
              </button>
            </div>

            <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-indigo-600">
                <Upload className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-base font-bold text-slate-900">Restore JSON Backup</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select a previously downloaded Youth IT POS <code className="bg-slate-100 px-1 rounded">.json</code> backup file to restore all records immediately.
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-sm" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                <Upload className="w-4 h-4 shrink-0" />
                <span>{restoring ? 'Restoring...' : 'Upload & Restore JSON'}</span>
                <input type="file" accept=".json,application/json" onChange={handleFileRestore} className="hidden" disabled={restoring} />
              </label>
            </div>

            <div className="min-w-0 bg-white border border-slate-200 rounded-[20px] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <Database className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-base font-bold text-slate-900">Import MySQL (.sql)</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload your full MySQL <code className="bg-slate-100 px-1 rounded">.sql</code> database dump to import all tables into this software&apos;s layout.
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-sm" style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>
                <FileUp className="w-4 h-4 shrink-0" />
                <span>{importingSql ? 'Importing SQL...' : 'Upload & Import .sql'}</span>
                <input type="file" accept=".sql,text/sql,application/sql" onChange={handleSqlImport} className="hidden" disabled={importingSql} />
              </label>
            </div>

            <div className="min-w-0 bg-white border border-red-200/80 rounded-[20px] p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-base font-bold text-slate-900">Clear All Database Data</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Delete all products, sales, purchases, customers, suppliers, categories, brands, accounts, and transactions to start fresh.
              </p>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" /> Clear All Data
              </button>
            </div>
          </div>
        </div>
      ) : (
        <LaravelCodeView />
      )}

      {confirmClearOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => !clearing && setConfirmClearOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">Delete All Database Data?</h3>
                <p className="text-xs text-slate-500">Shop settings, menus &amp; user accounts will remain intact.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently remove all products, categories, brands, sales, invoices, purchases, customers, suppliers, accounts, and transaction records.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={clearing}
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearing}
                onClick={handleClearDatabase}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-semibold text-white cursor-pointer"
              >
                {clearing ? 'Deleting...' : 'Yes, Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
