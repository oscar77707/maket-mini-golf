# La Palmeraie : gestion interne

Application de gestion des stocks, fournisseurs, commandes et appels IA du complexe La Palmeraie (Restaurant, Mini-golf, Aires aquatiques). Interface en français. Plan complet : [docs/plan.md](docs/plan.md).

## Prérequis

- Node.js 20.19+ (testé avec 22) et npm
- Docker et la [CLI Supabase](https://supabase.com/docs/guides/local-development) pour la base locale, ou un projet Supabase Cloud

## Installation (base locale)

```bash
npm install
supabase start            # démarre Postgres, Auth, API ; affiche les clés locales
cp .env.example .env.local
# renseigner NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY
# avec les valeurs affichées par `supabase start` (`supabase status` pour les revoir)
supabase db reset         # applique supabase/migrations puis supabase/seed.sql (données de démo)
npm run dev               # http://localhost:3000
```

Les e-mails de réinitialisation du mot de passe arrivent dans Inbucket : http://127.0.0.1:54324.

## Installation (Supabase Cloud)

1. Créer un projet (région UE), puis exécuter `supabase/migrations/*.sql` dans l'éditeur SQL (ou `supabase link` puis `supabase db push`).
2. La purge nocturne des appels (90 jours) repose sur l'extension `pg_cron` : la migration `20260930000000` tente de l'activer. Si Supabase la refuse, l'activer dans Database > Extensions puis relancer la fin de cette migration (bloc `do $$ … cron.schedule`), ou planifier `select app.purger_donnees()` chaque nuit.
3. Auth > URL : ajouter l'adresse du site et `/auth/callback` aux URL de redirection autorisées ; désactiver les inscriptions libres.
4. Créer le premier gérant (Auth > Users) avec, dans « app metadata » : `{"role": "gerant"}`. Les autres comptes s'inviteront depuis Paramètres (étape 6).
5. Ne pas charger `seed.sql` en production (comptes de démo).

## Comptes de démonstration

Mot de passe commun : `Palmeraie2026!`

| E-mail                                                                                               | Rôle                |
| ---------------------------------------------------------------------------------------------------- | ------------------- |
| gerant@palmeraie.test                                                                                | Gérant              |
| resp.restaurant@palmeraie.test, resp.minigolf@palmeraie.test, resp.aquatique@palmeraie.test          | Responsable de pôle |
| salarie.restaurant@palmeraie.test, salarie.minigolf@palmeraie.test, salarie.aquatique@palmeraie.test | Salarié             |

## Contrôles

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`supabase/tests/rls_smoke.sql` rejoue les droits de chaque rôle directement en SQL (à lancer sur une base préparée avec `supabase db reset`).

## Régénérer les types de la base

Après chaque nouvelle migration : `supabase gen types typescript --local > src/types/database.ts`.

## Ce que fait l'étape 1

- Connexion e-mail + mot de passe, mot de passe oublié, réinitialisation par e-mail. Pas d'inscription libre. Les comptes désactivés sont refusés.
- Session gérée côté serveur (`src/proxy.ts`) ; redirection vers la page demandée après connexion.
- Menu selon le rôle : gérant (tout), responsable (stocks, commandes, fournisseurs), salarié (stocks). Filtre de pôle pour le gérant. Mode clair par défaut, sombre en option, barre de navigation en bas sur téléphone.
- Les modules suivants affichent un écran « arrive bientôt » jusqu'à leur étape.

## Comment tester l'étape 1

1. `supabase db reset` puis `npm run dev`.
2. Se connecter avec `gerant@palmeraie.test` : arrivée sur le tableau de bord, 6 entrées de menu, filtre de pôle en haut.
3. Se connecter avec `resp.restaurant@palmeraie.test` : arrivée sur Stocks, ni « Appels IA » ni « Paramètres ». Ouvrir `/appels` renvoie vers « Accès refusé ».
4. Se connecter avec un salarié sur téléphone : seule l'entrée « Stocks » existe dans la barre du bas.
5. « Mot de passe oublié » : le lien arrive dans Inbucket et mène à « Nouveau mot de passe ».

## Ce que fait l'étape 2 (Stocks)

- **Catalogue** : recherche, filtres (niveau d'alerte, catégorie, lieu, fournisseur, archivés), tri, pagination serveur, sélection multiple (export, commande, archivage avec « Annuler »). Cartes à gros boutons sur téléphone.
- **Mouvements** : entrée, sortie, perte, correction, depuis le tableau ou la fiche produit ; annulation d'une saisie récente par le bouton « Annuler » du message de confirmation ; historique filtrable, export CSV.
- **Fiche produit** : stock, seuil, valeur, prix d'achat, lots à DLC, courbe d'évolution du prix, historique.
- **Alertes** : rouge (sous le seuil), orange (proche), DLC à surveiller ; « Commander tous les produits en alerte » prépare des brouillons de commande.
- **Inventaires** : comptage à l'aveugle sur téléphone (enregistrement à chaque saisie), soumission, validation par le responsable ou le gérant, écarts transformés en corrections.
- **Import / export CSV** : format Excel français (`;`, virgule décimale), modèle à télécharger, contrôle ligne par ligne avant import.

## Comment tester l'étape 2

1. `supabase db reset` (applique la migration `soumettre_inventaire` et recharge les données de démo), puis `npm run dev`.
2. **Responsable** (`resp.restaurant@palmeraie.test`) sur ordinateur, page Stocks :
   - créer un produit avec « Nouveau produit » (bouton « Enregistrer et ajouter un autre » pour en saisir plusieurs) ; un nom déjà pris est refusé ;
   - « Entrée » sur ce produit : livraison de 10 unités, le stock du tableau passe à 10 en une saisie ;
   - « Sortie » supérieure au stock : refusée avec un message clair ; sortie valide puis « Annuler » dans le message : le stock revient ;
   - filtre « Sous le seuil » puis « Commander tous les produits en alerte » ; sélectionner deux lignes puis « Exporter » (CSV ouvrable dans Excel) et « Archiver » (annulable).
3. **Salarié** (`salarie.restaurant@palmeraie.test`) sur téléphone (ou fenêtre étroite) :
   - cartes avec « + Entrée » et « + Sortie » ; pas de « Nouveau produit », pas de « Correction », pas d'onglet « Import / export » ;
   - Inventaires : ouvrir l'inventaire en cours, saisir les quantités (aucun stock théorique affiché), « Soumettre à validation ».
4. **Gérant** (`gerant@palmeraie.test`) : filtre de pôle en haut ; Inventaires : ouvrir l'inventaire soumis, voir les écarts, « Valider et corriger le stock » ; Import / export : télécharger le modèle, ajouter une ligne fausse (prix « abc ») : elle est signalée sans bloquer les autres.
5. Vérifier qu'un salarié du restaurant ne voit aucun produit des autres pôles (l'adresse d'une fiche d'un autre pôle renvoie « introuvable »).

## Ce que fait l'étape 3 (Fournisseurs et commandes)

- **Fournisseurs** : liste (recherche, mode de commande, désactivés), fiche avec contact, jours de commande et de livraison, minimum de commande, produits associés (référence, prix HT, conditionnement), statistiques (commandes passées, délai réel moyen, taux de livraisons conformes, montant total), évolution des prix et dernières commandes. Un fournisseur désactivé n'est plus proposé mais son historique reste.
- **Commandes** : liste filtrable par statut, fournisseur et dates ; création d'un brouillon, ajout de produits d'un clic (quantité conseillée arrondie au conditionnement, prix du fournisseur), quantités et prix modifiables sur place, alerte si le minimum de commande n'est pas atteint, duplication, annulation avec motif, historique de la commande.
- **Circuit de validation** : le responsable prépare puis « Soumet au gérant » ; **seul le gérant** fait « Valider et envoyer » (un clic). L'application transmet la commande à n8n, signée ; si n8n est éteint ou répond en erreur, la commande reste « À valider », l'erreur est affichée et l'on peut réessayer.
- **Réception** : « Recevoir la livraison » ouvre un pointage pré-rempli « comme commandé » ; on ne corrige que les écarts (motif obligatoire), le prix facturé, la DLC des produits suivis. « Enregistrer sans valider » permet de reprendre plus tard. La validation crée les entrées de stock, met à jour le dernier prix d'achat et passe la commande à « Livrée » ; « Clôturer » la range.
- **« Commander tous les produits en alerte »** (page Stocks) crée un brouillon par fournisseur pour les produits sous le seuil, sans reprendre ceux qui sont déjà dans un brouillon ou une commande en cours.
- **n8n** : envoi signé de la commande, et route `POST /api/webhooks/n8n/orders` pour créer un brouillon ou changer un statut (jeton + signature + horodatage + idempotence). Contrat complet : [docs/n8n.md](docs/n8n.md).

## Comment tester l'étape 3

1. `supabase db reset`, puis renseigner dans `.env.local` : `SUPABASE_SERVICE_ROLE_KEY`, `N8N_WEBHOOK_ORDER_SEND=http://localhost:5678/webhook/order-send`, `N8N_OUTBOUND_SECRET`, `N8N_INBOUND_TOKEN`, `N8N_INBOUND_SECRET` (des chaînes au hasard suffisent en local).
2. Dans un terminal : `N8N_OUTBOUND_SECRET=<la même valeur> node scripts/faux-n8n.mjs` (il affiche chaque commande reçue). Puis `npm run dev`.
3. **Responsable** (`resp.restaurant@palmeraie.test`), sur ordinateur :
   - Fournisseurs > « Nouveau fournisseur » (mode e-mail : l'adresse est obligatoire), puis « Associer un produit » (prix, conditionnement) ;
   - « Nouvelle commande » depuis la fiche, « Ajouter des produits », modifier une quantité (enregistrée en quittant le champ), « Soumettre au gérant » ; il n'a pas de bouton « Valider et envoyer » ;
   - page Stocks > « Commander tous les produits en alerte » puis « Voir les brouillons ».
4. **Gérant** (`gerant@palmeraie.test`) : ouvrir la commande « À valider », « Valider et envoyer » : la commande passe à « Envoyée » et le faux n8n affiche les lignes. Arrêter le faux n8n (ou le relancer avec `--echec`) et recommencer sur une autre commande : elle reste « À valider » avec un message d'erreur, puis repart une fois n8n rétabli. Tester « Annuler la commande » (motif obligatoire) et « Dupliquer ».
5. **Réception** (critère « moins d'une minute ») : en responsable, sur une commande envoyée, « Recevoir la livraison » ; changer une quantité (le motif de l'écart est demandé), renseigner la DLC d'un produit frais, « Valider la livraison » : le stock du produit est à jour et la commande « Livrée ».
6. **n8n vers l'application** : `N8N_INBOUND_TOKEN=… N8N_INBOUND_SECRET=… APP_URL=http://localhost:3000 node scripts/appel-n8n.mjs '{"evenement":"status.update","reference":"CMD-000082","statut":"confirmee"}'` ; rejouer avec la même clé d'idempotence (2e argument) : réponse « doublon » ; un jeton faux donne 401 (autres exemples dans [docs/n8n.md](docs/n8n.md)).
7. **Droits** : un salarié n'a ni « Commandes » ni « Fournisseurs » ; un responsable ne voit que les commandes de son pôle.

## Ce que fait l'étape 4 (Journal des appels IA)

- **Journal** (gérant seulement) : date et heure, numéro masqué, durée, pôle, résumé, issue ; onglets par issue avec compteurs, recherche (résumé, transcription, numéro), filtre par jour, filtre de pôle en haut, pagination. Se met à jour tout seul quand un nouvel appel arrive (Supabase Realtime).
- **Détail** : résumé, transcription en « Client / Standard IA », informations techniques, autres appels du même numéro.
- **Statistiques** : appels par jour, par heure, par pôle et par issue, durée moyenne, taux de transfert, sur 7, 30 ou 90 jours ou des dates libres.
- **Entrée n8n** : `POST /api/webhooks/n8n/calls` (jeton + signature + horodatage + idempotence). Le numéro de téléphone n'est jamais enregistré en clair. Contrat : [docs/n8n.md](docs/n8n.md).
- **Purge** : les appels de plus de 90 jours sont supprimés chaque nuit (réglable à l'étape 6).

## Comment tester l'étape 4

1. `supabase db reset` (nouvelle migration), renseigner dans `.env.local` `N8N_INBOUND_TOKEN`, `N8N_INBOUND_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` et `PHONE_HASH_SECRET` (des chaînes au hasard suffisent), puis `npm run dev`.
2. **Envoyer un appel de test** : `npm run appel-test` (réponse `200` avec l'appel et son numéro masqué). Le relancer avec la même clé d'idempotence, ou avec un jeton faux, montre la réponse « doublon » ou `401` ; la version `curl` est dans [docs/n8n.md](docs/n8n.md).
3. **Gérant** (`gerant@palmeraie.test`) : menu « Appels IA » ; l'appel de test est en tête de la liste, numéro masqué (`06 •• •• •• 78`). Essayer les onglets d'issue, la recherche, une date, le filtre de pôle ; ouvrir un appel puis un autre appel du même numéro ; onglet « Statistiques » : 7 / 30 / 90 jours, changer de pôle.
4. **Droits** : avec `resp.restaurant@palmeraie.test` ou `salarie.restaurant@palmeraie.test`, le menu n'a pas « Appels IA » et l'adresse `/appels` renvoie « Accès refusé ».
5. **Purge** : dans l'éditeur SQL, `select app.purger_donnees();` supprime les appels de plus de 90 jours.

## Ce que fait l'étape 5 (Tableau de bord)

- **Gérant** : six cartes cliquables (produits sous le seuil, commandes à valider, livraisons attendues aujourd'hui, commandes en retard, DLC à surveiller, appels du jour), la liste « À faire aujourd'hui », les commandes à valider avec un bouton **« Valider et envoyer »** sur chaque ligne (un seul clic), les livraisons du jour, les produits sous le seuil, les derniers appels, la courbe de la valeur du stock sur 30 jours et le top 10 des produits consommés. Filtre de pôle en haut.
- **Responsable** : la même page limitée à son pôle (ses commandes attendent le gérant, avec la mention « En attente du gérant » ; pas d'appels).
- Les chiffres se mettent à jour tout seuls (Supabase Realtime) : une commande soumise ou un appel reçu apparaît sans recharger la page.
- Le responsable arrive maintenant sur le tableau de bord après connexion ; le salarié reste sur les Stocks.

## Comment tester l'étape 5

1. `supabase db reset` (nouvelle migration `20260930000100`), puis lancer le faux n8n (`node scripts/faux-n8n.mjs`, voir étape 3) et `npm run dev`.
2. **Gérant** (`gerant@palmeraie.test`) : après connexion, vous arrivez sur le tableau de bord. Cliquer chaque carte : elle ouvre la liste correspondante déjà filtrée. Choisir un pôle en haut : tous les chiffres et les liens suivent.
3. **Critère 2 (valider en un clic)** : dans « Commandes à valider », cliquer une seule fois sur « Valider et envoyer » : la commande disparaît de la liste, passe à « Envoyée » et le faux n8n l'affiche. Arrêter le faux n8n et recommencer sur une autre : message d'erreur, la commande reste à valider ; relancer n8n et recliquer.
4. **Responsable** (`resp.restaurant@palmeraie.test`) : le tableau de bord ne montre que le Restaurant, sans bouton « Valider et envoyer ».
5. **Temps réel** : garder le tableau de bord du gérant ouvert, envoyer un appel avec `npm run appel-test` : la carte « Appels aujourd'hui » et « Derniers appels » se mettent à jour d'eux-mêmes ; de même quand un responsable soumet une commande.
6. **Salarié** : pas de « Tableau de bord » dans le menu, l'adresse `/tableau-de-bord` renvoie « Accès refusé ».
