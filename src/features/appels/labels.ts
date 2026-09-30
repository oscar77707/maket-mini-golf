import type { IssueAppel } from "@/types/models";

export const ISSUES = [
  "renseigne",
  "reservation",
  "transfere",
  "message_laisse",
] as const satisfies readonly IssueAppel[];

export const ISSUE_LABELS: Record<IssueAppel, string> = {
  renseigne: "Renseigné",
  reservation: "Réservation",
  transfere: "Transféré",
  message_laisse: "Message laissé",
};

export const ISSUE_VARIANT: Record<IssueAppel, "default" | "vert" | "orange" | "bleu"> = {
  renseigne: "vert",
  reservation: "bleu",
  transfere: "orange",
  message_laisse: "default",
};

export function formatDuree(secondes: number) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return m > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`;
}
