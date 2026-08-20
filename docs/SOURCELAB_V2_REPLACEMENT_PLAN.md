# Remplacement SourceLab V1 → V2

## Statut

- Mode : `HARD_OFF`
- Portée : `TECH_VALIDATION`
- Écriture en base : impossible dans l’état actuel
- Programme historique : `ingenieur-logiciel-production-sourcelab`
- Nouveau programme : `sourcelab-docker-api-socle-ingestion`

Le programme V2 est une nouvelle identité runtime. Aucun identifiant de
programme, d’étape, de module, de leçon ou de progression V1 n’est réutilisé
pour lui attribuer une équivalence.

## Pourquoi l’exécution reste désactivée

LearnX sait dépublier un programme sans supprimer les progressions et conserve
des snapshots `ProgramVersion`, mais ne possède pas encore d’opération
d’archivage transactionnelle avec reçu de rollback. Les inscriptions sont liées
à un programme et à une version, tandis que le runtime pédagogique lit encore
la hiérarchie relationnelle courante.

Activer une bascule automatique dans ce ticket créerait donc une autorité de
mutation nouvelle et insuffisamment auditée. Le planificateur livré est
strictement read-only : aucun argument `--apply` n’existe.

## Dry-run obligatoire

```bash
pnpm sourcelab:replacement:plan --dry-run --owner-email=<adresse-admin>
```

La commande lit les deux programmes, calcule un `planId`, inventorie les lignes
historiques à préserver et retourne des blockers. Elle termine avec le code 2
si un blocker reste ouvert.

## Gates avant une future bascule

1. V1 et V2 existent avec deux UUID distincts.
2. Leurs slugs et clés canoniques correspondent exactement au contrat.
3. V2 comporte exactement 3 étapes, 3 modules, 7 leçons et 7 notions
   obligatoires.
4. Chaque étape possède une évaluation finale obligatoire.
5. Chaque notion obligatoire possède une évaluation obligatoire.
6. Toutes les étapes, modules et leçons V2 sont publiés.
7. V2 est `ACTIVE`, encore `PRIVATE` et possède un `publishedVersionId` créé par
   le workflow officiel.
8. Les compteurs historiques V1 sont consignés avant toute mutation.

## Actions futures autorisées par le plan

Une implémentation ultérieure, séparée et auditée, pourra uniquement :

1. passer V1 à `ARCHIVED` et `PRIVATE` ;
2. passer ses inscriptions `ACTIVE` à `WITHDRAWN` sans supprimer aucune ligne ;
3. rendre V2 `PUBLIC` sans modifier son contenu ni sa version publiée.

Aucune progression ou inscription n’est transférée vers V2. L’inscription à V2
est une action explicite et commence à zéro.

## Préservation vérifiée par le dry-run

Le plan consigne les volumes V1 suivants :

- progressions programme, étape, leçon et notion ;
- runs de module ;
- tentatives de quiz et de mini-évaluation ;
- soumissions d’exercice et d’évaluation finale ;
- complétions de tâches.

La future opération ne pourra contenir que des `UPDATE`. Toute suppression ou
variation de ces compteurs doit bloquer la clôture.

## Rollback contractuel

Un rollback ne sera autorisé que si aucune inscription ni progression V2 n’a
été créée depuis la bascule. Il devra :

1. rendre V2 privée sans supprimer sa version ;
2. restaurer le statut et la visibilité V1 consignés dans un reçu persistant ;
3. réactiver uniquement les inscriptions V1 retirées par cette bascule ;
4. prouver que les identifiants et compteurs historiques V1 sont inchangés.

Le plan décrit ces actions mais ne les exécute pas. L’activation attend donc un
ticket technique distinct avec reçu de bascule, audit, concurrence optimiste et
test sur une copie de la base.
