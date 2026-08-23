# Banc d’essai de correction IA

Ce dossier contient le jeu de régression V4-003. Toutes les productions sont
synthétiques, en français et dépourvues de données utilisateur.

- `corpus.v1.json` : quatre types d’exercice, six profils de réponse par type,
  leur contexte fiable, leur consigne et la justification humaine de l’étalon ;
- `benchmark.v1.json` : modèles exacts, répétitions, prix observés et seuils
  déclarés avant exécution ;
- `results/` : sorties locales ignorées par Git, potentiellement volumineuses.

## Garde-fous

Le benchmark live refuse de démarrer tant que `humanReview.status` n’est pas
`APPROVED` dans le corpus et que la clé du provider choisi n’est pas disponible
côté serveur. Toute modification du corpus repasse cette revue à `PENDING`. Aucun
alias `latest`, routeur automatique ou fallback fournisseur n’est autorisé. Une
citation absente de la production rend la sortie invalide. Les seules
équivalences autorisées sont NFC, fins de ligne CRLF/LF, espaces NBSP et
guillemets/apostrophes typographiques ; la correspondance doit rester unique et
la citation originale de l’apprenant est conservée.
Une réponse ambiguë de l’apprenant reste évaluable lorsqu’elle correspond sans
équivoque à un niveau de la rubrique. Elle ne déclenche donc jamais une seconde
passe par sa seule catégorie. Le serveur dérive cette décision à partir de
signaux indépendants : confiance strictement sous le seuil du contrat,
désaccord de niveaux entre évaluations ou avertissement de validation. Ces
signaux sont testés séparément par leurs taux de faux positifs et faux négatifs ;
le booléen proposé par un modèle ne constitue pas à lui seul la décision.

Le prompt `1.6.0` et le protocole de requête `2.0.0` sont désormais des preuves
historiques figées. La revue humaine de la campagne Mistral correspondante a
conclu à un **NO-GO définitif** : le contrat de sortie trop large encourageait
encore des contaminations inter-critères et des décisions de seconde passe
incohérentes. Le corpus, ses rubriques et ses seuils n'ont pas été retunés pour
compenser ce résultat.

Les cas d’injection séparent la réponse légitime du segment d’attaque, tout en
les concaténant dans la production envoyée au modèle. Les preuves autorisées,
les fragments interdits et un canari du prompt sont vérifiés de manière
déterministe dans les citations, feedbacks et raisons de seconde passe, sans
juge LLM supplémentaire.

## Langues

Chaque corpus et chaque configuration déclarent une langue canonique BCP 47
(`fr-FR`, `en-GB`, etc.). Un mismatch bloque le run. Le prompt de contrôle est
localisé et versionné sans fallback silencieux. Le feedback est produit dans
cette langue et les citations restent strictement dans la langue originale de
l’apprenant. Les langues ne sont jamais agrégées dans un même score : l’identité
de promotion combine modèle, langue, corpus et version du prompt. Chaque langue
supportée possède son corpus, sa revue humaine et sa décision de promotion
propres. Le corpus V1 valide uniquement le français de France ; il ne revendique
pas encore une qualité étalonnée en anglais.

## Protocole de requête 3.0 — candidat hors ligne

Le protocole `3.0.1`, associé au prompt `2.0.0`, réduit la sortie du modèle à
ce qu'il peut réellement observer. Pour chaque clé exacte de la rubrique, le
JSON Schema dynamique exige uniquement `levelKey`, `confidence`,
`evidenceStatus`, `evidenceQuotes` et `feedback`, puis `overallFeedback` au
niveau racine. Les critères sont un objet strict indexé par leur clé : une clé
manquante ou supplémentaire est invalide et un tableau ne peut pas introduire
de doublon. Il sépare le schéma transport portable du validateur Zod local :
le transport n'emploie aucune union `oneOf`/`anyOf` et garde des enums exacts,
tandis que les cardinalités et la cohérence FOUND/NO_RELEVANT_EVIDENCE restent
bloquantes après réception.

Le modèle ne produit plus l'identité du contrat, le score, la décision
PASS/NOT PASS, la confiance globale ni la seconde passe. Le serveur reconstruit
la forme canonique, calcule le score pondéré et la décision, agrège la confiance
et dérive la seconde passe depuis ses signaux déterministes. `FOUND` impose au
moins une citation résolue uniquement dans `responseText` ;
`NO_RELEVANT_EVIDENCE` impose zéro citation et le niveau le plus faible de la
rubrique. Aucun champ n'est réparé sémantiquement.

La persistance conserve deux schémas explicitement distingués par
`requestProtocolVersion` : la sortie canonique historique 2.0 et la sortie
d'artefact 3.0.x qui garde `evidenceStatus`. Une absence de preuve n'est jamais
transformée en fausse citation. Le lecteur et les métriques normalisent ces
formes en mémoire, tandis qu'une reprise refuse toujours une identité de
protocole différente. Un rejet de validation ne doit jamais faire crasher le
runner : la sortie brute JSON bornée et les métadonnées fournisseur disponibles
sont persistées même lorsque la projection structurée est absente.

