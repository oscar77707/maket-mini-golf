import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { EmptyState } from "./empty-state";

/** Écran provisoire des modules pas encore construits (retiré au fil des étapes). */
export function ModulePlaceholder({
  title,
  step,
  icon,
}: {
  title: string;
  step: number;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <EmptyState
        icon={icon ?? Hammer}
        title="Ce module arrive bientôt"
        description={`Il sera construit à l'étape ${step} du plan de développement.`}
      />
    </div>
  );
}
