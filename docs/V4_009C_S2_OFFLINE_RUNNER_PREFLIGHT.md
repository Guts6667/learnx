# V4-009C-S2 — Préflight hors ligne du runner v2

- **Statut** : `HARD_OFF_PREFLIGHT_GREEN`
- **Date** : 21 août 2026
- **Identité gelée** : `cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31`
- **Appel modèle, réseau, holdout ou activation** : aucun
- **Prochaine autorité** : Rayan, pour un éventuel gate réseau quatre cas

## 1. Résultat simple

Le runner successeur sait désormais préparer et contrôler les quatre cas du
gate avec le contrat exécutable v2, sans appeler de fournisseur. Il a été testé
avec un faux fournisseur déterministe et un stockage durable temporaire.

Résultat :

- quatre workflows sur quatre valides ;
- zéro défaut ;
- zéro appel modèle ;
- zéro accès réseau ;
- zéro réexécution fournisseur après fermeture puis réouverture du stockage.

Cette preuve valide le **banc d'essai**, pas Sonnet 5. La qualité et la route
réelles restent inconnues tant que Rayan n'a pas autorisé les quatre appels.

## 2. Architecture livrée

L'adaptation est isolée des campagnes historiques : aucun runner, protocole ou
artefact clos n'a été modifié.

Le nouveau lot comprend :

1. un adaptateur du contrat exécutable v2 vers la vue candidate evidence-assist ;
2. un runner séquentiel qui ne connaît actuellement qu'un fournisseur
   `OFFLINE_FAKE` ;
3. un stockage durable append-only pour `CALL_INTENT`, raw et outcome ;
4. un script de préflight reproductible ;
5. des contrôles ciblés des frontières Finance, sécurité et idempotence.

La vue envoyable au modèle contient les éléments et leurs règles de preuve,
mais aucun niveau, score, template, remédiation, progression ou décision de
maîtrise.

## 3. Mesures du préflight

| Cas | Taille des messages UTF-8 | Résultat |
| --- | ---: | --- |
| Réponse complète PICO/SPIDER | 12 235 octets | `VALID` |
| Refus explicite projet A | 12 012 octets | `VALID` |
| Première preuve A retirée | 12 125 octets | `VALID` |
| Injection sur réponse incomplète | 12 321 octets | `VALID` |

Maximum observé : **12 321 octets**, soit 18,8 % de la borne Finance de
65 536 octets. Cette marge ne réduit pas le plafond financier : elle constitue
seulement une mesure du runner actuel.

## 4. Contrôles démontrés

- toutes les autorités du dossier V4-003C sont relues et rehashées ;
- le dossier et l'enveloppe Finance sont liés aux mêmes octets et à la même
  identité ;
- la rubrique v2 et l'oracle mécanique v2.1 recompilent avant préparation ;
- la clé locale suit
  `SHA256(identityFingerprint:FOUR_CASE_GATE:caseId:1)` ;
- `CALL_INTENT` précède toujours le fournisseur ;
- le raw est écrit avant toute validation ;
- le journal est chaîné par hash et les fichiers sont créés exclusivement ;
- une reprise après redémarrage restitue les quatre outcomes sans rappeler le
  fournisseur ;
- un intent sans outcome ferme l'exécution au lieu de redéclencher un appel ;
- un message supérieur à 65 536 octets est refusé avant intent et fournisseur ;
- un coût absent devient `RECONCILIATION_REQUIRED`, jamais zéro ;
- une fuite du canari stoppe le gate sur `SAFETY` ;
- zéro retry, zéro fallback et arrêt au premier défaut.

## 5. Artefact machine

`benchmarks/ai-correction/executable-rubric/writing-framework-selection-sonnet-5-runner-preflight.v1.json`

Empreinte :

`ca81bfec01494d31356d6a3efde9bb7581c1a1ff601013f1c8c6df63ee582f16`

Commande reproductible :

`pnpm ai:evidence:assist:v2:preflight`

## 6. Ce qui reste volontairement fermé

Le préflight n'implémente ni n'autorise encore l'adaptateur réseau. Il ne prouve
donc pas :

- que la route Anthropic répondra ;
- que Sonnet 5 produira quatre sorties conformes ;
- que les coûts `ACTUAL` seront présents et réconciliés ;
- que le panel 10 × 2 ou le holdout sont ouvrables ;
- que V4-010 peut être activé.

## 7. Prochaine décision

V4-009C-S2 est prêt pour une autorisation réseau distincte. Cette autorisation
doit nommer exactement :

- `anthropic/claude-sonnet-5` via OpenRouter, route Anthropic ;
- les quatre cas gelés ;
- quatre appels maximum ;
- zéro retry et zéro fallback ;
- plafond fournisseur total `0,708328 USD` ;
- raw, usages, identifiants fournisseur et coûts conservés localement ;
- panel, holdout et activation toujours interdits.

Après cette autorisation seulement, l'adaptateur réseau sera raccordé au runner
prévalidé et la campagne s'arrêtera au premier défaut.

## 8. Validation du dépôt

- préflight reproductible : `4/4 VALID`, zéro appel modèle ;
- tests ciblés : `25/25` ;
- suite complète : `1 138/1 138` tests ;
- lint : vert ;
- typecheck : vert ;
- build de production : vert.
