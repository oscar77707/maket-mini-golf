import { Badge } from "@/components/ui/badge";
import { STATUT_COMPTE_LABELS, type StatutCompte } from "../labels";

const VARIANTES = {
  actif: "vert",
  invite: "bleu",
  desactive: "orange",
  anonymise: "default",
} as const;

export function StatutBadge({ statut }: { statut: StatutCompte }) {
  return <Badge variant={VARIANTES[statut]}>{STATUT_COMPTE_LABELS[statut]}</Badge>;
}
