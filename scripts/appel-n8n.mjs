#!/usr/bin/env node
// Appelle une entrée n8n → application avec les bons en-têtes (jeton, horodatage, signature).
//   node scripts/appel-n8n.mjs '{"evenement":"status.update","reference":"CMD-000012","statut":"confirmee"}'
//   node scripts/appel-n8n.mjs --route=calls --exemple          (envoie un appel de démonstration)
//   node scripts/appel-n8n.mjs --route=calls '<json>' [cle-d-idempotence]
// Variables lues dans l'environnement : N8N_INBOUND_TOKEN, N8N_INBOUND_SECRET, APP_URL (défaut http://localhost:3000).
import { createHmac, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const option = (nom) => args.find((a) => a.startsWith(`--${nom}=`))?.split("=")[1];
const route = option("route") ?? "orders";
const [corpsArg, cle = randomUUID()] = args.filter((a) => !a.startsWith("--"));

let corps = corpsArg;
if (args.includes("--exemple")) {
  const id = `test-${Date.now()}`;
  corps = JSON.stringify({
    evenement: "call.completed",
    id_externe: id,
    debut: new Date(Date.now() - 150_000).toISOString(),
    duree_secondes: 150,
    numero: "06 12 34 56 78",
    pole: "restaurant",
    issue: "reservation",
    resume: "Réservation d'une table pour 4 personnes demain à 20 h.",
    transcription:
      "Client : Bonjour, je voudrais réserver pour demain soir.\nIA : Bien sûr, pour combien de personnes ?\nClient : Quatre, vers 20 h.\nIA : C'est noté, à demain !",
    metadonnees: { source: "appel-de-test" },
  });
}

const {
  N8N_INBOUND_TOKEN: jeton,
  N8N_INBOUND_SECRET: secret,
  APP_URL = "http://localhost:3000",
} = process.env;
if (!corps || !jeton || !secret) {
  console.error(
    "Usage : N8N_INBOUND_TOKEN=... N8N_INBOUND_SECRET=... node scripts/appel-n8n.mjs [--route=orders|calls] ('<json>' [cle-d-idempotence] | --exemple)",
  );
  process.exit(1);
}
const horodatage = String(Math.floor(Date.now() / 1000));
const signature = createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex");
const reponse = await fetch(`${APP_URL}/api/webhooks/n8n/${route}`, {
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
