"use client";

import { Pagination } from "@/components/ui/pagination";
import { useUrlState } from "@/hooks/use-url-state";

export function UrlPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const { update } = useUrlState();
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(p) => update({ page: String(p) }, { keepPage: true })}
      onPageSizeChange={(s) => update({ taille: String(s) })}
    />
  );
}
