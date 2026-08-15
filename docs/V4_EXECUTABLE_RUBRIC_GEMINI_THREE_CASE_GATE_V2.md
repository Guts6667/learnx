# V4-009C — Préparation du gate Gemini trois cas v2

- **Statut** : `OFFLINE_READY / PRODUCT_APPROVED / FINANCE_NOT_ARBITRATED / OWNER_NOT_GRANTED`
- **Date** : 15 août 2026
- **Portée** : fixture synthétique et manifeste hors ligne uniquement
- **Appels modèle** : aucun

## Pourquoi une identité v2

Le gate v1 reste figé avec le verdict
`FAILED_INCONCLUSIVE_ORACLE_BOUNDARY`. Son cas négatif écartait implicitement
une option et permettait donc de lire un choix, même sans recommandation
explicite. Ce résultat n'est ni effacé ni requalifié comme faute de Gemini.

La v2 utilise un nouveau corpus et une nouvelle campagne. Elle ne réutilise
aucune cellule historique :

- corpus : `writing-fr-semantic-three-case-development-v2` ;
- campagne : `learnx-writing-fr-gemini-evidence-researcher-three-case-v2` ;
- SHA-256 corpus :
  `6287785daa0396af14ce4358d1ce2cdfb57742b7912cdba2c4b18e8345366f03` ;
- SHA-256 campagne :
  `cafcf98a8d8961f658985cea58db42d9fe87303a5f96f96e30ecd1e1e3986652`.

## Fixture négative

`writing-fr-no-choice-negative` indique explicitement qu'aucune des deux
dépenses n'est choisie et qu'aucune recommandation n'est formulée. Elle ne
préfère ni n'élimine implicitement une option. Les deux faits du dossier restent
exacts et indépendants de la décision :

- `decision-position=insufficient` ;
- `evidence-fidelity=mastered` ;
- `reasoning-link=insufficient` ;
- score indicatif serveur : `40` ;
- état : `REVISION_REQUIRED`.

Produit/pédagogie a approuvé indépendamment cette lecture et l'indépendance des
critères. Cette approbation concerne le pseudo-oracle synthétique, pas la
qualité d'un modèle.

## Enveloppe encore fermée

Le manifeste conserve la même identité technique Gemini 1.3, mais reste
`DRAFT_BLOCKED` et `networkCallsAllowed=false`. Il préenregistre seulement :

1. `writing-fr-base-mastered` ;
2. `writing-fr-no-choice-negative` ;
3. `writing-fr-direct-injection`.

Le validate-only confirme trois appels maximum, aucun retry ni fallback, arrêt
au premier défaut, borne pessimiste de `0,0172545 USD` par appel et `0,0517635
USD` au total sous un plafond proposé de `0,055 USD`. Ces montants ne sont pas
arbitrés pour la v2 et ne constituent aucune autorisation de dépense.

## Preuves hors ligne

- corpus et certificat serveur reconstruits ;
- ancien corpus et ancienne campagne vérifiés byte-identiques ;
- 34/34 tests ciblés verts avant la revue ;
- lint et typecheck verts après génération Prisma ;
- validate-only vert, sans réseau.

Avant tout appel, Finance doit arbitrer l'empreinte exacte et le propriétaire
doit fournir un GO séparé. Le panel 10×2, le holdout et V4-002 restent fermés.
