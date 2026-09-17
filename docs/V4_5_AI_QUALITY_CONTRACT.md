# Contrat qualité V4.5 — correction assistée par IA

- **Statut** : `ACTIVE_AUTHORITY` (V4.5-001 / ticket V4.5-100)
- **Version** : 1.1.0
- **Date** : 17 septembre 2026 (amendement approuvé par le plan de reprise)
- **Owner** : Architecture/Produit (Head of AI)
- **Reviewer** : Rayan
- **Portée** : exercices textuels libres et, après V4.5-130, remises
  textuelles d'étape ; `fr-FR` ; preuve texte uniquement
- **Autorité supérieure** : `ADR_003` (frontières de confiance, addendum du
  29 août 2026)

## 1. Promesse et principe

La correction assistée LearnX est un **retour formatif assisté par IA**. Elle
n'est pas une note, ne valide aucune maîtrise et n'écrit jamais dans la
progression. Aucune validation humaine n'est revendiquée : LearnX est exploité
sans relecteur humain dans la boucle de correction. Pour le pilote étroit
V4.5-210, Rayan fournit les références absolues et le retest aveugle avant
mesure. Cette référence propriétaire n'est pas une validation humaine
indépendante.

Principe directeur :

> Le système a le droit de se tromper. Il n'a pas le droit de se tromper en
> silence ni avec autorité.

Une erreur de niveau **étiquetée `LOW`**, accompagnée d'un **extrait verbatim**
de la réponse et **sans effet sur la progression** est une erreur bornée. Le
contrat vise un output `HIGH` rare mais fiable, pas un output toujours juste.

## 2. Niveaux de confiance par critère

Chaque critère livré porte un niveau `HIGH | MEDIUM | LOW`, dérivé
**uniquement** de faits décidables côté serveur. La confiance auto-déclarée du
modèle n'est jamais une entrée.

| Signal (serveur) | Effet |
| --- | --- |
| Citation absente, ambiguë ou rejetée par le vérificateur déterministe | `LOW` (critère « à vérifier », aucun niveau affiché) |
| `evidenceStatus = NO_RELEVANT_EVIDENCE` avec niveau plancher cohérent | `MEDIUM` |
| Regex de contrainte dure détectée dans le feedback avec niveau > plancher | `LOW` |
| Désaccord du vérificateur indépendant (V4.5-111) sur ce critère | `LOW` |
| Vérificateur indisponible | plafond `MEDIUM` pour chaque critère et la correction |
| Famille hors `scientificallyValidatedActivityTypeScope` | plafond `MEDIUM` par critère et au global |
| Niveau extrême (`mastered` ou plancher) avec citation vérifiée et accord vérificateur | `HIGH` |
| Niveau intermédiaire avec citation vérifiée et accord vérificateur | `MEDIUM` |

Règles de restitution :

- `indicativeScore` n'est calculé que si tous les critères livrés sont `HIGH`
  ou `MEDIUM` ; sinon `null`.
- Un critère `LOW` est rendu « À vérifier » : observation + extrait, sans
  niveau ni feedback prescriptif.
- `overallConfidence` = minimum des critères livrés.
- La table exacte est implémentée par une fonction pure testée
  (`src/lib/ai-correction-confidence.ts`, V4.5-110). Toute
  modification de la table est une nouvelle version de ce contrat.

### 2.1 Doctrine de livraison — jamais de disparition silencieuse

**Un critère n'est jamais retiré en silence.** C'est la règle, et elle est
plus forte que le principe du §1 : se tromper en silence est interdit, se
taire aussi.

Quand la preuve d'un critère ne se résout pas dans la production de
l'apprenant, le critère est **livré**, en « à vérifier » :

- les citations irrecevables sont **retirées** — un extrait qui ne vient pas
  de la copie n'est pas une preuve ;
- **aucun niveau n'est affiché** — la confiance retombe à `LOW` par la table
  du §2, et la règle du score indicatif suit d'elle-même ;
- le niveau que le modèle a prononcé **reste dans l'artefact** sans jamais
  être montré : c'est la trace de ce qui a été affirmé, et l'effacer
  reviendrait à juger à sa place ;
- la **raison du retrait est enregistrée dans sa propre catégorie**, distincte
  de tout autre motif.

Même principe du côté des oracles (§4) : un contrôle **rapporte sa portée**, et
ce qui en sort produit le **silence, jamais une accusation**. Le vérificateur
arithmétique en est le cas travaillé — `coverage` dit combien de citations
portaient une expression explicite, et une arithmétique écrite en prose est
hors portée plutôt qu'à moitié traitée. Un contrôle dont la portée est de 0,6 %
des citations ne doit pas se lire comme un verdict sur les 99,4 % restantes.

#### Pourquoi les trois autres options ont été refusées

Cette section existe parce que la règle seule invite à la « simplifier », et
qu'en la simplifiant on réintroduit la disparition silencieuse. **La raison
compte davantage que la règle.**

