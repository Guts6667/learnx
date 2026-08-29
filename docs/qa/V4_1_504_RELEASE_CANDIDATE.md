# V4.1-504 — candidat de release, recette et publication

## État

**RELEASED** le 29 août 2026 sur GO explicite de Rayan.

- SHA publié : `63c436d9` ;
- `main` avancé de `a02ecc3f307af36656fa5cb8a7b62954fdec73e9` à `63c436d9`
  en avance rapide, sans réécriture d'historique ;
- baseline de rollback V4 : `a02ecc3f307af36656fa5cb8a7b62954fdec73e9` ;
- production : `https://learn-x.app`.

Le candidat précédemment consigné (`d7b1949e`) était périmé de dix commits, dont
quatre correctifs fonctionnels de progression et de navigation d'évaluation. Ses
preuves ne décrivaient plus un build existant et ont été remplacées.

## Preuves automatiques au SHA publié

Exécution distante `Quality`, job bloquant `V4.1 final (required)`, run
`33226595192` : succès. Exécution distante `Integration`, job `real-functions`,
run `33226595197` : succès.

- 215 fichiers / 1 374 tests Vitest verts ;
- couverture globale : 88,99 % statements, 80,48 % branches, 90,23 % functions,
  90,19 % lines ;
- domaines critiques : auth 90,59 %, correction/pricing/crédits 90,30 %,
  progression/évaluations 92,26 %, autorisation admin 93,22 % ;
- initial JS 111 704/125 000 octets gzip ; initial CSS 19 001/25 000 ;
  plus gros chunk paresseux 12 206/13 460 ;
- précache PWA 135/140 entrées, 1 300 864/1 371 224 octets ;
- 0 import Preact, cycle, code mort ou vulnérabilité de production haute.

## Analyse de rollback

**V4.1 n'introduit aucune modification de base de données.** Les jeux de
migrations de `a02ecc3f` et `63c436d9` sont identiques : 43 répertoires de
chaque côté, `20260826120000_add_correction_reconsideration` inclus déjà dans la
baseline V4. L'intégralité du diff `prisma/` est le découpage multi-file de
V4.1-403, qui ne produit aucun SQL.

Conséquences : le rollback est purement applicatif, `prisma migrate deploy` y est
sans effet, et aucune forme de donnée ne peut être incompatible. La cible de
rollback était le déploiement qui servait la production au moment du GO, vérifié
sain sur `/`, `/login`, `/manifest.webmanifest` et `/sw.js`.

## Recette exécutée

- [x] `Quality` et `Integration` verts au SHA publié.
- [x] Analyse de compatibilité de rollback : aucune migration entre V4 et V4.1.
- [x] Cible de rollback vérifiée vivante et saine avant publication.
- [x] Mise à jour PWA sur appareil réel : l'instance installée depuis la preview
      `dev` a chargé le nouveau shell et affiché `/today` après relance, sans
      shell obsolète ni page blanche.
- [x] Revue visuelle du propriétaire sur la preview `dev`.
- [x] Smoke public de production après publication : `/`, `/login`,
      `/request-access`, `/research/ai-correction`,
      `/research/ai-correction/en.html`, `/manifest.webmanifest`, `/sw.js` et
      `/interest` répondent `200` ; `/api/auth/session` conserve
      `cache-control: private, no-store`.
- [x] Protection de `main` : `V4.1 final (required)`, administrateurs inclus,
      résolution des conversations, ni force-push ni suppression.

## Recette non exécutée, acceptée par le propriétaire

Ces cases n'ont pas été prouvées. Elles ne sont pas présentées comme des
succès ; le propriétaire a publié en connaissance de cause.

- [ ] Demande d'accès, activation, connexion et déconnexion bout en bout sur un
      déploiement.
- [ ] Refus d'accès utilisateur et permissions administrateur.
- [ ] Aujourd'hui → programme → étape → module → leçon sur un déploiement.
- [ ] Notes, révisions et progression sur un déploiement.
- [ ] Exercice textuel : devis, confirmation, correction complète et partielle.
- [ ] Historique, contestation et comparaison des corrections.
- [ ] Réservation, règlement, libération et coût inconnu fail-close.
- [ ] Crédits utilisateur et administration.
- [ ] Clavier, zoom 200 % et lecteur d'écran natif.
- [ ] Basculement Vercel réel vers `a02ecc3f…` suivi d'une restauration.

Le risque résiduel principal porte sur le parcours authentifié de correction et
de crédits, jamais parcouru sur un déploiement. Il reste couvert par des tests
unitaires et d'intégration, et le pilote IA demeure fermé par défaut :
`LEARNX_AI_ENABLED=false` et `LEARNX_AI_KILL_SWITCH=true` doivent être ouverts
explicitement par environnement.

## Exception de publication

`main` exige un historique linéaire. `dev` contenait quatre commits de fusion
issus des sous-lots de V4.1-401 : `1f59fcab`, `8acf42f2`, `e493d5da` et
`a1f39944`. Les deux branches avaient donc des politiques incompatibles, ce qui
aurait bloqué toute release V4.1.

Un rebase ou un squash aurait réécrit les 165 commits et rendu pendantes toutes
les références de SHA citées comme preuves de revue dans `V4_1_BACKLOG.md` et
`docs/qa/`. Sur décision du propriétaire, `required_linear_history` a été
désactivé le temps de l'avance rapide puis rétabli ; la configuration de
protection a été comparée avant et après et est identique. Aucun autre réglage
n'a été modifié.

Cette incompatibilité de politique reste ouverte : la prochaine release
rencontrera le même blocage tant que `main` exige un historique linéaire alors
que `dev` intègre ses lots par fusion.

## Rollback

Redéployer `a02ecc3f…` via Vercel Instant Rollback. Aucune migration à annuler,
aucune donnée à restaurer.
