# Digest de conservation — recherche correction IA

## Statut

- Version : 1.1.0
- Date : 26 août 2026
- Portée : navigation et conservation pour V4.1-004
- Autorité d'exécution : aucune

Ce digest évite que la refondation V4.1 perde ou aplatisse l'historique de
recherche IA. Il ne remplace ni les artefacts, ni les journaux, ni les contrats
runtime, ni les verdicts datés. En cas d'écart, la source versionnée et sa preuve
prévalent.

## Handoff en moins de 15 minutes

1. Lire `docs/V4_DOCUMENT_STATUS.md` pour savoir si un document est actif,
   descriptif, historique ou superseded.
2. Pour le runtime V4 borné, lire
   `src/server/corrections/promoted-identity.ts`, puis
   `docs/V4_FREE_TEXT_CORRECTION_CONTRACTS.md` et le rapport d'implémentation.
3. Pour comprendre la recherche, lire `docs/V4_RESEARCH_FINDINGS.md`, puis
   l'entrée pertinente du journal append-only et enfin l'artefact cité.
4. Traiter tout `benchmarks/ai-correction/**` et les deux phase manifests comme
   preuve historique non exécutoire, même si un statut interne ancien dit
   `APPROVED`, `GO` ou `AWAITING_*`.
5. Revalider l'arbre avec l'empreinte agrégée ci-dessous avant tout déplacement.

La direction active suivante est `V4_5_BACKLOG.md`, après le GO V4.1-504. Les
phrases historiques du journal ou des findings qui reportaient encore une
nouvelle campagne en « V4.1 » restent datées et immuables ; elles ne remplacent
pas le séquençage courant.

## Classification canonique

| Classe | Éléments | Usage |
| --- | --- | --- |
| Autorité runtime active | `src/server/corrections/promoted-identity.ts`, contrats texte V4 | Exécution bornée réellement livrée ; ne prouve pas une qualification scientifique générale. |
| Statut courant | `docs/V4_RESEARCH_FINDINGS.md`, rapport d'implémentation | Décrit l'état lisible ; les preuves brutes prévalent. |
| Preuve historique | journal, phase manifests, totalité de `benchmarks/ai-correction/**` | Reproduction, audit et provenance uniquement ; aucun replay ou budget implicite. |
| Superseded | prédécesseurs nommés par un manifeste de supersession | Conservés byte-identiques ; seul le successeur nommé sert de point de lecture dans la campagne historique. |
| Navigation | ce digest et `docs/INDEX.md` | Route vers l'autorité ; aucun verdict propre. |

`docs/V4_AI_CORRECTION_PHASE_MANIFEST.json` et
`docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` sont explicitement
`HISTORICAL_EVIDENCE` dans le registre V4. Leurs queues, holdouts « awaiting »
et anciennes autorités ne doivent pas être relancés.

## Structure canonique de l'archive Git

L'archive reste à son emplacement historique afin de préserver tous les liens.
Au SHA audité `64691f2f`, elle contient 235 fichiers suivis, répartis sans
recouvrement par premier niveau :

| Chemin sous `benchmarks/ai-correction/` | Fichiers | Contenu dominant |
| --- | ---: | --- |
| racine | 16 | README, corpus/benchmarks généraux, holdouts et revues racine |
| `autonomous/` | 7 | manifests et mini-panel autonome |
| `composite/` | 4 | enveloppes V4-009B et sidecars SHA-256 |
| `executable-rubric/` | 59 | contrats compilés, oracles, gels, attestations et holdouts |
| `gemini/` | 3 | manifeste historique et sidecar |
| `hybrid/` | 63 | campagnes holdout et Writing, préenregistrements et décisions |
| `pricing/` | 1 | calibration pilote datée |
| `results/` | 77 | tentatives, résumés, mappings et revues de résultats |
| `reviews/` | 5 | revues aveugles historiques |

Les familles fonctionnelles se recouvrent volontairement : 25 fichiers de
corpus, 35 liés aux holdouts, 43 manifests/gels/préflights/attestations et 103
résultats/revues/décisions. Le filtre exact et leurs empreintes sont consignés
dans `docs/DOCUMENT_MANIFEST.yaml`.

## Intégrité vérifiée au 26 août 2026

- arbre Git récursif : `ae889cdcd1e5ef9c9ff7318cc9da50de8ce26822` ;
- 235 fichiers, 5 121 753 octets ;
- 202 JSON parseables, zéro erreur de parsing ;
- SHA-256 agrégé :
  `4687910b53f612584c0b98f709f4d9731c53b590f6e04b4e153f62189cbb0e3c` ;
