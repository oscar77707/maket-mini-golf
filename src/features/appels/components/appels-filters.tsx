"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrlSearch } from "@/components/table/url-search";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";
import type { IssueAppel } from "@/types/models";
import { ISSUE_LABELS, ISSUES } from "../labels";

type Counts = Record<"toutes" | IssueAppel, number>;

export function AppelsFilters({ counts }: { counts: Counts }) {
  const { params, update, pending } = useUrlState();
  const issue = params.get("issue") ?? "toutes";
  const active = ["q", "du", "au"].some((k) => params.get(k));
  const tabs = [
    { id: "toutes" as const, label: "Tous" },
    ...ISSUES.map((id) => ({ id, label: ISSUE_LABELS[id] })),
  ];

  return (
    <div className="space-y-3" aria-busy={pending}>
      <div
        role="group"
        aria-label="Filtrer par issue"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
      >
        {tabs.map((t) => {
          const selected = issue === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={selected}
              onClick={() => update({ issue: t.id === "toutes" ? null : t.id })}
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
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_10rem]">
        <UrlSearch
          label="Rechercher un appel"
          placeholder="Résumé, transcription ou numéro"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Input
          type="date"
          aria-label="Appels à partir du"
          value={params.get("du") ?? ""}
          onChange={(e) => update({ du: e.target.value })}
        />
        <Input
          type="date"
          aria-label="Appels jusqu'au"
          value={params.get("au") ?? ""}
          onChange={(e) => update({ au: e.target.value })}
        />
      </div>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => update({ q: null, du: null, au: null })}>
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
