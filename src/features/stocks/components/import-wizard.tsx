"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Download, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notify } from "@/components/feedback/notify";
import { toCsv } from "@/lib/csv";
import type { Pole } from "@/types/models";
import { importerProduits, previsualiserImport, type ImportSummary } from "../actions";
import { parseImportFile, type ImportParseResult } from "../import-parse";
import { CSV_HEADERS, type ImportRow } from "../schemas";

const EXEMPLE = [
  [
    "Farine T55",
    "FAR-001",
    "Restaurant",
    "Épicerie sèche",
    "kg",
    "Réserve sèche",
    "",
    0.85,
    25,
    10,
    25,
    "non",
  ],
  [
    "Tomates rondes",
    "",
    "Restaurant",
    "Fruits et légumes",
    "kg",
    "Chambre froide positive",
    "",
    2.2,
    8,
    8,
    20,
    "oui",
  ],
] as const;

/** Excel français enregistre parfois en Windows-1252 : on essaie UTF-8 puis on retombe sur cet encodage. */
async function readText(file: File) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

const ICON = {
  ok: <CircleCheck aria-label="Prêt" className="size-5 text-green-600" />,
  avertissement: <TriangleAlert aria-label="Avertissement" className="size-5 text-orange-600" />,
  erreur: <CircleAlert aria-label="Erreur" className="size-5 text-destructive" />,
};

