# Arbitrage V4 — absence, refus explicite et contradiction

- **Statut** : `OFFLINE_IMPLEMENTED_AWAITING_V4-002A`
- **Version** : `1.0.0`
- **Décision propriétaire** : Rayan Chambet
- **Date** : 21 août 2026
- **Portée** : successeur du protocole evidence-assist, hors ligne uniquement

## 1. Problème révélé

Le gate clos a rencontré la réponse :

> Je ne formule aucune recommandation.

Pour l'élément positif `explicit-recommendation`, l'ancien pseudo-oracle
attendait `NOT_DEMONSTRATED`, donc uniquement une omission ou une abstention du
modèle. Sonnet a proposé `EVIDENCE_AGAINST_ELEMENT` sur la négation exacte.

La production ne satisfait pas le critère dans les deux lectures. Le désaccord
porte sur la nature de la preuve :

- rien ne permet d'observer une recommandation ;
- la réponse affirme explicitement qu'elle n'en donne pas.

L'ancien protocole ne pouvait pas représenter cette différence.

## 2. Décision

L'ontologie successeur ajoute `EXPLICITLY_REFUTED`.

| Statut | Exemple pour « formuler une recommandation » | Sens |
| --- | --- | --- |
| `SUPPORTED` | « Je recommande l'option A. » | L'élément est démontré. |
| `NOT_DEMONSTRATED` | « Le délai a diminué. » | La réponse ne permet pas d'observer l'élément. |
| `EXPLICITLY_REFUTED` | « Je ne formule aucune recommandation. » | La réponse refuse explicitement l'élément attendu. |
| `CONTRADICTED` | « Je recommande A. Finalement, je ne recommande aucune option. » | Des passages incompatibles demeurent. |
| `AMBIGUOUS` | « Je penche peut-être pour A, sans vraiment choisir. » | Plusieurs interprétations plausibles peuvent changer le résultat. |

Pour le MVP, `EXPLICITLY_REFUTED` et `NOT_DEMONSTRATED` ont le **même effet sur
le niveau** d'un élément positif requis : l'exigence n'est pas satisfaite.
Ils restent distincts dans le certificat et le feedback :

- absence : « Formulez la recommandation attendue. » ;
- refus explicite : « Votre réponse indique explicitement qu'aucune
  recommandation n'est donnée ; révisez ce choix pour répondre à la consigne. »

Cette distinction ne rend donc pas la notation plus punitive. Elle conserve
une information utile et permet un feedback plus fidèle.

## 3. Frontières obligatoires

- `EXPLICITLY_REFUTED` exige un passage exact exprimant le refus de l'élément.
- Une absence de passage reste `NOT_DEMONSTRATED`.
- Une hésitation n'est pas automatiquement un refus.
- Refuser une option précise tout en en recommandant une autre ne réfute pas
  l'élément générique « formuler une recommandation ».
- `CONTRADICTED` reste distinct : il exige au moins deux assertions
  matériellement incompatibles non résolues.
- Une relation modèle `EVIDENCE_AGAINST_ELEMENT` n'établit jamais seule un
  statut. LearnX contrôle le span, l'élément, la polarité et la règle authorée.
- Aucun de ces statuts ne peut produire directement score, progression ou
  maîtrise.

## 4. Compatibilité et versionnage

La campagne `learnx-writing-fr-sonnet-5-evidence-assist-v3@1.0.0`, ses golds,
son mapping et son verdict restent byte-identiques et clos. Elle ne doit pas
être recalculée sous cette décision.

L'ajout du statut modifie l'ontologie, les templates, le mapping et
l'évaluateur. Il impose donc :

1. une nouvelle version du moteur/contrat ;
2. un nouveau corpus mécanique ;
3. une nouvelle identité expérimentale ;
4. un nouveau gate quatre cas ;
5. de nouveaux GO Finance et Propriétaire avant tout appel.

## 5. Preuves hors ligne avant gel

Les paires minimales doivent démontrer :

- distinction absence/refus explicite ;
- même effet de niveau provisoire, messages différents ;
- contradiction distincte du refus ;
- hésitation conservée comme ambiguïté lorsque matérielle ;
- localité : seul le critère propriétaire change ;
- aucune autorité candidate sur score, niveau ou progression.

L'artefact de départ est
`benchmarks/ai-correction/executable-rubric/writing-fr-explicit-refutation-minimal-pairs.v1.json`.
Il constitue un oracle mécanique de conception, pas une preuve de qualité d'un
modèle.

## 6. Arbitrages qui restent ouverts

- extension éventuelle aux éléments négatifs ou de type `CONTRADICTION` ;
- formulation définitive des templates apprenant ;
- passage du contrat pilote de `EVIDENCE_ASSIST_ONLY` à
  `FULLY_COMPILABLE` après compilation et tests ;
- choix du modèle du nouveau gate ;
- budget et date d'exécution.

Ces points reviennent explicitement au Propriétaire. Aucun choix n'est déduit
du présent document.
