# V4-002C — Rapport du compilateur sémantique v2

- **Statut** : `DONE_OFFLINE`
- **Date** : 21 août 2026
- **Responsable** : `AGENT-DEV-LEARNX`
- **Consultés** : `AGENT-PEDAGOGIE`, `AGENT-METHODOLOGIE`
- **Entrée approuvée** : `V4-002B`, gate `Rayan B` clos
- **Baseline** : `db214a6103913229fa6ed3fce5d476f35ce7f501`
- **Branche isolée** : `codex/v4-002c-rubric-compiler`
- **Appels modèle / réseau** : 0
- **Publication / activation** : aucune

## 1. Résultat

Le contrat `v4-writing-framework-selection-fr` peut désormais être analysé et
exécuté **hors ligne** avec le schéma `executable-rubric/v2`. Le compilateur
produit une empreinte déterministe et refuse les rubriques structurellement
ambiguës ou susceptibles d'appliquer une double pénalisation.

Cette preuve ferme `V4-002C`, mais ne rend pas le contrat publiable. Le fichier
d'entrée demeure `DRAFT`, aucun `ProgramVersion` publié n'est lié, aucun corpus
successeur n'est encore gelé et aucun pipeline modèle n'est promu.

## 2. Livrables

| Livrable | Rôle |
| --- | --- |
| `src/lib/executable-rubric-engine-v2.ts` | Schéma strict v2, compilation statique, routage explicite v1/v2, consolidation indépendante et certificat de preuve v2. |
| `src/lib/executable-rubric-engine-v2.test.ts` | Tests du contrat approuvé, mutations interdites et états de restitution. |
| `benchmarks/ai-correction/executable-rubric/writing-framework-selection-fr.v1.draft.json` | Entrée pédagogique approuvée, toujours `DRAFT` et `NOT_COMPILED` par construction. |
| `docs/V4_WRITING_FRAMEWORK_SELECTION_CONTRACT_DRAFT.md` | Autorité pédagogique alignée avec les arbitrages `Rayan B`. |

Le moteur v1 existant n'est pas modifié. Le routage dépend explicitement de
`schemaVersion`, ce qui évite de réinterpréter les campagnes historiques avec
le nouveau contrat.

## 3. Contrôles statiques bloquants

La compilation refuse notamment :

- un checksum de consigne ou de scénario incorrect ;
- une clé, un propriétaire, une exclusion ou un groupe incohérent ;
- un élément `HOLISTIC` présenté comme entièrement compilable ;
- une dépendance inconnue, inter-scénario ou cyclique ;
- le partage implicite d'un élément entre critères ;
- une règle de niveau non totale, chevauchante, inaccessible ou non monotone ;
- un niveau `mastered` atteignable avec un scénario incomplet ;
- un effet de niveau différent entre absence et refus explicite ;
- un mapping de cadre non authoré ou une variante conditionnelle dont toutes
  les conditions n'ont pas de preuve structurée ;
- un score, une autorité modèle ou un effet sur la progression.

## 4. Certificat de preuve v2

Le certificat conserve :

- la rubrique, sa version, son empreinte et la version des règles ;
- le pipeline et son empreinte ;
- les statuts atomiques proposés et résolus ;
- le cadre identifié lorsque l'élément en dépend ;
- les spans exacts, offsets, hashes et claims fiables associés ;
- les rôles de relation rattachés à leurs spans et les conditions PECO/PCC
  rattachées à leurs preuves ;
- les conflits structurés ;
- le propriétaire, le scénario, la règle et les niveaux possibles ;
- un score toujours `null` et un effet de progression toujours `NONE`.

Les deux passes sont consolidées après validation et canonisation séparées.
Un désaccord de statut, de cadre ou de claim fiable devient `AMBIGUOUS`. LearnX énumère ensuite
les résolutions possibles : si elles changent un niveau, l'état est
`CLARIFICATION_REQUIRED`; sinon le niveau stable peut être rendu sans score.

## 5. Invariants pédagogiques couverts

- Les projets A et B ne se compensent pas pour atteindre `mastered`.
- La décision explicite reste démontrée même si le cadre choisi est mal adapté ;
  seul `choice-rationale` porte le conflit de mapping.
