const TIMEZONE = "Europe/Paris";

/** Date du jour à Paris au format AAAA-MM-JJ (le serveur peut tourner en UTC). */
export function todayParis(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TIMEZONE }).format(now);
}

/** Ajoute des jours à une date AAAA-MM-JJ. */
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
