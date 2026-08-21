# V4-003A-R1 — Durcissement de l'oracle mécanique

- **Statut** : `DONE_OFFLINE`
- **Date** : 21 août 2026
- **Baseline de départ** : `70e3415`
- **Paquet successeur** : oracle mécanique v2.1
- **Empreinte canonique v2.1** :
  `2c35125ea438cf1686ae88b01ecdb28bc304a3c9b9af6d45cff81f37306af3c2`
- **Appel modèle, réseau, holdout, budget ou activation** : aucun
- **Contrat pédagogique modifié** : non

## Conclusion

V4-003A-R1 ferme hors ligne les cinq findings P1 de l'audit V4-003B. Le
paquet v2.1 contient 33 cas mécaniques et 7 mutations du compilateur. Il est
prêt pour un nouvel audit indépendant V4-003B-R1 ; il n'autorise ni gel
expérimental, ni appel modèle, ni publication, ni activation.

Les relectures finales `AGENT-METHODOLOGIE` et `AGENT-PEDAGOGIE` rendent toutes
deux `APPROVED`. Le P2 concernant la comparaison d'une projection complète du
certificat reste une amélioration non bloquante et n'est pas présenté comme
résolu.

## Corrections apportées

| Finding V4-003B | Réponse v2.1 | Preuve |
| --- | --- | --- |
| Injection/canari non discriminants | Ajout d'un cas partiel où l'injection demande une inflation ; `INJECTION` et `CANARY` sont obligatoires et interdits comme preuves. | `injection-negative-base-remains-partial` |
| Désaccord entre passes non exercé | Deux vecteurs researcher/falsifier sont construits séparément ; accord, désaccord matériel et désaccord non matériel sont couverts. | `independent-material-choice-disagreement`, `independent-non-material-choice-disagreement` |
| PECO/PCC et projet B insuffisamment couverts | Chaque condition PECO/PCC est retirée séparément de toute la réponse ; absences, refus, contradiction, ambiguïté et mapping rejeté sont exercés sur B. | 6 cas conditionnels et 5 cas négatifs B |
| Empreinte et verdict insuffisamment liés | Comparaison canonique des niveaux, empreinte épinglée et test négatif de dérive sémantique. | `MECHANICAL_ORACLE_V21_FINGERPRINT` et test de dérive `corpusId` |
| Faux positifs structurels du harness | Rejet des overrides étrangers des deux passes, exactement 7 opérateurs attendus et liaison obligatoire des cas injection aux segments non fiables. | 12 tests dédiés v2.1 |

Les six cas conditionnels utilisent `NOT_DEMONSTRATED`, jamais
`CONTRADICTED`, lorsqu'une condition manque. Ils laissent explicitement la
dimension concernée ouverte : la lacune reste localisée à la justification,
sans double pénalisation sur la décision ou la fidélité au dossier.

## Paquet produit

- corpus :
  `benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.mechanical-oracle.v2.1.json` ;
- validateur :
  `src/lib/executable-rubric-mechanical-oracle-v2-1.ts` ;
- tests :
  `src/lib/executable-rubric-mechanical-oracle-v2-1.test.ts`.

Le corpus comprend 33 cas, dont les 19 cas v2 repris dans la nouvelle identité,
14 cas de durcissement et 7 mutations distinctes du compilateur. Les attentes
restent des oracles mécaniques par construction, pas une validation humaine ni
une preuve de vérité pédagogique universelle.

## Préservation de V4-003A

Les trois artefacts historiques v2 sont inchangés par rapport à la baseline :

| Artefact historique | SHA-256 brut |
| --- | --- |
| `writing-framework-selection-fr.mechanical-oracle.v2.json` | `a239967666ba24bc3b6f46861c7a2b45b856c118074a3169e9e3c9b07da11433` |
| `executable-rubric-mechanical-oracle-v2.ts` | `46daa0da783cb5d02fd6c80d302279a301a625e98aab8b6fc2773e8b5958d50d` |
| `executable-rubric-mechanical-oracle-v2.test.ts` | `6618a3774c00bf64f3c4c4bc6699934b8447903eefb592d83815e595530f0eca` |

## Validation

- 12/12 tests dédiés v2.1 verts ;
- 18/18 tests v2 + v2.1 verts ;
- lint vert ;
- typecheck vert ;
- 1 119/1 119 tests globaux verts ;
- build de production vert ;
- validation JSON verte ;
- relecture méthodologique : `APPROVED` ;
- relecture pédagogique : `APPROVED`.

## Gate suivant

Le seul ticket ouvrable est `V4-003B-R1`, audit indépendant read-only du paquet
v2.1. Il doit rendre un verdict unique :

- `READY_TO_FREEZE` : ouvre V4-003C sans autoriser de réseau ;
- `BLOCKED_WITH_FINDINGS` : exige une nouvelle version corrective.

V4-003C, V4-003D, tout appel modèle et tout accès au holdout restent fermés.
