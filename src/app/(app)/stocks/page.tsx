import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/feedback/module-placeholder";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Stocks" };

export default async function Page() {
  await requireRole("gerant", "responsable", "salarie");
  return <ModulePlaceholder title="Stocks" step={2} />;
}
