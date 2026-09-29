"use client";

import { cn } from "@/lib/utils";
import { JOURS } from "../labels";

/** Sélecteur de jours de la semaine (L M M J V S D) : gros boutons à bascule, utilisable au doigt. */
export function JoursSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (jours: number[]) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {JOURS.map((j) => {
        const active = value.includes(j.value);
        return (
          <button
            key={j.value}
            type="button"
            aria-pressed={active}
            aria-label={j.long}
            title={j.long}
            onClick={() =>
              onChange(active ? value.filter((v) => v !== j.value) : [...value, j.value].sort())
            }
            className={cn(
              "size-11 rounded-md border text-base font-medium",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {j.court}
          </button>
        );
      })}
    </div>
  );
}