- Une propriété fausse du dossier dégrade uniquement `dossier-fidelity` ;
  l'existence d'un lien explicatif reste évaluée séparément.
- Deux faits libres sont canonisés comme un groupe non ordonné et doivent
  utiliser deux claims ainsi que deux occurrences distinctes.
- Un refus répété dans les deux slots ne crée qu'un défaut et un feedback.
- Une dépendance non satisfaite bloque le feedback dérivé au lieu d'ajouter une
  seconde pénalité.
- Un refus explicite de mobiliser le dossier ne constitue pas une propriété du
  projet et bloque donc la justification dérivée.
- `EXPLICITLY_REFUTED` reste distinct dans le certificat et le feedback, avec
  le même effet de niveau que `NOT_DEMONSTRATED`.
- Une citation inventée, une ambiguïté sans preuve, un rôle de relation non lié
  à un span ou un binding de cadre parasite rend la passe invalide.

## 6. Consultations intégrées

### Développement — `APPROVED`

La recommandation d'un moteur v2 séparé a été retenue. Les empreintes des deux
rubriques v1 historiques restent couvertes par des tests de non-régression :

- `writing-recommendation-fr.v1.json` :
  `9cb8ada85eafaf65974e4050ee23b468e265748d5780b5c64f1d60ad7b` ;
- `writing-go-no-go-recommendation-fr.v2.json`, malgré son nom historique :
  `6206d4a8dfab0715da008de1265e63a1e246b753026a72622447277c19ed47b4`.

La contre-revue finale confirme également la frontière de confiance du
certificat : l'identité validée n'est pas transférable par copie et le résultat
consolidé est gelé récursivement avant sa consommation.

### Méthodologie / pédagogie — `APPROVED`

Les quatre précisions suivantes sont intégrées :

1. la vérité d'une propriété appartient uniquement à `dossier-fidelity` ;
2. tout passage attribué au dossier peut créer un `CONTEXT_MISMATCH` ;
3. un refus répété dans un groupe possède une seule cause racine ;
4. un cadre connu mais non adapté reste une décision explicite ; le défaut est
   localisé dans la justification.

La contre-revue finale confirme la localité, la non-compensation, l'exécution
des conditions PECO/PCC et l'abstention lorsque l'ambiguïté peut modifier un
niveau.

## 7. Validation

Les validations finales du dépôt sont consignées avant clôture du ticket :

- tests ciblés du moteur v2 : **32/32** ;
- suite complète : **1 101/1 101** tests, 173 fichiers ;
- lint global : réussi ;
- typecheck : réussi ;
- build de production : réussi.

Sous Node 25, la suite complète doit être exécutée avec le stockage web
expérimental désactivé (`NODE_OPTIONS=--no-experimental-webstorage`) afin de
laisser `jsdom` fournir `localStorage`. Une première exécution sans cette option
a produit des échecs d'environnement sans rapport avec V4-002C ; la relance
canonique ci-dessus est entièrement verte.

## 8. Limites et prochaine étape

`V4-003A` devient le seul ticket ouvrable. Il doit construire un oracle
mécanique reproductible : paires minimales, localité, monotonie,
métamorphismes, Unicode/injections et mutations. Il ne doit ni modifier le
contrat après observation, ni appeler un modèle.

Restent explicitement fermés :

- publication du contrat et modification pédagogique de l'activité réelle ;
- gel d'une identité modèle, budget et appels OpenRouter ;
- panel, holdout et activation de `V4-010` ;
- score public, `PASS/FAIL`, maîtrise ou progression.

## 9. Paquet de reprise V4-003A

L'agent `AGENT-METHODOLOGIE` reprend exclusivement :

1. le contrat Markdown approuvé ;
2. sa projection JSON v2 et son empreinte
   `600fb37a29694ed70c93f6041f879f557792b5120b92cc0ab415466d05383752` ;
3. le compilateur et les tests V4-002C ;
4. les contraintes de corpus de `BACKLOG_V4.md`.

Il doit livrer des fixtures avec oracle par construction et un manifeste
reproductible. Toute anomalie devient une observation d'audit : elle ne permet
pas de modifier silencieusement le contrat, les niveaux, les attentes ou les
seuils. Sont interdits pendant V4-003A : modèle, réseau, budget, holdout,
publication, runtime utilisateur et activation.
