import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { NiveauAlerte } from "@/types/models";
import { ALERTE_LABELS } from "../labels";

export function AlerteBadge({ niveau }: { niveau: NiveauAlerte }) {
  if (niveau === "rouge") {
    return (
      <Badge variant="rouge">
        <CircleAlert aria-hidden className="size-4" />
        {ALERTE_LABELS.rouge}
      </Badge>
    );
  }
  if (niveau === "orange") {
    return (
      <Badge variant="orange">
        <TriangleAlert aria-hidden className="size-4" />
        {ALERTE_LABELS.orange}
      </Badge>
    );
  }
  return (
    <Badge variant="vert">
      <CircleCheck aria-hidden className="size-4" />
      {ALERTE_LABELS.ok}
    </Badge>
  );
}
