"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { PoleCode } from "@/types/database";

type PoleOption = { code: PoleCode; nom: string };

const ACTIVE: Record<PoleCode, string> = {
  restaurant: "border-pole-restaurant bg-pole-restaurant text-white",
  mini_golf: "border-pole-mini-golf bg-pole-mini-golf text-white",
  aquatique: "border-pole-aquatique bg-pole-aquatique text-white",
};

/** Filtre de pôle du gérant : stocké dans l'URL (?pole=restaurant) pour rester partageable. */
export function PoleFilter({ poles }: { poles: PoleOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("pole");

  const select = (code: PoleCode | null) => {
    const next = new URLSearchParams(params.toString());
    if (code) next.set("pole", code);
    else next.delete("pole");
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div role="group" aria-label="Filtrer par pôle" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={!current}
        onClick={() => select(null)}
        className={cn(
          "h-10 rounded-full border px-4 text-sm font-medium",
          !current ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
        )}
      >
        Tous les pôles
      </button>
      {poles.map((p) => (
        <button
          key={p.code}
          type="button"
          aria-pressed={current === p.code}
          onClick={() => select(p.code)}
          className={cn(
            "h-10 rounded-full border px-4 text-sm font-medium",
            current === p.code ? ACTIVE[p.code] : "bg-card hover:bg-muted",
          )}
        >
          {p.nom}
        </button>
      ))}
    </div>
  );
}
