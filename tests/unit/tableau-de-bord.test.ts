import { describe, expect, it } from "vitest";
import { tachesDuJour } from "@/features/tableau-de-bord/todo";
import type { Indicateurs } from "@/features/tableau-de-bord/queries";

const zero: Indicateurs = {
  rouges: 0,
  oranges: 0,
  dlc: 0,
  valeur_stock_ht: 0,
  a_valider: 0,
  brouillons: 0,
  attendues_aujourdhui: 0,
  en_retard: 0,
  inventaires_soumis: 0,
  appels_aujourdhui: 0,
};
const sansPole = (chemin: string) => chemin;

describe("À faire aujourd'hui", () => {
  it("est vide quand tout est à jour", () => {
    expect(tachesDuJour(zero, "gerant", sansPole)).toEqual([]);
    expect(tachesDuJour(zero, "responsable", sansPole)).toEqual([]);
  });

  it("le gérant doit valider les commandes, avec accord au singulier et au pluriel", () => {
    const un = tachesDuJour({ ...zero, a_valider: 1 }, "gerant", sansPole);
    expect(un).toEqual([
      {
        id: "a_valider",
        texte: "1 commande à valider et envoyer",
        href: "#commandes-a-valider",
        niveau: "urgent",
      },
    ]);
    const deux = tachesDuJour({ ...zero, a_valider: 2 }, "gerant", sansPole);
    expect(deux[0].texte).toBe("2 commandes à valider et envoyer");
  });

  it("le responsable voit seulement que ses commandes attendent le gérant", () => {
    const [t] = tachesDuJour({ ...zero, a_valider: 2 }, "responsable", sansPole);
    expect(t.texte).toBe("2 commandes attendent la validation du gérant");
    expect(t.niveau).toBe("normal");
    expect(t.href).toBe("/commandes?statut=a_valider");
  });

  it("classe les tâches urgentes avant les autres et garde le filtre de pôle dans les liens", () => {
    const taches = tachesDuJour(
      {
        ...zero,
        rouges: 3,
        attendues_aujourdhui: 1,
        en_retard: 2,
        dlc: 1,
        inventaires_soumis: 1,
        brouillons: 4,
      },
      "gerant",
      (c) => `${c}${c.includes("?") ? "&" : "?"}pole=restaurant`,
    );
    expect(taches.map((t) => t.id)).toEqual([
      "rouges",
      "attendues",
      "en_retard",
      "dlc",
      "inventaires",
      "brouillons",
    ]);
    expect(taches.find((t) => t.id === "attendues")?.href).toBe(
      "/commandes?attendues=aujourdhui&pole=restaurant",
    );
    expect(taches.filter((t) => t.niveau === "urgent")).toHaveLength(4);
  });
});
