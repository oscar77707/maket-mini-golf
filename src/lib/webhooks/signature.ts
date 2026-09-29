import { createHmac, timingSafeEqual } from "node:crypto";

/** En-têtes échangés avec n8n dans les deux sens. */
export const HEADER_TIMESTAMP = "x-palmeraie-timestamp";
export const HEADER_SIGNATURE = "x-palmeraie-signature";
export const HEADER_IDEMPOTENCY = "x-idempotency-key";

/** Tolérance sur l'horodatage : au-delà, la requête est rejetée (anti-rejeu). */
export const MAX_CLOCK_SKEW_SECONDS = 300;

/** Signature HMAC-SHA256 en hexadécimal de « horodatage.corps ». */
export function sign(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Comparaison en temps constant de deux chaînes (longueurs différentes : faux sans fuite de temps utile). */
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

/** Vérifie jeton Bearer, horodatage récent et signature d'une requête entrante. */
export function verifyInbound(input: {
  token: string;
  secret: string;
  authorization: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
}): SignatureCheck {
  const bearer = input.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  if (!input.token || !input.secret) return { ok: false, reason: "Webhook non configuré." };
  if (!safeEqual(bearer, input.token)) return { ok: false, reason: "Jeton invalide." };
  const seconds = Number(input.timestamp);
  const now = (input.now ?? Date.now()) / 1000;
  if (!Number.isFinite(seconds) || Math.abs(now - seconds) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "Horodatage absent ou trop ancien." };
  }
  const expected = sign(input.secret, input.timestamp ?? "", input.body);
  if (!input.signature || !safeEqual(input.signature.toLowerCase(), expected)) {
    return { ok: false, reason: "Signature invalide." };
  }
  return { ok: true };
}
