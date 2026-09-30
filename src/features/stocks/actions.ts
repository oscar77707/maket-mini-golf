"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toFrenchMessage } from "@/lib/errors";
import { fetchAll, inChunks } from "@/lib/supabase/paginate";
import { context, DENIED, failed, type Client } from "@/lib/action-context";
import { fail, invalid, ok, type ServerResult } from "@/lib/server-result";
import { planImport, type ImportLineReport } from "./import-plan";
import { UNITE_LABELS } from "./labels";
import {
  comptageSchema,
  importPayloadSchema,
  splitImportRows,
  inventaireCreationSchema,
  mouvementSchema,
  produitSchema,
} from "./schemas";

const refresh = () => {
  revalidatePath("/stocks", "layout");
  revalidatePath("/tableau-de-bord");
};
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);

function produitError(error: { code?: string; message?: string }): ServerResult<never> {
  if (error.code === "23505")
    return fail("Un produit actif porte déjà ce nom dans ce pôle.", {
      nom: "Ce nom existe déjà dans ce pôle.",
    });
  if (error.code === "23503")
    return fail("La catégorie, le lieu ou le fournisseur choisi n'appartient pas à ce pôle.");
  return fail(toFrenchMessage(error));
}

// -----------------------------------------------------------------------------------------------
// Produits
// -----------------------------------------------------------------------------------------------
export async function createProduit(input: unknown): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = produitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  // Un responsable ne crée que dans son pôle (la RLS le refuserait de toute façon).
  const pole_id =
    ctx.user.profile.role === "gerant"
      ? parsed.data.pole_id
      : (ctx.user.profile.pole_id ?? parsed.data.pole_id);
  const { data, error } = await ctx.supabase
    .from("produits")
    .insert({ ...parsed.data, pole_id })
    .select("id")
    .single();
  if (error) return produitError(error);
  refresh();
  return ok({ id: data.id }, `Produit « ${parsed.data.nom} » créé.`);
}

export async function updateProduit(id: string, input: unknown): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(id).success) return fail("Produit invalide.");
  const parsed = produitSchema.omit({ pole_id: true }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { data, error } = await ctx.supabase
    .from("produits")
    .update(parsed.data)
    .eq("id", id)
    .select("id");
  if (error) return produitError(error);
  if (!data?.length) return fail(DENIED);
  refresh();
  return ok(null, "Produit modifié.");
}

export async function archiverProduits(
  ids: string[],
  archiver: boolean,
): Promise<ServerResult<{ count: number }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return fail("Sélectionnez au moins un produit.");

  const { data, error } = await ctx.supabase
    .from("produits")
    .update({ actif: !archiver })
    .in("id", parsed.data)
    .select("id");
  if (error) return produitError(error);
  refresh();
  const n = data?.length ?? 0;
  return ok(
    { count: n },
    archiver
      ? `${n} produit${n > 1 ? "s" : ""} archivé${n > 1 ? "s" : ""}.`
      : `${n} produit${n > 1 ? "s" : ""} restauré${n > 1 ? "s" : ""}.`,
  );
}

