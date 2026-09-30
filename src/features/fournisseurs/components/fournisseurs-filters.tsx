"use client";

import { X } from "lucide-react";
import { UrlSearch } from "@/components/table/url-search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { useUrlState } from "@/hooks/use-url-state";
import { MODE_LABELS } from "../labels";

export function FournisseursFilters() {
  const { params, update, pending } = useUrlState();
  const active = ["q", "mode", "archives"].some((k) => params.get(k));
  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
        <UrlSearch
          label="Rechercher un fournisseur"
          placeholder="Rechercher un fournisseur ou un contact"
        />
        <Select
          aria-label="Filtrer par mode de commande"
          value={params.get("mode") ?? ""}
          onChange={(e) => update({ mode: e.target.value })}
        >
          <option value="">Tous les modes</option>
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label className="flex h-11 items-center gap-2 text-sm">
          <Checkbox
            checked={params.get("archives") === "1"}
            onChange={(e) => update({ archives: e.target.checked ? "1" : null })}
          />
          Afficher les fournisseurs désactivés
        </label>
      </div>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update({ q: null, mode: null, archives: null })}
        >
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
