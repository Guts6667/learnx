# Reprise correction IA — preuves locales du 17 septembre 2026

Tickets : V4.5-210-R1 à R5. Branche : `codex/ai-correction-recovery`.
Base consolidée : `e874f943cb3d75469547571d0fbadff236f7eaa4`.
Cette preuve décrit une implémentation et ses contrôles logiciels. Elle ne
qualifie aucun modèle, n'autorise aucune dépense et n'ouvre aucun pilote.

## Résultat et périmètre

- R1 : état daté, backlog, handoff et manifeste réconciliés ; historique de
  recherche conservé ; titre/périmètre de PR #213 et record Airtable V4.5-210
  relus après mise à jour. Les PR historiques ne sont ni fusionnées ni fermées.
- R2 : sélection FAKE primaire/checker commune ; confiance et projection
  apprenant cohérentes ; coûts et request IDs conservés malgré parsing invalide ;
  alertes du breaker ; arrêt avant chaque dispatch ; replay propriétaire avec
  prix d'origine malgré expiration/arrêt des nouveaux appels.
- R3 : politique V7 complète et versionnée, probe de discrimination séparé de
  HIGH, stabilité spécifique aux mutations, cache lié à l'identité réelle,
  protection budgétaire durable, fumée de schéma et état UNMEASURED.
- R4 : rubrique Writing proposée, import de 30 sources/60 mutations, revue et
  retest aveugles, verrou des références, deux bras de mesure et rapport
  séparant vérification, extraction et restitution. Appels réels non exécutés.
- R5 : **BLOQUÉ**. Aucune mesure sur un holdout propriétaire verrouillé, aucune
  qualification ni recette authentifiée d'une cible déployée.

## Vérifications acquises

| Vérification | Résultat | Portée |
| --- | --- | --- |
| Suite complète avec couverture, code `3ed809be6c5dd6c9b375763e2e0d41a5cbe7520b` | 2 466 tests / 307 fichiers, tous verts | Hors ligne ; nouveaux guards, runtime, import et calculs |
| Couverture critique | Auth 90,02 %, correction/crédits 91,63 %, progression 92,31 %, admin 91,17 % | Seuil 90 % inchangé ; découverte des nouveaux fichiers financiers corrigée |
| Browser E2E sur bundle de production au même SHA | 97 réussis, 27 skips conditionnels préexistants, aucun échec ; quatre projets | Chromium desktop/mobile/tablet et WebKit mobile ; API mockées, aucune production |
| Préflight du probe, `--false-agree-probe --qualification-run-id=recovery-qualification-001 --dry-run` | Vert, zéro appel ; réservation maximale calculée 0,160348 USD | Calcul gratuit, aucune autorisation de dépense |
| Politique V7 synthétique | Fixture correcte : les 22 gates passent ; défauts injectés refusés | Preuve de fonctionnement de l'instrument uniquement |
| Artefacts historiques | Aucun fichier existant de `benchmarks/` modifié depuis la base consolidée | Deux artefacts finaux de PR #212 et une nouvelle politique ajoutés |

La chaîne finale `pnpm quality:v4.1:final` est requise avant chaque push ; son
résultat et le SHA exact seront enregistrés dans la PR de reprise. Elle inclut
format, lint, types/imports, tests/couverture, fichiers critiques, code/CSS mort,
build, bundle et audit des dépendances. Aucun seuil n'est abaissé.

Les revues croisées d'agents ont notamment fait corriger : replay avec prix
gelé, profils checker réellement exécutés, appel verifier fourni même si le
primaire est invalide, réconciliation avant acceptation d'une observation,
schéma wire strict et provenance distincte de chaque répétition. Elles ne
constituent pas une revue humaine indépendante.

## Branchement des nouvelles surfaces

