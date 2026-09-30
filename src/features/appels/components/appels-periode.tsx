"use client";

import { Input } from "@/components/ui/input";
import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";
import { PRESETS } from "../periode";

export function AppelsPeriode({ du, au, jours }: { du: string; au: string; jours: number | null }) {
  const { update, pending } = useUrlState();
  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={pending}>
      <div role="group" aria-label="Période" className="flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={jours === n}
            onClick={() => update({ jours: String(n), du: null, au: null })}
            className={cn(
              "h-11 rounded-full border px-4 text-sm font-medium",
              jours === n
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {n} jours
          </button>
        ))}
      </div>
      <label className="grid gap-1 text-sm">
        Du
        <Input
          type="date"
          className="w-40"
          value={du}
          max={au}
          onChange={(e) => e.target.value && update({ jours: null, du: e.target.value, au })}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Au
        <Input
          type="date"
          className="w-40"
          value={au}
          min={du}
          onChange={(e) => e.target.value && update({ jours: null, du, au: e.target.value })}
        />
      </label>
    </div>
  );
}
