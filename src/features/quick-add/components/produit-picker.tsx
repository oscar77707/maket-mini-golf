"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/format";
import { UNITE_LABELS } from "@/features/stocks/labels";
import type { MouvementProduit } from "@/features/stocks/components/mouvement-sheet";
import type { ResultatProduit } from "../search";

const PAUSE_MS = 200;

/** Cherche un produit par nom ou référence (même API que la palette) et le renvoie au tiroir de mouvement. */
export function ProduitPicker({ onChoisir }: { onChoisir: (produit: MouvementProduit) => void }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [reponse, setReponse] = useState<{ pour: string; produits: ResultatProduit[] } | null>(
    null,
  );
  const [erreurPour, setErreurPour] = useState<string | null>(null);
  const liste = useRef<HTMLUListElement>(null);
  const terme = q.trim();

  useEffect(() => {
    if (terme.length < 2) return;
    const ctrl = new AbortController();
    const minuteur = setTimeout(async () => {
      try {
        const r = await fetch(`/api/recherche?q=${encodeURIComponent(terme)}`, {
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        const json = (await r.json()) as { produits: ResultatProduit[] };
        setReponse({ pour: terme, produits: json.produits });
        setErreurPour(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setErreurPour(terme);
      }
    }, PAUSE_MS);
    return () => {
      clearTimeout(minuteur);
      ctrl.abort();
    };
  }, [terme]);

  // seuls comptent les résultats de ce qui est affiché dans le champ (pas ceux d'une frappe précédente)
  const visibles = terme.length >= 2 && reponse?.pour === terme ? reponse.produits : null;
  const erreur = erreurPour === terme;
  const attente = terme.length >= 2 && !visibles && !erreur;
  const choisir = (p: ResultatProduit) =>
    onChoisir({
      id: p.id,
      nom: p.nom,
      unite: p.unite,
      stock_actuel: Number(p.stock_actuel),
      suivi_dlc: p.suivi_dlc,
    });
  const boutons = () => [...(liste.current?.querySelectorAll("button") ?? [])];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={id}>Produit</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={id}
            role="combobox"
            aria-expanded={!!visibles?.length}
            aria-controls={`${id}-liste`}
            autoComplete="off"
            autoFocus
            placeholder="Nom ou référence du produit"
            className="pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                boutons()[0]?.focus();
              } else if (e.key === "Enter" && visibles?.length) {
                e.preventDefault();
                choisir(visibles[0]);
              }
            }}
          />
          {attente && (
            <Loader2
              aria-hidden
              className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}
        </div>
      </div>
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          La recherche a échoué. Réessayez.
        </p>
      )}
      <p className="sr-only" role="status">
        {visibles ? `${visibles.length} produit(s) trouvé(s)` : ""}
      </p>
      {terme.length < 2 && (
        <p className="text-sm text-muted-foreground">Tapez au moins 2 lettres pour chercher.</p>
      )}
      {visibles && visibles.length === 0 && !attente && (
        <p className="text-sm text-muted-foreground">Aucun produit ne correspond à « {terme} ».</p>
      )}
      {!!visibles?.length && (
        <ul
          id={`${id}-liste`}
          ref={liste}
          aria-label="Produits trouvés"
          className="divide-y rounded-md border"
          onKeyDown={(e) => {
            const b = boutons();
            const i = b.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "ArrowDown" && i < b.length - 1) {
              e.preventDefault();
              b[i + 1].focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              (i > 0 ? b[i - 1] : document.getElementById(id))?.focus();
            }
          }}
        >
          {visibles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choisir(p)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.nom}</span>
                  {p.reference && (
                    <span className="block truncate text-sm text-muted-foreground">
                      Réf. {p.reference}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {formatNumber(Number(p.stock_actuel), 3)} {UNITE_LABELS[p.unite]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