export function ImportWizard({ poles, isGerant }: { poles: Pole[]; isGerant: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [poleId, setPoleId] = useState<number | null>(isGerant ? (poles[0]?.id ?? null) : null);
  const [creer, setCreer] = useState(true);
  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifier = (rows: ImportRow[], pole: number | null, creerRef: boolean) =>
    startTransition(async () => {
      setError(null);
      if (rows.length === 0) return setSummary(null);
      const result = await previsualiserImport({
        pole_id: pole,
        creer_referentiels: creerRef,
        rows,
      });
      if (!result.ok) {
        setSummary(null);
        return setError(result.message);
      }
      setSummary(result.data);
    });

  const telechargerModele = () => {
    const blob = new Blob(
      [
        toCsv(
          [...CSV_HEADERS],
          EXEMPLE.map((r) => [...r]),
        ),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-produits.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const surFichier = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setSummary(null);
    setError(null);
    const result = parseImportFile(await readText(file));
    setParsed(result);
    if (result.missingHeaders.length === 0) verifier(result.rows, poleId, creer);
  };

  const nbErreurs =
    (summary?.reports.filter((r) => r.statut === "erreur").length ?? 0) +
    (parsed?.errors.length ?? 0);
  const nbAvertissements = summary?.reports.filter((r) => r.statut === "avertissement").length ?? 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">1. Préparer le fichier</h2>
        <p className="text-muted-foreground">
          Enregistrez votre feuille Excel au format <strong>CSV</strong> (« CSV UTF-8 » ou « CSV
          séparateur point-virgule »). Colonnes attendues : {CSV_HEADERS.join(", ")}. Seuls le nom
          et l&apos;unité sont obligatoires. Le stock actuel devient une entrée « Stock initial ».
        </p>
        <Button variant="outline" onClick={telechargerModele}>
          <Download aria-hidden />
          Télécharger le modèle CSV
        </Button>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <h2 className="text-lg font-semibold">2. Choisir le fichier</h2>
        {isGerant && (
          <label className="block max-w-sm space-y-2 text-sm font-medium">
            Pôle par défaut (si la colonne « Pôle » est vide)
            <Select
              value={poleId ?? ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                setPoleId(value);
                if (parsed?.rows.length) verifier(parsed.rows, value, creer);
              }}
            >
              {poles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="flex items-center gap-3">
          <Checkbox
            checked={creer}
            onChange={(e) => {
              setCreer(e.target.checked);
              if (parsed?.rows.length) verifier(parsed.rows, poleId, e.target.checked);
            }}
          />
          Créer automatiquement les catégories et lieux de stockage manquants
        </label>
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,text/csv"
          className="sr-only"
          aria-label="Fichier CSV à importer"
          onChange={(e) => void surFichier(e.target.files?.[0])}
        />
        <Button size="lg" onClick={() => input.current?.click()} disabled={pending}>
          <FileUp aria-hidden />
          {fileName ? "Choisir un autre fichier" : "Choisir un fichier CSV"}
        </Button>
        {fileName && <p className="text-sm text-muted-foreground">Fichier : {fileName}</p>}
        {parsed && parsed.missingHeaders.length > 0 && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
          >
            Colonne obligatoire absente : {parsed.missingHeaders.join(", ")}. Utilisez le modèle CSV
            ci-dessus.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </section>

      {pending && !summary && (
        <p role="status" className="flex items-center gap-2 text-muted-foreground">
          <Loader2 aria-hidden className="animate-spin" />
          Vérification du fichier…
        </p>
      )}

      {(summary || (parsed && parsed.errors.length > 0 && !pending)) && (
        <section className="space-y-4 rounded-lg border bg-card p-5" aria-live="polite">
          <h2 className="text-lg font-semibold">3. Vérifier et importer</h2>
          <p>
            <strong>{summary?.importes ?? 0}</strong> produit
            {(summary?.importes ?? 0) > 1 ? "s" : ""} prêt{(summary?.importes ?? 0) > 1 ? "s" : ""}{" "}
            à importer
            {nbAvertissements > 0 && <>, {nbAvertissements} avec avertissement</>}
            {nbErreurs > 0 && (
              <>
                ,{" "}
                <strong className="text-destructive">
                  {nbErreurs} ligne{nbErreurs > 1 ? "s" : ""} ignorée{nbErreurs > 1 ? "s" : ""}
                </strong>
              </>
            )}
            .
            {summary && (summary.categoriesCreees > 0 || summary.lieuxCrees > 0) && (
              <>
                {" "}
                {summary.categoriesCreees} catégorie{summary.categoriesCreees > 1 ? "s" : ""} et{" "}
                {summary.lieuxCrees} lieu{summary.lieuxCrees > 1 ? "x" : ""} seront créés.
              </>
            )}
          </p>
          {((summary?.reports.some((r) => r.statut !== "ok") ?? false) ||
            (parsed?.errors.length ?? 0) > 0) && (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH scope="col">Ligne</TH>
                    <TH scope="col">Produit</TH>
                    <TH scope="col">État</TH>
                    <TH scope="col">Détail</TH>
                  </TR>
                </THead>
                <TBody>
                  {parsed?.errors.map((e) => (
                    <TR key={`p${e.ligne}`}>
                      <TD>{e.ligne}</TD>
                      <TD>—</TD>
                      <TD>{ICON.erreur}</TD>
                      <TD>{e.raison}</TD>
                    </TR>
                  ))}
                  {summary?.reports
                    .filter((r) => r.statut !== "ok")
                    .slice(0, 300)
                    .map((r) => (
                      <TR key={r.ligne}>
                        <TD>{r.ligne}</TD>
                        <TD>{r.nom}</TD>
                        <TD>{ICON[r.statut]}</TD>
                        <TD>{r.messages.join(" ")}</TD>
                      </TR>
                    ))}
                </TBody>
              </Table>
            </div>
          )}
          <Button
            size="lg"
            disabled={pending || !summary || summary.importes === 0}
            onClick={() =>
              startTransition(async () => {
                const result = await importerProduits({
                  pole_id: poleId,
                  creer_referentiels: creer,
                  rows: parsed?.rows ?? [],
                });
                if (notify(result)) {
                  router.push("/stocks");
                  router.refresh();
                }
              })
            }
          >
            {pending && <Loader2 aria-hidden className="animate-spin" />}
            Importer {summary?.importes ?? 0} produit{(summary?.importes ?? 0) > 1 ? "s" : ""}
          </Button>
        </section>
      )}
    </div>
  );
}
