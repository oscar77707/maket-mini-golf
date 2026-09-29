import { describe, expect, it } from "vitest";
import { parseCsv, parseDecimal, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("lit un CSV Excel français (point-virgule, BOM, virgule décimale)", () => {
    const { headers, rows } = parseCsv("﻿Nom;Prix\r\nFarine;0,85\r\nSel;0,6\r\n");
    expect(headers).toEqual(["Nom", "Prix"]);
    expect(rows).toEqual([
      { Nom: "Farine", Prix: "0,85" },
      { Nom: "Sel", Prix: "0,6" },
    ]);
  });
  it("détecte la virgule comme séparateur", () => {
    expect(parseCsv("a,b\n1,2").rows).toEqual([{ a: "1", b: "2" }]);
  });
  it("gère guillemets, séparateurs et retours à la ligne dans une cellule", () => {
    const { rows } = parseCsv('Nom;Note\n"Huile; olive";"ligne 1\nligne 2"\n"Dit ""bonjour""";x');
    expect(rows[0]).toEqual({ Nom: "Huile; olive", Note: "ligne 1\nligne 2" });
    expect(rows[1].Nom).toBe('Dit "bonjour"');
  });
  it("ignore les lignes vides et complète les cellules manquantes", () => {
    const { rows } = parseCsv("a;b;c\n\n1;2\n;;\n");
    expect(rows).toEqual([{ a: "1", b: "2", c: "" }]);
  });
  it("renvoie un résultat vide pour un fichier vide", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("toCsv", () => {
  it("écrit un CSV Excel français", () => {
    const csv = toCsv(
      ["Nom", "Prix", "DLC"],
      [
        ["Farine", 0.85, true],
        ["Huile; olive", 7.9, false],
      ],
    );
    expect(csv).toBe('﻿Nom;Prix;DLC\r\nFarine;0,85;oui\r\n"Huile; olive";7,9;non\r\n');
  });
  it("neutralise les formules (injection CSV) sans toucher aux nombres négatifs", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ['=CMD("x")', -5],
        ["+1", "@x"],
      ],
    );
    expect(csv).toContain(`"'=CMD(""x"")";-5`);
    expect(csv).toContain("'+1;'@x");
  });
  it("fait l'aller-retour avec parseCsv", () => {
    const { rows } = parseCsv(
      toCsv(
        ["Nom", "Note"],
        [
          ['Dit "oui"', "a;b"],
          ["é à ç", null],
        ],
      ),
    );
    expect(rows).toEqual([
      { Nom: 'Dit "oui"', Note: "a;b" },
      { Nom: "é à ç", Note: "" },
    ]);
  });
});

describe("parseDecimal", () => {
  it.each([
    ["2,5", 2.5],
    ["2.5", 2.5],
    [" 1 200,50 ", 1200.5],
    ["0", 0],
    ["-3", -3],
  ])("lit %s", (input, expected) => expect(parseDecimal(input)).toBe(expected));
  it.each(["", "abc", "1,2,3", "12kg", "1e5"])("refuse %j", (input) =>
    expect(parseDecimal(input)).toBeNaN(),
  );
});
