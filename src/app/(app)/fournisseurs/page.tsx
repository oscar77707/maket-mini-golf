import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/feedback/module-placeholder";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Fournisseurs" };

export default async function Page() {
  await requireRole("gerant", "responsable");
  return <ModulePlaceholder title="Fournisseurs" step={3} />;
}
