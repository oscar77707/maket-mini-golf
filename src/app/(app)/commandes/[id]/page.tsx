import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChevronLeft, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PoleBadge } from "@/components/ui/pole-badge";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatDateTime, formatEuro, formatNumber } from "@/lib/format";
import {
  CommandeActions,
  ReprendreReception,
} from "@/features/commandes/components/commande-actions";
import { CommandeInfoForm } from "@/features/commandes/components/commande-info-form";
import { LignesCommande } from "@/features/commandes/components/lignes-commande";
import { motifEcartLabel, STATUT_LABELS, STATUT_VARIANT } from "@/features/commandes/labels";
import { getCommande, listProduitsCommandables } from "@/features/commandes/queries";
import { UNITE_LABELS } from "@/features/stocks/labels";
import { getReferentiels } from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Commande" };

export default async function CommandePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("gerant", "responsable");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getCommande(id);
  if (!detail) notFound();
  const { commande: c, fournisseur, lignes, livraisons, createur, valideur } = detail;

  const editable = c.statut === "brouillon" || c.statut === "a_valider";
  const [referentiels, produits] = await Promise.all([
    getReferentiels(),
    editable ? listProduitsCommandables(c.pole_id, c.fournisseur_id) : Promise.resolve([]),
  ]);
  const pole = referentiels.poles.find((p) => p.id === c.pole_id);
  const role = user.profile.role;

  const historique = [
    { label: "Créée", date: c.created_at, detail: createur ? `par ${createur}` : null },
    { label: "Soumise au gérant", date: c.soumise_le, detail: null },
    {
      label: "Envoyée au fournisseur",
      date: c.envoyee_le,
      detail: valideur ? `validée par ${valideur}` : null,
    },
    { label: "Confirmée par le fournisseur", date: c.confirmee_le, detail: null },
    { label: "Livrée", date: c.livree_le, detail: null },
    { label: "Clôturée", date: c.cloturee_le, detail: null },
    { label: "Annulée", date: c.annulee_le, detail: c.motif_annulation },
  ].filter((h) => h.date);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/commandes"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Toutes les commandes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{c.reference}</h1>
          <Badge variant={STATUT_VARIANT[c.statut]}>{STATUT_LABELS[c.statut]}</Badge>
          {c.est_en_retard && c.statut !== "en_retard" && <Badge variant="rouge">En retard</Badge>}
          {pole && <PoleBadge code={pole.code} nom={pole.nom} />}
        </div>
        <p className="text-muted-foreground">
          <Link
            href={`/fournisseurs/${fournisseur.id}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {fournisseur.nom}
          </Link>
          {c.date_livraison_prevue && (
            <> · livraison prévue le {formatDate(c.date_livraison_prevue)}</>
          )}
        </p>
        <CommandeActions id={c.id} statut={c.statut} role={role} nbLignes={lignes.length} />
        {c.derniere_erreur_envoi && c.statut === "a_valider" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Le dernier envoi a échoué : {c.derniere_erreur_envoi}. Vous pouvez réessayer.
          </p>
        )}
        {c.statut === "a_valider" && role !== "gerant" && (
          <p className="text-sm text-muted-foreground">
            Cette commande attend la validation du gérant.
          </p>
        )}
      </div>

      {editable ? (
        <Card>
          <CardContent className="pt-6">
            <CommandeInfoForm
              id={c.id}
              date={c.date_livraison_prevue}
              commentaire={c.commentaire}
            />
          </CardContent>
        </Card>
      ) : (
        c.commentaire && (
          <p className="rounded-lg border bg-card p-4 text-sm">
            <span className="font-medium">Commentaire : </span>
            {c.commentaire}
          </p>
        )
      )}

      <LignesCommande
        commandeId={c.id}
        lignes={lignes}
        editable={editable}
        produits={produits}
        minimumHt={editable ? fournisseur.minimum_commande_ht : 0}
      />

      {livraisons.length > 0 && (
        <section className="space-y-3" aria-labelledby="livraisons">
          <h2 id="livraisons" className="text-lg font-semibold">
            Livraison{livraisons.length > 1 ? "s" : ""}
          </h2>
          {livraisons.map((lv) => (
            <Card key={lv.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">
                  Reçue le {formatDateTime(lv.recue_le)}
                  {lv.receptionnaire && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      par {lv.receptionnaire}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {lv.statut === "en_cours" ? (
                    <>
                      <Badge variant="orange">Pointage en cours</Badge>
                      <ReprendreReception id={c.id} />
                    </>
                  ) : lv.conforme ? (
                    <Badge variant="vert">Conforme</Badge>
                  ) : (
                    <Badge variant="orange">Avec écarts</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {lv.numero_bon_livraison && <p>Bon de livraison : {lv.numero_bon_livraison}</p>}
                {lv.commentaire && <p>Commentaire : {lv.commentaire}</p>}
                <ul className="divide-y rounded-md border">
                  {lv.lignes.map((l) => (
                    <li
                      key={l.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3"
                    >
                      <span className="font-medium">{l.produit_nom}</span>
                      <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        {formatNumber(l.quantite_recue, 3)} /{" "}
                        {formatNumber(l.quantite_commandee, 3)} {UNITE_LABELS[l.unite]}
                        {l.ecart !== 0 && l.ecart !== null && (
                          <Badge variant="orange">
                            {l.ecart > 0 ? "+" : ""}
                            {formatNumber(l.ecart, 3)} · {motifEcartLabel(l.motif_ecart)}
                          </Badge>
                        )}
                        {l.dlc && <span>DLC {formatDate(l.dlc)}</span>}
                        {l.prix_unitaire_ht !== null && (
                          <span>{formatEuro(l.prix_unitaire_ht)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="historique">
        <h2 id="historique" className="text-lg font-semibold">
          Historique
        </h2>
        <ol className="space-y-2 border-l pl-4">
          {historique.map((h) => (
            <li key={h.label} className="text-sm">
              <span className="font-medium">{h.label}</span>
              <span className="text-muted-foreground"> · {formatDateTime(h.date!)}</span>
              {h.detail && <span className="text-muted-foreground"> · {h.detail}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
