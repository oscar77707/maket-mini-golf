import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/feedback/module-placeholder";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Page() {
  await requireRole("gerant");
  return <ModulePlaceholder title="Paramètres" step={6} />;
}
