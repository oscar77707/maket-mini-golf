/** Ajoute (ou remplace) le filtre de pôle `?pole=` d'une adresse interne, en gardant son ancre. */
export function avecPole(chemin: string, codePole: string | null | undefined): string {
  if (!codePole) return chemin;
  const [sansAncre, ancre] = chemin.split("#");
  const [path, requete = ""] = sansAncre.split("?");
  const params = new URLSearchParams(requete);
  params.set("pole", codePole);
  return `${path}?${params.toString()}${ancre ? `#${ancre}` : ""}`;
}
