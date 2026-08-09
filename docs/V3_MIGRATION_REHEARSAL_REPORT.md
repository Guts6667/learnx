# Rapport de répétition de migration V3

- Ticket : V3-032
- Statut : validation sur clone Neon requise avant V3-033
- Cible autorisée : branche Neon éphémère issue de Production
- Production : lecture et écriture interdites dans ce ticket

## Objectif et méthode

La répétition combine deux preuves complémentaires :

1. le clone Production est photographié avant `prisma migrate deploy`, puis les
   mêmes tables et colonnes sont recomptées et hachées après migration ;
2. l'historique Prisma complet est rejoué depuis zéro dans un schéma jetable du
   même clone, puis son registre `_prisma_migrations` est comparé aux fichiers
   versionnés.

Le snapshot ne contient ni valeur de colonne, ni e-mail, ni identifiant, ni
token. Pour chaque table, il conserve seulement les noms des colonnes déjà
présentes, un nombre de lignes et un condensat PostgreSQL. Les colonnes ajoutées
par une migration ne peuvent donc pas masquer la préservation des données
antérieures.

Le script refuse toute écriture si les marqueurs
`LEARNX_INTEGRATION_DATABASE=ephemeral`, `NEON_BRANCH_ID` et
`LEARNX_INTEGRATION_RUN_ID` sont absents. Le schéma de replay doit commencer par
`ci_migration_replay_` et il est supprimé dans un bloc `finally`.

## Matrice multi-utilisateur

La validation réelle couvre :

- une demande d'accès concurrente et non énumérante ;
- un administrateur propriétaire ;
- un compte Créateur sans capacité `/admin` ;
- deux apprenants inscrits au même programme publié ;
- l'accès commun au contenu et l'isolation des notes, tentatives et progression ;
- la suspension d'un apprenant, la révocation de sa session, le refus de login,
  la réactivation sans restauration de session et la conservation de son
  enrollment ;
- l'idempotence des revues, invitations, publications et seeds ciblés ;
- Chromium desktop, Chromium mobile et WebKit mobile ;
- axe WCAG A/AA sur le programme, la leçon et son sommaire.

## Critères d'arrêt

La promotion est bloquée si l'un des événements suivants survient :

- disparition d'une table antérieure, variation d'un décompte ou d'un checksum ;
- migration appliquée absente, incomplète, annulée ou dont le checksum diverge ;
- échec du replay complet depuis zéro ;
- accès d'un utilisateur aux notes, tentatives ou progressions d'un autre ;
- capacité administrative accordée à USER ou CREATOR ;
- session encore valide après suspension ;
- violation axe sérieuse/critique ou échec Chromium/WebKit/mobile ;
- concurrence créant plusieurs demandes, invitations ou audits supposés uniques.

## Sauvegarde, promotion et rollback Production

Avant V3-033 :

1. figer le SHA applicatif et relever la branche/heure Production ;
2. créer une branche Neon de sauvegarde au point pré-déploiement et vérifier une
   connexion en lecture ainsi que les décomptes critiques ;
3. conserver les artefacts `migration-before.json` et `migration-after.json` du
   run vert ;
4. déployer les migrations avant le nouveau code seulement si elles restent
   rétrocompatibles, puis effectuer les smoke tests authentifiés ;
5. surveiller erreurs, latence, sessions et audit pendant la fenêtre convenue.

Après activation des écritures V3, le roll-forward est prioritaire. Un simple
retour à un ancien binaire peut ignorer statuts, rôles, enrollments ou versions.
Si le roll-forward échoue, fermer les écritures, restaurer ensemble la branche
Neon pré-déploiement et le SHA compatible, puis vérifier comptes, sessions,
programmes et données personnelles avant réouverture. Les écritures postérieures
au point restauré seraient perdues et nécessitent une décision explicite.

## Résultats

Validation effectuée sur le commit `51d1c9b` par le workflow Integration
[#86](https://github.com/Guts6667/learnx/actions/runs/31336025921) :

- branche Neon éphémère `ci-31336025921-1`, supprimée avec succès en fin de
  job ;
- 44 tables du clone Production préservées, avec décomptes et condensats
  identiques sur leurs colonnes antérieures ;
- 28 migrations Prisma vérifiées puis rejouées intégralement dans le schéma
  jetable `ci_migration_replay_31336025921_1` ;
- mesure des lectures bornées réussie ;
- 8 scénarios d'intégration réels réussis en 5,1 minutes : cycle d'accès,
  vérification e-mail, revue admin, suspension multi-session, isolation
  multi-utilisateur et UI sur Chromium desktop/mobile et WebKit mobile ; les
  10 entrées ignorées correspondent aux scénarios backend volontairement
  limités à Chromium desktop ;
- contrôles axe WCAG A/AA réussis sur les vues Programme, Leçon et Sommaire ;
- seed Platform APM exécuté deux fois sans divergence, signature
  `1|2|5|6|19|12|6|6|30|2|0|0|0` ;
- seed du pilote anglais exécuté deux fois sans divergence, signature
  `draft|private|2|2|6|30|22|5|13|18|90|2|0|0|0` ;
- artefacts publiés : répétition migration, performance base et rapport
  Playwright, conservés 90 jours par GitHub Actions.

Matrice locale finale du même périmètre : lint, typecheck et build réussis ;
99 fichiers de tests et 536 tests réussis ; 40 tests E2E réussis. Aucune
écriture n'a été effectuée sur Production.
