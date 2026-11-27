import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationBarProps {
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizes?: number[];
}

export function PaginationBar({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  pageSizes = [10, 20, 50, 100],
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const [goValue, setGoValue] = useState(String(page));

  useEffect(() => {
    setGoValue(String(page));
  }, [page]);

  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  const pageNumbers: number[] = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="px-5 py-3.5 border-t border-[#f1f5f9] bg-[#f8fafc] rounded-b-[20px] flex flex-wrap items-center justify-between gap-3.5 text-[13px]">
      <div className="text-[#64748b] tabular-nums">
        <strong>{total === 0 ? 0 : offset + 1}</strong> – <strong>{Math.min(offset + limit, total)}</strong> of{' '}
        <strong>{total.toLocaleString()}</strong>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          title="First Page"
          className="min-w-[36px] h-9 px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          title="Previous Page"
          className="min-w-[36px] h-9 px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="min-w-[36px] h-9 px-3 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] cursor-pointer tabular-nums"
            >
              1
            </button>
            {startPage > 2 && <span className="px-1 text-[#94a3b8]">…</span>}
          </>
        )}

        {pageNumbers.map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onPageChange(num)}
            style={num === page ? { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' } : undefined}
            className={`min-w-[36px] h-9 px-3 border rounded-lg font-medium cursor-pointer tabular-nums ${
              num === page
                ? 'text-white border-[#4f46e5] shadow-[0_2px_8px_rgba(79,70,229,0.28)]'
                : 'border-[#e2e8f0] bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5]'
            }`}
          >
            {num}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-1 text-[#94a3b8]">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="min-w-[36px] h-9 px-3 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] cursor-pointer tabular-nums"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          title="Next Page"
          className="min-w-[36px] h-9 px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Last Page"
          className="min-w-[36px] h-9 px-2.5 border border-[#e2e8f0] rounded-lg bg-white text-[#334155] hover:border-[#4f46e5] hover:text-[#4f46e5] disabled:opacity-40 cursor-pointer flex items-center justify-center"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-[#64748b]">
          <span>Show:</span>
          <select
            value={limit}
            onChange={(e) => {
              onPageChange(1);
              onLimitChange(Number(e.target.value));
            }}
            className="px-2.5 py-1.5 border border-[#e2e8f0] rounded-md bg-white text-[#334155]"
          >
            {pageSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = Number(goValue);
            if (Number.isFinite(parsed) && parsed >= 1 && parsed <= totalPages) {
              onPageChange(Math.trunc(parsed));
            }
          }}
          className="flex items-center gap-1.5 text-[#64748b]"
        >
          <span>Go:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={goValue}
            onChange={(e) => setGoValue(e.target.value)}
            className="w-14 px-2 py-1.5 border border-[#e2e8f0] rounded-md bg-white text-[#334155] text-center tabular-nums"
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded-md border border-[#cbd5e1] bg-white text-[#334155] font-semibold hover:border-[#4f46e5] hover:text-[#4f46e5] cursor-pointer"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
