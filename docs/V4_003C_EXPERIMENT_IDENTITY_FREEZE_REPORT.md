# V4-003C — Gel de la nouvelle identité expérimentale

- **Statut** : `FROZEN_OFFLINE_AWAITING_RAYAN_C`
- **Date** : 21 août 2026
- **Responsable** : `AGENT-PROTOCOLE-IA`
- **Entrée** : V4-003B-R1 `READY_TO_FREEZE`
- **Appel modèle, réseau, budget, holdout ou activation** : aucun

## 1. Résultat

Le dossier reproductible du prochain test est gelé hors ligne dans :

`benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-freeze.v1.json`

Il lie dans une seule identité :

- le pilote réel « Choisir sans forcer un cadre » ;
- le contrat v2 approuvé et son empreinte compilée ;
- l'oracle mécanique v2.1 audité `READY_TO_FREEZE` ;
- le modèle, la route et le profil de requête ;
- les quatre cas du premier gate et les dix cas du panel conditionnel ;
- le mapping sémantique successeur ;
- le contrat du runner, la télémétrie et la politique d'arrêt.

L'identité expérimentale est :

`learnx-writing-framework-selection-fr-sonnet-5-evidence-assist-v1@1.0.0`

Empreinte :

`cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31`

Ce gel n'autorise aucune dépense. Il attend l'arbitrage **Rayan C**.

## 2. Choix du candidat

Le premier candidat recommandé reste `anthropic/claude-sonnet-5`, via
OpenRouter, route exacte `Anthropic`, fallback interdit et raisonnement
explicitement désactivé par `reasoning.effort=none`.

Ce choix ne signifie pas que Sonnet 5 est promu ou déclaré meilleur. Il évite
de changer simultanément le modèle et le contrat :

- la route et le profil sont déjà attestés hors ligne ;
- les échecs historiques de Sonnet 5 appartiennent à d'autres identités ;
- le dernier désaccord concernait précisément l'absence versus le refus
  explicite, frontière désormais authorée par `EXPLICITLY_REFUTED` ;
- tous les résultats du nouveau gate seront frais et non réutilisés.

Gemini et au moins un troisième candidat restent prévus pour la comparaison de
robustesse et de coût après preuve de faisabilité du pipeline exact. Les faire
entrer maintenant ajouterait une seconde variable et retarderait le diagnostic
du contrat successeur.

## 3. Gate quatre cas

Le gate est volontairement petit et discriminant :

| Ordre | Cas | Ce qu'il éprouve |
| --- | --- | --- |
| 1 | `baseline-pico-spider-mastered` | Repérage des preuves d'une réponse complète. |
| 2 | `fidelity-a-explicit-refusal` | Distinction entre absence et refus explicite. |
| 3 | `fidelity-a-first-fact-removed` | Abstention lorsqu'une preuve attendue est absente. |
| 4 | `injection-negative-base-remains-partial` | Résistance à l'injection sans gonfler une réponse déjà incomplète. |

Le gate exige `4/4`. Il s'arrête au premier défaut, sans retry ni fallback.
Une identité qui échoue est close ; elle n'est pas retunée ni rejouée.

## 4. Panel conditionnel 10 × 2

Le panel ne devient éligible qu'après `4/4`, sous la même identité, puis une
nouvelle enveloppe Finance et une nouvelle autorisation propriétaire. Il
effectue vingt workflows frais ; aucun résultat du gate n'est réutilisé.

Les dix cas couvrent : réponse complète, concision, preuve absente, refus
explicite symétrique sur A et B, variantes PECO et PCC, ambiguïté matérielle,
contradiction interne et injection sur réponse incomplète.

## 5. Mapping successeur

Le modèle ne retourne que des relations candidates :

| Oracle LearnX | Relation candidate attendue |
| --- | --- |
| `SUPPORTED` | `EVIDENCE_FOR_ELEMENT` |
| `NOT_DEMONSTRATED` | `ABSTAIN` ou omission |
| `EXPLICITLY_REFUTED` | `EVIDENCE_AGAINST_ELEMENT` |
| `CONTRADICTED` | `ABSTAIN` ou omission |
| `AMBIGUOUS` | `ABSTAIN` ou omission |

Ce mapping ne permet jamais au modèle de fixer un statut atomique, un niveau,
un score, un `PASS/FAIL`, la maîtrise, la progression ou un feedback libre.
LearnX reste l'unique autorité mécanique.

## 6. Frontières techniques et financières

Le runner est gelé comme **contrat d'exécution**, mais son adaptation au
compilateur v2 n'est pas encore exécutable. `V4-009C-S2` devra implémenter
exactement ce contrat et prouver l'égalité des empreintes avant tout réseau.
Toute divergence créera une nouvelle identité et reviendra à Rayan C.

Garanties figées :

- `CALL_INTENT` et clé d'idempotence locale avant le réseau ;
- raw persisté avant validation ;
- coût `ACTUAL` obligatoire ; un coût absent devient
  `RECONCILIATION_REQUIRED`, jamais zéro ;
- exécution séquentielle, zéro retry et zéro fallback ;
- route demandée et fournisseur observé persistés séparément ;
- usages, latence, défauts, coûts et résumé quantile consignés ;
- holdout, live, publication et débit utilisateur interdits.

## 7. Empreintes du gel

| Composant | Empreinte SHA-256 canonique |
| --- | --- |
| Identité | `cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31` |
| Corpus | `12f0202d930b9f197532847c0125f5531a2b8d39502c8f1244e6049629828a4b` |
| Mapping | `4fbff2b975124bcd336c49e0d2dbfe42ebf3f4adcf9a048ca17c8c4e5a79bb85` |
| Runner | `891560b6712afc1f197aea8d016a3309d2d5c7db3ac7e519bda6968d4227eb0b` |
| Télémétrie | `e8e4e16a18e4ad652f3b271847e156aedc66f0c8c934eae9c2291cbf1d519b56` |
| Stop-policy | `3416fd36324f0b29952dbb005c44ec2fc58520167d011fdf2698b1a04eabff4e` |

## 8. Arbitrage Rayan C demandé

La recommandation est d'approuver ce dossier exact : Sonnet 5 en premier,
quatre cas dans l'ordre indiqué, panel 10 × 2 seulement en cas de `4/4`, et
aucune réutilisation historique.

L'approbation Rayan C ouvrirait uniquement `V4-003D` pour calculer et arbitrer
l'enveloppe Finance. Elle n'autoriserait ni l'implémentation réseau, ni un
appel, ni le panel, ni le holdout, ni V4-010.

## 9. Validation hors ligne

- les autorités pointent vers les octets exacts du dépôt ;
- les six empreintes sont recalculées par test ;
- les 4 + 10 identifiants existent dans l'oracle v2.1 et sont uniques ;
- le panel représente exactement 20 workflows frais ;
- tous les verrous d'exécution restent fermés ;
- lint et typecheck réussis ;
- suite complète : **1 124/1 124** tests, 176 fichiers ;
- build de production réussi.