// -----------------------------------------------------------------------------------------------
// Mouvements
// -----------------------------------------------------------------------------------------------
export async function enregistrerMouvement(
  input: unknown,
): Promise<ServerResult<{ id: number; libelle: string }>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  const parsed = mouvementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  if (v.type === "correction" && ctx.user.profile.role === "salarie") {
    return fail("Seul un responsable peut corriger le stock.");
  }
  const { data: produit, error: e1 } = await ctx.supabase
    .from("v_stock_produits")
    .select("nom, unite, actif, suivi_dlc, stock_actuel")
    .eq("id", v.produit_id)
    .maybeSingle();
  if (e1) return fail(toFrenchMessage(e1));
  if (!produit || !produit.actif) return fail("Ce produit est introuvable ou archivé.");

  const stock = Number(produit.stock_actuel);
  const unite = UNITE_LABELS[produit.unite as keyof typeof UNITE_LABELS];
  let quantite = v.quantite;

  if (v.type === "sortie" || v.type === "perte") {
    if (v.quantite > stock + 1e-9) {
      return fail(
        `Stock insuffisant : il reste ${fmt(stock)} ${unite}. Vérifiez la quantité ou demandez une correction à votre responsable.`,
        {
          quantite: `Il ne reste que ${fmt(stock)} ${unite}.`,
        },
      );
    }
  }
  if (v.type === "correction") {
    quantite = round3(v.quantite - stock);
    if (quantite === 0)
      return fail("Le stock réel est identique au stock actuel : rien à corriger.", {
        quantite: "Identique au stock actuel.",
      });
  }
  if (v.type === "entree" && produit.suivi_dlc) {
    if (!v.dlc)
      return fail("La DLC est obligatoire pour ce produit.", {
        dlc: "La DLC est obligatoire pour ce produit.",
      });
    if (v.dlc < new Date().toISOString().slice(0, 10))
      return fail("Cette DLC est déjà dépassée.", { dlc: "Cette DLC est déjà dépassée." });
  }

  const { data, error } = await ctx.supabase.rpc("enregistrer_mouvement", {
    p_produit_id: v.produit_id,
    p_type: v.type,
    p_quantite: quantite,
    p_motif: v.motif ?? undefined,
    p_dlc: v.type === "entree" ? (v.dlc ?? undefined) : undefined,
    p_numero_lot: v.type === "entree" ? (v.numero_lot ?? undefined) : undefined,
  });
  if (error) return fail(toFrenchMessage(error));
  refresh();

  const signed = v.type === "entree" ? quantite : v.type === "correction" ? quantite : -quantite;
  const libelle = {
    entree: `Entrée enregistrée : +${fmt(quantite)} ${unite} de ${produit.nom}`,
    sortie: `Sortie enregistrée : −${fmt(quantite)} ${unite} de ${produit.nom}`,
    perte: `Perte enregistrée : −${fmt(quantite)} ${unite} de ${produit.nom}`,
    correction: `Stock corrigé : ${produit.nom} passe à ${fmt(v.quantite)} ${unite} (${signed > 0 ? "+" : "−"}${fmt(Math.abs(signed))})`,
  }[v.type];
  return ok({ id: data as number, libelle }, libelle);
}

export async function annulerMouvement(id: number): Promise<ServerResult<null>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  if (!Number.isInteger(id) || id <= 0) return fail("Mouvement invalide.");
  const { error } = await ctx.supabase.rpc("annuler_mouvement", { p_mouvement_id: id });
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok(null, "Mouvement annulé.");
}

export async function solderLot(lotId: string): Promise<ServerResult<null>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  if (!z.uuid().safeParse(lotId).success) return fail("Lot invalide.");
  const { data, error } = await ctx.supabase
    .from("lots_dlc")
    .update({ solde_le: new Date().toISOString(), solde_par: ctx.user.profile.id })
    .eq("id", lotId)
    .is("solde_le", null)
    .select("id");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Ce lot est déjà soldé ou introuvable.");
  refresh();
  return ok(null, "Lot marqué comme consommé ou jeté.");
}

// -----------------------------------------------------------------------------------------------
// Réapprovisionnement : brouillons de commande
// -----------------------------------------------------------------------------------------------
const commanderSchema = z.object({
  produitIds: z.array(z.uuid()).max(500).optional(),
  poleId: z.number().int().positive().nullable().optional(),
});

/** Retire des cibles les produits déjà dans un brouillon ou une commande en cours (évite les doublons). */
async function retirerDejaCommandes(
  supabase: Client,
  targets: Map<number, string[] | undefined>,
): Promise<number> {
  const { data: ouvertes, error } = await supabase
    .from("commandes")
    .select("id")
    .in("statut", ["brouillon", "a_valider", "envoyee", "confirmee", "en_retard"]);
  if (error) throw error;
  const lignes = await inChunks(
    (ouvertes ?? []).map((c) => c.id),
    (chunk) => supabase.from("commande_lignes").select("produit_id").in("commande_id", chunk),
    40,
  );
  const deja = new Set(lignes.map((l) => l.produit_id));
  let retires = 0;
  for (const [pole, ids] of [...targets]) {
    const restants = (ids ?? []).filter((id) => !deja.has(id));
    retires += (ids?.length ?? 0) - restants.length;
    if (restants.length) targets.set(pole, restants);
    else targets.delete(pole);
  }
  return retires;
}

