import { afterEach, describe, expect, it, vi } from "vitest";
import { nettoyerBrouillons } from "@/hooks/use-form-draft";
import { AJOUTS, ajoutParDefaut, ajoutsFor } from "@/features/quick-add/registry";
import { NAV_ITEMS, navFor } from "@/lib/auth/navigation";

describe("registre des ajouts rapides", () => {
  it("chaque rôle ne voit que ses ajouts", () => {
    expect(ajoutsFor("gerant").map((a) => a.id)).toEqual([
      "produit",
      "commande",
      "fournisseur",
      "mouvement",
    ]);
    expect(ajoutsFor("responsable")).toHaveLength(4);
    expect(ajoutsFor("salarie").map((a) => a.id)).toEqual(["mouvement"]);
  });

  it("les intitulés sont uniques (le menu, la palette et les tests s'y fient)", () => {
    const labels = AJOUTS.map((a) => a.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("la touche N ouvre l'ajout de la page, sinon le menu", () => {
    expect(ajoutParDefaut("/commandes", "gerant")).toBe("commande");
    expect(ajoutParDefaut("/commandes/abc", "responsable")).toBe("commande");
    expect(ajoutParDefaut("/fournisseurs", "gerant")).toBe("fournisseur");
    expect(ajoutParDefaut("/fournisseurs/abc", "gerant")).toBe("fournisseur");
    expect(ajoutParDefaut("/stocks", "gerant")).toBe("produit");
    expect(ajoutParDefaut("/stocks/alertes", "gerant")).toBe("produit");
    expect(ajoutParDefaut("/stocks/mouvements", "gerant")).toBe("mouvement");
    expect(ajoutParDefaut("/tableau-de-bord", "gerant")).toBeNull();
    expect(ajoutParDefaut("/parametres/utilisateurs", "gerant")).toBeNull();
  });

  it("un rôle n'obtient jamais un ajout qui ne lui est pas ouvert", () => {
    expect(ajoutParDefaut("/commandes", "salarie")).toBeNull();
    expect(ajoutParDefaut("/stocks", "salarie")).toBeNull();
    expect(ajoutParDefaut("/stocks/mouvements", "salarie")).toBe("mouvement");
  });
});

describe("raccourcis « G puis… »", () => {
  it("chaque page a une lettre différente", () => {
    const lettres = NAV_ITEMS.map((n) => n.key);
    expect(new Set(lettres).size).toBe(lettres.length);
    expect(lettres.every((l) => /^[a-z]$/.test(l))).toBe(true);
  });

  it("les lettres annoncées par l'énoncé : S pour Stocks, C pour Commandes", () => {
    const parLettre = Object.fromEntries(NAV_ITEMS.map((n) => [n.key, n.href]));
    expect(parLettre.s).toBe("/stocks");
    expect(parLettre.c).toBe("/commandes");
  });

  it("un salarié n'a que les pages de son menu", () => {
    expect(navFor("salarie").map((n) => n.key)).toEqual(["s"]);
  });
});

describe("brouillons de formulaire", () => {
  const PREFIXE = "palmeraie:brouillon:";
  const faux = () => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      key: (i: number) => [...data.keys()][i] ?? null,
      get length() {
        return data.size;
      },
    };
  };
  afterEach(() => vi.unstubAllGlobals());

  it("le nettoyage courant ne retire que les brouillons de plus de 24 h", () => {
    const s = faux();
    const frais = JSON.stringify({ le: Date.now() - 3_600_000, valeurs: { nom: "a" } });
    const vieux = JSON.stringify({ le: Date.now() - 25 * 3_600_000, valeurs: { nom: "b" } });
    s.data.set(`${PREFIXE}u1:produit`, frais);
    s.data.set(`${PREFIXE}u1:commande`, vieux);
    s.data.set("autre-cle", "x");
    vi.stubGlobal("window", { localStorage: s });
    nettoyerBrouillons();
    expect([...s.data.keys()].sort()).toEqual(["autre-cle", `${PREFIXE}u1:produit`]);
  });

  it("la déconnexion efface tous les brouillons de l'appareil, et rien d'autre", () => {
    const s = faux();
    s.data.set(`${PREFIXE}u1:produit`, JSON.stringify({ le: Date.now(), valeurs: {} }));
    s.data.set(`${PREFIXE}u2:fournisseur`, JSON.stringify({ le: Date.now(), valeurs: {} }));
    s.data.set("theme", "dark");
    vi.stubGlobal("window", { localStorage: s });
    nettoyerBrouillons(true);
    expect([...s.data.keys()]).toEqual(["theme"]);
  });

  it("sans stockage (navigation privée), rien ne plante", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("SecurityError");
      },
    });
    expect(() => nettoyerBrouillons(true)).not.toThrow();
  });
});