- **Rejeter toute la tentative** jette du bon travail : deux critères
  correctement établis disparaissent pour une citation irrecevable sur un
  troisième.
- **Imposer le niveau plancher** revient à **juger à la place du modèle**. Il a
  prononcé un niveau ; en lui en substituant un autre, nous inventons un
  verdict que personne n'a rendu, et nous le présentons comme le sien.
- **Retirer la citation en gardant le niveau affiché** est le pire des trois :
  cela **masque l'erreur avec autorité**. L'apprenant lit un niveau qui semble
  établi, dont le seul appui a été retiré sans qu'il l'apprenne.

Le défaut d'origine (V4.5-177) était réel et mesuré : un critère retiré quitte
le numérateur **et** le dénominateur de tous les gates. Un gabarit qui se tait
paraît donc meilleur qu'un gabarit qui se trompe, et la mesure enregistre la
dérobade comme un progrès. C'est ce que cette doctrine interdit.

## 3. Garde indépendante

La seconde passe par le même modèle dans la bande ±5 est retirée : elle
mesure la variance du modèle, pas sa clémence. Elle est remplacée par un
**vérificateur indépendant** (autre famille de modèle, appel unique, question
fermée par critère : « l'extrait cité étaye-t-il ce niveau selon cette ligne
de rubrique ? »). Un désaccord force `LOW` ; il ne modifie jamais un niveau ni
un score. L'identité du vérificateur est épinglée comme celle du modèle
primaire et vérifiée par le préflight de release.

## 4. Oracles décidables par la machine

La qualité n'est plus mesurée comme un accord avec un étalon rédigé par une
IA. Les corpus historiques sont conservés dans un **pool de régression
réutilisable** avec `oracleKind: MODEL_AUTHORED` : ils signalent une dérive,
pas une vérité. Les gates reposent sur des propriétés certaines :

| Oracle | Propriété attendue | Métrique |
| --- | --- | --- |
| Mutation — suppression de la phrase portant le critère X | X ne reste pas `mastered` | `mutationDirectionViolations` |
| Mutation — inversion factuelle | le critère factuel baisse ; les critères non liés ne baissent pas | `mutationDirectionViolations`, `unrelatedCriterionDrift` |
| Mutation — charge d'injection ajoutée | niveaux inchangés, aucune citation de la charge | sécurité injection, `unrelatedCriterionDrift` |
| Mutation — paraphrase sans changement de sens | niveaux à ≤ 1 pas | `unrelatedCriterionDrift` |
| Mutation — mélange de paragraphes | niveaux inchangés | `unrelatedCriterionDrift` |
| Stabilité — 3 répétitions | aucun critère ne bascule de ≥ 2 pas | `repetitionTwoStepFlips` |
| Cross-modèle | probes faux-accord construits séparément ; accord à HIGH descriptif uniquement car circulaire | `checkerFalseAgreeDesigned`, `checkerAgreementAtHigh` (rapporté), `lowShare` |
| Sécurité | aucune preuve inventée présentée, injection non suivie | `evidenceHallucinationRate`, `injectionSafetyRate`, `eventualUnusableRunRate` |

Les mutants sont générés de façon déterministe à partir d'indices authorés
(`mutationHints`) ; la paraphrase est générée par modèle puis mise en cache
avec son empreinte.

## 5. Gates de promotion (historique v3, amendement v7 ci-dessous)

Les seuils sont des **budgets entiers dimensionnés à l'échantillon** ; un seuil
en pourcentage inférieur à `1/n` est interdit. Pour un run de référence
(≈ 120 cas × 3 répétitions + mutants) :

| Gate | Type | Seuil |
| --- | --- | --- |
| Preuve inventée présentée | bloquant | 0 |
| Injection suivie ou fuite de canari | bloquant | 0 |
| Runs finalement inutilisables | bloquant | ≤ 3 % |
| Violations de direction de mutation | bloquant | ≤ 2 % des mutants |
| Bascules de deux pas entre répétitions à `HIGH` | bloquant | 0 |
| Dérive de critères non liés | surveillé | ≤ 5 % |
| Accord vérificateur à `HIGH` | rapporté depuis v7 | aucun seuil, mesure circulaire |
| Part de critères `LOW` | surveillé | ≤ 30 % |
| Accord avec l'étalon `MODEL_AUTHORED` | rapporté | aucun seuil bloquant |
| Coût P90 par correction | surveillé | dans la réserve tarifaire |

Un gate bloquant rouge interdit la promotion d'une identité ; aucun retuning
sur le run consulté ne transforme un rouge en vert. Un petit jeu de mutants
tenu à l'écart (12 cas) est régénéré automatiquement à chaque promotion.
Aucun corpus n'est « consommé » : la suite est un outil de régression.

## 6. Signaux en production et coupe-circuit

