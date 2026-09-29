import { describe, expect, it } from "vitest";
import { mouvementSchema, produitSchema, splitImportRows } from "@/features/stocks/schemas";
import { normalizeUnite, parseImportFile } from "@/features/stocks/import-parse";
import { parsePaging, sanitizeSearch } from "@/lib/table-params";

const UUID = "5b0b1c1e-6f64-4a0a-9a0c-3f0f2f0b7a11";

describe("produitSchema", () => {
  const valide = {
    pole_id: 1,
    nom: "Farine T55",
    unite: "kg",
    prix_achat_ht: "0,85",
    seuil_minimum: "10",
    quantite_reappro: "25",
    suivi_dlc: false,
    categorie_id: "",
    lieu_stockage_id: "",
    fournisseur_principal_id: "",
    reference: "",
    notes: "",
  };
  it("accepte les décimales à virgule et vide les champs facultatifs", () => {
    const r = produitSchema.parse(valide);
    expect(r.prix_achat_ht).toBe(0.85);
    expect(r.categorie_id).toBeNull();
    expect(r.reference).toBeNull();
  });
  it("refuse un prix négatif et un prix vide avec des messages français", () => {
    expect(
      produitSchema.safeParse({ ...valide, prix_achat_ht: "-1" }).error?.issues[0].message,
    ).toBe("Le prix d'achat ne peut pas être négatif.");
    expect(produitSchema.safeParse({ ...valide, prix_achat_ht: "" }).error?.issues[0].message).toBe(
      "Le prix d'achat : saisissez un nombre.",
    );
  });
  it("refuse un nom trop court et une unité inconnue", () => {
    expect(produitSchema.safeParse({ ...valide, nom: "a" }).success).toBe(false);
    expect(produitSchema.safeParse({ ...valide, unite: "tonne" }).success).toBe(false);
  });
});

describe("mouvementSchema", () => {
  const base = { produit_id: UUID, quantite: "5", motif: "", dlc: "", numero_lot: "" };
  it("accepte une entrée et une sortie simples", () => {
    expect(mouvementSchema.safeParse({ ...base, type: "entree" }).success).toBe(true);
    expect(mouvementSchema.parse({ ...base, type: "sortie", quantite: "2,5" }).quantite).toBe(2.5);
  });
  it("refuse une quantité nulle hors correction", () => {
    expect(
      mouvementSchema.safeParse({ ...base, type: "sortie", quantite: "0" }).error?.issues[0]
        .message,
    ).toBe("La quantité doit être supérieure à zéro.");
  });
  it("accepte un stock réel de zéro pour une correction, avec motif", () => {
    expect(
      mouvementSchema.safeParse({ ...base, type: "correction", quantite: "0", motif: "Comptage" })
        .success,
    ).toBe(true);
  });
  it("exige un motif pour une perte ou une correction", () => {
    expect(mouvementSchema.safeParse({ ...base, type: "perte" }).error?.issues[0].message).toBe(
      "Indiquez le motif.",
    );
    expect(mouvementSchema.safeParse({ ...base, type: "correction" }).success).toBe(false);
  });
});

describe("import CSV", () => {
  const csv =
    "Nom;Référence;Pôle;Catégorie;Unité;Lieu de stockage;Fournisseur principal;Prix d'achat HT;Stock actuel;Seuil minimum;Quantité de réappro;DLC suivie\r\nFarine T55;F1;Restaurant;Épicerie sèche;kg;Réserve sèche;;0,85;25;10;25;non\r\nTomates;;;;kg;;;2,2;abc;8;20;oui\r\n";
  it("lit les lignes valides et signale les nombres illisibles avec le numéro de ligne Excel", () => {
    const r = parseImportFile(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      ligne: 2,
      nom: "Farine T55",
      prix: 0.85,
      stock: 25,
      dlc: false,
    });
    expect(r.errors).toEqual([{ ligne: 3, raison: "Stock actuel : « abc » n'est pas un nombre." }]);
  });
  it("reconnaît les en-têtes sans accents ni majuscules et signale les colonnes obligatoires absentes", () => {
    expect(parseImportFile("NOM;UNITE\nSel;kg").rows[0].nom).toBe("Sel");
    expect(parseImportFile("Produit;Prix\nSel;1").missingHeaders).toEqual(["Unité"]);
  });
  it("valide les lignes une à une : une ligne invalide est signalée et ne bloque pas les autres", () => {
    const ok = {
      ligne: 2,
      nom: "Sel",
      unite: "kg",
      prix: 1,
      stock: 2,
      seuil: 1,
      reappro: 2,
      dlc: false,
    };
    const { valid, rejected } = splitImportRows([
      ok,
      { ...ok, ligne: 3, nom: "" },
      { ...ok, ligne: 4, prix: -1 },
      "n'importe quoi",
    ]);
    expect(valid.map((r) => r.ligne)).toEqual([2]);
    expect(rejected.map((r) => r.ligne)).toEqual([3, 4, 5]);
    expect(rejected[0].messages).toEqual(["Nom manquant ou trop court."]);
    expect(rejected[1].messages).toEqual(["Prix négatif."]);
  });
  it("normalise les unités courantes", () => {
    expect(normalizeUnite("Litres")).toBe("L");
    expect(normalizeUnite("pièce")).toBe("piece");
    expect(normalizeUnite("KG")).toBe("kg");
    expect(normalizeUnite("tonne")).toBeNull();
  });
});

describe("paramètres d'URL", () => {
  it("borne la pagination", () => {
    expect(parsePaging({ page: "-3", taille: "7" })).toMatchObject({
      page: 1,
      pageSize: 25,
      from: 0,
      to: 24,
    });
    expect(parsePaging({ page: "3", taille: "50" })).toMatchObject({
      page: 3,
      pageSize: 50,
      from: 100,
      to: 149,
    });
  });
  it("retire les caractères qui casseraient un filtre PostgREST", () => {
    expect(sanitizeSearch('a,b)(c%d*"e')).toBe("a b c d e");
  });
});
