import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { ReceptionForm } from "@/features/commandes/components/reception-form";
import { getCommande } from "@/features/commandes/queries";
import { DemarrerReception } from "@/features/commandes/components/demarrer-reception";

export const metadata: Metadata = { title: "Réception de livraison" };

export default async function ReceptionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("gerant", "responsable");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getCommande(id);
  if (!detail) notFound();
  const { commande: c, fournisseur, livraisons } = detail;
  if (["livree", "cloturee", "annulee", "brouillon", "a_valider"].includes(c.statut))
    redirect(`/commandes/${id}`);

  const livraison = livraisons.find((l) => l.statut === "en_cours");
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href={`/commandes/${id}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Retour à la commande
        </Link>
        <h1 className="text-2xl font-semibold">Réception de {c.reference}</h1>
        <p className="text-muted-foreground">
          {fournisseur.nom}. Tout est pré-rempli comme commandé : corrigez seulement ce qui diffère.
        </p>
      </div>
      {livraison ? (
        <ReceptionForm
          livraisonId={livraison.id}
          commandeId={c.id}
          reference={c.reference}
          numeroBl={livraison.numero_bon_livraison}
          commentaire={livraison.commentaire}
          lignes={livraison.lignes.map((l) => ({
            id: l.id,
            produit_nom: l.produit_nom,
            unite: l.unite,
            suivi_dlc: l.suivi_dlc,
            quantite_commandee: l.quantite_commandee,
            quantite_recue: l.quantite_recue,
            prix_unitaire_ht: l.prix_unitaire_ht,
            motif_ecart: l.motif_ecart,
            dlc: l.dlc,
            numero_lot: l.numero_lot,
          }))}
        />
      ) : (
        <DemarrerReception commandeId={id} />
      )}
    </div>
  );
}
