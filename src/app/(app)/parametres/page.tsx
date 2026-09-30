import type { Metadata } from "next";
import { ComplexeForm } from "@/features/parametres/components/complexe-form";
import { LogoUpload } from "@/features/parametres/components/logo-upload";
import { PolesForm } from "@/features/parametres/components/poles-form";
import { getParametres, getTousLesPoles } from "@/features/parametres/queries";
import { requireRole } from "@/lib/auth/session";
import { logoPublicUrl } from "@/lib/logo";

export const metadata: Metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  await requireRole("gerant");
  const [parametres, poles] = await Promise.all([getParametres(), getTousLesPoles()]);
  return (
    <div className="max-w-3xl space-y-6">
      <ComplexeForm parametres={parametres} />
      <LogoUpload logoUrl={logoPublicUrl(parametres.logo_path)} nom={parametres.nom_complexe} />
      <PolesForm poles={poles} />
    </div>
  );
}
