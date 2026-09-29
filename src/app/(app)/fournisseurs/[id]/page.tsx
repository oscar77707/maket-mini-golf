import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatEuro, formatNumber } from "@/lib/format";
import { FournisseurActions } from "@/features/fournisseurs/components/fournisseur-actions";
import { ProduitsAssocies } from "@/features/fournisseurs/components/produits-associes";
import { PrixFournisseur } from "@/features/fournisseurs/components/prix-fournisseur";
import { joursTexte, MODE_LABELS } from "@/features/fournisseurs/labels";
import {
  getFournisseur,
  listCommandesFournisseur,
  listPrixFournisseur,
  listProduitsAssociables,
  listProduitsAssocies,
} from "@/features/fournisseurs/queries";
import { STATUT_LABELS, STATUT_VARIANT } from "@/features/commandes/labels";
import { getReferentiels } from "@/features/stocks/queries";
import { z } from "zod";

export const metadata: Metadata = { title: "Fiche fournisseur" };

export default async function FournisseurPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("gerant", "responsable");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const fiche = await getFournisseur(id);
  if (!fiche) notFound();
  const { fournisseur: f, stats } = fiche;

  const [liens, associables, prix, commandes, referentiels] = await Promise.all([
    listProduitsAssocies(id),
    listProduitsAssociables(id),
    listPrixFournisseur(id),
    listCommandesFournisseur(id),
    getReferentiels(),
  ]);
  const isGerant = user.profile.role === "gerant";
  const noms = Object.fromEntries(liens.map((l) => [l.produit_id, l.produit_nom]));

  const kpis = [
    { label: "Commandes passées", value: String(stats.nb_commandes) },
    {
      label: "Délai réel moyen",
      value:
        stats.delai_reel_moyen_jours === null
          ? "—"
          : `${formatNumber(stats.delai_reel_moyen_jours, 1)} j`,
    },
    {
      label: "Livraisons conformes",
      value: stats.taux_conformite_pct === null ? "—" : `${stats.taux_conformite_pct} %`,
    },
    {
      label: "Montant total HT",
      value: stats.montant_total_ht === null ? "—" : formatEuro(stats.montant_total_ht),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/fournisseurs"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Tous les fournisseurs
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{f.nom}</h1>
          <Badge>{MODE_LABELS[f.mode_commande]}</Badge>
          {!f.actif && <Badge variant="orange">Désactivé</Badge>}
        </div>
        <FournisseurActions
          fournisseur={f}
          poles={referentiels.poles}
          isGerant={isGerant}
          defaultPoleId={user.profile.pole_id}
          aDesCommandes={commandes.length > 0}
        />
      </div>

      <section aria-label="Statistiques" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <p className="text-sm text-muted-foreground">{k.label}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 text-sm">
            <h2 className="text-base font-semibold">Contact</h2>
            {f.contact_nom && <p>{f.contact_nom}</p>}
            {f.email && (
              <p className="flex items-center gap-2">
                <Mail aria-hidden className="size-4 text-muted-foreground" />
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={`mailto:${f.email}`}
                >
                  {f.email}
                </a>
              </p>
            )}
            {f.telephone && (
              <p className="flex items-center gap-2">
                <Phone aria-hidden className="size-4 text-muted-foreground" />
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={`tel:${f.telephone}`}
                >
                  {f.telephone}
                </a>
              </p>
            )}
            {f.adresse && (
              <p className="flex items-center gap-2">
                <MapPin aria-hidden className="size-4 text-muted-foreground" />
                {f.adresse}
              </p>
            )}
            {f.url_portail && (
              <p>
                Portail :{" "}
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={f.url_portail}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {f.url_portail}
                </a>
              </p>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <h2 className="text-base font-semibold">Commande et livraison</h2>
            <p>Commande : {joursTexte(f.jours_commande)}</p>
            <p>Livraison : {joursTexte(f.jours_livraison)}</p>
            <p>
              Délai annoncé : {f.delai_livraison_jours} jour{f.delai_livraison_jours > 1 ? "s" : ""}
            </p>
            <p>
              Minimum de commande :{" "}
              {f.minimum_commande_ht > 0 ? formatEuro(f.minimum_commande_ht) : "aucun"}
            </p>
          </div>
          {f.notes && (
            <div className="space-y-2 text-sm">
              <h2 className="text-base font-semibold">Notes</h2>
              <p className="whitespace-pre-line">{f.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ProduitsAssocies
        fournisseurId={id}
        liens={liens}
        associables={associables}
        poles={referentiels.poles}
      />

      <PrixFournisseur points={prix} noms={noms} />

      <section className="space-y-3" aria-labelledby="dernieres-commandes">
        <h2 id="dernieres-commandes" className="text-lg font-semibold">
          Dernières commandes
        </h2>
        {commandes.length === 0 ? (
          <p className="text-muted-foreground">Aucune commande pour ce fournisseur.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {commandes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/commandes/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-muted/40"
                >
                  <span className="font-medium text-primary">{c.reference}</span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">
                    {formatDate(c.created_at)} · {formatEuro(c.montant_ht)}
                    <Badge variant={STATUT_VARIANT[c.statut]}>{STATUT_LABELS[c.statut]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
