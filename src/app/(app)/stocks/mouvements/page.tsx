import type { Metadata } from "next";
import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { requireUser } from "@/lib/auth/session";
import type { SearchParams } from "@/lib/table-params";
import { MouvementsFilters } from "@/features/stocks/components/mouvements-filters";
import { annulableIds, MouvementsList } from "@/features/stocks/components/mouvements-list";
import { UrlPagination } from "@/features/stocks/components/url-pagination";
import {
  getReferentiels,
  listMouvements,
  parseMouvementFilters,
  selectedPoleId,
} from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Mouvements de stock" };

export default async function MouvementsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { poles } = await getReferentiels();
  const filters = parseMouvementFilters(params, selectedPoleId(user, poles, params));
  const { rows, total, page, pageSize } = await listMouvements(filters, params);
  const annulables = annulableIds(rows, {
    canManage: user.profile.role !== "salarie",
    userId: user.profile.id,
  });
  const exportQuery = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      typeof v === "string" && !["page", "taille"].includes(k) ? [[k, v]] : [],
    ),
  ).toString();

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button asChild variant="outline">
          <a href={`/stocks/mouvements/export${exportQuery ? `?${exportQuery}` : ""}`}>
            <Download aria-hidden />
            Exporter en CSV
          </a>
        </Button>
      </div>
      <MouvementsFilters />
      {rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="Aucun mouvement"
          description="Aucun mouvement ne correspond à ces critères."
        />
      ) : (
        <>
          <MouvementsList rows={rows} annulables={annulables} />
          <UrlPagination page={page} pageSize={pageSize} total={total} />
        </>
      )}
    </div>
  );
}
