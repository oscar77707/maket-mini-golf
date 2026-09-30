"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { Input } from "@/components/ui/input";
import { PoleBadge } from "@/components/ui/pole-badge";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/auth/navigation";
import type { PoleCode, Role } from "@/types/models";
import { STATUT_COMPTE_LABELS, type StatutCompte } from "../labels";
import type { Utilisateur } from "../queries";
import { StatutBadge } from "./statut-badge";
import { UtilisateurSheet } from "./utilisateur-sheet";
import type { PoleOption } from "./role-pole-fields";

const sansAccent = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function UtilisateursTable({
  utilisateurs,
  poles,
  currentUserId,
}: {
  utilisateurs: Utilisateur[];
  poles: PoleOption[];
  currentUserId: string;
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [pole, setPole] = useState<PoleCode | "">("");
  const [statut, setStatut] = useState<StatutCompte | "">("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const codeDuPole = useMemo(() => new Map(poles.map((p) => [p.id, p.code])), [poles]);

  const lignes = useMemo(() => {
    const terme = sansAccent(q.trim());
    return utilisateurs.filter((u) => {
      if (role && u.role !== role) return false;
      if (pole && (u.pole_id === null ? null : codeDuPole.get(u.pole_id)) !== pole) return false;
      if (statut && u.statut !== statut) return false;
      if (!terme) return true;
      return sansAccent(`${u.prenom} ${u.nom} ${u.email}`).includes(terme);
    });
  }, [utilisateurs, q, role, pole, statut, codeDuPole]);

  const selection = utilisateurs.find((u) => u.id === selectionId) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_11rem_13rem]">
        <Input
          type="search"
          aria-label="Rechercher une personne"
          placeholder="Nom ou e-mail"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select
          aria-label="Filtrer par rôle"
          value={role}
          onChange={(e) => setRole(e.target.value as Role | "")}
        >
          <option value="">Tous les rôles</option>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par pôle"
          value={pole}
          onChange={(e) => setPole(e.target.value as PoleCode | "")}
        >
          <option value="">Tous les pôles</option>
          {poles.map((p) => (
            <option key={p.code} value={p.code}>
              {p.nom}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par état"
          value={statut}
          onChange={(e) => setStatut(e.target.value as StatutCompte | "")}
        >
          <option value="">Tous les états</option>
          {(Object.keys(STATUT_COMPTE_LABELS) as StatutCompte[]).map((s) => (
            <option key={s} value={s}>
              {STATUT_COMPTE_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {lignes.length === 0 ? (
        <EmptyState
          title="Aucune personne trouvée"
          description="Modifiez la recherche ou les filtres."
        />
      ) : (
        <Table aria-label="Comptes utilisateurs">
          <THead>
            <TR>
              <TH>Nom</TH>
              <TH>E-mail</TH>
              <TH>Rôle</TH>
              <TH>Pôle</TH>
              <TH>État</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {lignes.map((u) => {
              const code = u.pole_id === null ? null : codeDuPole.get(u.pole_id);
              const nom = `${u.prenom} ${u.nom}`.trim() || u.email;
              return (
                <TR key={u.id} data-testid="ligne-utilisateur">
                  <TD className="font-medium">
                    {nom}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(vous)</span>
                    )}
                    {u.saisonnier && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        saisonnier
                      </span>
                    )}
                  </TD>
                  <TD className="text-muted-foreground">{u.email}</TD>
                  <TD>{ROLE_LABELS[u.role]}</TD>
                  <TD>
                    {code && u.pole_nom ? (
                      <PoleBadge code={code} nom={u.pole_nom} />
                    ) : (
                      "Tous les pôles"
                    )}
                  </TD>
                  <TD>
                    <StatutBadge statut={u.statut} />
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Modifier ${nom}`}
                      onClick={() => setSelectionId(u.id)}
                    >
                      <Pencil aria-hidden />
                      Modifier
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}

      <UtilisateurSheet
        utilisateur={selection}
        poles={poles}
        soi={selection?.id === currentUserId}
        onClose={() => setSelectionId(null)}
      />
    </div>
  );
}
