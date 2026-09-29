import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PoleBadge } from "@/components/ui/pole-badge";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatEuro } from "@/lib/format";
import { uuidOrUndefined } from "@/lib/table-params";
import { ComptageListe } from "@/features/stocks/components/comptage-liste";
import { InventaireActions } from "@/features/stocks/components/inventaire-actions";
import { STATUT_INVENTAIRE_LABELS } from "@/features/stocks/labels";
import { getInventaire, getReferentiels } from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Inventaire" };

export default async function InventairePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = uuidOrUndefined((await params).id);
  if (!id) notFound();
  const data = await getInventaire(id);
  if (!data) notFound();
  const { inventaire, lignes } = data;
  const referentiels = await getReferentiels();

  const canManage = user.profile.role !== "salarie";
  const pole = referentiels.poles.find((p) => p.id === inventaire.pole_id);
  const lieu = referentiels.lieux.find((l) => l.id === inventaire.lieu_stockage_id)?.nom;
  const comptes = lignes.filter((l) => l.quantite_comptee !== null);
  const avecEcart = comptes.filter((l) => (l.ecart ?? 0) !== 0);
  const valeurEcart = avecEcart.reduce((sum, l) => sum + (l.ecart ?? 0) * l.prix_achat_ht, 0);
  // un salarié ne compte que tant que l'inventaire est en cours ; personne ne modifie un inventaire clos
  const verrouille =
    inventaire.statut === "valide" ||
    inventaire.statut === "annule" ||
    (!canManage && inventaire.statut !== "en_cours");

  return (
    <div className="space-y-6">
      <Link
        href="/stocks/inventaires"
        className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Tous les inventaires
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">Inventaire · {lieu ?? "tout le pôle"}</h2>
          {pole && <PoleBadge code={pole.code} nom={pole.nom} />}
          <Badge
            variant={
              inventaire.statut === "valide"
                ? "vert"
                : inventaire.statut === "soumis"
                  ? "orange"
                  : "bleu"
            }
          >
            {STATUT_INVENTAIRE_LABELS[inventaire.statut]}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Lancé le {formatDate(inventaire.created_at)}
          {inventaire.commentaire ? ` · ${inventaire.commentaire}` : ""}
        </p>
        {canManage && comptes.length > 0 && inventaire.statut !== "annule" && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            {avecEcart.length === 0
              ? "Aucun écart pour l'instant."
              : `${avecEcart.length} écart${avecEcart.length > 1 ? "s" : ""}, soit ${formatEuro(valeurEcart)} HT d'écart net.`}
          </p>
        )}
        <InventaireActions
          id={inventaire.id}
          statut={inventaire.statut}
          canManage={canManage}
          comptes={comptes.length}
        />
      </header>
      <ComptageListe
        key={`${inventaire.statut}-${lignes.length}`}
        lignes={lignes}
        categories={new Map(referentiels.categories.map((c) => [c.id, c.nom]))}
        verrouille={verrouille}
        voirEcarts={canManage}
      />
    </div>
  );
}