export async function commanderProduits(
  input: z.input<typeof commanderSchema>,
): Promise<ServerResult<{ commandes: number; sansFournisseur: number }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = commanderSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { produitIds, poleId } = parsed.data;
  const { supabase, user } = ctx;

  const targets = new Map<number, string[] | undefined>();
  let sansFournisseur = 0;

  if (produitIds?.length) {
    const { data, error } = await supabase
      .from("v_stock_produits")
      .select("id, pole_id, fournisseur_principal_id")
      .in("id", produitIds)
      .eq("actif", true);
    if (error) return fail(toFrenchMessage(error));
    for (const p of data ?? []) {
      if (!p.fournisseur_principal_id) {
        sansFournisseur += 1;
        continue;
      }
      targets.set(p.pole_id as number, [
        ...(targets.get(p.pole_id as number) ?? []),
        p.id as string,
      ]);
    }
  } else {
    let poleIds: number[];
    if (user.profile.role === "responsable")
      poleIds = user.profile.pole_id ? [user.profile.pole_id] : [];
    else if (poleId) poleIds = [poleId];
    else {
      const { data } = await supabase.from("poles").select("id").eq("actif", true);
      poleIds = (data ?? []).map((p) => p.id);
    }
    for (const id of poleIds) {
      const { data, error } = await supabase
        .from("v_stock_produits")
        .select("id, fournisseur_principal_id")
        .eq("pole_id", id)
        .eq("actif", true)
        .eq("niveau_alerte", "rouge");
      if (error) return fail(toFrenchMessage(error));
      const eligible = (data ?? []).filter((p) => p.fournisseur_principal_id);
      sansFournisseur += (data ?? []).length - eligible.length;
      if (eligible.length)
        targets.set(
          id,
          eligible.map((p) => p.id as string),
        );
    }
  }

  if (targets.size === 0) {
    return fail(
      sansFournisseur > 0
        ? "Aucun produit à commander : les produits concernés n'ont pas de fournisseur principal."
        : "Aucun produit à commander pour le moment.",
    );
  }
  let dejaCommandes: number;
  try {
    dejaCommandes = await retirerDejaCommandes(supabase, targets);
  } catch (error) {
    return fail(toFrenchMessage(error as { code?: string; message?: string }));
  }
  if (targets.size === 0)
    return fail(
      "Ces produits sont déjà dans un brouillon ou une commande en cours : rien à ajouter.",
    );
  const commandes = new Set<string>();
  for (const [pole, ids] of targets) {
    const { data, error } = await supabase.rpc("creer_brouillons_reappro", {
      p_pole_id: pole,
      p_produit_ids: ids,
    });
    if (error) return fail(toFrenchMessage(error));
    (data ?? []).forEach((c) => commandes.add(c));
  }
  refresh();
  revalidatePath("/commandes");
  const n = commandes.size;
  const ignores = (n: number, motif: string) =>
    n > 0 ? ` ${n} produit${n > 1 ? "s" : ""} ${motif} ignoré${n > 1 ? "s" : ""}.` : "";
  const note =
    ignores(sansFournisseur, "sans fournisseur principal") +
    ignores(dejaCommandes, "déjà en commande ou en brouillon");
  return ok(
    { commandes: n, sansFournisseur },
    `${n} brouillon${n > 1 ? "s" : ""} de commande créé${n > 1 ? "s" : ""} ou complété${n > 1 ? "s" : ""}.${note}`,
  );
}

// -----------------------------------------------------------------------------------------------
// Inventaires
// -----------------------------------------------------------------------------------------------
export async function creerInventaire(input: unknown): Promise<ServerResult<{ id: string }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = inventaireCreationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = ctx;
  const pole_id =
    user.profile.role === "gerant"
      ? parsed.data.pole_id
      : (user.profile.pole_id ?? parsed.data.pole_id);

  const lieu = parsed.data.lieu_stockage_id;
  let liste: { id: string }[];
  try {
    liste = await fetchAll((a, b) => {
      const q = supabase
        .from("produits")
        .select("id")
        .eq("pole_id", pole_id)
        .eq("actif", true)
        .order("id");
      return (lieu ? q.eq("lieu_stockage_id", lieu) : q).range(a, b);
    });
  } catch (e) {
    return fail(toFrenchMessage(e));
  }
  if (!liste.length) return fail("Aucun produit à inventorier dans ce lieu.");

  const { data: inv, error: e1 } = await supabase
    .from("inventaires")
    .insert({
      pole_id,
      lieu_stockage_id: parsed.data.lieu_stockage_id,
      commentaire: parsed.data.commentaire,
    })
    .select("id")
    .single();
  if (e1) {
    return fail(
      e1.code === "23505"
        ? "Un inventaire est déjà ouvert pour ce lieu. Terminez-le ou annulez-le avant d'en créer un autre."
        : toFrenchMessage(e1),
    );
  }
  for (let i = 0; i < liste.length; i += 500) {
    const { error } = await supabase
      .from("inventaire_lignes")
      .insert(liste.slice(i, i + 500).map((p) => ({ inventaire_id: inv.id, produit_id: p.id })));
    if (error) {
      await supabase.from("inventaires").delete().eq("id", inv.id);
      return fail(toFrenchMessage(error));
    }
  }
  refresh();
  return ok({ id: inv.id }, `Inventaire créé : ${liste.length} produits à compter.`);
}

