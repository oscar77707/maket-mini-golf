"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { notify } from "@/components/feedback/notify";
import { UNITE_LABELS } from "@/features/stocks/labels";
import { parseDecimal } from "@/lib/csv";
import { formatEuro, formatNumber } from "@/lib/format";
import { removeLigne, saveLigne } from "../actions";
import type { LigneDetail, ProduitCommandable } from "../queries";

const text = (n: number) => String(n).replace(".", ",");
const round2 = (n: number) => Math.round(n * 100) / 100;

type Saisie = { quantite: string; prix: string };
type Etat = "saving" | "saved" | "error";

/**
 * Lignes d'une commande. En brouillon ou « à valider », la quantité et le prix se modifient sur place
 * (enregistrés dès qu'on quitte le champ) ; ensuite la liste est en lecture seule.
 */
export function LignesCommande({
  commandeId,
  lignes,
  editable,
  produits,
  minimumHt,
}: {
  commandeId: string;
  lignes: LigneDetail[];
  editable: boolean;
  produits: ProduitCommandable[];
  minimumHt: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // saisies en cours ; une ligne pas encore modifiée (ou ajoutée depuis) reprend les valeurs du serveur
  const [saisies, setSaisies] = useState<Record<string, Saisie>>({});
  const depart = (l: LigneDetail): Saisie => ({
    quantite: text(l.quantite),
    prix: text(l.prix_unitaire_ht),
  });
  const saisie = (l: LigneDetail): Saisie => saisies[l.id] ?? depart(l);
  const modifie = (l: LigneDetail, patch: Partial<Saisie>) =>
    setSaisies((v) => ({ ...v, [l.id]: { ...(v[l.id] ?? depart(l)), ...patch } }));
  const [etats, setEtats] = useState<Record<string, Etat>>({});
  const [ajout, setAjout] = useState(false);
  const derniers = useRef<Record<string, Saisie>>({});

  const valeurs = (l: LigneDetail) => {
    const s = saisie(l);
    return { quantite: parseDecimal(s.quantite), prix: parseDecimal(s.prix) };
  };
  const montant = (l: LigneDetail) => {
    const { quantite, prix } = valeurs(l);
    return Number.isFinite(quantite) && Number.isFinite(prix) ? round2(quantite * prix) : 0;
  };
  const total = round2(lignes.reduce((sum, l) => sum + montant(l), 0));
  const manque = round2(minimumHt - total);

  async function enregistrer(l: LigneDetail) {
    const s = saisie(l);
    const dernier = derniers.current[l.id] ?? depart(l);
    if (s.quantite === dernier.quantite && s.prix === dernier.prix) return;
    setEtats((e) => ({ ...e, [l.id]: "saving" }));
    const result = await saveLigne({
      commande_id: commandeId,
      produit_id: l.produit_id,
      quantite: s.quantite,
      prix_unitaire_ht: s.prix,
    });
    if (!result.ok) {
      setEtats((e) => ({ ...e, [l.id]: "error" }));
      notify(result);
      return;
    }
    derniers.current[l.id] = s;
    setEtats((e) => ({ ...e, [l.id]: "saved" }));
    router.refresh();
  }

  return (
    <section className="space-y-3" aria-labelledby="lignes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="lignes" className="text-lg font-semibold">
          Lignes de la commande
        </h2>
        {editable && (
          <Button variant="outline" onClick={() => setAjout(true)}>
            <Plus aria-hidden />
            Ajouter des produits
          </Button>
        )}
      </div>

      {lignes.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-card p-6 text-center text-muted-foreground">
          {editable
            ? "Aucun produit pour le moment. Ajoutez ceux à commander : les quantités conseillées sont proposées."
            : "Cette commande n'a aucune ligne."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {lignes.map((l) => {
            const s = saisie(l);
            const etat = etats[l.id];
            const unite = UNITE_LABELS[l.unite];
            return (
              <li
                key={l.id}
                className="grid gap-3 p-4 md:grid-cols-[1fr_9rem_9rem_7rem_auto] md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/stocks/${l.produit_id}`}
                    className="block font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {l.produit_nom}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Stock {formatNumber(l.stock_actuel, 3)} {unite} · seuil{" "}
                    {formatNumber(l.seuil_minimum, 3)}
                    {l.reference_fournisseur ? ` · réf. ${l.reference_fournisseur}` : ""}
                    {l.conditionnement > 1 ? ` · par ${formatNumber(l.conditionnement, 3)}` : ""}
                  </p>
                </div>
                {editable ? (
                  <>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Quantité ({unite})</span>
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Quantité de ${l.produit_nom}`}
                        value={s.quantite}
                        onChange={(e) => modifie(l, { quantite: e.target.value })}
                        onBlur={() => void enregistrer(l)}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Prix HT (€)</span>
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Prix HT de ${l.produit_nom}`}
                        value={s.prix}
                        onChange={(e) => modifie(l, { prix: e.target.value })}
                        onBlur={() => void enregistrer(l)}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="text-sm text-muted-foreground md:hidden">Quantité : </span>
                      {formatNumber(l.quantite, 3)} {unite}
                    </p>
                    <p>
                      <span className="text-sm text-muted-foreground md:hidden">Prix HT : </span>
                      {formatEuro(l.prix_unitaire_ht)}
                    </p>
                  </>
                )}
                <p className="font-semibold md:text-right">{formatEuro(montant(l))}</p>
                {editable && (
                  <div className="flex items-center justify-end gap-1">
                    <span className="flex size-6 items-center justify-center" aria-live="polite">
                      {etat === "saving" && (
                        <Loader2
                          aria-label="Enregistrement"
                          className="size-5 animate-spin text-muted-foreground"
                        />
                      )}
                      {etat === "saved" && (
                        <Check aria-label="Enregistré" className="size-5 text-green-600" />
                      )}
                      {etat === "error" && (
                        <TriangleAlert aria-label="Erreur" className="size-5 text-destructive" />
                      )}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Retirer ${l.produit_nom}`}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          notify(await removeLigne(l.id));
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {lignes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {minimumHt > 0 && manque > 0 ? (
            <p
              role="status"
              className="flex items-center gap-2 rounded-md border border-orange-600/40 bg-orange-500/10 px-3 py-2 text-sm text-orange-800 dark:text-orange-300"
            >
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              Minimum de commande non atteint : il manque {formatEuro(manque)} (minimum{" "}
              {formatEuro(minimumHt)}).
            </p>
          ) : (
            <span />
          )}
          <p className="text-lg">
            Total HT : <strong aria-label="Total HT">{formatEuro(total)}</strong>
          </p>
        </div>
      )}

      {editable && (
        <Sheet open={ajout} onOpenChange={setAjout}>
          <SheetContent
            title="Ajouter des produits"
            description="Un clic ajoute le produit avec la quantité conseillée et le prix du fournisseur."
          >
            <AjoutProduits
              commandeId={commandeId}
              produits={produits}
              dejaLa={new Set(lignes.map((l) => l.produit_id))}
            />
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}

function AjoutProduits({
  commandeId,
  produits,
  dejaLa,
}: {
  commandeId: string;
  produits: ProduitCommandable[];
  dejaLa: Set<string>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [ajoutes, setAjoutes] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<string | null>(null);
  const filtres = produits.filter((p) => p.nom.toLowerCase().includes(q.trim().toLowerCase()));

  async function ajouter(p: ProduitCommandable) {
    setEnCours(p.id);
    const result = await saveLigne({
      commande_id: commandeId,
      produit_id: p.id,
      quantite: text(p.suggestion),
      prix_unitaire_ht: text(p.prix),
    });
    setEnCours(null);
    if (!notify(result, { success: `« ${p.nom} » ajouté.` })) return;
    setAjoutes((a) => new Set(a).add(p.id));
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Rechercher un produit à ajouter"
          placeholder="Rechercher un produit"
          className="pl-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {filtres.length === 0 ? (
        <p className="text-center text-muted-foreground">Aucun produit ne correspond.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {filtres.map((p) => {
            const deja = dejaLa.has(p.id) || ajoutes.has(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{p.nom}</p>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    Stock {formatNumber(p.stock_actuel, 3)} {UNITE_LABELS[p.unite]}
                    {p.niveau_alerte === "rouge" && <Badge variant="rouge">Sous le seuil</Badge>}
                    {p.niveau_alerte === "orange" && (
                      <Badge variant="orange">Proche du seuil</Badge>
                    )}
                    {!p.associe && <Badge>Hors catalogue fournisseur</Badge>}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={deja ? "ghost" : "outline"}
                  disabled={deja || enCours === p.id}
                  aria-label={deja ? `${p.nom} déjà ajouté` : `Ajouter ${p.nom}`}
                  onClick={() => void ajouter(p)}
                >
                  {deja ? (
                    <Check aria-hidden className="size-4" />
                  ) : enCours === p.id ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : (
                    <Plus aria-hidden className="size-4" />
                  )}
                  {deja ? "Ajouté" : "Ajouter"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