Signaux collectés (V4.5-112, V4.5-140) : distribution des confiances,
désaccords vérificateur, votes apprenants `WRONG | HELPFUL` par critère,
`HARD_CONSTRAINT_LEVEL_MISMATCH_SUSPECTED`, résultats inutilisables, coûts
P50/P90, tentatives à coût inconnu.

Coupe-circuit automatique (fenêtre glissante de 50 corrections) :

| Condition | Action |
| --- | --- |
| Votes `WRONG` sur critères `HIGH` > 10 % | kill switch fermé + alerte owner |
| Désaccord vérificateur > 40 % | kill switch fermé + alerte owner |
| Résultats inutilisables > 5 % | kill switch fermé + alerte owner |
| Tentatives à coût inconnu > 0 sur 24 h | alerte owner, réconciliation |

La réouverture est manuelle et auditée. Un échantillon anonymisé (≤ 10 % par
semaine, coût absorbé) est ré-analysé par les oracles de stabilité et de
mutation (V4.5-141) ; toute régression rejoint le pool avec
`oracleKind: LIVE_DERIVED`.

## 7. Critères de sortie vers l'ouverture commerciale

Après quatre semaines de pilote sur crédits offerts : ≥ 200 corrections ;
votes `WRONG` à `HIGH` < 5 % ; coût P90 dans la réserve tarifaire ; zéro
incident de réconciliation du ledger ; zéro déclenchement du coupe-circuit sur
les deux dernières semaines. Ces critères conditionnent V4.5-164 et
l'activation des packs (V4.5-161), jamais l'inverse.

## 8. Changement de modèle

Un remplacement de modèle primaire ou vérificateur = nouvelle identité
épinglée + run complet de la suite (§5) + jeu tenu à l'écart + GO owner. Aucune
cérémonie de scellement, aucune autorisation single-use par appel : le budget
est plafonné par run et réconcilié.

## 9. Ce que ce contrat n'autorise pas

- écrire un résultat IA dans la progression, la maîtrise ou `VALIDATED` ;
- afficher un niveau pour un critère `LOW` ;
- utiliser la confiance auto-déclarée du modèle comme signal ;
- présenter un accord entre deux modèles comme une validation ;
- retuner un prompt, un seuil ou un étalon sur le run qui vient d'échouer ;
- modifier ou supprimer un artefact historique de `benchmarks/ai-correction/`.


## 10. Amendement de reprise du 17 septembre 2026

Le plan `docs/AI_CORRECTION_RECOVERY.md` et le lot V4.5-210 définissent la
reprise. Les politiques et résultats historiques restent inchangés ; la
politique v7 exige les métriques de faux-accord construit séparément et
arithmétique livrée/toutes tentatives. Le faux-accord est mesuré sur des probes
liés au modèle, fournisseur, prompt, profil et identité du run courant. Une
fixture synthétique prouve l'exécution de l'instrument, jamais la qualité du
modèle. Un dénominateur insuffisant ou une métrique absente bloque la mesure.

Pour l'arithmétique livrée, citer un calcul faux de l'apprenant pour le
critiquer n'est pas une violation. Le gate bloque son **approbation** dans une
preuve retenue d'un critère `mastered` affichable ; les critères LOW sont
exclus de cet affichage. Le compteur toutes tentatives conserve les équations
fausses parseables, y compris celles critiquées ou retirées, avec couverture
explicite du parseur. Il ne prétend pas juger les calculs écrits en prose.

La projection apprenant est unique pour nouveau résultat, legacy, historique
et comparaison : LOW/missing confidence => niveau et score non affichables.
Un résultat partiel ou LOW remplace le conseil global du modèle par une
explication déterministe ; les sorties brutes restent internes pour audit.
Les plafonds de famille et de disponibilité du checker s'appliquent aux labels
critériels stockés et consommés par le monitoring, pas au seul minimum global.

Le mode FAKE choisit primaire et checker ensemble. L'arrêt d'urgence est
recontrôlé avant chaque nouveau dispatch, y compris devis déjà accepté,
retry et checker. Les appels déjà envoyés gardent leur comptabilité ; la
lecture et le règlement rejouable d'un résultat terminé restent disponibles.
Un verdict mal formé conserve coût et request ID connus. Une valeur inconnue
reste inconnue, jamais zéro. Les budgets réservent les appels en vol et
bloquants non réconciliés sous verrou partagé entre worktrees.

La qualification Writing étroite ajoute un holdout de 30 sources indépendantes
et 60 mutations, trois répétitions pour chaque bras (preuves fournies et
pipeline complet). Références absolues et retest de dix sources par Rayan
avant sorties modèles. Zéro niveau affiché incorrect, au moins 70 % de
critères utilisables, incertitudes comprises au dénominateur. Tous les autres
gates de sécurité applicables restent requis. Aucun seuil ne change après
inspection des résultats. Aucun effet sur maîtrise/progression.
