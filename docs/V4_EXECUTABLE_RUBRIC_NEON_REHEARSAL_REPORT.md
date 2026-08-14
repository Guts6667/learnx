# Répétition Neon — moteur de rubrique exécutable V4

## Résultat

La migration additive `20260813160000_add_provider_call_intent` est rejouable
sur un clone Neon jetable. La répétition a réussi sans écrire dans une base
partagée et la branche Neon a été supprimée automatiquement en fin de job.

Cette preuve lève uniquement le bloqueur de répétition de migration. Elle
n'autorise aucun appel de modèle, aucun budget R&D, aucun holdout et aucune
activation utilisateur.

## Identité de la preuve

- workflow : `Integration` ;
- run : [#125](https://github.com/Guts6667/learnx/actions/runs/31785569786),
  identifiant `31785569786` ;
- branche Git : `codex/v4-autonomous-docs` ;
- SHA testé : `20fb325fa9755770cd82ea170982b54df17a724d` ;
- artefact : `migration-rehearsal-31785569786` ;
- empreinte GitHub de l'artefact :
  `sha256:979bea3f943107fa8cf4b11ed197d88c61ecbbe611f230cf299f0a309d7cc1ec` ;
- portée du snapshot : `production-clone` ;
- 63 tables observées ;
- dernière migration appliquée :
  `20260813160000_add_provider_call_intent` ;
- branche Neon jetable : supprimée avec succès.

## Étapes validées

Le run a réussi toutes les étapes suivantes :

1. création d'une branche Neon isolée ;
2. snapshot du clone avant migration ;
3. application de l'historique Prisma ;
4. comparaison du clone après migration ;
5. replay intégral dans un schéma isolé ;
6. mesure des lectures bornées ;
7. tests réels Functions et navigateurs ;
8. répétition idempotente des deux seeds ciblés ;
9. archivage des rapports ;
10. suppression de la branche Neon.

Le snapshot après migration contient l'enum de dispatch utilisé par les
tentatives et enregistre la migration `CALL_INTENT` comme dernière migration
appliquée. La comparaison avant/après et le replay intégral ont tous deux
réussi.

## Gates encore fermées

La campagne `learnx-writing-fr-gemini-evidence-researcher-v1` reste
`DRAFT_BLOCKED`, avec réseau désactivé. Restent nécessaires avant tout appel :

- validation du budget expérimental par Finance et le Propriétaire ;
- autorisation explicite du Propriétaire ;
- smoke borné de l'identité et de la route épinglées ;
- résolution des incompatibilités du corpus/holdout autonome historique ;
- publication d'au moins un contrat et d'une activité éligible avant toute
  surface utilisateur ;
- clôture séparée du gate déterministe V4-011 avant toute revendication de
  maîtrise.
