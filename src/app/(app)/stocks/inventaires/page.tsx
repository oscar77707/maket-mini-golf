import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PoleBadge } from "@/components/ui/pole-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import type { SearchParams } from "@/lib/table-params";
import { NouvelInventaireButton } from "@/features/stocks/components/nouvel-inventaire-button";
import { STATUT_INVENTAIRE_LABELS } from "@/features/stocks/labels";
import { getReferentiels, listInventaires, selectedPoleId } from "@/features/stocks/queries";
import type { StatutInventaire } from "@/types/models";

export const metadata: Metadata = { title: "Inventaires" };

const VARIANT: Record<StatutInventaire, "bleu" | "orange" | "vert" | "default"> = {
  en_cours: "bleu",
  soumis: "orange",
  valide: "vert",
  annule: "default",
};

export default async function InventairesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const referentiels = await getReferentiels();
  const poleId = selectedPoleId(user, referentiels.poles, params);
  const inventaires = await listInventaires(poleId);
  const canManage = user.profile.role !== "salarie";
  const pole = new Map(referentiels.poles.map((p) => [p.id, p]));
  const lieu = new Map(referentiels.lieux.map((l) => [l.id, l.nom]));

  return (
    <div className="space-y-5">
      {canManage && (
        <NouvelInventaireButton
          referentiels={referentiels}
          isGerant={user.profile.role === "gerant"}
          defaultPoleId={poleId ?? user.profile.pole_id}
        />
      )}
      {inventaires.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun inventaire"
          description={
            canManage
              ? "Lancez un inventaire pour comparer le stock réel au stock théorique."
              : "Votre responsable n'a pas encore lancé d'inventaire."
          }
        />
      ) : (
        <ul className="space-y-3">
          {inventaires.map((i) => {
            const p = pole.get(i.pole_id);
            return (
              <li key={i.id}>
                <Link
                  href={`/stocks/inventaires/${i.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 hover:bg-muted/40"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {i.lieu_stockage_id ? lieu.get(i.lieu_stockage_id) : "Tout le pôle"} ·{" "}
                      {formatDate(i.created_at)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {p && <PoleBadge code={p.code} nom={p.nom} className="px-2 py-0 text-xs" />}
                      {i.commentaire && <span>{i.commentaire}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(i.comptes, 0)} / {formatNumber(i.total, 0)} comptés
                    </span>
                    <Badge variant={VARIANT[i.statut]}>{STATUT_INVENTAIRE_LABELS[i.statut]}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
