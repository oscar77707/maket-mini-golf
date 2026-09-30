"use client";

import { X } from "lucide-react";
import { UrlSearch } from "@/components/table/url-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";
import type { StatutCommande } from "@/types/models";
import { STATUT_TABS } from "../labels";

type Counts = Record<"toutes" | StatutCommande, number>;

export function CommandesFilters({
  counts,
  fournisseurs,
}: {
  counts: Counts;
  fournisseurs: { id: string; nom: string }[];
}) {
  const { params, update, pending } = useUrlState();
  const statut = params.get("statut") ?? "toutes";
  const active = ["q", "fournisseur", "du", "au", "attendues"].some((k) => params.get(k));

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div
        role="group"
        aria-label="Filtrer par statut"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {STATUT_TABS.map((t) => {
          const selected = statut === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={selected}
              onClick={() => update({ statut: t.id === "toutes" ? null : t.id })}
              className={cn(
                "h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:bg-muted",
              )}
            >
              {t.label} ({counts[t.id]})
            </button>
          );
        })}
      </div>
      {params.get("attendues") === "aujourdhui" && (
        <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          Livraisons prévues aujourd&apos;hui (commandes envoyées ou confirmées).
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_10rem_10rem]">
        <UrlSearch label="Rechercher une commande" placeholder="Numéro ou fournisseur" />
        <Select
          aria-label="Filtrer par fournisseur"
          value={params.get("fournisseur") ?? ""}
          onChange={(e) => update({ fournisseur: e.target.value })}
        >
          <option value="">Tous les fournisseurs</option>
          {fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          aria-label="Créée à partir du"
          value={params.get("du") ?? ""}
          onChange={(e) => update({ du: e.target.value })}
        />
        <Input
          type="date"
          aria-label="Créée jusqu'au"
          value={params.get("au") ?? ""}
          onChange={(e) => update({ au: e.target.value })}
        />
      </div>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update({ q: null, fournisseur: null, du: null, au: null, attendues: null })}
        >
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