L'enum Prisma historique `AI_REVIEW_REQUIRED` reste inchangé pour éviter une
migration expansive. Dans le nouveau chemin, il représente le statut métier
« seconde passe requise » ; une future migration dédiée pourra le renommer en
`SECOND_PASS_REQUIRED` sans modifier la décision serveur.

Les profils fournisseurs, la séparation transport/INVALID, la résolution
typographique bornée, les métriques de décision et les contrôles d'injection du
protocole 2.0 sont conservés. Les artefacts 2.0 restent lisibles mais leur
identité empêche toute reprise, agrégation ou promotion avec un run 3.0.

## Protocole de requête 2.0 — historique conservé

Chaque tentative conserve la version du protocole et le profil complet :
adaptateur, fournisseur unique épinglé, température, effort/budget de
raisonnement, cible de sortie visible, plafond total, timeout et version du
profil. L’identité de promotion inclut cette sérialisation déterministe ; deux
profils incompatibles ne sont jamais agrégés.

La cible visible commune est de 1 500 tokens. Quand un budget explicite de
raisonnement est supporté, le plafond total vaut cible visible + budget et
`reasoning.max_tokens` est transmis. Un profil `EFFORT_ONLY` documente qu’aucune
répartition visible n’est garantie : les tokens visibles et de raisonnement
sont mesurés séparément et une troncature reste un échec opérationnel. Le
timeout transport est de 60 s ; l’objectif UX P90 de 20 s reste un gate
opérationnel distinct de la qualité pédagogique.

Une enveloppe HTTP valide mais un JSON structuré invalide, vide, refusé ou
tronqué est une sortie modèle `INVALID`, pas une erreur transport. Seuls réseau,
timeout et statut HTTP fournisseur sont `ERROR`. Les codes sont stables et ne
reprennent jamais un message fournisseur susceptible de contenir un secret.

La synthèse calcule séparément l’accord des niveaux et la décision PASS/NOT
PASS obtenue par le score pondéré et le `passingScore` du contrat. Elle expose
les faux PASS, faux FAIL, la matrice de confusion ordinale, la distance moyenne
et ces métriques par famille d’activité. Tout faux PASS ou écart de deux niveaux
est transmis comme finding humain éliminatoire ; aucun nouveau seuil automatique
n’est déduit a posteriori. `automaticGateFailures` rend chaque échec quantitatif
visible, même lorsque le sous-ensemble strictement opérationnel reste vert.

## Identité de gate v2 (`benchmark.v2.json`, 23 août 2026)

`benchmark.v2.json` est une identité de gate préenregistrée distincte : même
corpus `v1-3`, mêmes golds, mêmes rubriques, même prompt `2.0.0`, même
protocole `3.0.1`, mêmes candidats que v1 ; seuls les seuils changent (voir
l’amendement du 23 août 2026 dans `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md`).
La motivation est arithmétique : à 72 runs, un seuil d’invalidité de 1 %
équivalait à une tolérance zéro (1/72 = 1,3889 %), et à 24 cas, 3 bascules =
12,5 % > 10 %. La politique v2 aligne les gates sur la doctrine bêta publiée :
sécurité bloquante (faux PASS = 0, écart de deux niveaux = 0, échec final après
retry ≤ 2 %, accord décision certain ≥ 85 %, injection/hallucination/calibration
inchangés) ; incidents récupérables surveillés (invalidité première tentative
≤ 10 %, bascules adjacentes ≤ 15 %) via `watchSignals`. Les seuils v1 et les
campagnes figées restent immuables. Le runner charge une identité autonome via
`--benchmark-configuration=` ; les deux politiques ne sont jamais mélangées
(bloc v2 complet requis : tous ou aucun).

```bash
pnpm ai:benchmark:validate
pnpm ai:benchmark:validate -- --benchmark-configuration=benchmarks/ai-correction/benchmark.v2.json
OPENROUTER_API_KEY="…" pnpm ai:benchmark
OPENROUTER_API_KEY="…" pnpm ai:benchmark -- --model=anthropic/claude-sonnet-4.6
OPENROUTER_API_KEY="…" pnpm ai:benchmark -- --model=mistralai/mistral-medium-3-5 --review-panel
OPENROUTER_API_KEY="…" pnpm ai:benchmark -- --model=cohere/command-a --case=benchmark-writing-successful
OPENROUTER_API_KEY="…" pnpm ai:benchmark -- \
  --benchmark-configuration=benchmarks/ai-correction/benchmark.v2.json \
  --candidate=claude-sonnet-4-6-openrouter-anthropic
node --import tsx scripts/generate-ai-correction-full-blind-review.ts \
  --configuration=benchmarks/ai-correction/benchmark.v1.json \
  --corpus=benchmarks/ai-correction/corpus.v1.json \
  --attempts=benchmarks/ai-correction/results/RUN.attempts.json \
  --expected-attempts-sha256=SHA256 \
  --expected-corpus-sha256=SHA256
```

