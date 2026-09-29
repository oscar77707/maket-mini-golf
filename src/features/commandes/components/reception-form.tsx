"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCheck, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notify } from "@/components/feedback/notify";
import { FormField } from "@/features/auth/form-field";
import { UNITE_LABELS } from "@/features/stocks/labels";
import { parseDecimal } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import type { Unite } from "@/types/models";
import { enregistrerReception } from "../actions";
import { MOTIFS_ECART } from "../labels";

export type LigneReception = {
  id: string;
  produit_nom: string;
  unite: Unite;
  suivi_dlc: boolean;
  quantite_commandee: number;
  quantite_recue: number;
  prix_unitaire_ht: number | null;
  motif_ecart: string | null;
  dlc: string | null;
  numero_lot: string | null;
};

type Saisie = { recue: string; prix: string; motif: string; dlc: string; lot: string };

const text = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** Pointage d'une livraison : tout est pré-rempli « comme commandé », on ne corrige que les écarts. */
export function ReceptionForm({
  livraisonId,
  commandeId,
  reference,
  lignes,
  numeroBl,
  commentaire,
}: {
  livraisonId: string;
  commandeId: string;
  reference: string;
  lignes: LigneReception[];
  numeroBl: string | null;
  commentaire: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entete, setEntete] = useState({ bl: numeroBl ?? "", commentaire: commentaire ?? "" });
  const [saisies, setSaisies] = useState<Record<string, Saisie>>(() =>
    Object.fromEntries(
      lignes.map((l) => [
        l.id,
        {
          recue: text(l.quantite_recue),
          prix: text(l.prix_unitaire_ht),
          motif: l.motif_ecart ?? "",
          dlc: l.dlc ?? "",
          lot: l.numero_lot ?? "",
        },
      ]),
    ),
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [globale, setGlobale] = useState<string | null>(null);

  const change = (id: string, patch: Partial<Saisie>) =>
    setSaisies((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const ecart = (l: LigneReception) => {
    const recue = parseDecimal(saisies[l.id].recue);
    return Number.isFinite(recue) ? Math.round((recue - l.quantite_commandee) * 1000) / 1000 : 0;
  };
  const nbEcarts = lignes.filter((l) => ecart(l) !== 0).length;

  const envoyer = (valider: boolean) =>
    startTransition(async () => {
      setGlobale(null);
      const result = await enregistrerReception({
        livraison_id: livraisonId,
        numero_bon_livraison: entete.bl,
        commentaire: entete.commentaire,
        valider,
        lignes: lignes.map((l) => ({
          id: l.id,
          quantite_recue: saisies[l.id].recue,
          prix_unitaire_ht: saisies[l.id].prix,
          motif_ecart: saisies[l.id].motif,
          dlc: saisies[l.id].dlc,
          numero_lot: saisies[l.id].lot,
        })),
      });
      if (!result.ok) {
        const parEndroit: Record<string, string> = {};
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          const m = key.match(/^lignes\.(\d+)\.(.+)$/);
          if (m && lignes[Number(m[1])]) parEndroit[`${lignes[Number(m[1])].id}.${m[2]}`] = message;
        }
        setErreurs(parEndroit);
        setGlobale(result.message);
        return;
      }
      setErreurs({});
      notify(result);
      if (valider) {
        router.push(`/commandes/${commandeId}`);
        router.refresh();
      }
    });

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer(true);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="bl" label="Numéro du bon de livraison (facultatif)">
          <Input
            id="bl"
            autoComplete="off"
            value={entete.bl}
            onChange={(e) => setEntete((v) => ({ ...v, bl: e.target.value }))}
          />
        </FormField>
        <FormField id="commentaire" label="Commentaire (facultatif)">
          <Input
            id="commentaire"
            autoComplete="off"
            value={entete.commentaire}
            onChange={(e) => setEntete((v) => ({ ...v, commentaire: e.target.value }))}
          />
        </FormField>
      </div>

      <ul className="space-y-3" aria-label={`Lignes de la livraison ${reference}`}>
        {lignes.map((l) => {
          const s = saisies[l.id];
          const e = ecart(l);
          const unite = UNITE_LABELS[l.unite];
          const recue = parseDecimal(s.recue);
          const besoinDlc = l.suivi_dlc && Number.isFinite(recue) && recue > 0;
          return (
            <li key={l.id} className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{l.produit_nom}</p>
                  <p className="text-sm text-muted-foreground">
                    Commandé : {formatNumber(l.quantite_commandee, 3)} {unite}
                  </p>
                </div>
                {e === 0 ? (
                  <Badge variant="vert">Conforme</Badge>
                ) : (
                  <Badge variant="orange">
                    Écart {e > 0 ? "+" : ""}
                    {formatNumber(e, 3)} {unite}
                  </Badge>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  id={`recue-${l.id}`}
                  label={`Quantité reçue (${unite})`}
                  error={erreurs[`${l.id}.quantite_recue`]}
                >
                  <Input
                    id={`recue-${l.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-14 text-xl"
                    value={s.recue}
                    onChange={(ev) => change(l.id, { recue: ev.target.value })}
                  />
                </FormField>
                <FormField
                  id={`prix-${l.id}`}
                  label="Prix HT facturé (€)"
                  error={erreurs[`${l.id}.prix_unitaire_ht`]}
                >
                  <Input
                    id={`prix-${l.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={s.prix}
                    onChange={(ev) => change(l.id, { prix: ev.target.value })}
                  />
                </FormField>
                {e !== 0 && (
                  <FormField
                    id={`motif-${l.id}`}
                    label="Motif de l'écart"
                    error={erreurs[`${l.id}.motif_ecart`]}
                  >
                    <Select
                      id={`motif-${l.id}`}
                      aria-invalid={!!erreurs[`${l.id}.motif_ecart`]}
                      value={s.motif}
                      onChange={(ev) => change(l.id, { motif: ev.target.value })}
                    >
                      <option value="">Choisissez un motif</option>
                      {MOTIFS_ECART.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
                {besoinDlc && (
                  <>
                    <FormField
                      id={`dlc-${l.id}`}
                      label="DLC (date limite)"
                      error={erreurs[`${l.id}.dlc`]}
                    >
                      <Input
                        id={`dlc-${l.id}`}
                        type="date"
                        aria-invalid={!!erreurs[`${l.id}.dlc`]}
                        value={s.dlc}
                        onChange={(ev) => change(l.id, { dlc: ev.target.value })}
                      />
                    </FormField>
                    <FormField id={`lot-${l.id}`} label="N° de lot (facultatif)">
                      <Input
                        id={`lot-${l.id}`}
                        autoComplete="off"
                        value={s.lot}
                        onChange={(ev) => change(l.id, { lot: ev.target.value })}
                      />
                    </FormField>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {globale && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {globale}
        </p>
      )}

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-md lg:bottom-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {nbEcarts === 0
            ? "Tout est conforme à la commande."
            : `${nbEcarts} ligne${nbEcarts > 1 ? "s" : ""} avec écart`}
        </p>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label="Enregistrer sans valider"
            className="min-w-0 flex-1 px-3 sm:flex-none sm:px-6"
            disabled={pending}
            onClick={() => envoyer(false)}
          >
            <Save aria-hidden />
            <span className="sm:hidden">Enregistrer</span>
            <span className="hidden sm:inline">Enregistrer sans valider</span>
          </Button>
          <Button
            type="submit"
            size="lg"
            aria-label="Valider la livraison"
            className="min-w-0 flex-1 px-3 sm:flex-none sm:px-6"
            disabled={pending}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <CheckCheck aria-hidden />
            )}
            <span className="sm:hidden">Valider</span>
            <span className="hidden sm:inline">Valider la livraison</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
