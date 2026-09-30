import { describe, expect, it } from "vitest";
import { contrastRatio, isHexColor, TEXT_ON_PRIMARY } from "@/lib/colors";
import { detectLogoType, logoPublicUrl } from "@/lib/logo";
import { libelleAction, statutCompte } from "@/features/parametres/labels";
import {
  anonymisationSchema,
  complexeSchema,
  fermetureSchema,
  horairesSchema,
  invitationSchema,
  polesSchema,
  retentionSchema,
  saisonSchema,
  utilisateurSchema,
  webhookSchema,
} from "@/features/parametres/schemas";
import { profilSchema } from "@/features/compte/schemas";

const message = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.success ? null : r.error?.issues.map((i) => i.message).join(" | ");

describe("couleurs", () => {
  it("reconnaît les codes #RRGGBB", () => {
    expect(isHexColor("#0F766E")).toBe(true);
    expect(isHexColor("0F766E")).toBe(false);
    expect(isHexColor("#FFF")).toBe(false);
  });

  it("calcule le contraste (blanc sur noir = 21, sur blanc = 1)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#0F766E", TEXT_ON_PRIMARY)).toBeGreaterThan(4.5);
  });
});

describe("logo", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

  it("reconnaît PNG, JPEG et WebP à leur contenu", () => {
    expect(detectLogoType(png)?.mime).toBe("image/png");
    expect(detectLogoType(jpeg)?.mime).toBe("image/jpeg");
    expect(detectLogoType(webp)?.mime).toBe("image/webp");
  });

  it("refuse le reste, dont le SVG (il peut contenir du script) et un fichier renommé", () => {
    expect(
      detectLogoType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")),
    ).toBeNull();
    expect(detectLogoType(new TextEncoder().encode("ceci n'est pas une image"))).toBeNull();
    expect(detectLogoType(new Uint8Array())).toBeNull();
  });

  it("construit l'adresse publique en encodant chaque segment", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co/";
    expect(logoPublicUrl("logo-1.png")).toBe(
      "https://exemple.supabase.co/storage/v1/object/public/logos/logo-1.png",
    );
    expect(logoPublicUrl("dossier/a b.png")).toContain("/logos/dossier/a%20b.png");
    expect(logoPublicUrl(null)).toBeNull();
  });
});

describe("réglages du complexe", () => {
  const valide = {
    nom_complexe: "  La Palmeraie  ",
    couleur_principale: "#1d4ed8",
    couleur_secondaire: "#f59e0b",
    adresse: "",
    telephone: "",
    email_contact: "Contact@Palmeraie.TEST",
    seuil_dlc_jours: "3",
    marge_alerte_pct: "25",
  };

  it("nettoie les valeurs (espaces, majuscules des couleurs, e-mail en minuscules, vides en null)", () => {
    const r = complexeSchema.parse(valide);
    expect(r).toMatchObject({
      nom_complexe: "La Palmeraie",
      couleur_principale: "#1D4ED8",
      adresse: null,
      email_contact: "contact@palmeraie.test",
      seuil_dlc_jours: 3,
      marge_alerte_pct: 25,
    });
  });

  it("refuse une couleur principale trop claire pour le texte blanc", () => {
    expect(
      message(complexeSchema.safeParse({ ...valide, couleur_principale: "#FFFF00" })),
    ).toContain("trop claire");
  });

  it("refuse une couleur secondaire trop sombre pour son texte", () => {
    expect(
      message(complexeSchema.safeParse({ ...valide, couleur_secondaire: "#111111" })),
    ).toContain("trop sombre");
  });

  it("borne les seuils et accepte la virgule française", () => {
    expect(message(complexeSchema.safeParse({ ...valide, seuil_dlc_jours: "31" }))).toContain(
      "au plus 30",
    );
    expect(message(complexeSchema.safeParse({ ...valide, marge_alerte_pct: "-1" }))).toContain(
      "au moins 0",
    );
    expect(message(complexeSchema.safeParse({ ...valide, marge_alerte_pct: "2,5" }))).toContain(
      "entier",
    );
    expect(message(complexeSchema.safeParse({ ...valide, nom_complexe: "A" }))).toContain(
      "2 caractères",
    );
  });

  it("valide les pôles : nom et couleur lisible", () => {
    expect(polesSchema.safeParse([{ id: 1, nom: "Restaurant", couleur: "#ea580c" }]).success).toBe(
      true,
    );
    expect(message(polesSchema.safeParse([{ id: 1, nom: "R", couleur: "#EA580C" }]))).toContain(
      "2 caractères",
    );
    expect(
      message(polesSchema.safeParse([{ id: 1, nom: "Restaurant", couleur: "#FFFF00" }])),
    ).toContain("trop claire");
  });
});

