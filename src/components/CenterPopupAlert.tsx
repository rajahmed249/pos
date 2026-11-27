import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from 'lucide-react';
import { POPUP_EVENT_NAME, type CenterPopupPayload } from '../lib/popup.ts';

export function CenterPopupAlert() {
  const [popup, setPopup] = useState<CenterPopupPayload | null>(null);

  useEffect(() => {
    function handlePopup(e: Event) {
      const custom = e as CustomEvent<CenterPopupPayload>;
      if (custom.detail?.message) {
        setPopup(custom.detail);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopup(null);
      }
    }
    window.addEventListener(POPUP_EVENT_NAME, handlePopup);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener(POPUP_EVENT_NAME, handlePopup);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    if (!popup || (popup.type !== 'success' && popup.type !== 'info')) return;
    const timer = window.setTimeout(() => setPopup(null), 3200);
    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!popup) return null;

  const isError = popup.type === 'error';
  const isWarning = popup.type === 'warning';
  const isSuccess = popup.type === 'success';

  const Icon = isError ? ShieldAlert : isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : Info;
  const ringBg = isError
    ? 'bg-red-50 text-red-600 border-red-200'
    : isWarning
      ? 'bg-amber-50 text-amber-600 border-amber-200'
      : isSuccess
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
        : 'bg-indigo-50 text-indigo-600 border-indigo-200';
  const buttonStyle = isError
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : isWarning
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : isSuccess
        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/60 flex items-center justify-center p-4"
      onClick={() => setPopup(null)}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="center-popup-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-[0_28px_70px_rgba(15,23,42,0.32)] overflow-hidden animate-[scaleIn_0.16s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${ringBg}`}>
              <Icon className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <h3 id="center-popup-title" className="font-display text-base font-bold text-slate-900">
                {popup.title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{popup.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPopup(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
            aria-label="Close alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={() => setPopup(null)}
            className={`px-5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${buttonStyle}`}
          >
            {popup.confirmLabel || 'OK, Got It'}
          </button>
        </div>
      </div>
    </div>
  );
}
