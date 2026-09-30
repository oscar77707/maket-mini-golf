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

/** Décalage de Paris par rapport à UTC, en minutes, à un instant donné (60 l'hiver, 120 l'été). */
function decalageParisMinutes(instant: number) {
  const nom = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = nom?.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** Instant (UTC) où commence le jour AAAA-MM-JJ à Paris : minuit local, heure d'été ou d'hiver. */
export function debutJourParis(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const minuitUtc = Date.UTC(y, m - 1, d);
  const premier = minuitUtc - decalageParisMinutes(minuitUtc) * 60_000;
  return new Date(minuitUtc - decalageParisMinutes(premier) * 60_000);
}

/** Jours AAAA-MM-JJ de `du` à `au` inclus. */
export function joursEntre(du: string, au: string) {
  const jours: string[] = [];
  for (let d = du; d <= au && jours.length < 400; d = addDays(d, 1)) jours.push(d);
  return jours;
}
