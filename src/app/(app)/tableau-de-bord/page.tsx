import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/feedback/module-placeholder";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function Page() {
  await requireRole("gerant");
  return <ModulePlaceholder title="Tableau de bord" step={5} />;
}
