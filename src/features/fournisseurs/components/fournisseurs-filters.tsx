"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useUrlState } from "@/hooks/use-url-state";
import { MODE_LABELS } from "../labels";

export function FournisseursFilters() {
  const { params, update, pending } = useUrlState();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = ["q", "mode", "archives"].some((k) => params.get(k));
  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Rechercher un fournisseur"
            placeholder="Rechercher un fournisseur ou un contact"
            className="pl-10"
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => {
              clearTimeout(timer.current);
              const value = e.target.value;
              timer.current = setTimeout(() => update({ q: value.trim() || null }), 300);
            }}
          />
        </div>
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
