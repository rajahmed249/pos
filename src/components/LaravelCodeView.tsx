import { useEffect, useState } from 'react';
import { Download, FileCode2 } from 'lucide-react';
import { apiDownload, apiFetch } from '../lib/api.ts';

type FileScope = 'blade' | 'migrations' | 'backend' | 'all';

export function LaravelCodeView() {
  const [files, setFiles] = useState<string[]>([]);
  const [scope, setScope] = useState<FileScope>('blade');
  const [selected, setSelected] = useState('resources/views/layouts/app.blade');
  const [content, setContent] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    apiFetch<{ files: string[] }>('/api/laravel/tree').then((res) => {
      setFiles(res.files);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    apiFetch<{ path: string; content: string }>(`/api/laravel/file?path=${encodeURIComponent(selected)}`).then((res) => {
      setContent(res.content);
    });
  }, [selected]);

  const scopedFiles = files.filter((f) => {
    if (scope === 'blade') return f.startsWith('resources/views/') && f.endsWith('.blade');
    if (scope === 'migrations') return f.startsWith('database/');
    if (scope === 'backend') return f.startsWith('app/') || f.startsWith('routes/') || f.startsWith('bootstrap/');
    return true;
  });

  const filtered = scopedFiles.filter((f) => !filter || f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Pure Laravel 13 Codebase ({files.filter((f) => f.endsWith('.blade')).length} .blade Views · {files.length} Total Files)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All views in <span className="font-mono">resources/views/**/*.blade</span> (registered via <span className="font-mono">View::addExtension(&apos;blade&apos;, &apos;blade&apos;)</span>) · Clean URLs with zero <span className="font-mono">index.php</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void apiDownload('/api/laravel/download-zip', 'youthit-pos-laravel-13.zip')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 shrink-0" />
          Download Laravel 13 Project (.zip)
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(
          [
            { id: 'blade', label: 'Blade Views (.blade)' },
            { id: 'migrations', label: 'Migrations & Seeders' },
            { id: 'backend', label: 'Controllers, Models & Routes' },
            { id: 'all', label: 'All Project Files' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setScope(tab.id);
              const first = files.find((f) => {
                if (tab.id === 'blade') return f.startsWith('resources/views/') && f.endsWith('.blade');
                if (tab.id === 'migrations') return f.startsWith('database/');
                if (tab.id === 'backend') return f.startsWith('app/') || f.startsWith('routes/');
                return true;
              });
              if (first) setSelected(first);
            }}
            className={`px-3 py-1.5 rounded-md font-medium border cursor-pointer ${
              scope === tab.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 min-w-0 bg-white border border-slate-200 rounded-lg p-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files..."
            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md mb-2"
          />
          <div className="max-h-[540px] overflow-y-auto space-y-0.5 text-xs font-mono">
            {filtered.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => setSelected(file)}
                className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-2 truncate cursor-pointer ${
                  selected === file ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                <span className="truncate">{file}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 min-w-0 bg-slate-900 text-slate-100 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-800 text-xs font-mono text-slate-400 flex items-center justify-between truncate">
            <span className="truncate">laravel/{selected}</span>
          </div>
          <pre className="p-4 text-xs font-mono overflow-auto max-h-[560px] leading-relaxed">
            <code>{content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
