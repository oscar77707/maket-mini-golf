import type { Indicateurs } from "@/features/tableau-de-bord/queries";

export type Tache = {
  id: string;
  texte: string;
  href: string;
  /** « urgent » : à traiter avant tout ; « normal » : dans la journée. */
  niveau: "urgent" | "normal";
};

const s = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Liste « À faire aujourd'hui », déduite des indicateurs. Le gérant valide les commandes ; le
 * responsable n'a que le rappel qu'elles attendent le gérant.
 * `lien(chemin)` ajoute le filtre de pôle courant aux adresses.
 */
export function tachesDuJour(
  i: Indicateurs,
  role: "gerant" | "responsable",
  lien: (chemin: string) => string,
): Tache[] {
  const t: Tache[] = [];
  if (i.a_valider > 0) {
    t.push(
      role === "gerant"
        ? {
            id: "a_valider",
            texte: `${s(i.a_valider, "commande à valider", "commandes à valider")} et envoyer`,
            href: "#commandes-a-valider",
            niveau: "urgent",
          }
        : {
            id: "a_valider",
            texte: `${s(i.a_valider, "commande attend", "commandes attendent")} la validation du gérant`,
            href: lien("/commandes?statut=a_valider"),
            niveau: "normal",
          },
    );
  }
  if (i.rouges > 0)
    t.push({
      id: "rouges",
      texte: `${s(i.rouges, "produit sous le seuil à commander", "produits sous le seuil à commander")}`,
      href: lien("/stocks/alertes"),
      niveau: "urgent",
    });
  if (i.attendues_aujourdhui > 0)
    t.push({
      id: "attendues",
      texte: `${s(i.attendues_aujourdhui, "livraison à réceptionner aujourd'hui", "livraisons à réceptionner aujourd'hui")}`,
      href: lien("/commandes?attendues=aujourdhui"),
      niveau: "urgent",
    });
  if (i.en_retard > 0)
    t.push({
      id: "en_retard",
      texte: `${s(i.en_retard, "commande en retard à relancer", "commandes en retard à relancer")}`,
      href: lien("/commandes?statut=en_retard"),
      niveau: "urgent",
    });
  if (i.dlc > 0)
    t.push({
      id: "dlc",
      texte: `${s(i.dlc, "lot à DLC proche ou dépassée", "lots à DLC proche ou dépassée")}`,
      href: lien("/stocks/alertes#dlc"),
      niveau: "urgent",
    });
  if (i.inventaires_soumis > 0)
    t.push({
      id: "inventaires",
      texte: `${s(i.inventaires_soumis, "inventaire à valider", "inventaires à valider")}`,
      href: lien("/stocks/inventaires"),
      niveau: "normal",
    });
  if (i.brouillons > 0)
    t.push({
      id: "brouillons",
      texte: `${s(i.brouillons, "brouillon de commande à finaliser", "brouillons de commande à finaliser")}`,
      href: lien("/commandes?statut=brouillon"),
      niveau: "normal",
    });
  return t;
}
