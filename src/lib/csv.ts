export type CsvCell = string | number | boolean | null | undefined;

const BOM = "﻿";

/**
 * Lit un CSV (Excel français : séparateur « ; », ou « , »). Gère BOM, guillemets et retours à la ligne dans
 * les cellules. La première ligne non vide est l'en-tête.
 */
export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) &&
    firstLine.includes(";")
      ? ";"
      : ",";

  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      records.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    records.push(row);
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim());
  const rows = nonEmpty
    .slice(1)
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

/** Un texte qui commence par = + - @ serait interprété comme une formule par Excel : on le neutralise. */
function guard(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function format(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return Number.isFinite(cell) ? String(cell).replace(".", ",") : "";
  if (typeof cell === "boolean") return cell ? "oui" : "non";
  const safe = guard(cell);
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Produit un CSV compatible Excel français : séparateur « ; », décimales avec virgule, BOM UTF-8. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) =>
    r.map((c) => (typeof c === "string" && r === headers ? c : format(c))).join(";"),
  );
  return BOM + lines.join("\r\n") + "\r\n";
}

/** Décimal saisi à la française ou à l'anglaise : « 2,5 », « 2.5 », « 1 200,50 ». NaN si invalide. */
export function parseDecimal(value: string | undefined | null): number {
  if (value === undefined || value === null) return Number.NaN;
  const cleaned = value.trim().replace(/[\s ]/g, "").replace(",", ".");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}
