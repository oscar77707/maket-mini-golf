import { cn } from "@/lib/utils";
import type { PoleCode } from "@/types/models";

const STYLES: Record<PoleCode, string> = {
  restaurant: "bg-pole-restaurant/15 text-pole-restaurant border-pole-restaurant/40",
  mini_golf: "bg-pole-mini-golf/15 text-pole-mini-golf border-pole-mini-golf/40",
  aquatique: "bg-pole-aquatique/15 text-pole-aquatique border-pole-aquatique/40",
};

export function PoleBadge({
  code,
  nom,
  className,
}: {
  code: PoleCode;
  nom: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium",
        STYLES[code],
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {nom}
    </span>
  );
}
