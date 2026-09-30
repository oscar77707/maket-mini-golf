import { addDays, todayParis } from "@/lib/dates";
import { dateOrUndefined, first, type SearchParams } from "@/lib/table-params";

/** Périodes proposées d'un clic dans les statistiques d'appels (nombre de jours jusqu'à aujourd'hui). */
export const PRESETS = [7, 30, 90] as const;

/**
 * Période des statistiques : `jours=7|30|90` (jusqu'à aujourd'hui) ou dates libres `du` / `au`,
 * bornée à 366 jours. Sans paramètre : les 30 derniers jours.
 */
export function parsePeriode(params: SearchParams, today = todayParis()) {
  const jours = PRESETS.find((j) => String(j) === first(params.jours));
  const libre = first(params.du) || first(params.au);
  if (jours || !libre) {
    const n = jours ?? 30;
    return { du: addDays(today, -(n - 1)), au: today, jours: n as number | null };
  }
  let au = dateOrUndefined(first(params.au)) ?? today;
  let du = dateOrUndefined(first(params.du)) ?? addDays(au, -29);
  if (du > au) [du, au] = [au, du];
  if (du < addDays(au, -365)) du = addDays(au, -365);
  return { du, au, jours: null };
}
