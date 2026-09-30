import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { AppelsNav } from "@/features/appels/components/appels-nav";

export default async function AppelsLayout({ children }: { children: React.ReactNode }) {
  await requireRole("gerant");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Appels IA</h1>
      <Suspense fallback={null}>
        <AppelsNav />
      </Suspense>
      {children}
    </div>
  );
}