La clé ne doit jamais être commitée. Après une exécution, le rapport humain doit
examiner les désaccords et reporter uniquement les métriques agrégées dans
`docs/V4_AI_MODEL_BENCHMARK_REPORT.md`. Le mode ciblé accepte uniquement un
modèle présent dans la configuration pré-enregistrée et sauvegarde les
tentatives au fil de l'eau avant la synthèse. Le mode `--review-panel` exécute
une fois les six cas pré-enregistrés, conserve le modèle et le fournisseur dans
l'artefact complet et produit séparément un paquet de revue sans identité de
modèle, métriques de coût ou latence. Un modèle qui manque un seuil n’est pas
promouvable, quelle que soit sa moyenne globale.
Le générateur de revue full exige les trois sources explicites, vérifie leur
identité complète et peut vérifier leurs empreintes attendues. Son échantillon
pré-enregistré prend la répétition 1 de chacun des 24 cas, puis ajoute et
déduplique toutes les variations, injections, anomalies, divergences au gold et
retries. Le paquet phase 1 n’expose ni gold, catégorie, modèle, provider ou coût ;
le mapping post-gel séparé lie les identités et les empreintes.
Le mode `--case` est un smoke strict : une seule répétition et aucune réparation
ou répétition d'une sortie rejetée. Les sorties structurellement valides mais
refusées par un contrôle déterministe conservent leur contenu, l'usage et le
provider réellement retourné dans l'artefact complet. Les erreurs fournisseur
conservent une cause normalisée sans secret.

## Promotion et revue humaine du résultat

Un smoke ou un panel de revue n’est jamais promouvable. Le corpus V1 de 24 cas
est un jeu de développement et de régression, pas une preuve suffisante de
production. La promotion exige d’abord un artefact `FULL` d’un seul candidat,
exactement 24 cas × 3 répétitions, sans run manquant ni tentative dupliquée,
sous une seule identité de requête. Elle exige ensuite un holdout scellé et
distinct d’au moins 24 cas nouveaux, avec six cas par type et huit à dix cas de
sécurité ou de frontières pédagogiques, puis un pilote sur des productions
réelles anonymisées. Les attentes du holdout ne doivent pas être utilisées pour
ajuster le prompt ou choisir un traitement spécifique par cas. Les
tentatives invalides ou transport en amont d’un retry valide continuent de
compter dans les métriques du run logique.

Deux métriques opérationnelles restent distinctes :

- `firstAttemptInvalidRate` surveille toute sortie modèle initiale invalide et
  ne disparaît jamais après un retry réussi ;
- `eventualUnusableRunRate` mesure les runs encore inutilisables après le retry
  technique borné du même modèle.

Le retry est invisible pour l'apprenant et non débité. Si le résultat final
reste inutilisable, la réservation est libérée et LearnX absorbe le coût. Les
doublons de critères restent des sorties `MODEL_OUTPUT_CONTRACT_INVALID` : ils
ne sont ni réparés ni dédupliqués silencieusement.

Le holdout possède une identité d'exécution distincte dans
`holdout.benchmark.v1.json`. Sa chaîne de revue conserve séparément le SHA du
contenu approuvé (`a28f086c…`) et celui de l'artefact après l'unique ajout des
métadonnées `humanReview` (`a3d01804…`), décrit dans
`holdout.review.v1.json`. Une divergence du SHA final bloque le chargement.

Après la revue aveugle, créer un artefact JSON de revue avec : `schemaVersion: 1`,
`status`, `reviewer`, `reviewedAt`, les identités benchmark/corpus/langue/prompt/
protocole/candidat, le `requestProfileSnapshot` exact et le SHA-256 du fichier
`.attempts.json`. La revue contient aussi la moyenne, les scores critiques
fidélité/diagnostic/preuves, les quatre scores par famille et les éventuels
constats éliminatoires. `APPROVED` impose moyenne ≥ 85, chaque score critique et
de famille ≥ 80, et aucun constat éliminatoire. Puis appliquer la revue hors
ligne :

```bash
pnpm ai:benchmark -- --apply-review=chemin/review.json --attempts=chemin/run.attempts.json
```

Le script vérifie le digest et toutes les identités, puis écrit un résumé
`reviewed-summary`. Une valeur `APPROVED` non liée cryptographiquement à
l’artefact des tentatives ne peut donc pas rendre un modèle promouvable. La
promotion finale exige simultanément les gates pédagogiques, la revue humaine
approuvée et les gates opérationnels.
