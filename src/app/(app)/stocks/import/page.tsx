import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { ImportWizard } from "@/features/stocks/components/import-wizard";
import { getReferentiels } from "@/features/stocks/queries";

export const metadata: Metadata = { title: "Import et export des produits" };

export default async function ImportPage() {
  const { profile } = await requireRole("gerant", "responsable");
  const { poles } = await getReferentiels();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Importer vos produits depuis Excel</h2>
        <p className="text-muted-foreground">
          Pour exporter le catalogue actuel, utilisez le bouton « Exporter en CSV » de la page
          Catalogue : le fichier obtenu peut être réimporté tel quel.
        </p>
      </div>
      <ImportWizard poles={poles} isGerant={profile.role === "gerant"} />
    </div>
  );
}
