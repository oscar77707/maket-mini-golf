"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Un problème est survenu",
  description = "Cette page n'a pas pu s'afficher. Vos données ne sont pas perdues.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-card px-6 py-14 text-center"
    >
      <TriangleAlert aria-hidden className="size-10 text-destructive" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
