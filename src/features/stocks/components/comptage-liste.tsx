"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { notify } from "@/components/feedback/notify";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { LigneInventaire } from "../queries";
import { saveComptage } from "../actions";
import { UNITE_LABELS } from "../labels";

type Etat = { comptee: number | null; theorique: number | null; ecart: number | null };
type Filtre = "a_compter" | "comptes" | "ecarts" | "tous";

/**
 * Liste de comptage pensée pour le téléphone : un gros champ par produit, enregistré dès qu'on quitte le champ.
 * `voirEcarts` : les responsables voient stock théorique et écarts ; les salariés comptent « à l'aveugle ».
 */
export function ComptageListe({
  lignes,
  categories,
  verrouille,
  voirEcarts,
}: {
  lignes: LigneInventaire[];
  categories: Map<string, string>;
  verrouille: boolean;
  voirEcarts: boolean;
}) {
  const [etats, setEtats] = useState<Record<string, Etat>>(() =>
    Object.fromEntries(
      lignes.map((l) => [
        l.id,
        { comptee: l.quantite_comptee, theorique: l.stock_theorique, ecart: l.ecart },
      ]),
    ),
  );
  const [saisies, setSaisies] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lignes.map((l) => [
        l.id,
        l.quantite_comptee === null ? "" : String(l.quantite_comptee).replace(".", ","),
      ]),
    ),
  );
  const [statut, setStatut] = useState<Record<string, "saving" | "saved" | "error">>({});
  // à l'ouverture : les lignes restantes à compter ; s'il n'y en a plus (inventaire soumis ou validé), tout le détail
  const [filtre, setFiltre] = useState<Filtre>(() =>
    verrouille || lignes.every((l) => l.quantite_comptee !== null)
      ? voirEcarts
        ? "ecarts"
        : "tous"
      : "a_compter",
  );
  const [recherche, setRecherche] = useState("");
  // lignes comptées pendant cette visite : elles restent dans « À compter » pour que la coche « Enregistré » soit vue
  const [recents, setRecents] = useState<Set<string>>(() => new Set());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const compte = (l: LigneInventaire) =>
    etats[l.id]?.comptee !== null && etats[l.id]?.comptee !== undefined;
  const nbComptes = lignes.filter(compte).length;
  const nbEcarts = lignes.filter((l) => compte(l) && (etats[l.id]?.ecart ?? 0) !== 0).length;

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return lignes.filter((l) => {
      if (q && !l.nom.toLowerCase().includes(q)) return false;
      const c = etats[l.id]?.comptee !== null && etats[l.id]?.comptee !== undefined;
      if (filtre === "a_compter") return !c || recents.has(l.id);
      if (filtre === "comptes") return c;
      if (filtre === "ecarts") return c && (etats[l.id]?.ecart ?? 0) !== 0;
      return true;
    });
  }, [lignes, etats, filtre, recherche, recents]);

  async function enregistrer(l: LigneInventaire) {
    const texte = (saisies[l.id] ?? "").trim();
    const actuel = etats[l.id]?.comptee ?? null;
    const valeur = texte === "" ? null : Number(texte.replace(/\s/g, "").replace(",", "."));
    if (valeur !== null && Number.isNaN(valeur)) {
      notify({ ok: false, message: `« ${texte} » n'est pas un nombre.` });
      return;
    }
    if (valeur === actuel) return;
    setStatut((s) => ({ ...s, [l.id]: "saving" }));
    const result = await saveComptage({ ligne_id: l.id, quantite: valeur });
    if (!result.ok) {
      setStatut((s) => ({ ...s, [l.id]: "error" }));
      notify(result);
      return;
    }
    if (valeur !== null) setRecents((r) => new Set(r).add(l.id));
    setEtats((e) => ({
      ...e,
      [l.id]: {
        comptee: valeur,
        theorique: result.data.stock_theorique,
        ecart: valeur === null ? null : result.data.ecart,
      },
    }));
    setStatut((s) => ({ ...s, [l.id]: "saved" }));
  }

  const filtres: { id: Filtre; label: string; n: number }[] = [
    { id: "a_compter", label: "À compter", n: lignes.length - nbComptes },
    { id: "comptes", label: "Comptés", n: nbComptes },
    ...(voirEcarts ? [{ id: "ecarts" as const, label: "Écarts", n: nbEcarts }] : []),
    { id: "tous", label: "Tous", n: lignes.length },
  ];

  return (
    <div className="space-y-4">
      <div
        className="h-3 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Avancement du comptage"
        aria-valuemin={0}
        aria-valuemax={lignes.length}
        aria-valuenow={nbComptes}
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${lignes.length ? (100 * nbComptes) / lignes.length : 0}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {nbComptes} produit{nbComptes > 1 ? "s" : ""} compté{nbComptes > 1 ? "s" : ""} sur{" "}
        {lignes.length}
      </p>

      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Rechercher un produit à compter"
          placeholder="Rechercher un produit"
          className="pl-10"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      <div role="group" aria-label="Filtrer les lignes" className="flex flex-wrap gap-2">
        {filtres.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtre === f.id}
            onClick={() => setFiltre(f.id)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm font-medium",
              filtre === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {f.label} ({f.n})
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-8 text-center text-muted-foreground">
          {filtre === "a_compter" && lignes.length > 0 && nbComptes === lignes.length
            ? "Tout est compté. Vous pouvez soumettre l'inventaire."
            : filtre === "ecarts" && nbComptes > 0
              ? "Aucun écart : le stock compté correspond au stock théorique."
              : "Aucun produit dans cette liste."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((l, index) => {
            const etat = etats[l.id];
            const s = statut[l.id];
            return (
              <li key={l.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <label htmlFor={`c-${l.id}`} className="block text-base font-semibold">
                    {l.nom}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {l.categorie_id ? `${categories.get(l.categorie_id) ?? ""} · ` : ""}en{" "}
                    {UNITE_LABELS[l.unite]}
                    {voirEcarts &&
                    etat?.theorique !== null &&
                    etat?.theorique !== undefined &&
                    compte(l)
                      ? ` · théorique ${formatNumber(etat.theorique, 3)}`
                      : ""}
                  </p>
                  {voirEcarts && compte(l) && etat?.ecart !== null && etat?.ecart !== undefined && (
                    <Badge variant={etat.ecart === 0 ? "vert" : "orange"}>
                      {etat.ecart === 0
                        ? "Aucun écart"
                        : `Écart ${etat.ecart > 0 ? "+" : ""}${formatNumber(etat.ecart, 3)}`}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`c-${l.id}`}
                    ref={(el) => {
                      inputs.current[l.id] = el;
                    }}
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="next"
                    disabled={verrouille}
                    className="h-14 w-28 text-center text-2xl"
                    value={saisies[l.id] ?? ""}
                    onChange={(e) => {
                      setSaisies((v) => ({ ...v, [l.id]: e.target.value }));
                      setStatut((st) => {
                        const next = { ...st };
                        delete next[l.id];
                        return next;
                      });
                    }}
                    onBlur={() => void enregistrer(l)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const next = visibles[index + 1];
                      if (next) inputs.current[next.id]?.focus();
                      else e.currentTarget.blur();
                    }}
                  />
                  <span className="flex size-6 items-center justify-center" aria-live="polite">
                    {s === "saving" && (
                      <Loader2
                        aria-label="Enregistrement"
                        className="size-5 animate-spin text-muted-foreground"
                      />
                    )}
                    {s === "saved" && (
                      <Check aria-label="Enregistré" className="size-5 text-green-600" />
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
