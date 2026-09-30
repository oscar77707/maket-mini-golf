"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrlSearch } from "@/components/table/url-search";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useUrlState } from "@/hooks/use-url-state";
import { GROUPES_AUDIT, GROUPES_AUDIT_IDS } from "../labels";

export function AuditFiltres() {
  const { params, update, pending } = useUrlState();
  const actif = ["groupe", "q", "du", "au"].some((k) => params.get(k));
  return (
    <div className="space-y-3" aria-busy={pending}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[14rem_1fr_10rem_10rem]">
        <Select
          aria-label="Type d'action"
          value={params.get("groupe") ?? ""}
          onChange={(e) => update({ groupe: e.target.value })}
        >
          <option value="">Toutes les actions</option>
          {GROUPES_AUDIT_IDS.map((id) => (
            <option key={id} value={id}>
              {GROUPES_AUDIT[id].label}
            </option>
          ))}
        </Select>
        <UrlSearch
          label="Rechercher dans le journal"
          placeholder="Action ou adresse e-mail"
          className="sm:col-span-2 lg:col-span-1"
        />
        <Input
          type="date"
          aria-label="Journal à partir du"
          value={params.get("du") ?? ""}
          onChange={(e) => update({ du: e.target.value })}
        />
        <Input
          type="date"
          aria-label="Journal jusqu'au"
          value={params.get("au") ?? ""}
          onChange={(e) => update({ au: e.target.value })}
        />
      </div>
      {actif && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update({ groupe: null, q: null, du: null, au: null })}
        >
          <X aria-hidden />
          Effacer les filtres
        </Button>
      )}
    </div>
  );
}
