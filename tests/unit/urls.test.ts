import { describe, expect, it } from "vitest";
import { avecPole } from "@/lib/urls";

describe("adresses avec pôle", () => {
  it("ajoute le pôle en gardant les autres paramètres et l'ancre", () => {
    expect(avecPole("/stocks/alertes", "restaurant")).toBe("/stocks/alertes?pole=restaurant");
    expect(avecPole("/commandes?statut=a_valider", "mini_golf")).toBe(
      "/commandes?statut=a_valider&pole=mini_golf",
    );
    expect(avecPole("/stocks/alertes#dlc", "aquatique")).toBe("/stocks/alertes?pole=aquatique#dlc");
    expect(avecPole("/commandes?pole=restaurant", "aquatique")).toBe("/commandes?pole=aquatique");
    expect(avecPole("/appels", null)).toBe("/appels");
  });
});
