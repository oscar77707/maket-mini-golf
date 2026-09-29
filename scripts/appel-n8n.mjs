#!/usr/bin/env node
// Appelle l'entrée n8n → application avec les bons en-têtes (jeton, horodatage, signature).
//   node scripts/appel-n8n.mjs '{"evenement":"status.update","reference":"CMD-000012","statut":"confirmee"}'
// Variables lues dans l'environnement : N8N_INBOUND_TOKEN, N8N_INBOUND_SECRET, APP_URL (défaut http://localhost:3000).
import { createHmac, randomUUID } from "node:crypto";

const [corps, cle = randomUUID()] = process.argv.slice(2);
const {
  N8N_INBOUND_TOKEN: jeton,
  N8N_INBOUND_SECRET: secret,
  APP_URL = "http://localhost:3000",
} = process.env;
if (!corps || !jeton || !secret) {
  console.error(
    "Usage : N8N_INBOUND_TOKEN=... N8N_INBOUND_SECRET=... node scripts/appel-n8n.mjs '<json>' [cle-d-idempotence]",
  );
  process.exit(1);
}
const horodatage = String(Math.floor(Date.now() / 1000));
const signature = createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex");
const reponse = await fetch(`${APP_URL}/api/webhooks/n8n/orders`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${jeton}`,
    "x-palmeraie-timestamp": horodatage,
    "x-palmeraie-signature": signature,
    "x-idempotency-key": cle,
  },
  body: corps,
});
console.log(reponse.status, await reponse.text());