export async function saveComptage(
  input: unknown,
): Promise<ServerResult<{ ecart: number | null; stock_theorique: number | null }>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  const parsed = comptageSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = ctx;

  if (user.profile.role === "salarie") {
    // un salarié ne peut plus modifier un comptage une fois l'inventaire soumis
    const { data: ligne } = await supabase
      .from("inventaire_lignes")
      .select("inventaire_id")
      .eq("id", parsed.data.ligne_id)
      .maybeSingle();
    const { data: inv } = ligne
      ? await supabase
          .from("inventaires")
          .select("statut")
          .eq("id", ligne.inventaire_id)
          .maybeSingle()
      : { data: null };
    if (inv && inv.statut !== "en_cours")
      return fail("Cet inventaire a été soumis : le comptage est verrouillé.");
  }
  const { data, error } = await supabase
    .from("inventaire_lignes")
    .update({ quantite_comptee: parsed.data.quantite })
    .eq("id", parsed.data.ligne_id)
    .select("ecart, stock_theorique");
  if (error) return fail(toFrenchMessage(error));
  if (!data?.length) return fail("Cet inventaire n'accepte plus de comptage.");
  return ok({ ecart: data[0].ecart, stock_theorique: data[0].stock_theorique });
}

const idSchema = z.uuid("Inventaire invalide.");

export async function soumettreInventaire(id: string): Promise<ServerResult<null>> {
  const ctx = await context();
  if (failed(ctx)) return ctx;
  if (!idSchema.safeParse(id).success) return fail("Inventaire invalide.");
  const { error } = await ctx.supabase.rpc("soumettre_inventaire", { p_inventaire_id: id });
  if (error) return fail(toFrenchMessage(error));
  refresh();
  return ok(null, "Inventaire soumis : votre responsable va le valider.");
}

export async function validerInventaire(
  id: string,
): Promise<ServerResult<{ corrections: number }>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!idSchema.safeParse(id).success) return fail("Inventaire invalide.");
  const { data, error } = await ctx.supabase.rpc("valider_inventaire", { p_inventaire_id: id });
  if (error) return fail(toFrenchMessage(error));
  refresh();
  const n = Number(data);
  return ok(
    { corrections: n },
    n === 0
      ? "Inventaire validé : aucun écart, le stock est exact."
      : `Inventaire validé : ${n} correction${n > 1 ? "s" : ""} de stock enregistrée${n > 1 ? "s" : ""}.`,
  );
}

export async function changerStatutInventaire(
  id: string,
  action: "annuler" | "rouvrir",
): Promise<ServerResult<null>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  if (!idSchema.safeParse(id).success) return fail("Inventaire invalide.");
  const query = ctx.supabase.from("inventaires");
  const { data, error } =
    action === "annuler"
      ? await query
          .update({ statut: "annule" })
          .eq("id", id)
          .in("statut", ["en_cours", "soumis"])
          .select("id")
      : await query
          .update({ statut: "en_cours", soumis_le: null })
          .eq("id", id)
          .eq("statut", "soumis")
          .select("id");
  if (error)
    return fail(
      error.code === "23505"
        ? "Un autre inventaire est déjà ouvert pour ce lieu."
        : toFrenchMessage(error),
    );
  if (!data?.length) return fail("Cet inventaire ne peut plus être modifié.");
  refresh();
  return ok(
    null,
    action === "annuler" ? "Inventaire annulé." : "Inventaire rouvert pour le comptage.",
  );
}

// -----------------------------------------------------------------------------------------------
// Import CSV
// -----------------------------------------------------------------------------------------------
export type ImportSummary = {
  reports: ImportLineReport[];
  importes: number;
  stocksInitiaux: number;
  categoriesCreees: number;
  lieuxCrees: number;
};

