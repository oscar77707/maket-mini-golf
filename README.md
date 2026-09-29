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
2. Activer l'extension `pg_cron` (Database > Extensions) **avant** la migration si vous voulez la purge automatique des appels ; sinon planifier `select app.purger_donnees()` chaque nuit.
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
