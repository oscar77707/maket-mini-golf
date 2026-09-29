import { parseCsv, parseDecimal } from "@/lib/csv";
import type { ImportRow } from "./schemas";

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const ALIASES: Record<keyof Omit<ImportRow, "ligne">, string[]> = {
  nom: ["nom", "produit", "designation", "libelle"],
  reference: ["reference", "ref", "code"],
  pole: ["pole"],
  categorie: ["categorie", "famille"],
  unite: ["unite"],
  lieu: ["lieudestockage", "lieu", "emplacement", "stockage"],
  fournisseur: ["fournisseurprincipal", "fournisseur"],
  prix: ["prixdachatht", "prixachatht", "prixdachat", "prixachat", "prixht", "prix"],
  stock: ["stockactuel", "stock", "quantite"],
  seuil: ["seuilminimum", "seuilmin", "stockminimum", "seuil"],
  reappro: ["quantitedereappro", "quantitereappro", "reappro", "quantiteconseillee"],
  dlc: ["dlcsuivie", "suividlc", "dlc"],
};
const LABELS: Record<string, string> = { nom: "Nom", unite: "Unité" };

const TRUE_VALUES = new Set(["oui", "o", "1", "true", "vrai", "x", "yes"]);

export type ImportParseResult = {
  rows: ImportRow[];
  errors: { ligne: number; raison: string }[];
  missingHeaders: string[];
};

/** Transforme le texte d'un CSV (export ou modèle) en lignes d'import ; les lignes illisibles deviennent des erreurs. */
export function parseImportFile(text: string): ImportParseResult {
  const { headers, rows: raw } = parseCsv(text);
  const byField = new Map<string, string>();
  for (const h of headers) {
    const key = strip(h);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(key) && !byField.has(field)) byField.set(field, h);
    }
  }
  const missingHeaders = Object.keys(LABELS)
    .filter((f) => !byField.has(f))
    .map((f) => LABELS[f]);
  if (missingHeaders.length > 0) return { rows: [], errors: [], missingHeaders };

  const get = (row: Record<string, string>, field: string) =>
    byField.has(field) ? (row[byField.get(field)!] ?? "") : "";
  const rows: ImportRow[] = [];
  const errors: { ligne: number; raison: string }[] = [];

  raw.forEach((row, index) => {
    const ligne = index + 2; // ligne 1 = en-têtes, numérotation comme dans Excel
    const numbers: Record<string, number> = {};
    for (const [field, label] of [
      ["prix", "Prix d'achat HT"],
      ["stock", "Stock actuel"],
      ["seuil", "Seuil minimum"],
      ["reappro", "Quantité de réappro"],
    ] as const) {
      const cell = get(row, field);
      const value = cell === "" ? 0 : parseDecimal(cell);
      if (Number.isNaN(value)) {
        errors.push({ ligne, raison: `${label} : « ${cell} » n'est pas un nombre.` });
        return;
      }
      numbers[field] = value;
    }
    rows.push({
      ligne,
      nom: get(row, "nom"),
      reference: get(row, "reference"),
      pole: get(row, "pole"),
      categorie: get(row, "categorie"),
      unite: get(row, "unite"),
      lieu: get(row, "lieu"),
      fournisseur: get(row, "fournisseur"),
      prix: numbers.prix,
      stock: numbers.stock,
      seuil: numbers.seuil,
      reappro: numbers.reappro,
      dlc: TRUE_VALUES.has(strip(get(row, "dlc"))),
    });
  });
  return { rows, errors, missingHeaders };
}

/** Reconnaît les écritures courantes d'une unité. */
export function normalizeUnite(value: string): "kg" | "L" | "piece" | null {
  const v = strip(value);
  if (["kg", "kilo", "kilos", "kilogramme", "kilogrammes"].includes(v)) return "kg";
  if (["l", "litre", "litres"].includes(v)) return "L";
  if (["piece", "pieces", "pc", "pcs", "u", "unite", "unites"].includes(v)) return "piece";
  return null;
}

export const normalizeName = (s: string) => strip(s);
