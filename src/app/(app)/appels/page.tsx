import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/feedback/module-placeholder";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Journal des appels IA" };

export default async function Page() {
  await requireRole("gerant");
  return <ModulePlaceholder title="Journal des appels IA" step={4} />;
}
