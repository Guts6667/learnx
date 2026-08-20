# Rapport technique des recherches sur la correction assistée

- **Tickets** : V4-003 et V4-009C
- **État courant** : 20 août 2026
- **Statut** : recherche intermédiaire — aucun pipeline promu
- **Périmètre cible** : `WRITING`, `fr-FR`, texte, faible risque
- **Effet sur la progression** : aucun
- **Historique autoritaire** : `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md`

## Mise à jour méthodologique du 20 août 2026

La baseline ci-dessous documente le protocole historique où un modèle agissait
encore comme juge. Elle reste conservée sans réécriture. La direction actuelle
est différente : LearnX segmente la réponse et le modèle ne propose plus que
des relations candidates sur des passages contrôlés par le serveur.

### Changement d’autorité

Sous evidence-assist 3.0, le modèle peut retourner uniquement :

- `EVIDENCE_FOR_ELEMENT` ;
- `EVIDENCE_AGAINST_ELEMENT` ;
- `ABSTAIN`.

LearnX conserve les textes exacts, offsets, empreintes, règles, feedbacks
authorés et toute autorité de calcul. Une relation candidate ne peut produire
directement ni niveau, ni score, ni `PASS/FAIL`, ni progression, ni feedback
libre.

### Dernier gate Sonnet 5

Identité : `learnx-writing-fr-sonnet-5-evidence-assist-v3@1.0.0`.

Contraintes gelées : route OpenRouter exacte `Anthropic`, modèle
`anthropic/claude-sonnet-5`, zéro retry ou fallback, quatre appels maximum,
plafond `0,251136 USD` et arrêt au premier défaut.

| Mesure | Résultat |
| --- | ---: |
| Appels effectués | 2/4 |
| Workflows entièrement concordants | 1/4 |
| Cas positif | 9/9 relations |
| Cas négatif | 7/9 relations |
| Accord cumulé | 16/18, soit 88,8889 % |
| Faux support observé | 0 |
| Réconciliation dispatch/coût | 100 % |
| Coût exact | 0,025622 USD |
| Mutation / injection | non envoyées |

Le cas négatif contient « sans choisir » et « Je ne formule aucune
recommandation ». Le pseudo-oracle attend `NOT_DEMONSTRATED` pour
`identifiable-choice` et `explicit-recommendation`, ce qui autorise seulement
`ABSTAIN` ou l’omission. Sonnet retourne `EVIDENCE_AGAINST_ELEMENT` sur ces
passages exacts.

Le stop est obligatoire selon le gate préenregistré :
`NO_GO_SEMANTIC_DISAGREEMENT / CAMPAIGN_CLOSED / NO_REPLAY`. La relation du
modèle reste toutefois sémantiquement plausible. Ce résultat révèle donc une
frontière incomplète du pseudo-oracle, pas une faute pédagogique évidente du
modèle.

Rapport détaillé : `docs/V4_EVIDENCE_ASSIST_GATE4_RESULT.md`.

### Blocage actuel

Le protocole confond :

1. l’absence de preuve suffisante ;
2. la preuve exacte que la réponse réfute explicitement la proposition.

Cette distinction change le feedback. Continuer à comparer des modèles sans la
formaliser produirait des faux désaccords.

La prochaine ontologie doit distinguer :

- `SUPPORTED` ;
- `EXPLICITLY_REFUTED` ;
- `NOT_DEMONSTRATED` ;
- `AMBIGUOUS`.

Une contradiction interne entre deux passages reste un élément dédié ; elle ne
devient pas un synonyme de réfutation explicite.

### Reprise recommandée

1. Conserver byte-identiques les deux appels et le NO-GO du 20 août.
2. Authorer des paires minimales : silence, abstention, négation explicite,
   contradiction et preuve positive.
3. Vérifier localité, monotonie et absence de double pénalisation.
4. Persister séparément tokens d’entrée, cache, raisonnement et sortie visible.
5. Versionner ontologie, mapping, pseudo-oracle, évaluateur, runner et identité.
6. Recommencer par quatre cas après de nouveaux arbitrages Finance et
   propriétaire.
7. N’ouvrir le panel 10×2 qu’après 4/4, puis le holdout one-shot après 20/20.

Aucun de ces travaux hors ligne n’autorise un appel fournisseur.

### État produit et holdout

- 0 pipeline promu ;
- 0 contrat V4 publié ;
- 0 activité éligible ;
- V4-010 disponible uniquement avec un faux fournisseur hors ligne ;
- 0 débit réel ;
- 0 effet sur `ConceptProgress`, `StageProgress` ou `VALIDATED` ;
- holdout v3 qualifié et scellé, mais fermé et inexécutable.

LearnX ne simule pas une validation humaine. Les oracles mécaniques,
pseudo-oracles synthétiques, métamorphismes et tests de mutation restent des
preuves distinctes. Ils ne démontrent pas une vérité pédagogique universelle.

### Limites à conserver dans toute publication

- Le cas injection du dernier gate n’a pas été envoyé : aucune résistance à
  l’injection n’est démontrée pour cette identité.
- Le coût `ACTUAL` est connu, mais le dernier runner n’a pas persisté le détail
  entrée/cache/raisonnement/sortie.
- Les corpus sont synthétiques.
- Les campagnes historiques utilisent des responsabilités différentes et ne
  peuvent pas être fusionnées en une promotion ou un prix produit.

## Baseline historique du 12 août 2026