describe("utilisateurs", () => {
  const base = {
    prenom: " Emma ",
    nom: "Durand",
    email: "  Emma.Durand@Palmeraie.TEST ",
    telephone: "",
    role: "salarie",
    pole: "mini_golf",
    saisonnier: false,
    fin_contrat: "",
  };

  it("invitation : normalise l'e-mail et le pôle vide", () => {
    const r = invitationSchema.parse(base);
    expect(r).toMatchObject({
      email: "emma.durand@palmeraie.test",
      prenom: "Emma",
      telephone: null,
      fin_contrat: null,
    });
  });

  it("un responsable ou un salarié a toujours un pôle, le gérant n'en a pas", () => {
    expect(message(invitationSchema.safeParse({ ...base, pole: "" }))).toContain(
      "Choisissez le pôle",
    );
    expect(
      message(invitationSchema.safeParse({ ...base, role: "responsable", pole: "" })),
    ).toContain("Choisissez le pôle");
    expect(invitationSchema.safeParse({ ...base, role: "gerant", pole: "" }).success).toBe(true);
  });

  it("le gérant n'est pas saisonnier ; la fin de contrat ne concerne que les saisonniers", () => {
    expect(
      message(invitationSchema.safeParse({ ...base, role: "gerant", pole: "", saisonnier: true })),
    ).toContain("ne peut pas être saisonnier");
    expect(message(utilisateurSchema.safeParse({ ...base, fin_contrat: "2026-10-31" }))).toContain(
      "saisonniers",
    );
    expect(
      utilisateurSchema.safeParse({ ...base, saisonnier: true, fin_contrat: "2026-10-31" }).success,
    ).toBe(true);
    expect(
      message(
        utilisateurSchema.safeParse({ ...base, saisonnier: true, fin_contrat: "2026-02-31" }),
      ),
    ).toContain("n'existe pas");
  });

  it("refuse un rôle inconnu, un e-mail invalide et un téléphone mal formé", () => {
    expect(invitationSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
    expect(message(invitationSchema.safeParse({ ...base, email: "pas-un-email" }))).toContain(
      "adresse e-mail",
    );
    expect(message(utilisateurSchema.safeParse({ ...base, telephone: "abc" }))).toContain(
      "Numéro de téléphone",
    );
    expect(utilisateurSchema.parse({ ...base, telephone: "06 12 34 56 78" }).telephone).toBe(
      "06 12 34 56 78",
    );
  });

  it("l'anonymisation exige la confirmation exacte", () => {
    expect(anonymisationSchema.safeParse({ confirmation: "ANONYMISER" }).success).toBe(true);
    expect(anonymisationSchema.safeParse({ confirmation: "anonymiser" }).success).toBe(false);
    expect(anonymisationSchema.safeParse({}).success).toBe(false);
  });

  it("mon compte : prénom et nom obligatoires", () => {
    expect(message(profilSchema.safeParse({ prenom: "", nom: "Martin", telephone: "" }))).toContain(
      "prénom",
    );
    expect(
      profilSchema.parse({ prenom: "Lucas", nom: "Martin", telephone: "" }).telephone,
    ).toBeNull();
  });

  it("états d'un compte", () => {
    const p = { actif: true, anonymise_le: null, invitation_en_attente: false };
    expect(statutCompte(p)).toBe("actif");
    expect(statutCompte({ ...p, invitation_en_attente: true })).toBe("invite");
    expect(statutCompte({ ...p, actif: false })).toBe("desactive");
    expect(statutCompte({ ...p, actif: false, anonymise_le: "2026-09-30T00:00:00Z" })).toBe(
      "anonymise",
    );
  });
});

describe("saisons, horaires, fermetures", () => {
  it("saison : la fin ne précède pas le début, dates réelles", () => {
    expect(
      saisonSchema.safeParse({ nom: "Été", date_debut: "2026-07-01", date_fin: "2026-08-31" })
        .success,
    ).toBe(true);
    expect(
      saisonSchema.safeParse({ nom: "Été", date_debut: "2026-07-01", date_fin: "2026-07-01" })
        .success,
    ).toBe(true);
    expect(
      message(
        saisonSchema.safeParse({ nom: "Été", date_debut: "2026-08-31", date_fin: "2026-07-01" }),
      ),
    ).toContain("ne peut pas précéder");
    expect(
      message(
        saisonSchema.safeParse({ nom: "Été", date_debut: "2026-02-30", date_fin: "2026-08-01" }),
      ),
    ).toContain("n'existe pas");
  });

  const semaine = (
    surcharge: Record<
      number,
      Partial<{ ferme: boolean; ouverture: string; fermeture: string }>
    > = {},
  ) => ({
    saison_id: "0b1c7d0a-0000-4000-8000-000000000001",
    pole_id: 1,
    jours: [1, 2, 3, 4, 5, 6, 7].map((j) => ({
      jour_semaine: j,
      ferme: false,
      ouverture: "10:00",
      fermeture: "19:00",
      ...surcharge[j],
    })),
  });

  it("horaires : sept jours, heures HH:MM, fermé sans heures", () => {
    expect(horairesSchema.safeParse(semaine()).success).toBe(true);
    expect(
      horairesSchema.safeParse(semaine({ 2: { ferme: true, ouverture: "", fermeture: "" } }))
        .success,
    ).toBe(true);
    expect(horairesSchema.safeParse(semaine({ 7: { fermeture: "01:00" } })).success).toBe(true); // après minuit
  });

  it("horaires : refuse les heures manquantes, invalides ou identiques", () => {
    expect(message(horairesSchema.safeParse(semaine({ 1: { ouverture: "" } })))).toContain(
      "Indiquez l'heure",
    );
    expect(message(horairesSchema.safeParse(semaine({ 1: { fermeture: "25:00" } })))).toContain(
      "Indiquez l'heure",
    );
    expect(
      message(horairesSchema.safeParse(semaine({ 3: { ouverture: "10:00", fermeture: "10:00" } }))),
    ).toContain("identiques");
  });

  it("horaires : exige les sept jours, chacun une fois", () => {
    const s = semaine();
    expect(horairesSchema.safeParse({ ...s, jours: s.jours.slice(0, 6) }).success).toBe(false);
    expect(
      message(horairesSchema.safeParse({ ...s, jours: [...s.jours.slice(0, 6), s.jours[0]] })),
    ).toContain("une fois");
  });

  it("fermeture : motif, pôle facultatif (tout le complexe), dates cohérentes", () => {
    const f = { pole_id: "", date_debut: "2026-12-01", date_fin: "2026-12-05", motif: "Travaux" };
    expect(fermetureSchema.parse(f).pole_id).toBeNull();
    expect(fermetureSchema.parse({ ...f, pole_id: "2" }).pole_id).toBe(2);
    expect(message(fermetureSchema.safeParse({ ...f, date_fin: "2026-11-30" }))).toContain(
      "ne peut pas précéder",
    );
    expect(message(fermetureSchema.safeParse({ ...f, motif: " " }))).toContain("motif");
  });
});

describe("intégrations et données", () => {
  it("webhook : https obligatoire, pas d'identifiants dans l'adresse, vide = aucune adresse", () => {
    expect(
      webhookSchema.parse({
        cle: "order_send",
        url: "https://n8n.exemple.fr/webhook/x",
        actif: true,
      }).url,
    ).toBe("https://n8n.exemple.fr/webhook/x");
    expect(webhookSchema.parse({ cle: "order_send", url: "", actif: true }).url).toBeNull();
    expect(
      message(
        webhookSchema.safeParse({ cle: "order_send", url: "http://n8n.local/x", actif: true }),
      ),
    ).toContain("https://");
    expect(
      message(
        webhookSchema.safeParse({ cle: "order_send", url: "https://u:p@n8n.local/x", actif: true }),
      ),
    ).toContain("sans identifiant");
    expect(webhookSchema.safeParse({ cle: "Order Send!", url: "", actif: true }).success).toBe(
      false,
    );
  });

  it("conservation : bornes des durées", () => {
    expect(
      retentionSchema.parse({ retention_appels_jours: "90", retention_audit_jours: "730" }),
    ).toEqual({
      retention_appels_jours: 90,
      retention_audit_jours: 730,
    });
    expect(
      message(
        retentionSchema.safeParse({ retention_appels_jours: "6", retention_audit_jours: "730" }),
      ),
    ).toContain("au moins 7");
    expect(
      message(
        retentionSchema.safeParse({ retention_appels_jours: "90", retention_audit_jours: "89" }),
      ),
    ).toContain("au moins 90");
    expect(
      message(
        retentionSchema.safeParse({ retention_appels_jours: "1096", retention_audit_jours: "730" }),
      ),
    ).toContain("au plus 1095");
  });

  it("journal : libellés français, action inconnue affichée telle quelle", () => {
    expect(libelleAction("rgpd.anonymisation")).toBe("Compte anonymisé");
    expect(libelleAction("utilisateur.invitation")).toBe("Invitation envoyée");
    expect(libelleAction("quelque.chose")).toBe("quelque.chose");
  });
});