async function runImport(input: unknown, dryRun: boolean): Promise<ServerResult<ImportSummary>> {
  const ctx = await context("gerant", "responsable");
  if (failed(ctx)) return ctx;
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, user } = ctx;

  const { valid, rejected } = splitImportRows(parsed.data.rows);
  const plan = await planImport(supabase, user, { ...parsed.data, rows: valid });
  const summary: ImportSummary = {
    reports: [...plan.reports, ...rejected].sort((a, b) => a.ligne - b.ligne),
    importes: plan.planned.length,
    stocksInitiaux: plan.planned.filter((p) => p.row.stock > 0).length,
    categoriesCreees: plan.newCategories.length,
    lieuxCrees: plan.newLieux.length,
  };
  if (dryRun || plan.planned.length === 0) return ok(summary);

  if (plan.newCategories.length) {
    const { error } = await supabase
      .from("categories_produit")
      .upsert(plan.newCategories, { onConflict: "pole_id,nom", ignoreDuplicates: true });
    if (error) return fail(toFrenchMessage(error));
  }
  if (plan.newLieux.length) {
    const { error } = await supabase
      .from("lieux_stockage")
      .upsert(plan.newLieux, { onConflict: "pole_id,nom", ignoreDuplicates: true });
    if (error) return fail(toFrenchMessage(error));
  }
  const [cats, lieux] = await Promise.all([
    supabase.from("categories_produit").select("id, pole_id, nom"),
    supabase.from("lieux_stockage").select("id, pole_id, nom"),
  ]);
  const key = (pole: number, nom: string) =>
    `${pole}:${nom
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")}`;
  const catId = new Map((cats.data ?? []).map((c) => [key(c.pole_id, c.nom), c.id]));
  const lieuId = new Map((lieux.data ?? []).map((c) => [key(c.pole_id, c.nom), c.id]));

  const rows = plan.planned.map((p) => ({
    pole_id: p.pole_id,
    nom: p.row.nom,
    reference: p.row.reference || null,
    unite: p.unite,
    categorie_id: p.categorie ? (catId.get(key(p.pole_id, p.categorie)) ?? null) : null,
    lieu_stockage_id: p.lieu ? (lieuId.get(key(p.pole_id, p.lieu)) ?? null) : null,
    fournisseur_principal_id: p.fournisseur_id,
    prix_achat_ht: p.row.prix,
    seuil_minimum: p.row.seuil,
    quantite_reappro: p.row.reappro,
    suivi_dlc: p.row.dlc,
  }));
  const inserted: { id: string; pole_id: number; nom: string }[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await supabase
      .from("produits")
      .insert(rows.slice(i, i + 500))
      .select("id, pole_id, nom");
    if (error) {
      if (inserted.length)
        await supabase
          .from("produits")
          .delete()
          .in(
            "id",
            inserted.map((p) => p.id),
          );
      return produitError(error);
    }
    inserted.push(...(data ?? []));
  }

  const stockByProduct = new Map(plan.planned.map((p) => [key(p.pole_id, p.row.nom), p.row.stock]));
  const mouvements = inserted
    .map((p) => ({
      produit_id: p.id,
      pole_id: p.pole_id,
      type: "entree" as const,
      quantite: stockByProduct.get(key(p.pole_id, p.nom)) ?? 0,
      motif: "Stock initial (import CSV)",
      origine: "import_csv" as const,
    }))
    .filter((m) => m.quantite > 0);
  for (let i = 0; i < mouvements.length; i += 500) {
    const { error } = await supabase.from("mouvements_stock").insert(mouvements.slice(i, i + 500));
    if (error) {
      await supabase
        .from("produits")
        .delete()
        .in(
          "id",
          inserted.map((p) => p.id),
        );
      return fail(`Import annulé : ${toFrenchMessage(error)}`);
    }
  }
  refresh();
  return ok(
    { ...summary, importes: inserted.length, stocksInitiaux: mouvements.length },
    `${inserted.length} produit${inserted.length > 1 ? "s" : ""} importé${inserted.length > 1 ? "s" : ""}.`,
  );
}

export async function previsualiserImport(input: unknown) {
  return runImport(input, true);
}
export async function importerProduits(input: unknown) {
  return runImport(input, false);
}