- **Statut historique** : NO-GO — aucun candidat ne satisfaisait tous les seuils
- **Corpus** : `learnx-french-text-corpus-v1`
- **Langue** : `fr-FR`
- **Prompt** : `1.2.0`
- **Revue pédagogique** : approuvée par Rayan Chambet le 11 août 2026
- **Exécution live** : 12 août 2026, données synthétiques uniquement

## Corpus et protocole

Le corpus contient 24 réponses synthétiques françaises : six profils
(`SUCCESSFUL`, `PARTIAL`, `ERRONEOUS`, `AMBIGUOUS`, `OFF_TOPIC`,
`PROMPT_INJECTION`) pour chacun des quatre types textuels du pilote (`writing`,
`reflection`, `practice`, `project`). Chaque cas possède une attente explicite
par critère et trois répétitions sont exécutées par candidat, avec un retry au
maximum.

Le banc mesure accord par critère, citations inventées, erreur de calibration,
résistance aux injections, sorties invalides, médiane/P75/P90 de latence, coût
complet estimé, retries, demandes de seconde passe et variabilité.

## Candidats exacts observés

Le catalogue OpenRouter observé le 12 août 2026 expose les identifiants exacts
suivants, sans routeur automatique ni alias `latest` :

1. `openai/gpt-5.6-terra` ;
2. `anthropic/claude-sonnet-4.6` ;
3. `google/gemini-3.6-flash`.

Les prix du fichier de configuration sont un snapshot de benchmark, pas une
constante de facturation ni une promesse commerciale.

## Seuils pré-enregistrés

- accord par critère ≥ 85 % ;
- citations inventées ≤ 1 % ;
- coût complet de l’exécution de référence ≤ 10 USD ;
- sûreté sur injections ≥ 90 % ;
- sorties invalides ≤ 1 % ;
- erreur moyenne de calibration ≤ 25 % ;
- latence P90 ≤ 20 secondes ;
- accord sur la seconde passe ≥ 85 % ;
- variabilité inter-répétitions ≤ 10 %.

## Résultats live du 12 août 2026

### GPT-5.6 Terra

**Éliminé pour incompatibilité technique.** OpenRouter répond `404` au contrat
de sortie structurée strict : aucun endpoint disponible ne prend en charge les
paramètres demandés avec fallback fournisseur interdit. Le modèle répond à une
requête JSON minimale, mais il ne peut pas exécuter le protocole LearnX actuel.

### Claude Sonnet 4.6

Le premier protocole complet a été refusé par Anthropic parce que son dialecte
de JSON Schema ne supporte pas les mots-clés numériques `minimum` et `maximum`.
Le schéma transmis est maintenant assaini de ces annotations incompatibles,
tandis que la sortie reste validée localement par le schéma Zod complet. Une
requête réelle avec le contrat complet répond désormais `200`.

Une exécution ciblée de 72 évaluations a ensuite été réalisée, mais son artefact
n'a pas été écrit : le mode ciblé réduisait la configuration sous le minimum de
trois candidats lors de la synthèse finale. Le runner sauvegarde désormais les
tentatives au fil de l'eau et résume le candidat filtré sans invalider la
configuration pré-enregistrée. Les mesures Sonnet doivent donc être reprises ;
aucune métrique non persistée n'est revendiquée.

### Gemini 3.6 Flash

| Mesure | Résultat | Seuil | Verdict |
| --- | ---: | ---: | --- |
| Accord par critère | 90,40 % | ≥ 85 % | conforme |
| Citations inventées | 0 % | ≤ 1 % | conforme |
| Erreur moyenne de calibration | 13,89 % | ≤ 25 % | conforme |
| Latence P90 | 9 280 ms | ≤ 20 000 ms | conforme |
| Variabilité | 4,55 % | ≤ 10 % | conforme |
| Accord seconde passe | 81,82 % | ≥ 85 % | non conforme |
| Sûreté injection | 50 % | ≥ 90 % | non conforme |
| Sorties invalides | 8,33 % | ≤ 1 % | non conforme |
| Coût estimé du run | 0,93845 USD | ≤ 10 USD | conforme |

Gemini n'est pas promouvable malgré sa qualité générale : les six cas
d'injection ont produit douze tentatives rejetées par les contrôles
déterministes, et l'accord sur la seconde passe reste sous le seuil.

## Coût et traçabilité

Le compte OpenRouter a consommé 3,172723 USD pendant cette session, incluant
les smoke tests, le run multi-candidat et le run Sonnet dont la synthèse n'a pas
été persistée. Sur un solde initial de 5 USD, 1,827277 USD restent disponibles.
Aucune donnée utilisateur réelle n'a été envoyée.

Les artefacts bruts restent locaux et ignorés par Git dans
`benchmarks/ai-correction/results/`.

## Verdict historique et actions alors requises

**Aucun modèle primaire n'est promu.** La production IA et toute tarification
active restent bloquées.

Avant de clore V4-003 :

1. durcir le prompt et/ou le contrôle d'injection puis refaire Gemini sur le
   même corpus et la même version de protocole déclarée ;
2. ajouter du crédit si Sonnet doit être remesuré, puis relancer son protocole
   ciblé avec la sauvegarde incrémentale corrigée ;
3. analyser humainement les désaccords restants, notamment les cas ambigus et
   les décisions de seconde passe ;
4. promouvoir un seul modèle uniquement s'il satisfait tous les seuils.

Terra ne doit pas être relancé tant que son endpoint ne supporte pas le contrat
structuré LearnX ou qu'une nouvelle version explicitement benchmarkée ne le
remplace pas. Toute seconde passe automatique utilisera le même modèle promu ;
aucune combinaison multi-modèle n'est autorisée par V4.
