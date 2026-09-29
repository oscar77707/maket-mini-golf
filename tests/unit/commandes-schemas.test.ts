import { describe, expect, it } from "vitest";
import { fournisseurProduitSchema, fournisseurSchema } from "@/features/fournisseurs/schemas";
import { joursTexte } from "@/features/fournisseurs/labels";
import {
  annulationSchema,
  ligneCommandeSchema,
  receptionSchema,
} from "@/features/commandes/schemas";

const UUID = "5b0b1c1e-6f64-4a0a-9a0c-3f0f2f0b7a11";

describe("fournisseurSchema", () => {
  const base = {
    nom: "Grossiste Provence",
    mode_commande: "email",
    email: "Commandes@Grossiste.fr ",
    jours_commande: [5, 1, 1],
    jours_livraison: [],
    delai_livraison_jours: "2",
    minimum_commande_ht: "150,50",
  };
  it("normalise e-mail, jours et nombres à virgule", () => {
    const r = fournisseurSchema.parse(base);
    expect(r.email).toBe("commandes@grossiste.fr");
    expect(r.jours_commande).toEqual([1, 5]);
    expect(r.delai_livraison_jours).toBe(2);
    expect(r.minimum_commande_ht).toBe(150.5);
    expect(r.contact_nom).toBeNull();
  });
  it("exige l'e-mail pour une commande par e-mail et l'adresse pour un portail", () => {
    const sansMail = fournisseurSchema.safeParse({ ...base, email: "" });
    expect(sansMail.success).toBe(false);
    expect(sansMail.error?.issues[0].path).toEqual(["email"]);
    expect(
      fournisseurSchema.safeParse({ ...base, mode_commande: "telephone", email: "" }).success,
    ).toBe(true);
    expect(fournisseurSchema.safeParse({ ...base, mode_commande: "portail" }).success).toBe(false);
    expect(
      fournisseurSchema.safeParse({
        ...base,
        mode_commande: "portail",
        url_portail: "https://portail.fr",
      }).success,
    ).toBe(true);
  });
  it("refuse un délai non entier ou hors limites, un minimum négatif", () => {
    expect(fournisseurSchema.safeParse({ ...base, delai_livraison_jours: "1,5" }).success).toBe(
      false,
    );
    expect(fournisseurSchema.safeParse({ ...base, delai_livraison_jours: "61" }).success).toBe(
      false,
    );
    expect(fournisseurSchema.safeParse({ ...base, minimum_commande_ht: "-1" }).success).toBe(false);
    expect(fournisseurSchema.safeParse({ ...base, jours_commande: [8] }).success).toBe(false);
  });
  it("affiche les jours en toutes lettres abrégées", () => {
    expect(joursTexte([5, 1, 3])).toBe("lun., mer., ven.");
    expect(joursTexte([])).toBe("Non précisé");
  });
});

describe("association produit / fournisseur", () => {
  it("accepte un prix vide (le prix du produit sert alors) et exige un conditionnement positif", () => {
    const r = fournisseurProduitSchema.parse({
      fournisseur_id: UUID,
      produit_id: UUID,
      prix_ht: "",
      conditionnement: "6",
    });
    expect(r.prix_ht).toBeNull();
    expect(r.conditionnement).toBe(6);
    expect(
      fournisseurProduitSchema.safeParse({
        fournisseur_id: UUID,
        produit_id: UUID,
        prix_ht: "2,5",
        conditionnement: "0",
      }).success,
    ).toBe(false);
  });
});

describe("lignes, annulation et réception", () => {
  it("valide une ligne avec quantité décimale et refuse zéro", () => {
    expect(
      ligneCommandeSchema.parse({
        commande_id: UUID,
        produit_id: UUID,
        quantite: "2,5",
        prix_unitaire_ht: "3,2",
      }),
    ).toMatchObject({ quantite: 2.5, prix_unitaire_ht: 3.2 });
    expect(
      ligneCommandeSchema.safeParse({
        commande_id: UUID,
        produit_id: UUID,
        quantite: "0",
        prix_unitaire_ht: "3",
      }).success,
    ).toBe(false);
  });
  it("exige un motif d'annulation", () => {
    expect(annulationSchema.safeParse({ id: UUID, motif: "  " }).success).toBe(false);
    expect(annulationSchema.parse({ id: UUID, motif: " Doublon " }).motif).toBe("Doublon");
  });
  it("lit un pointage de livraison (motif et DLC vides deviennent nuls)", () => {
    const r = receptionSchema.parse({
      livraison_id: UUID,
      valider: true,
      lignes: [{ id: UUID, quantite_recue: "4,5", prix_unitaire_ht: "", motif_ecart: "", dlc: "" }],
    });
    expect(r.lignes[0]).toMatchObject({
      quantite_recue: 4.5,
      prix_unitaire_ht: null,
      motif_ecart: null,
      dlc: null,
    });
    expect(
      receptionSchema.safeParse({ livraison_id: UUID, valider: false, lignes: [] }).success,
    ).toBe(false);
    expect(
      receptionSchema.safeParse({
        livraison_id: UUID,
        valider: false,
        lignes: [{ id: UUID, quantite_recue: "1", motif_ecart: "casse" }],
      }).success,
    ).toBe(false);
  });
});
