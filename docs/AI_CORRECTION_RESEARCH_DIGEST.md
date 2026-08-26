# Digest de conservation — recherche correction IA

## Statut

- Version : 1.0.0
- Date : 26 août 2026
- Portée : navigation et conservation pour V4.1-004
- Autorité d'exécution : aucune

Ce digest évite que la refondation V4.1 perde ou aplatisse l'historique de
recherche IA. Il ne remplace ni les artefacts, ni les journaux, ni les contrats
runtime, ni les verdicts datés. En cas d'écart, la source versionnée et sa preuve
prévalent.

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
| Cadrer une nouvelle génération | `V4_5_BACKLOG.md` | V4.5 reste fermée jusqu'au GO explicite V4.1-027. |

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
