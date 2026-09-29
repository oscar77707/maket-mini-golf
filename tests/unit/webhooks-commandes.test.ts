import { describe, expect, it } from "vitest";
import { addDays, todayParis } from "@/lib/dates";
import { isAllowedWebhookUrl } from "@/features/commandes/n8n";
import { orderEventSchema } from "@/features/commandes/webhook-orders";
import { MAX_CLOCK_SKEW_SECONDS, safeEqual, sign, verifyInbound } from "@/lib/webhooks/signature";

const SECRET = "secret-de-test";
const TOKEN = "jeton-de-test";

function requete(body: string, over: Partial<Parameters<typeof verifyInbound>[0]> = {}) {
  const now = 1_800_000_000_000;
  const timestamp = String(now / 1000);
  return {
    token: TOKEN,
    secret: SECRET,
    authorization: `Bearer ${TOKEN}`,
    timestamp,
    signature: sign(SECRET, timestamp, body),
    body,
    now,
    ...over,
  };
}

describe("signature des webhooks", () => {
  const body = '{"evenement":"status.update"}';
  it("accepte une requête correctement signée", () => {
    expect(verifyInbound(requete(body))).toEqual({ ok: true });
  });
  it("refuse un mauvais jeton, une signature altérée ou un corps modifié", () => {
    expect(verifyInbound(requete(body, { authorization: "Bearer autre" }))).toMatchObject({
      ok: false,
    });
    expect(verifyInbound(requete(body, { authorization: null }))).toMatchObject({ ok: false });
    expect(verifyInbound(requete(body, { signature: "0".repeat(64) }))).toMatchObject({
      ok: false,
      reason: "Signature invalide.",
    });
    expect(verifyInbound(requete(body, { body: body + " " }))).toMatchObject({
      ok: false,
      reason: "Signature invalide.",
    });
    expect(verifyInbound(requete(body, { signature: null }))).toMatchObject({ ok: false });
  });
  it("refuse un horodatage trop ancien ou du futur (anti-rejeu)", () => {
    const now = 1_800_000_000_000;
    const vieux = String(now / 1000 - MAX_CLOCK_SKEW_SECONDS - 1);
    expect(
      verifyInbound(requete(body, { timestamp: vieux, signature: sign(SECRET, vieux, body) })),
    ).toMatchObject({ ok: false });
    const futur = String(now / 1000 + MAX_CLOCK_SKEW_SECONDS + 1);
    expect(
      verifyInbound(requete(body, { timestamp: futur, signature: sign(SECRET, futur, body) })),
    ).toMatchObject({ ok: false });
    expect(verifyInbound(requete(body, { timestamp: "abc" }))).toMatchObject({ ok: false });
  });
  it("refuse tout tant que les secrets ne sont pas configurés", () => {
    expect(verifyInbound(requete(body, { token: "", secret: "" }))).toMatchObject({
      ok: false,
      reason: "Webhook non configuré.",
    });
  });
  it("compare en temps constant sans planter sur des longueurs différentes", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("événements entrants de n8n", () => {
  it("accepte une création de brouillon complète", () => {
    const r = orderEventSchema.safeParse({
      evenement: "draft.create",
      pole: "restaurant",
      fournisseur: "Boucherie du Marché",
      lignes: [{ produit: "Steak haché", quantite: 12 }],
    });
    expect(r.success).toBe(true);
  });
  it("exige un fournisseur, des lignes identifiées et un pôle connu", () => {
    const base = {
      evenement: "draft.create",
      pole: "restaurant",
      fournisseur: "X",
      lignes: [{ produit: "Sel", quantite: 1 }],
    };
    expect(orderEventSchema.safeParse({ ...base, fournisseur: undefined }).success).toBe(false);
    expect(orderEventSchema.safeParse({ ...base, lignes: [] }).success).toBe(false);
    expect(orderEventSchema.safeParse({ ...base, lignes: [{ quantite: 1 }] }).success).toBe(false);
    expect(
      orderEventSchema.safeParse({ ...base, lignes: [{ produit: "Sel", quantite: 0 }] }).success,
    ).toBe(false);
    expect(orderEventSchema.safeParse({ ...base, pole: "cuisine" }).success).toBe(false);
  });
  it("accepte une mise à jour par référence ou identifiant, pas sans cible ni sans changement", () => {
    expect(
      orderEventSchema.safeParse({
        evenement: "status.update",
        reference: "CMD-000012",
        statut: "confirmee",
      }).success,
    ).toBe(true);
    expect(
      orderEventSchema.safeParse({
        evenement: "status.update",
        reference: "12",
        date_livraison_prevue: "2026-10-02",
      }).success,
    ).toBe(true);
    expect(
      orderEventSchema.safeParse({ evenement: "status.update", statut: "confirmee" }).success,
    ).toBe(false);
    expect(
      orderEventSchema.safeParse({ evenement: "status.update", reference: "CMD-000012" }).success,
    ).toBe(false);
    expect(
      orderEventSchema.safeParse({
        evenement: "status.update",
        reference: "abc",
        statut: "confirmee",
      }).success,
    ).toBe(false);
  });
  it("refuse un événement inconnu", () => {
    expect(orderEventSchema.safeParse({ evenement: "order.delete" }).success).toBe(false);
  });
});

describe("adresse du webhook sortant", () => {
  it("n'accepte que https en production", () => {
    expect(isAllowedWebhookUrl("https://n8n.exemple.fr/webhook/x", true)).toBe(true);
    expect(isAllowedWebhookUrl("http://n8n.exemple.fr/webhook/x", true)).toBe(false);
  });
  it("autorise http local en développement, jamais d'identifiants dans l'adresse", () => {
    expect(isAllowedWebhookUrl("http://localhost:5678/webhook/x", false)).toBe(true);
    expect(isAllowedWebhookUrl("https://user:pass@n8n.exemple.fr/x", false)).toBe(false);
    expect(isAllowedWebhookUrl("ftp://n8n.exemple.fr/x", false)).toBe(false);
    expect(isAllowedWebhookUrl("pas une adresse", false)).toBe(false);
  });
});

describe("dates", () => {
  it("ajoute des jours en franchissant fin de mois et année", () => {
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("donne la date du jour à Paris, pas en UTC", () => {
    expect(todayParis(new Date("2026-09-29T22:30:00Z"))).toBe("2026-09-30");
    expect(todayParis(new Date("2026-09-29T10:00:00Z"))).toBe("2026-09-29");
  });
});
