import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { logoPublicUrl } from "@/lib/logo";
import { createClient } from "@/lib/supabase/server";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const POLE_VARS = {
  restaurant: "--pole-restaurant",
  mini_golf: "--pole-mini-golf",
  aquatique: "--pole-aquatique",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: parametres }, { data: poles }] = await Promise.all([
    supabase
      .from("parametres")
      .select("nom_complexe, logo_path, couleur_principale, couleur_secondaire")
      .maybeSingle(),
    supabase.from("poles").select("code, nom, couleur").eq("actif", true).order("ordre"),
  ]);

  // Couleurs configurables dans Paramètres. Valeurs contrôlées (#RRGGBB) avant injection CSS.
  const vars: string[] = [];
  if (parametres && HEX.test(parametres.couleur_principale))
    vars.push(`--primary:${parametres.couleur_principale}`);
  if (parametres && HEX.test(parametres.couleur_secondaire))
    vars.push(`--secondary:${parametres.couleur_secondaire}`);
  const poleVars = (poles ?? [])
    .filter((p) => HEX.test(p.couleur))
    .map((p) => `${POLE_VARS[p.code]}:${p.couleur}`);

  return (
    <>
      <style>{`:root:not(.dark){${vars.join(";")}}:root{${poleVars.join(";")}}`}</style>
      <AppShell
        user={user}
        complexName={parametres?.nom_complexe ?? "La Palmeraie"}
        logoUrl={logoPublicUrl(parametres?.logo_path)}
        poles={poles ?? []}
      >
        {children}
      </AppShell>
    </>
  );
}
