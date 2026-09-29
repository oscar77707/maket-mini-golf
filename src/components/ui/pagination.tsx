"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/table-params";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0
          ? "Aucun résultat"
          : `${formatNumber(from, 0)} à ${formatNumber(to, 0)} sur ${formatNumber(total, 0)}`}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select
            aria-label="Nombre de lignes par page"
            className="h-10 w-auto"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} par page
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-20 text-center text-sm">
          Page {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
