#!/usr/bin/env node
// Faux serveur n8n pour tester « Valider et envoyer » sans n8n.
//   N8N_OUTBOUND_SECRET=secret-test node scripts/faux-n8n.mjs          # répond 200
//   N8N_OUTBOUND_SECRET=secret-test node scripts/faux-n8n.mjs --echec  # répond 500 (test du message d'erreur)
// Puis dans .env.local : N8N_WEBHOOK_ORDER_SEND=http://localhost:5678/webhook/order-send
// (http n'est accepté qu'avec `npm run dev`. Pour tester une application compilée, il faut https :
//  fournir N8N_TLS_CERT et N8N_TLS_KEY (certificat auto-signé) et lancer l'application avec NODE_EXTRA_CA_CERTS=<certificat>.)
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer as createHttp } from "node:http";
import { createServer as createHttps } from "node:https";

const secret = process.env.N8N_OUTBOUND_SECRET;
const port = Number(process.env.PORT ?? 5678);
const echec = process.argv.includes("--echec");
const tls = process.env.N8N_TLS_CERT && process.env.N8N_TLS_KEY;
const createServer = (handler) =>
  tls
    ? createHttps(
        {
          cert: readFileSync(process.env.N8N_TLS_CERT),
          key: readFileSync(process.env.N8N_TLS_KEY),
        },
        handler,
      )
    : createHttp(handler);
if (!secret) {
  console.error("Définissez N8N_OUTBOUND_SECRET (la même valeur que dans .env.local).");
  process.exit(1);
}

createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const timestamp = req.headers["x-palmeraie-timestamp"] ?? "";
    const attendu = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const recu = String(req.headers["x-palmeraie-signature"] ?? "");
    const valide =
      recu.length === attendu.length && timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
    const recent = Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;
    if (!valide || !recent) {
      console.log(
        `[${new Date().toISOString()}] REFUSÉ : signature ${valide ? "correcte" : "invalide"}, horodatage ${recent ? "récent" : "trop ancien"}`,
      );
      res.writeHead(401).end("signature invalide");
      return;
    }
    const commande = JSON.parse(body);
    if (commande.evenement === "test.ping") {
      console.log(
        `[${new Date().toISOString()}] test.ping reçu (webhook « ${commande.webhook} ») : connexion OK`,
      );
      if (echec) {
        res.writeHead(500).end("échec simulé");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    console.log(
      `[${new Date().toISOString()}] ${commande.evenement} ${commande.reference} pour ${commande.fournisseur?.nom} (${commande.fournisseur?.mode_commande}) : ${commande.lignes?.length} ligne(s), ${commande.total_ht} € HT`,
    );
    for (const l of commande.lignes ?? [])
      console.log(`   - ${l.quantite} ${l.unite} ${l.produit} à ${l.prix_unitaire_ht} €`);
    if (echec) {
      res.writeHead(500).end("échec simulé");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
  });
}).listen(port, () =>
  console.log(
    `Faux n8n sur http${tls ? "s" : ""}://localhost:${port}/webhook/order-send${echec ? " (répond 500)" : ""}`,
  ),
);
