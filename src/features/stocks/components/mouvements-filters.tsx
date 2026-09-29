"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useUrlState } from "@/hooks/use-url-state";
import { MOUVEMENT_LABELS } from "../labels";

export function MouvementsFilters({ withSearch = true }: { withSearch?: boolean }) {
  const { params, update, pending } = useUrlState();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = ["q", "type", "du", "au"].some((k) => params.get(k));
  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {withSearch && (
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Rechercher un produit"
              placeholder="Rechercher un produit"
              className="pl-10"
              defaultValue={params.get("q") ?? ""}
              onChange={(e) => {
                clearTimeout(timer.current);
                const value = e.target.value;
                timer.current = setTimeout(() => update({ q: value.trim() || null }), 300);
              }}
            />
          </div>
        )}
        <Select
          aria-label="Filtrer par type"
          value={params.get("type") ?? ""}
          onChange={(e) => update({ type: e.target.value })}
        >
          <option value="">Tous les types</option>
          {Object.entries(MOUVEMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          Du
          <Input
            type="date"
            value={params.get("du") ?? ""}
            onChange={(e) => update({ du: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          au
          <Input
            type="date"
            value={params.get("au") ?? ""}
            onChange={(e) => update({ au: e.target.value })}
          />
        </label>
      </div>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update({ q: null, type: null, du: null, au: null })}
        >
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
