# Rapport du benchmark des modèles de correction IA

- **Ticket** : V4-003
- **Statut** : NO-GO — aucun candidat ne satisfait encore tous les seuils
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

## Verdict et actions requises

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
