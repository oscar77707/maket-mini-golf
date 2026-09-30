# Échanges avec n8n (commandes fournisseurs et appels du standard IA)

Deux sens, tous deux signés. Les secrets ne sont jamais dans le code : variables d'environnement (`.env.example`).

| Variable                    | Rôle                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `N8N_WEBHOOK_ORDER_SEND`    | Adresse du webhook n8n qui reçoit les commandes (https en production)              |
| `N8N_OUTBOUND_SECRET`       | Clé de signature des appels application → n8n                                      |
| `N8N_INBOUND_TOKEN`         | Jeton `Bearer` que n8n doit présenter à l'application                              |
| `N8N_INBOUND_SECRET`        | Clé de signature des appels n8n → application                                      |
| `PHONE_HASH_SECRET`         | Clé de l'empreinte des numéros d'appel (regrouper les appels d'un même numéro)     |
| `SUPABASE_SERVICE_ROLE_KEY` | Utilisée par les routes entrantes (contourne la RLS), jamais envoyée au navigateur |

La signature est un HMAC-SHA256 en hexadécimal de `horodatage + "." + corps brut`, avec les en-têtes :

- `X-Palmeraie-Timestamp` : secondes Unix ; refusé au-delà de 5 minutes d'écart ;
- `X-Palmeraie-Signature` : la signature ;
- `X-Idempotency-Key` : identifiant unique de la requête.

## 1. Application → n8n : « Valider et envoyer »

Le gérant clique sur « Valider et envoyer » : l'application fait un `POST` JSON vers `N8N_WEBHOOK_ORDER_SEND` (délai maximal 10 s, pas de redirection). Si n8n répond 2xx, la commande passe à **Envoyée** ; sinon elle reste **À valider**, l'erreur est affichée et le gérant peut réessayer. La clé d'idempotence est `order.send:<commandeId>` : n8n peut ignorer un second appel pour la même commande.

```json
{
  "evenement": "order.send",
  "commandeId": "0b1c…",
  "reference": "CMD-000086",
  "pole": { "code": "restaurant", "nom": "Restaurant" },
  "fournisseur": {
    "id": "…",
    "nom": "Grossiste Provence Alimentaire",
    "mode_commande": "email",
    "email": "commandes@provence-alimentaire.test",
    "telephone": "04 11 22 33 44",
    "url_portail": null,
    "contact_nom": "Sandrine Vidal"
  },
  "date_livraison_prevue": "2026-10-01",
  "commentaire": "Livraison avant 10 h",
  "total_ht": 151,
  "lignes": [
    {
      "produit_id": "…",
      "produit": "Jambon blanc",
      "reference_fournisseur": "JAMB-01",
      "unite": "kg",
      "quantite": 10,
      "prix_unitaire_ht": 9.5,
      "montant_ht": 95
    }
  ]
}
```

`mode_commande` vaut `email`, `telephone` ou `portail` : c'est n8n qui choisit quoi faire (envoyer un e-mail, déclencher un appel, ouvrir le portail). Le workflow n8n doit vérifier la signature avant d'agir (voir `scripts/faux-n8n.mjs` pour un exemple complet).

## 2. n8n → application : `POST /api/webhooks/n8n/orders`

En-têtes : `Authorization: Bearer <N8N_INBOUND_TOKEN>`, `X-Palmeraie-Timestamp`, `X-Palmeraie-Signature`, `X-Idempotency-Key`. Un renvoi avec la même clé renvoie `200 {"doublon": true}` sans rien refaire.

### `draft.create` : crée un brouillon (origine « n8n »)

```json
{
  "evenement": "draft.create",
  "pole": "restaurant",
  "fournisseur": "Grossiste Provence Alimentaire",
  "date_livraison_prevue": "2026-10-01",
  "commentaire": "Réassort automatique",
  "lignes": [{ "produit": "Beurre doux", "quantite": 5 }]
}
```

- `pole` : `restaurant`, `mini_golf` ou `aquatique`.
- Fournisseur : `fournisseurId` (uuid) ou `fournisseur` (nom, sans tenir compte des accents ni de la casse).
- Chaque ligne : `produitId` ou `produit` (nom), `quantite` > 0, `prix_unitaire_ht` facultatif (sinon prix du fournisseur, puis du produit).
- Réponse : `200 {"commandeId", "reference", "statut": "brouillon", "lignes"}`. Le gérant valide ensuite dans l'application.

### `status.update` : met à jour le statut d'une commande envoyée

```json
{
  "evenement": "status.update",
  "reference": "CMD-000086",
  "statut": "confirmee",
  "date_livraison_prevue": "2026-10-03"
}
```

- Commande : `commandeId` ou `reference` (`CMD-000086`).
- `statut` : `confirmee`, `en_retard` ou `annulee` (avec `motif` obligatoire). **`livree` est refusé** : la livraison se pointe dans l'application, car c'est elle qui met le stock à jour.
- On peut n'envoyer que `date_livraison_prevue`.

### Réponses

| Code | Sens                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------ |
| 200  | Traité (ou doublon)                                                                              |
| 400  | Corps invalide, statut non autorisé, fournisseur ou produit inconnu : `details` liste les champs |
| 401  | Jeton, signature ou horodatage incorrect                                                         |
| 404  | Commande introuvable                                                                             |
| 409  | Transition de statut impossible (ex. `livree` → `confirmee`) ou requête déjà en cours            |
| 500  | Erreur interne                                                                                   |

## 3. n8n → application : `POST /api/webhooks/n8n/calls`

Le standard IA envoie chaque appel terminé. Mêmes en-têtes et même signature que `/orders` (jeton `Bearer`, `X-Palmeraie-Timestamp`, `X-Palmeraie-Signature`, `X-Idempotency-Key`). Un renvoi avec la même clé, ou avec le même `id_externe`, répond `200 {"doublon": true}` sans rien enregistrer de plus.

```json
{
  "evenement": "call.completed",
  "id_externe": "call_8f3a1c",
  "debut": "2026-09-30T10:12:00+02:00",
  "duree_secondes": 142,
  "numero": "06 12 34 56 78",
  "pole": "restaurant",
  "issue": "reservation",
  "resume": "Réservation d'une table pour 4 personnes ce soir à 20 h.",
  "transcription": "Client : Bonjour…\nIA : Bien sûr…",
  "metadonnees": { "langue": "fr" }
}
```

- Obligatoires : `id_externe` (identifiant de l'appel côté n8n), `debut` (ISO 8601 **avec fuseau**), `duree_secondes` (entier, 86 400 au plus), `issue`.
- `issue` : `renseigne`, `reservation`, `transfere` ou `message_laisse`.
- `pole` : `restaurant`, `mini_golf` ou `aquatique` ; à omettre (ou `null`) pour un appel général.
- `evenement` : facultatif, s'il est présent il vaut `call.completed`.
- `numero` : facultatif, sous n'importe quelle écriture (`06 12…`, `+33 6…`, `0033…`). **Il n'est jamais enregistré en clair** : l'application garde une version masquée (`06 •• •• •• 78`) et une empreinte HMAC (`PHONE_HASH_SECRET`) qui sert à retrouver les autres appels du même numéro. Numéro absent ou caché par l'appelant : « Numéro masqué ».
- `resume` (2 000 caractères) et `transcription` (50 000) : facultatifs. Dans la transcription, les lignes `Client : …` et `IA : …` sont mises en forme dans l'écran de détail.
- `metadonnees` : objet libre (10 000 caractères au plus), affiché dans « Informations techniques ».
- Réponse : `200 {"appelId", "numero": "06 •• •• •• 78"}`. Codes : 400 (corps invalide, `details` liste les champs), 401 (jeton, signature ou horodatage), 409 (même clé déjà en cours), 500.
- Seul le gérant voit le journal (la base refuse toute lecture aux autres rôles). Les appels sont supprimés après 90 jours (réglable), chaque nuit à 3 h 15 par `pg_cron`. Si `pg_cron` n'est pas activé sur votre projet Supabase (Database > Extensions), activez-le, ou lancez `select app.purger_donnees();` à la main.

## Tester sans n8n

```bash
# faux n8n : affiche chaque commande reçue et vérifie la signature (--echec : répond 500)
N8N_OUTBOUND_SECRET=… node scripts/faux-n8n.mjs

# appel entrant correctement signé
N8N_INBOUND_TOKEN=… N8N_INBOUND_SECRET=… APP_URL=http://localhost:3000 \
  node scripts/appel-n8n.mjs '{"evenement":"status.update","reference":"CMD-000082","statut":"confirmee"}'

# un appel de démonstration dans le journal des appels (lit .env.local, application lancée sur le port 3000)
npm run appel-test
```

Le même appel avec `curl` (la signature se calcule avec `openssl`) :

```bash
CORPS='{"id_externe":"test-curl-1","debut":"2026-09-30T10:12:00+02:00","duree_secondes":90,"numero":"06 12 34 56 78","issue":"renseigne","resume":"Question sur les horaires."}'
TS=$(date +%s)
SIG=$(printf '%s' "$TS.$CORPS" | openssl dgst -sha256 -hmac "$N8N_INBOUND_SECRET" | sed 's/^.* //')
curl -i -X POST http://localhost:3000/api/webhooks/n8n/calls \
  -H "Content-Type: application/json" -H "Authorization: Bearer $N8N_INBOUND_TOKEN" \
  -H "X-Palmeraie-Timestamp: $TS" -H "X-Palmeraie-Signature: $SIG" -H "X-Idempotency-Key: test-curl-1" \
  -d "$CORPS"
```

En développement (`npm run dev`), `http://localhost:5678/webhook/order-send` est accepté. Une application compilée (`npm run build` puis `npm start`) exige https : lancer `faux-n8n.mjs` avec `N8N_TLS_CERT` et `N8N_TLS_KEY` (certificat auto-signé) et démarrer l'application avec `NODE_EXTRA_CA_CERTS=<certificat>`.
