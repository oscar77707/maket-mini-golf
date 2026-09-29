"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useUrlState } from "@/hooks/use-url-state";
import type { Referentiels } from "../queries";

export function CatalogueFilters({
  referentiels,
  poleId,
}: {
  referentiels: Referentiels;
  poleId: number | null;
}) {
  const { params, update, pending } = useUrlState();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const categories = referentiels.categories.filter((c) => !poleId || c.pole_id === poleId);
  const lieux = referentiels.lieux.filter((l) => !poleId || l.pole_id === poleId);
  const active = ["q", "categorie", "lieu", "fournisseur", "alerte", "archives"].some((k) =>
    params.get(k),
  );

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Rechercher un produit"
          placeholder="Rechercher un produit ou une référence"
          className="pl-10"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => {
            clearTimeout(timer.current);
            const value = e.target.value;
            timer.current = setTimeout(() => update({ q: value.trim() || null }), 300);
          }}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          aria-label="Filtrer par alerte"
          value={params.get("alerte") ?? ""}
          onChange={(e) => update({ alerte: e.target.value })}
        >
          <option value="">Tous les niveaux</option>
          <option value="rouge">Sous le seuil</option>
          <option value="orange">Proche du seuil</option>
          <option value="alerte">Sous ou proche du seuil</option>
          <option value="ok">Stock correct</option>
        </Select>
        <Select
          aria-label="Filtrer par catégorie"
          value={params.get("categorie") ?? ""}
          onChange={(e) => update({ categorie: e.target.value })}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par lieu de stockage"
          value={params.get("lieu") ?? ""}
          onChange={(e) => update({ lieu: e.target.value })}
        >
          <option value="">Tous les lieux</option>
          {lieux.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nom}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par fournisseur"
          value={params.get("fournisseur") ?? ""}
          onChange={(e) => update({ fournisseur: e.target.value })}
        >
          <option value="">Tous les fournisseurs</option>
          {referentiels.fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </Select>
        <label className="flex h-11 items-center gap-2 text-sm">
          <Checkbox
            checked={params.get("archives") === "1"}
            onChange={(e) => update({ archives: e.target.checked ? "1" : null })}
          />
          Afficher les produits archivés
        </label>
      </div>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            update({
              q: null,
              categorie: null,
              lieu: null,
              fournisseur: null,
              alerte: null,
              archives: null,
            })
          }
        >
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
