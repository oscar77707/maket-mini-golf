import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Pole } from "@/types/models";

/** Pôles actifs, dans l'ordre d'affichage (une seule lecture par requête). */
export const getPoles = cache(async (): Promise<Pole[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("poles").select("*").eq("actif", true).order("ordre");
  if (error) throw error;
  return data;
});