- 145 liaisons chemin+SHA-256 uniques détectées : 108 correspondent aux bytes
  courants, 34 à un blob retrouvé dans l'historique Git, 3 restent non
  résolues ;
- les 17 liaisons directes des deux phase manifests correspondent aux fichiers
  présents ;
- les trois sidecars `.sha256` correspondent à leur JSON associé.

L'empreinte agrégée est le SHA-256 des lignes triées
`<sha256_fichier><deux espaces><chemin><LF>`. Elle se reproduit ainsi :

```bash
git ls-files 'benchmarks/ai-correction/**' | LC_ALL=C sort |
  while IFS= read -r f; do shasum -a 256 "$f"; done |
  shasum -a 256
```

Empreintes des points d'entrée :

| Point d'entrée | SHA-256 |
| --- | --- |
| `docs/V4_DOCUMENT_STATUS.md` | `c4c91d32030cb77768dc19a72db20e25d76b615e1dd7cd4cc9c8960eb959e0cb` |
| `docs/V4_RESEARCH_FINDINGS.md` | `0a00739b49a8d5c8b918881f8639f49245036b038a7af4a8cc1103f1df252e4e` |
| `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` | `427cf6f0aacc7b1200941ef2c2819832d3ee795ce374d713a99b004d929c1330` |
| `docs/V4_AI_CORRECTION_PHASE_MANIFEST.json` | `34103ec364e3d3bc6f7b9065d21d78ab59d3277c93d454ad514068612edb0075` |
| `docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` | `40d4fd971bf6620174cebd5822aa6b0f1dbd9a32eba377d49ca8303eba1b108d` |
| `src/server/corrections/promoted-identity.ts` | `df6bae5460f4dd0d243c7149a1719ce97bfd5ab15ea40f67968b007b49d6fcba` |

## Supersessions vérifiées

- holdout v2 manifest → holdout v3 manifest, sans réécriture du v2 ;
- `hybrid/sonnet-v3-1-holdout-v4/manifest.draft.json` →
  `manifest.final.json` ;
- `review-manifest.pending.json` → `corpus-review.autonomous.json` ;
- `hybrid/writing-only-fr-v1/cross-label-comparison.json` →
  `cross-label-comparison.corrected.json` ;
- `corpus-review.preseal.autonomous.json` →
  `corpus-review.preseal-v2.autonomous.json`.

Les quatre fichiers holdout v4 liés par le manifeste de supersession ont tous
leur empreinte attendue. Pour Writing, les prédécesseurs et successeurs
correspondent également aux digests du journal ; aucun fichier source n'a été
modifié pendant V4.1-004.

## Limites d'intégrité connues

Trois liaisons historiques n'ont pas de blob correspondant retrouvé sur les
refs Git locales : deux digests de `ai-correction-benchmark.ts` et de son test
dans `hybrid/sonnet-v3-1-holdout-v4/manifest.draft.json`, plus le digest de
`configuration.autonomous.json` dans le mapping de revue
`2026-08-24T11-20-07-271Z`. Ces artefacts sont des brouillons/mappings
historiques ; leurs valeurs restent conservées et ne sont pas recalculées avec
les bytes actuels.

Le journal indique aussi que les sorties brutes V4-009B étaient hors Git et que
seules leurs empreintes ont été committées. L'audit confirme donc l'intégrité de
l'archive Git disponible, pas l'existence de chaque payload externe historique.
Ces limites interdisent de déclarer l'archive totalement autoportante, mais ne
justifient aucune suppression ou réécriture.

## Ce que l'historique contient

La famille correction IA ne se réduit pas à une synthèse finale. Elle contient
plusieurs couches qui doivent rester distinguées :

1. décisions et frontières de confiance ;
2. spécifications, protocoles et préenregistrements ;
3. corpus de développement, holdouts et oracles ;
4. configurations, enveloppes de coût et attestations fournisseur ;
5. exécutions, résultats, revues aveugles et audits indépendants ;
6. contrats runtime, rapports d'implémentation et recettes ;
7. décisions Produit, Finance et release datées.

Une couche ne remplace pas implicitement la précédente. Un résultat ne modifie
pas rétroactivement son protocole, et un rapport de synthèse ne remplace pas le
résultat brut.

## Routage canonique

