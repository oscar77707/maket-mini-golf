import { describe, expect, it } from "vitest";
import { addDays, debutJourParis, joursEntre } from "@/lib/dates";
import { callEventSchema } from "@/features/appels/webhook-calls";
import { empreinteNumero, masquerNumero, normaliserNumero } from "@/features/appels/phone";
import { parsePeriode } from "@/features/appels/periode";
import { decouperTranscription } from "@/features/appels/transcription";
import { formatDuree } from "@/features/appels/labels";

describe("numéros d'appel", () => {
  it("normalise les écritures françaises et internationales d'un même numéro", () => {
    for (const n of ["06 12 34 56 42", "0612345642", "+33 6 12 34 56 42", "0033612345642"])
      expect(normaliserNumero(n)).toBe("+33612345642");
  });

  it("masque un numéro français en gardant le type de ligne et les deux derniers chiffres", () => {
    expect(masquerNumero("+33 6 12 34 56 42")).toBe("06 •• •• •• 42");
    expect(masquerNumero("04 91 22 33 44")).toBe("04 •• •• •• 44");
  });

  it("masque un numéro étranger sans indiquer le pays", () => {
    expect(masquerNumero("+44 20 7946 0958")).toBe("+•• •• •• •• 58");
  });

  it("ne révèle jamais le numéro complet", () => {
    for (const n of ["+33 6 12 34 56 42", "+44 20 7946 0958", "0491223344"]) {
      const masque = masquerNumero(n);
      const chiffres = masque.replace(/\D/g, "");
      expect(chiffres.length).toBeLessThanOrEqual(4);
    }
  });

  it("signale un numéro absent ou masqué par l'appelant", () => {
    for (const n of ["", "anonyme", "  ", "12"]) {
      expect(masquerNumero(n)).toBe("Numéro masqué");
      expect(empreinteNumero(n, "secret")).toBeNull();
    }
  });

  it("l'empreinte est la même quelle que soit l'écriture et dépend du secret", () => {
    const a = empreinteNumero("06 12 34 56 42", "secret");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteNumero("+33612345642", "secret")).toBe(a);
    expect(empreinteNumero("06 12 34 56 42", "autre")).not.toBe(a);
    expect(empreinteNumero("06 12 34 56 43", "secret")).not.toBe(a);
    expect(a).not.toContain("612345642");
  });

  it("sans secret configuré, aucune empreinte n'est calculée", () => {
    expect(empreinteNumero("0612345642", "")).toBeNull();
  });
});

describe("appel entrant : corps attendu", () => {
  const valide = {
    id_externe: "call-1",
    debut: "2026-09-30T10:12:00+02:00",
    duree_secondes: 120,
    numero: "06 12 34 56 42",
    pole: "restaurant",
    issue: "reservation",
    resume: "  Table pour 4  ",
    transcription: "Client : Bonjour",
  };

  it("accepte un appel complet et nettoie les textes", () => {
    const r = callEventSchema.parse(valide);
    expect(r.resume).toBe("Table pour 4");
    expect(r.metadonnees).toEqual({});
    expect(r.pole).toBe("restaurant");
  });

  it("accepte un appel minimal (sans numéro, pôle, résumé ni transcription)", () => {
    const r = callEventSchema.parse({
      id_externe: "c2",
      debut: "2026-09-30T08:00:00Z",
      duree_secondes: 0,
      issue: "renseigne",
    });
    expect(r.numero).toBe("");
    expect(r.resume).toBeNull();
    expect(r.transcription).toBeNull();
  });

  it("refuse les champs invalides avec le nom du champ", () => {
    const cas: [Record<string, unknown>, string][] = [
      [{ ...valide, issue: "inconnue" }, "issue"],
      [{ ...valide, pole: "spa" }, "pole"],
      [{ ...valide, debut: "hier" }, "debut"],
      [{ ...valide, debut: "2026-09-30T10:12:00" }, "debut"],
      [{ ...valide, duree_secondes: -1 }, "duree_secondes"],
      [{ ...valide, duree_secondes: 90_000 }, "duree_secondes"],
      [{ ...valide, duree_secondes: 1.5 }, "duree_secondes"],
      [{ ...valide, id_externe: "" }, "id_externe"],
      [{ ...valide, evenement: "call.started" }, "evenement"],
      [{ ...valide, resume: "x".repeat(2_001) }, "resume"],
      [{ ...valide, metadonnees: { a: "x".repeat(10_001) } }, "metadonnees"],
    ];
    for (const [corps, champ] of cas) {
      const r = callEventSchema.safeParse(corps);
      expect(r.success, champ).toBe(false);
      expect(
        r.error?.issues.some((i) => i.path[0] === champ),
        champ,
      ).toBe(true);
    }
  });
});

describe("jours de Paris", () => {
  it("le jour commence à minuit heure de Paris, été comme hiver", () => {
    expect(debutJourParis("2026-07-14").toISOString()).toBe("2026-07-13T22:00:00.000Z");
    expect(debutJourParis("2026-01-15").toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("gère les changements d'heure", () => {
    expect(debutJourParis("2026-03-29").toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(debutJourParis("2026-03-30").toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(debutJourParis("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(debutJourParis("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("joursEntre est inclusif", () => {
    expect(joursEntre("2026-02-27", "2026-03-01")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
    expect(joursEntre("2026-03-02", "2026-03-01")).toEqual([]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("période des statistiques", () => {
  const today = "2026-09-30";
  it("prend les 30 derniers jours par défaut", () => {
    expect(parsePeriode({}, today)).toEqual({ du: "2026-09-01", au: today, jours: 30 });
  });
  it("accepte les périodes prédéfinies et ignore les autres", () => {
    expect(parsePeriode({ jours: "7" }, today)).toEqual({ du: "2026-09-24", au: today, jours: 7 });
    expect(parsePeriode({ jours: "12" }, today).jours).toBe(30);
  });
  it("accepte des dates libres, les remet dans l'ordre et borne à un an", () => {
    expect(parsePeriode({ du: "2026-09-10", au: "2026-09-20" }, today)).toEqual({
      du: "2026-09-10",
      au: "2026-09-20",
      jours: null,
    });
    expect(parsePeriode({ du: "2026-09-20", au: "2026-09-10" }, today).du).toBe("2026-09-10");
    expect(parsePeriode({ du: "2020-01-01", au: "2026-09-10" }, today).du).toBe("2025-09-10");
    expect(parsePeriode({ du: "n'importe quoi" }, today).jours).toBe(null);
  });
});

describe("transcription", () => {
  it("sépare les répliques du client et du standard", () => {
    expect(
      decouperTranscription("Client : Bonjour\nIA : Bienvenue\nsuite\nAppelant : Merci"),
    ).toEqual([
      { locuteur: "client", texte: "Bonjour" },
      { locuteur: "ia", texte: "Bienvenue\nsuite" },
      { locuteur: "client", texte: "Merci" },
    ]);
  });
  it("garde un texte sans locuteur en un seul bloc", () => {
    expect(decouperTranscription("Bonjour tout le monde")).toEqual([
      { locuteur: null, texte: "Bonjour tout le monde" },
    ]);
  });
});

describe("durée", () => {
  it("s'affiche en minutes et secondes", () => {
    expect(formatDuree(45)).toBe("45 s");
    expect(formatDuree(125)).toBe("2 min 05 s");
  });
});
