import { History } from "lucide-react";

/** Bandeau affiché quand un formulaire a retrouvé la saisie interrompue de la personne. */
export function BrouillonBanner({ onEffacer }: { onEffacer: () => void }) {
  return (
    <div
      role="status"
      data-testid="brouillon-repris"
      className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
    >
      <span className="flex items-center gap-2">
        <History aria-hidden className="size-4 shrink-0 text-primary" />
        Brouillon repris : votre saisie précédente a été retrouvée.
      </span>
      <button
        type="button"
        onClick={onEffacer}
        className="shrink-0 font-medium text-primary underline underline-offset-4"
      >
        Effacer le brouillon
      </button>
    </div>
  );
}