| Besoin | Point d'entrée | Règle |
| --- | --- | --- |
| Comprendre les résultats V4 | `docs/V4_RESEARCH_FINDINGS.md` | Lire ensuite les artefacts cités ; la synthèse seule ne suffit pas à reproduire un verdict. |
| Reconstituer l'ordre des expériences | `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` | Journal append-only ; une nouvelle décision ajoute une entrée. |
| Retrouver les phases | `docs/V4_AI_CORRECTION_PHASE_MANIFEST.json` et `docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` | Respecter version et liens d'artefacts. |
| Comprendre les frontières de confiance | `ADR_003_AI_CORRECTION_FINANCING_TRUST_BOUNDARIES.md` | Une évolution exige une nouvelle décision explicite. |
| Inspecter corpus, holdouts et résultats | `benchmarks/ai-correction/` | Le fichier précis, sa version et son statut prévalent sur son nom de dossier. |
| Comprendre le contrat texte promu | `docs/V4_FREE_TEXT_CORRECTION_CONTRACTS.md` | Autorité du contrat runtime V4, pas preuve de qualification V4.5. |
| Vérifier l'état réellement implémenté | `docs/V4_FREE_TEXT_CORRECTION_IMPLEMENTATION_REPORT.md` | Distinguer couverture réelle et intention. |
| Rejouer les recettes V4-010 | `docs/V4_010_R1_ACCEPTANCE.md`, `docs/V4_010_R2_INPUT_LIMIT.md`, `docs/V4_010_R3_RECONSIDERATION.md`, `docs/V4_010_R4_HISTORY_COMPARISON.md` | Chaque recette garde sa portée et ses limites. |
| Cadrer une nouvelle génération | `V4_5_BACKLOG.md` | V4.5 reste fermée jusqu'au GO explicite V4.1-504. |

`docs/INDEX.md` reste le routeur documentaire. Ce tableau est une vue de
conservation ciblée ; il n'élargit pas la liste des autorités actives.

## Familles d'artefacts à préserver

### Corpus et oracles

Préserver les corpus versionnés, exemples adversariaux, minimal pairs, oracles
mécaniques, mappings de preuve et fichiers de qualification. Les données de
développement et de holdout ne doivent pas être fusionnées, renommées comme si
elles avaient le même rôle ou réutilisées dans un examen frais sans décision.

### Protocoles et configurations

Préserver les préenregistrements, configurations draft/final, enveloppes de
budget, règles d'arrêt, freezes, autorisations et manifests de campagne. Leur
ordre est une partie de la preuve : une autorisation postérieure ne doit pas
être présentée comme antérieure à l'exécution.

### Résultats, revues et décisions

Préserver résultats bruts, résultats dérivés, revues aveugles, audits de source,
rejets, GO/NO-GO et supersession manifests. Une décision négative, un essai
incomplet ou un artefact `draft` reste utile pour comprendre les limites et ne
doit pas disparaître lors d'un nettoyage.

### Coûts et attestations

Préserver devis, réconciliations, snapshots de prix et attestations avec leur
date, fournisseur, transport et devise. Ces valeurs sont historiques ; elles ne
fixent jamais seules un tarif LearnX futur.

## Règles de non-interprétation

- Un nom de modèle ou de fournisseur dans un artefact historique ne vaut pas
  autorisation runtime actuelle.
- Une preuve sur `writing` ne qualifie pas `reflection`, `practice` ou `project`.
- Un succès de développement ne remplace pas un examen frais et indépendant.
- Un score déclaré par un modèle n'est pas un signal de garde indépendant.
- Un feedback IA seul ne doit pas devenir une autorité de progression ou de
  maîtrise.
- Un coût ancien ne prouve ni un P90 actuel, ni une marge, ni un prix public.
- `draft`, `rejected`, `blocked`, `no-go` et `incomplete` sont des statuts à
  conserver, pas des motifs de suppression.

## Contrat de reprise V4.5

Avant de réutiliser une idée ou un composant historique, le ticket V4.5 actif
doit nommer : l'artefact source exact, la question nouvelle, le corpus frais, la
séparation développement/examen, le reviewer indépendant, les métriques, la
classe de taille, la famille, la langue, le budget, les règles d'arrêt et le
rollback. La campagne produit de nouveaux artefacts versionnés ; elle ne modifie
pas ceux de V4.

## Déplacement ou archivage futur

Un déplacement éventuel doit préserver l'historique Git et fournir un manifeste
de redirection avec ancien chemin, nouveau chemin, raison, owner, reviewer,
date, compatibilité des scripts et rollback. V4.1-001 à V4.1-005 n'autorisent
aucun déplacement ni aucune suppression.
