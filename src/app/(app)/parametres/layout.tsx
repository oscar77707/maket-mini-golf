import { ParametresNav } from "@/features/parametres/components/parametres-nav";
import { requireRole } from "@/lib/auth/session";

export default async function ParametresLayout({ children }: { children: React.ReactNode }) {
  await requireRole("gerant");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Paramètres</h1>
      <ParametresNav />
      {children}
    </div>
  );
}
