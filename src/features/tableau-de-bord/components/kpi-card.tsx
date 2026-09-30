import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  neutre: "",
  alerte: "border-red-600/50 bg-red-600/5",
  attention: "border-orange-600/50 bg-orange-500/5",
} as const;

/** Carte de chiffre clé : toute la carte est un lien vers la liste correspondante. */
export function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutre",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-24 items-center gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted",
        TONES[tone],
      )}
    >
      <Icon aria-hidden className="size-8 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block text-sm text-muted-foreground">{label}</span>
        <span className="block text-3xl font-semibold tabular-nums leading-tight">{value}</span>
        {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
      </span>
    </Link>
  );
}