| Surface exportée | Appelant et frontière |
| --- | --- |
| `selectCorrectionTransport`, `resolveCorrectionTransportMode` | Composition API corrections ; un seul choix primaire/checker |
| `authorizeCorrectionAttempt` | Exécution primaire/retry et checker avant réseau |
| `projectLearnerCorrection` | API résultat, normalisation/replay et historique Prisma |
| `sharedResearchStateDirectory`, `acquireAtomRunLock`, `openAtomBudget`, `atomCallReservationUsd` | Runners atomique, probe, pool et Writing ; recherche seulement |
| `applyResearchPriceCeilings`, `createGuardedResearchFetch` | Probe, pool, runner Writing ; tous les dispatchs des entrées récupérées |
| `readResearchProviderUsage`, `withGuardedResearchRun` | CLI benchmark `--run-pool` ; état partagé jusqu'à réconciliation finale |
| `computeQualificationMetrics` | Runner et analyse offline de régression |
| `qualificationSha256`, `designedCheckerIdentity`, `validateDesignedProbeEvidence`, `readDesignedProbeEvidence`, `runDesignedCheckerProbe` | Préflight, exécution et import du probe V7 |
| Constantes, rendu et parseur `ai-correction-atom-verifier-protocol`, `summariseSourceClusters` | Rapport et runner atomiques ; protocole de recherche historique conservé |
| `ATOM_REQUEST_PROFILE`, `atomRequestBody`, `callAtomModel`, `readAtomProviderUsage`, `executeAtomMeasurement` | Runner atomique ; mesure Writing réutilise uniquement la lecture de coût fournisseur |
| `RECOVERY_RUBRIC`, schémas `recovery*Schema`, `validateRecoveryPack` | Import, référence, runner et évaluation Writing ; aucun import runtime apprenant |
| `prepareRecoveryPack`, `createBlankRecoveryReference`, `recoveryBlindReview` | CLI `ai:recovery prepare` |
| `recoveryHash`, `validateRecoveryReference`, `createRecoveryLock`, `evaluateRecoveryPilot` | CLI `lock`/`evaluate` et préflight mesure |
| `buildRecoveryVerificationInput`, `recoveryVerifiedLevels`, `deliverRecoveryCorrection` | Runner et évaluateur Writing ; sortie expérimentale uniquement |
| `runRecoveryCorrection` | Harnais prototype testé, volontairement absent du runtime apprenant |
| `prepareRecoveryExecution`, `buildRecoveryResearchRequest`, `parseRecoveryResearchPayload`, `executeRecoveryMeasurement` | CLI `ai:recovery:measure`, gratuit par défaut ; exécution payante explicitement bornée |

Les types exportés décrivent les mêmes frontières. Le contrôle Knip vérifie les
exports ; aucun choix de modèle ni branchement Writing en production ne découle
de leur présence.

## Limites et recette restante

1. Rayan doit approuver la rubrique et fournir/revoir les 30 sources fraîches,
   leurs dossiers, 60 mutations, niveaux absolus et le retest de dix sources.
   Les désaccords restent incertains et dans le dénominateur. Des données
   synthétiques ne peuvent pas remplacer cette preuve propriétaire.
2. Avant mesure réelle : décision de budget explicite, tarifs documentés,
   enveloppe et ledger réconciliés ; 0,62 USD du récit historique restent non
   réconciliés. Le ledger nouveau ne certifie pas l'ancienne campagne.
3. Le benchmark générique multi-modèles hors `--run-pool` reste une entrée
   historique hors de la nouvelle garantie financière ; il n'est pas l'entrée
   de reprise. L'ancien `--measure-checker` est retiré.
4. La suite d'intégration DB existante ne teste pas de correction IA de bout en
   bout. Avant ouverture, une cible isolée doit prouver correction authentifiée,
   interruption après dispatch, réconciliation et replay sur Prisma réel. Les
   tests locaux de ports/repository mockés ne remplacent pas cette recette.
5. Vérifier SHA réellement déployé, flags effectifs, limite de durée de fonction,
   monitoring/alertes et rollback. Le GET public de santé a échoué par résolution
   DNS depuis cette session ; aucune panne de production n'en est déduite.
6. Après mesure : zéro niveau incorrect affiché, au moins 70 % utilisables et
   tous les gates de sécurité applicables. Le rapport numérique garde
   `SAFETY_AND_RELEASE_REVIEW_REQUIRED`, même en cas de réussite. GO Rayan requis.

Aucune migration, aucun reset/seed, aucun appel de correction payant, aucune
modification de données ou de flags de production et aucun déploiement n'ont
été effectués. Le workspace historique et ses fichiers utilisateur sont intacts.

## Revue et retour arrière

La revue Git porte sur la branche consolidée ; les commits séparent conservation
des recherches, corrections runtime, instruments et protocole Writing. Revenir
à la base consolidée par un revert revu de ces commits, sans supprimer les
artefacts historiques. Une promotion future suit le runbook de restauration et
son SHA de rollback ; ce lot n'a aucune migration à inverser. Prochaine autorité :
QA/Release pour les checks/recette, puis Rayan pour références, budget et pilote.
