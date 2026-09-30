import type { Metadata } from "next";
import { ReferentielListe } from "@/features/parametres/components/referentiel-liste";
import { getReferentiel, getTousLesPoles } from "@/features/parametres/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Réglages des stocks" };

export default async function ParametresStocksPage() {
  await requireRole("gerant");
  const [poles, categories, lieux] = await Promise.all([
    getTousLesPoles(),
    getReferentiel("categories_produit"),
    getReferentiel("lieux_stockage"),
  ]);
  const options = poles.map((p) => ({ id: p.id, code: p.code, nom: p.nom }));
  return (
    <div className="space-y-10">
      <ReferentielListe table="categories_produit" poles={options} lignes={categories} />
      <ReferentielListe table="lieux_stockage" poles={options} lignes={lieux} />
    </div>
  );
}
