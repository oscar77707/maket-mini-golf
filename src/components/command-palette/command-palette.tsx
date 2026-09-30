"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Boxes,
  ClipboardList,
  CornerDownLeft,
  Keyboard,
  Loader2,
  Search,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useQuickAdd } from "@/features/quick-add/context";
import { ajoutsFor } from "@/features/quick-add/registry";
import type { ResultatsRecherche } from "@/features/quick-add/search";
import { STATUT_LABELS } from "@/features/commandes/labels";
import { UNITE_LABELS } from "@/features/stocks/labels";
import { navFor } from "@/lib/auth/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/models";

const PAUSE_MS = 200;
const MIN_CARACTERES = 2;

type Entree = {
  id: string;
  groupe: string;
  label: string;
  detail?: string;
  raccourci?: string;
  icon: LucideIcon;
  /** Mots de recherche en plus de l'intitulé et du détail. */
  mots?: string;
  lancer: () => void;
};

/** Minuscules sans accents : « fournisseur » trouve « Fournisséur ». */
const normaliser = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const GROUPES_SERVEUR = ["Produits", "Fournisseurs", "Commandes"];

/** Palette Ctrl/⌘ K : actions, pages, et recherche de produits, fournisseurs et commandes. */
export function CommandPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}) {
  const lanceAction = useRef(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Recherche et actions"
        description="Tapez pour chercher un produit, un fournisseur, une commande, une page ou une action."
        hideTitle
        hideClose
        className="top-[6vh]"
        onCloseAutoFocus={(e) => {
          // une action vient d'ouvrir un tiroir ou une page : le focus ne revient pas derrière
          if (lanceAction.current) e.preventDefault();
          lanceAction.current = false;
        }}
      >
        <Contenu
          role={role}
          fermer={() => onOpenChange(false)}
          signalerAction={() => {
            lanceAction.current = true;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Contenu({
  role,
  fermer,
  signalerAction,
}: {
  role: Role;
  fermer: () => void;
  signalerAction: () => void;
}) {
  const router = useRouter();
  const { ouvrir, ouvrirAide } = useQuickAdd();
  const id = useId();
  const [q, setQ] = useState("");
  const [serveur, setServeur] = useState<{ pour: string; res: ResultatsRecherche } | null>(null);
  const [erreurPour, setErreurPour] = useState<string | null>(null);
  const entreeEnAttente = useRef(false);
  const [actif, setActif] = useState(0);
  const liste = useRef<HTMLDivElement>(null);
  const terme = q.trim();

  useEffect(() => {
    if (terme.length < MIN_CARACTERES) return;
    const ctrl = new AbortController();
    const minuteur = setTimeout(async () => {
      try {
        const r = await fetch(`/api/recherche?q=${encodeURIComponent(terme)}`, {
          signal: ctrl.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        setServeur({ pour: terme, res: (await r.json()) as ResultatsRecherche });
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

  // une erreur ou des résultats ne valent que pour le texte qui les a demandés
  const erreur = erreurPour === terme;
  const attente = terme.length >= MIN_CARACTERES && serveur?.pour !== terme && !erreur;

  const elements = useMemo(() => {
    const aller = (href: string) => () => router.push(href);
    const fixes: Entree[] = [
      ...ajoutsFor(role).map<Entree>((a) => ({
        id: `ajout-${a.id}`,
        groupe: "Ajouter",
        label: a.label,
        detail: a.description,
        icon: a.icon,
        mots: a.mots.join(" "),
        lancer: () => ouvrir(a.id),
      })),
      ...navFor(role).map<Entree>((n) => ({
        id: `page-${n.href}`,
        groupe: "Aller à",
        label: n.label,
        raccourci: `G ${n.key.toUpperCase()}`,
        icon: n.icon,
        mots: "page ouvrir aller",
        lancer: aller(n.href),
      })),
      {
        id: "page-compte",
        groupe: "Aller à",
        label: "Mon compte",
        icon: UserRound,
        mots: "profil mot de passe page",
        lancer: aller("/mon-compte"),
      },
      {
        id: "aide",
        groupe: "Aide",
        label: "Raccourcis clavier",
        detail: "Voir toutes les touches utiles",
        raccourci: "?",
        icon: Keyboard,
        mots: "aide clavier touches",
        lancer: ouvrirAide,
      },
    ];
    const mots = normaliser(terme).split(/\s+/).filter(Boolean);
    const gardes = fixes.filter((e) => {
      const foin = normaliser(`${e.label} ${e.detail ?? ""} ${e.mots ?? ""}`);
      return mots.every((m) => foin.includes(m));
    });

    const res = serveur?.pour === terme ? serveur.res : null;
    const trouves: Entree[] = res
      ? [
          ...res.produits.map<Entree>((p) => ({
            id: `produit-${p.id}`,
            groupe: "Produits",
            label: p.nom,
            detail: `Stock ${formatNumber(Number(p.stock_actuel), 3)} ${UNITE_LABELS[p.unite]}${p.reference ? ` · Réf. ${p.reference}` : ""}`,
            icon: Boxes,
            lancer: aller(`/stocks/${p.id}`),
          })),
          ...res.fournisseurs.map<Entree>((f) => ({
            id: `fournisseur-${f.id}`,
            groupe: "Fournisseurs",
            label: f.nom,
            detail: f.contact_nom ?? undefined,
            icon: Truck,
            lancer: aller(`/fournisseurs/${f.id}`),
          })),
          ...res.commandes.map<Entree>((c) => ({
            id: `commande-${c.id}`,
            groupe: "Commandes",
            label: c.reference,
            detail: `${c.fournisseur_nom} · ${STATUT_LABELS[c.statut]}`,
            icon: ClipboardList,
            lancer: aller(`/commandes/${c.id}`),
          })),
        ]
      : [];
    // ce que l'on cherche vraiment (un produit, une commande) passe avant les actions qui ressemblent
    return terme.length >= MIN_CARACTERES ? [...trouves, ...gardes] : gardes;
  }, [role, terme, serveur, router, ouvrir, ouvrirAide]);

  const indexActif = Math.min(actif, Math.max(elements.length - 1, 0));

  useEffect(() => {
    liste.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [indexActif, elements]);

  const lancer = (e: Entree | undefined) => {
    if (!e) return;
    signalerAction();
    fermer();
    e.lancer();
  };

  const groupes = [...new Set(elements.map((e) => e.groupe))].sort(
    (a, b) => Number(!GROUPES_SERVEUR.includes(a)) - Number(!GROUPES_SERVEUR.includes(b)),
  );
  const ordonnes = groupes.flatMap((g) => elements.filter((e) => e.groupe === g));
  const positionDe = (e: Entree) => ordonnes.indexOf(e);

  // Entrée pressée avant l'arrivée des résultats : on ouvre le premier résultat dès qu'il arrive
  // (sans cela, Entrée lancerait une action qui ressemble au texte au lieu de ce que l'on cherche)
  useEffect(() => {
    if (entreeEnAttente.current && !attente) {
      entreeEnAttente.current = false;
      lancer(ordonnes[0]);
    }
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative border-b">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          role="combobox"
          aria-label="Recherche et actions"
          aria-expanded={ordonnes.length > 0}
          aria-controls={`${id}-liste`}
          aria-activedescendant={
            ordonnes[indexActif] ? `${id}-${ordonnes[indexActif].id}` : undefined
          }
          aria-autocomplete="list"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Chercher un produit, une commande, une page, une action…"
          className="h-14 w-full bg-transparent pl-12 pr-12 text-base outline-none placeholder:text-muted-foreground"
          value={q}
          onChange={(e) => {
            entreeEnAttente.current = false;
            setQ(e.target.value);
            setActif(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActif(ordonnes.length ? (indexActif + 1) % ordonnes.length : 0);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActif(ordonnes.length ? (indexActif - 1 + ordonnes.length) % ordonnes.length : 0);
            } else if (e.key === "Home") {
              e.preventDefault();
              setActif(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setActif(Math.max(ordonnes.length - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (attente) entreeEnAttente.current = true;
              else lancer(ordonnes[indexActif]);
            }
          }}
        />
        {attente && (
          <Loader2
            aria-hidden
            className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div id={`${id}-liste`} ref={liste} role="listbox" aria-label="Résultats">
          {groupes.map((g, gi) => (
            <div key={g} role="group" aria-labelledby={`${id}-g${gi}`} className="py-1">
              <div
                id={`${id}-g${gi}`}
                role="presentation"
                className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {g}
              </div>
              {ordonnes
                .filter((e) => e.groupe === g)
                .map((e) => {
                  const Icone = e.icon;
                  const selectionne = positionDe(e) === indexActif;
                  return (
                    <div
                      key={e.id}
                      id={`${id}-${e.id}`}
                      role="option"
                      aria-selected={selectionne}
                      onMouseMove={() => setActif(positionDe(e))}
                      onClick={() => lancer(e)}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                        selectionne && "bg-muted",
                      )}
                    >
                      <Icone aria-hidden className="size-5 shrink-0 text-primary" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{e.label}</span>
                        {e.detail && (
                          <span className="truncate text-sm text-muted-foreground">{e.detail}</span>
                        )}
                      </span>
                      {e.raccourci && (
                        <span aria-hidden className="hidden shrink-0 gap-1 sm:flex">
                          {e.raccourci.split(" ").map((t) => (
                            <Kbd key={t}>{t}</Kbd>
                          ))}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
        {erreur && (
          <p className="px-3 py-3 text-center text-sm text-destructive">
            La recherche a échoué. Réessayez dans un instant.
          </p>
        )}
        {!ordonnes.length && !attente && !erreur && (
          <p className="px-3 py-8 text-center text-muted-foreground">
            {terme.length < MIN_CARACTERES
              ? "Aucune action ne correspond."
              : `Rien ne correspond à « ${terme} ».`}
          </p>
        )}
        {attente && !ordonnes.length && (
          <p className="px-3 py-8 text-center text-muted-foreground">Recherche en cours…</p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {attente
            ? "Recherche en cours"
            : ordonnes.length
              ? `${ordonnes.length} résultat${ordonnes.length > 1 ? "s" : ""}`
              : "Aucun résultat"}
        </p>
      </div>

      <div
        aria-hidden
        className="hidden items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground sm:flex"
      >
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> choisir
        </span>
        <span className="flex items-center gap-1">
          <Kbd>
            <CornerDownLeft className="size-3" />
          </Kbd>{" "}
          ouvrir
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Échap</Kbd> fermer
        </span>
      </div>
    </div>
  );
}
