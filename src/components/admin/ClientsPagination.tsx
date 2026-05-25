'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ClientsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  rangeStart: number; // 1-based start row of current page
  rangeEnd: number; // 1-based end row of current page
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZES = [10, 20, 50];

export default function ClientsPagination({
  page,
  totalPages,
  total,
  limit,
  rangeStart,
  rangeEnd,
  onPageChange,
  onLimitChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: ClientsPaginationProps) {
  const pages = computePageList(page, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3 bg-white rounded-b-2xl border border-[#E9EEF5] shadow-[0_2px_10px_rgba(16,24,40,0.04)]">
      <div className="text-[13px] text-[#667085]">
        {total > 0 ? (
          <>
            {rangeStart}–{rangeEnd} z {total} klient{total === 1 ? 'a' : 'ów'}
          </>
        ) : (
          <>0 klientów</>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Poprzednia strona"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#E9EEF5] bg-white text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span
                key={`gap-${i}`}
                className="inline-flex items-center justify-center w-8 h-8 text-[#98A2B3] text-sm"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`inline-flex items-center justify-center min-w-8 h-8 px-2.5 rounded-md text-sm font-medium transition-colors ${
                  p === page
                    ? 'bg-[#1F3D8A] text-white shadow-sm'
                    : 'border border-[#E9EEF5] bg-white text-[#344054] hover:bg-[#F8FAFC]'
                }`}
              >
                {p}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Następna strona"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#E9EEF5] bg-white text-[#475467] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <label className="flex items-center gap-1.5">
          <span className="sr-only">Wierszy na stronę</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            className="h-8 px-2 pr-7 text-sm bg-white border border-[#E9EEF5] rounded-md text-[#344054] hover:border-[#D0D7DE] focus:outline-none focus:ring-2 focus:ring-[#BFD2FF] cursor-pointer"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / strona
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function computePageList(current: number, total: number): Array<number | '…'> {
  if (total <= 0) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: Array<number | '…'> = [];
  const add = (v: number | '…') => pages.push(v);

  add(1);
  if (current > 4) add('…');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) add(i);
  if (current < total - 3) add('…');
  add(total);

  return pages;
}
