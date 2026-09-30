"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PoleBadge } from "@/components/ui/pole-badge";
import { notify } from "@/components/feedback/notify";
import {
  createReferentiel,
  deleteReferentiel,
  moveReferentiel,
  renameReferentiel,
} from "../actions-stocks";
import type { ReferentielLigne } from "../queries";
import type { Referentiel } from "../schemas";
import type { PoleOption } from "./role-pole-fields";

const TEXTES: Record<
  Referentiel,
  { singulier: string; nouveau: string; ajouter: string; titre: string; description: string }
> = {
  categories_produit: {
    singulier: "catégorie",
    nouveau: "Nouvelle catégorie",
    ajouter: "Ajouter une catégorie",
    titre: "Catégories de produits",
    description:
      "Le classement du catalogue (Viandes, Boissons, Entretien...). Propre à chaque pôle.",
  },
  lieux_stockage: {
    singulier: "lieu de stockage",
    nouveau: "Nouveau lieu de stockage",
    ajouter: "Ajouter un lieu de stockage",
    titre: "Lieux de stockage",
    description:
      "Où se trouvent les produits (chambre froide, réserve sèche...). Propre à chaque pôle.",
  },
};

export function ReferentielListe({
  table,
  poles,
  lignes,
}: {
  table: Referentiel;
  poles: PoleOption[];
  lignes: ReferentielLigne[];
}) {
  const t = TEXTES[table];
  return (
    <section aria-label={t.titre} className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t.titre}</h2>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        {poles.map((p) => (
          <PoleCarte
            key={p.id}
            table={table}
            pole={p}
            lignes={lignes.filter((l) => l.pole_id === p.id)}
          />
        ))}
      </div>
    </section>
  );
}

function PoleCarte({
  table,
  pole,
  lignes,
}: {
  table: Referentiel;
  pole: PoleOption;
  lignes: ReferentielLigne[];
}) {
  const router = useRouter();
  const t = TEXTES[table];
  const [pending, startTransition] = useTransition();
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [renommage, setRenommage] = useState<{ id: string; nom: string } | null>(null);

  const executer = (action: () => Promise<Parameters<typeof notify>[0]>, apres?: () => void) =>
    startTransition(async () => {
      const result = await action();
      if (notify(result)) {
        router.refresh();
        apres?.();
      }
    });

  const ajouter = (event: React.FormEvent) => {
    event.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const result = await createReferentiel(table, pole.id, nouveau);
      if (!result.ok) {
        setErreur(result.fieldErrors?.nom ?? result.message);
        return;
      }
      notify(result);
      setNouveau("");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <PoleBadge code={pole.code} nom={pole.nom} />
        </CardTitle>
        <CardDescription>
          {lignes.length} {t.singulier}
          {lignes.length > 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-md border" aria-label={`${t.titre} du pôle ${pole.nom}`}>
          {lignes.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Aucun élément.</li>
          )}
          {lignes.map((l, i) => (
            <li key={l.id} className="flex items-center gap-1 p-2">
              {renommage?.id === l.id ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    executer(
                      () => renameReferentiel(table, l.id, renommage.nom),
                      () => setRenommage(null),
                    );
                  }}
                >
                  <Input
                    aria-label={`Nouveau nom de ${l.nom}`}
                    value={renommage.nom}
                    autoFocus
                    onChange={(e) => setRenommage({ id: l.id, nom: e.target.value })}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    variant="ghost"
                    aria-label="Valider le nom"
                    disabled={pending}
                  >
                    <Check aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Annuler le renommage"
                    onClick={() => setRenommage(null)}
                  >
                    <X aria-hidden />
                  </Button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1 px-1">
                    <p className="truncate font-medium">{l.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.nb_produits === 0
                        ? "Aucun produit"
                        : `${l.nb_produits} produit${l.nb_produits > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Monter ${l.nom}`}
                    disabled={pending || i === 0}
                    onClick={() => executer(() => moveReferentiel(table, l.id, "haut"))}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Descendre ${l.nom}`}
                    disabled={pending || i === lignes.length - 1}
                    onClick={() => executer(() => moveReferentiel(table, l.id, "bas"))}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Renommer ${l.nom}`}
                    onClick={() => setRenommage({ id: l.id, nom: l.nom })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    aria-label={`Supprimer ${l.nom}`}
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${l.nom} » ?`))
                        executer(() => deleteReferentiel(table, l.id));
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form
          onSubmit={ajouter}
          className="space-y-2"
          aria-label={`${t.ajouter} au pôle ${pole.nom}`}
        >
          <div className="flex gap-2">
            <Input
              className="min-w-0"
              aria-label={`${t.nouveau} pour le pôle ${pole.nom}`}
              placeholder={t.nouveau}
              autoComplete="off"
              value={nouveau}
              aria-invalid={!!erreur}
              onChange={(e) => setNouveau(e.target.value)}
            />
            <Button
              type="submit"
              disabled={pending}
              aria-label={`${t.ajouter} au pôle ${pole.nom}`}
            >
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
              Ajouter
            </Button>
          </div>
          {erreur && (
            <p role="alert" className="text-sm text-destructive">
              {erreur}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
