# Roadmap V4 — vue de pilotage LearnX

## Objet et autorité

Cette page est le **registre humain unique de progression V4**. Elle répond à
six questions : qu'est-ce qui est intégré, qu'est-ce qui existe seulement sur
une branche locale, qu'est-ce qui a seulement une valeur expérimentale,
qu'est-ce qui est actif pour un utilisateur, quel ticket peut reprendre et quel
gate le ferme.

- `BACKLOG_V4.md` reste l'autorité détaillée des périmètres, dépendances et
  critères d'acceptation ; il ne porte pas un second registre de statut.
- `docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json` est l'état machine courant de
  la recherche IA et doit refléter le présent registre.
- `docs/V4_AI_CORRECTION_PHASE_MANIFEST.json` reste l'autorité historique
  épinglée par les campagnes closes.
- `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` reste l'historique append-only.
- `docs/V4_TOTEM_DESIGN_IMPLEMENTATION_PLAN.md` est l'autorité du langage
  visuel Totem et de sa file ; son statut `DESIGN_VALIDATED` n'autorise aucun
  code applicatif à lui seul.
- `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md` reste l'autorité active du core à
  passages déterministes ; les identités et résultats Sonnet sont historiques ;
  `docs/V4_EVIDENCE_SEMANTIC_ARBITRATION.md` régit le successeur hors ligne.
- Cette roadmap ne transforme jamais une preuve expérimentale en livraison
  produit.
- En cas d'écart sur le statut courant, cette page tranche pour la lecture
  humaine et le manifeste V3 tranche pour l'automatisation. L'écart doit alors
  être corrigé dans le même ticket documentaire.

Dernière consolidation : 22 août 2026.

## File design Totem — validée, non lancée

La direction Totem est validée et le backlog est prêt. Elle ne change pas le
point de reprise IA : le gate Gemini 3.6 `V4-003E-Q1` est clos après `1/4`
appel sur HTTP 400 fournisseur. Son autorisation single-use est consommée ; le
coût réel reste inconnu et la réserve `0,1208415 USD` doit être réconciliée
avant toute nouvelle décision.
La file design attend un GO d'implémentation distinct par lot.

| Ordre | Lot | Statut | Dépendance principale |
| --- | --- | --- | --- |
| 1 | V4-016D Fondations | `IMPLEMENTED_QA_GREEN_PENDING_PUSH` | Revue propriétaire et intégration |
| 2 | V4-016E Primitives | `IMPLEMENTED_QA_GREEN_PENDING_PUSH` | Intégrer après V4-016D |
| 3–7 | V4-016C/F/A/I/B Surfaces | `DESIGN_VALIDATED_WAIT_GO` | V4-016D/E et contrats de chaque surface |
| 8 | V4-016G Correction/finance | `DESIGN_VALIDATED_CONTRACTS_PENDING` | V4-007/010/012/014 |
| 9 | V4-016 Annonce V5 | `DESIGN_VALIDATED_WAIT_GO` | V4-016D/E et promesse validée |
| 10 | V4-016H QA/rollout | `WAIT_PREVIOUS_LOTS` | Tous les lots activés |

Totem supersède Atlas pour palette, typographie et nouveaux composants. Le
contrat émotionnel Atlas et tous les contrats produit restent actifs.

## Plans d'état à ne pas confondre

| Plan | État au 22 août 2026 | Ce que cela prouve | Ce que cela ne prouve pas |
| --- | --- | --- | --- |
| Baseline Git auditée | `origin/dev@f6607b9` au démarrage du worktree `codex/ai-correction-unblock` | Fondations V4-001 à V4-010, protocole evidence-assist 3.0.0, fake-flow hors ligne, preuve S2, analyse V4-003E et préflight Q1 intégrés avant reprise des deux commits Q1 locaux. | Le lot de déblocage et les deux commits Q1 repris restent à relire et intégrer séparément ; aucun contrat publié, débit utilisateur réel ou accès apprenant. |
| Gate V4-003E-Q1 | worktree isolé depuis `origin/dev@f6607b9` | Autorisation Gemini `ef88a8e3…` consommée ; `1/4` appel envoyé, HTTP 400, raw et ledger vérifiés, aucun retry/fallback. | `0/1` utilisable ; coût et identifiant fournisseur absents, `RECONCILIATION_REQUIRED`; aucun verdict pédagogique. |
| Produit publié | `origin/main` à `f612e53` | SourceLab V2 et le journal public de recherche sont publiés sur la branche de production. | `main` ne contient pas encore la baseline V4 de `dev` ; ces branches ne doivent pas être fusionnées ou réinitialisées en bloc. |
| Implémentation hors ligne | intégrée dans `origin/dev` | Segmenter, contexte, raw, schéma candidate-only, runner durci, contrat pilote DRAFT, holdout qualifié/scellé et fake-flow testés sous hard-off. | Ni qualité d'un modèle réel, ni ouverture du holdout, ni disponibilité utilisateur de la correction. |
| Expérimentation | `GEMINI_3_6_NO_GO_TECHNICAL_RECONCILIATION_REQUIRED` | Le gate Gemini a envoyé exactement `1/4` appel puis s'est arrêté sur HTTP 400 ; les trois autres appels n'ont pas été envoyés. | Aucun jugement pédagogique, aucune promotion ; coût non réconcilié, panel et holdout fermés. |
| Produit live | `HARD_OFF` | 0 contrat publié, 0 activité éligible, 0 débit réel. | Aucun apprenant ne dispose encore d'une correction V4. |
| Release externe | `V3_5_EXTERNAL_RELEASE_ASSURANCE_OPEN` | La V3.5 a un GO technique documenté. | Son rapport n'atteste toujours ni clôture officielle, ni iPhone/VoiceOver réel, ni smoke authentifié post-promotion. |

Le dernier plan est indépendant de l'évaluation autonome des modèles : il ne
réintroduit pas d'évaluateur humain dans la correction IA. Il bloque en
revanche toute affirmation de **clôture de release V4** tant que le rapport V3.5
n'est pas réconcilié avec une preuve de promotion et ses contrôles externes.

## Légende du registre

| Statut | Signification |
| --- | --- |
| `LIVRÉ_INACTIF` | Fondation ou preuve close disponible, sans activation utilisateur ; aucun nouveau travail sauf intégration explicitement citée. |
| `ACTIF_HORS_LIGNE` | Le ticket peut reprendre maintenant sous hard-off, sans réseau, débit, publication ni promesse live. |
| `BLOQUÉ` | Le ticket ou sa prochaine tranche ne doit pas démarrer avant le gate indiqué. |

`Historique` et `local non intégré` sont des niveaux de preuve, pas des
statuts de progression concurrents.

## Résumé exécutif

V4 n'est plus au stade de la conception générale : ledger, réconciliation,
adaptateurs, moteur de rubrique et outillage expérimental existent. En revanche,
la correction IA n'est pas encore une fonctionnalité de l'application.

Le chemin critique est désormais très étroit :

1. préserver le gate Q1 et ses artefacts append-only sans réinterpréter le coût
   inconnu comme zéro ;
2. réconcilier le coût fournisseur et diagnostiquer hors ligne l'argument refusé
   sans attribuer de cause non prouvée ; la procédure append-only est
   `docs/V4_003E_Q1_GEMINI_3_6_COST_RECONCILIATION.md`, avec nouvelle tentative
   Activity à partir du 23 août UTC ;
3. si une correction de payload est proposée, créer une nouvelle identité et
   obtenir de nouveaux arbitrages avant tout appel ; le panel 10 × 2 reste fermé ;
4. publier une rubrique `WRITING/fr-FR` réellement exécutable ;
5. remplacer le fake provider du flow apprenant sous feature flag et mesurer
   qualité/coûts réels ;
6. seulement ensuite activer tarification, paiement et extension.

État honnête : **0 contrat V4 publié, 0 activité éligible, aucun pipeline promu,
V4-010 branché uniquement sur un fake provider hors ligne et V4-011 fermé.**

### Prochaines actions sans ambiguïté

1. **Intégration** préserve les avancées distinctes de `main` et `dev`, puis
   réconcilie uniquement les commits nécessaires par une branche ou une PR
   dédiée. Aucun pull, merge ou reset global ne doit écraser l'une des deux
   histoires.
2. **Produit & pédagogie avec Développement** conserve
   `EXPLICITLY_REFUTED` comme statut canonique distinct de l'absence, avec le
   même effet de niveau au MVP et un template distinct. La campagne close
   demeure byte-identique et aucun replay n'est permis sous son identité.
3. Le contrat pilote suit
   `docs/V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md`; le Propriétaire arbitre
   l'activité, les critères/templates, puis l'identité gelée.
4. Toute évolution de l'ontologie, du mapping, du gold, de l'évaluateur ou de
   la télémétrie crée une nouvelle identité et exige un nouveau gate quatre cas,
   un nouvel arbitrage Finance et un nouveau GO propriétaire.
5. Le holdout v3 est désormais qualifié et scellé. Il reste fermé et son
   ouverture one-shot demeure un GO ultérieur distinct après les gates de
   développement.

Le gate `V4-009C-S2` et son analyse V4-003E sont clos et intégrés. Le gate
successeur `V4-003E-Q1`, identité Gemini 3.6 `ef88a8e3…`, est lui aussi clos :
exactement `1/4` appel a reçu un HTTP 400 fournisseur, sans retry ni fallback.
Son autorisation est consommée, son coût est en `RECONCILIATION_REQUIRED`, et
il n'a produit aucun workflow utilisable ni verdict pédagogique. Le point de
reprise unique est `V4-003E-Q1-R1`, remédiation Gemini 3.6 hors ligne sous une
nouvelle identité. R1 `00cd27d8…` est désormais gelée et validée en fake-only.
Aucun replay, appel modèle, publication de contrat ni branchement live n'est
autorisé avant réconciliation Q1, nouvel arbitrage Finance et nouveau GO Rayan.
`V4-002C`
est clos hors ligne : le schéma, le compilateur, le certificat v2 et leurs tests
sont disponibles. `V4-002B` reste
clos par l'arbitrage `Rayan B` du 21 août 2026 et `V4-002A` par `Rayan A`.
V4-010 peut
recevoir de la maintenance de non-régression sous hard-off, mais aucune nouvelle
capacité ne doit y être développée avant le contrat et le pipeline promu. Aucune
de ces actions n'autorise un appel modèle ou un utilisateur.

### File d'exécution active

La file détaillée et ses frontières sont dans `BACKLOG_V4.md`, section
« File P0 assignée ». Le point de reprise unique est :

| Maintenant | Agent | Sortie attendue | Puis |
| --- | --- | --- | --- |
| `V4-002A — Cadrage de l'activité pilote` | `AGENT-PEDAGOGIE` | **Clos** : brief, scénarios et consigne validés | `V4-002B` |
| `V4-002B — Contrat atomique successeur` | `AGENT-PEDAGOGIE` | **Clos** : contrat approuvé par `Rayan B`, non publié | `V4-002C` |
| `V4-002C — Compilateur v2` | `AGENT-DEV-LEARNX` | **Clos hors ligne** : moteur, contrôles statiques, certificat v2 et compatibilité historique validés | `V4-003A` |
| `V4-003A — Corpus mécanique` | `AGENT-METHODOLOGIE` | **Clos hors ligne** : 19 cas, 7 mutations et empreinte canonique reproductibles | `V4-003B` |
| `V4-003B — Audit autonome` | `AGENT-METHODOLOGIE` | **Clos** : `BLOCKED_WITH_FINDINGS`, rapport indépendant disponible | `V4-003A-R1` |
| `V4-003A-R1 — Durcissement oracle` | `AGENT-DEV-LEARNX` | **Clos hors ligne** : oracle v2.1, 33 cas, 7 mutations et contrôles fail-closed | `V4-003B-R1` |
| `V4-003B-R1 — Nouvel audit autonome` | `AGENT-METHODOLOGIE` | **Clos** : `READY_TO_FREEZE`, 0 P0/P1 et P2 non bloquant consigné | `V4-003C` |
| `V4-003C — Gel expérimental` | `AGENT-PROTOCOLE-IA` | **Clos** : dossier exact approuvé par Rayan C | `V4-003D` |
| `V4-003D — Budget` | `AGENT-FINANCE` | **Clos hors ligne** : plafond fournisseur `0,708328 USD`, réseau interdit | `V4-009C-S2` hors ligne |
| `V4-009C-S2 — Gate 4` | `AGENT-DEV-LEARNX` | **Clos NO-GO** : arrêt après `1/4` sur désaccord sémantique, coût `0,018828 USD` ACTUAL, aucun replay | `V4-003E` |
| `V4-003E — Analyse et documentation` | `AGENT-METHODOLOGIE` | **Clos et intégré** : verdict borné à l'identité exacte, limites `n = 1`, comparaison honnête et journal append-only | `V4-003E-Q1` historique |
| `V4-003E-Q1 — Dossier Gemini 3.6` | `AGENT-PROTOCOLE-IA` | **Clos NO-GO technique** : autorisation consommée après `1/4` appel HTTP 400 ; raw/ledger vérifiés, aucun retry/fallback, coût inconnu, aucun pipeline promu | Identité close ; aucun replay |
| `V4-003E-Q1-R1 — Remédiation Gemini 3.6` | `AGENT-PROTOCOLE-IA` | **Gel hors ligne terminé** : identité `00cd27d8…` liée au commit `07d5d809…`, wire `3.0.1`, différentiel conforme et fake preflight `4/4` sous `HARD_OFF` | Réconcilier Q1 ; puis nouvel arbitrage Finance et nouveau GO Rayan avant un canari réseau, jamais par simple présence de clé |

Tout agent recevant un ticket plus bas dans cette table doit refuser de le
démarrer si la sortie et le gate de la ligne précédente ne sont pas présents.

### Point de reprise vérifié le 22 août 2026

- `origin/dev` déploie correctement l'application et les fonctions réelles ;
  qualité, intégration, migrations Neon et seeds sont verts.
- Le fake-flow V4-010 passe les tests de persistance, idempotence, versions,
  permissions, états publics et responsive, mais reste forcé à `OFF` en
  production et ne valide aucun modèle.
- Le dernier gate, identité `cc3b1b52…`, a consommé son autorisation single-use
  puis envoyé `1/4` appel, sans retry/fallback, pour `0,018828 USD` ACTUAL. Il
  s'est arrêté sur l'inversion non ambiguë de `project-b-dimension-scope` ; les
  trois autres cas n'ont pas été envoyés.
- Le runner est revenu en `HARD_OFF`. V4-003E clôt cette identité sans replay ni
  retuning. Le gate du 20 août, identité `cc4dd0df…`, reste une preuve historique
  distincte (`2/4`, `0,025622 USD`) et n'est pas agrégé au résultat courant.
- Le gate Q1 Gemini 3.6 `ef88a8e3…` est clos après `1/4` appel HTTP 400.
  L'autorisation single-use est consommée, le coût reste à réconcilier et
  aucune cause précise ne peut être affirmée depuis le message fournisseur
  générique. `V4-003E-Q1-R1` a isolé hors ligne le payload corrigé sous
  l'identité `00cd27d8…`, avec différentiel et fake preflight sous `HARD_OFF`.
  `pattern` reste une hypothèse ; Finance et GO propres restent absents.
- La qualification et le scellement du holdout v3 ont consommé l'autorisation
  exacte `AUTHORIZE_V4_HOLDOUT_V3_QUALIFICATION_AND_SEAL`. Le paquet demeure
  non exécutable ; cette décision n'autorise ni son ouverture, ni un appel
  modèle.

## Chemin critique

### Gate A — preuve courante et campagnes historiques

Ticket principal : `V4-009C`, avec mesures dans `V4-003`.

**Preuve courante.** Le gate Gemini 3.6 Q1
`ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed`
est clos en `NO-GO_TECHNICAL_PROVIDER_HTTP_400` après exactement `1/4` appel.
Le fournisseur a renvoyé `INVALID_ARGUMENT` avec un message générique ; les
trois autres appels n'ont pas été envoyés. Aucun usage, identifiant fournisseur,
coût réel ou verdict pédagogique n'est disponible. L'autorisation single-use
est consommée, la réserve `0,1208415 USD` reste ouverte et aucun pipeline n'est
promu. Panel, holdout et live restent fermés.

**État R1 et prochaine décision.** Le transport
`evidence-assist-wire/3.0.1` est maintenant implémenté et
testé hors ligne : `pattern` reste dans le validateur Zod LearnX mais est omis
du schéma Gemini, dont les mots-clés sont contrôlés récursivement ; manifeste et
empreintes précèdent `CALL_INTENT`, les métadonnées routeur sont expurgées et
`generationId` reste distinct de `providerRequestId`. Cela isole l'hypothèse
`pattern` sans la prouver et n'a produit aucun appel réseau. Cette correction
crée nécessairement une nouvelle identité Gemini 3.6. L'identité
`00cd27d8fb78682e155595dc17d65b8168edbb7a1b938f2777f56f3d171445d0`
est gelée sur les octets du commit public
`07d5d80978ac1346a78a46e41e6a589439fa564d`. Le différentiel conserve les dix
invariants transport du smoke accepté et observe uniquement les trois écarts
attendus. Le runner passe un fake preflight `4/4` avec quatre exécutions fake,
zéro replay fournisseur et zéro appel réseau/modèle. Un futur gate 4 cas exige
la réconciliation Q1, son propre arbitrage Finance et une nouvelle autorisation
Rayan single-use. Le dossier Q1, son enveloppe et son GO consommé ne sont pas
transférables.

La réattestation publique hors ligne
`benchmarks/ai-correction/executable-rubric/gemini-3-6-google-vertex-attestation-2026-08-22.json`
documente seulement la route, les capacités et les prix observables au 22 août,
avec zéro inférence et zéro appel modèle. Elle n'est ni une nouvelle identité,
ni un arbitrage Finance, ni un GO réseau ; ses prix ne remplacent pas une
nouvelle enveloppe arbitrée.

**Historique non exécutable.** Les éléments ci-dessous expliquent l'évolution
du pipeline. Ils ne sont ni une file active, ni des résultats combinables avec
le gate courant.

- Acquis : moteur exécutable hors ligne, contrôles de citations, coûts et
  dispatch réconciliés, protocoles Gemini 1.1/1.2 archivés comme NO-GO
  techniques.
- Dernière preuve : protocole 1.3, citation exacte unique et offsets/hash
  calculés par LearnX ; smoke positif `VALID` sur un cas évident.
- Limite : le smoke positif ne teste ni réponse négative, ni contradiction, ni
  injection et ne promeut pas Gemini.
- Dernier gate : la campagne distincte 3×1 s'est arrêtée sur le cas négatif.
  Le pseudo-oracle n'était pas assez discriminant pour départager un choix
  implicite ; ce NO-GO formel n'est pas un échec pédagogique démontré du
  modèle. L'injection n'a pas été appelée.
- Gate v2 réussi : trois sorties valides, négatif correctement discriminé et
  injection sûre. Il autorise seulement la préparation du panel 10×2 ; aucune
  nouvelle dépense n'est autorisée.
- Préparation 10×2 historique terminée hors ligne : route demandée et fournisseur observé
  sont séparés, la sélection v2 remplace le seul pseudo-oracle inconclusif sans
  réécrire les corpus historiques, et le runner reste validate-only. Le
  panel v2 clos après 10 workflows valides puis une citation non exacte ; aucun
  appel supplémentaire n'est autorisé sous cette identité.
- Panel Sonnet 5 : arrêté au 11e appel après 10 workflows valides et stables ;
  le profil par défaut a produit 2 500 tokens de raisonnement et aucune sortie
  visible sur le premier cas de mutation. Campagne close, sans reprise.
- Gate borné clos : le premier appel a produit 1 082 tokens de raisonnement
  pour un maximum explicite de 1 024, puis le runner s'est arrêté avant
  validation sémantique. `0/4` workflow est terminé ; le coût réel de
  `0,026104 USD` est réconcilié. C'est un NO-GO technique du profil, sans
  verdict pédagogique sur Sonnet 5.
- Arbitrage adopté : le prochain protocole est evidence-assist à passages
  déterministes. LearnX résout les spans ; le modèle ne propose que des
  relations `EVIDENCE_FOR_ELEMENT`, `EVIDENCE_AGAINST_ELEMENT` ou `ABSTAIN`,
  sans citation libre, niveau, score ou feedback. Ces relations candidates ne
  sont jamais consommées par un calcul mécanique. L'autorité est
  `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`.
- Identifiants épinglés : adapter `OPENROUTER_CHAT`, modèle et ID
  wire `anthropic/claude-sonnet-5`, snapshot catalogue
  `anthropic/claude-sonnet-5-20260630`, route exacte `Anthropic`, fallback
  interdit. Le protocole/prompt est `3.0.0`, le validateur/segmenter `2.0.0` et
  l'empreinte hors ligne est
  `cbbb273979027fc1654a11e68202b5c7aa55876c2019f1262db35d19f9a41c5a`.
  L'identité de campagne est
  `learnx-writing-fr-sonnet-5-evidence-assist-v3@1.0.0`, empreinte
  `cc4dd0df056f6733bdaf9b4ad45e7d001405d869e38ea742271564a0d3b36805`.
- Capacité acquise hors ligne : l'attestation lie la route exacte à
  `reasoning.effort=none` et à un coût `ACTUAL` obligatoire. La route Anthropic
  directe est écartée tant que son coût reste estimé. L'état pré-exécution
  était `OFFLINE_CAMPAIGN_FROZEN / NO_MODEL_CALL`, pas un GO d'appel.
- Acquis hors ligne : runner validate-only, gate quatre cas et panel 10 × 2
  gelés ensemble, zéro résultat historique réutilisé.
- Le plafond prudent `0,251136 USD` du gate quatre cas est arbitré par Finance
  uniquement pour cette identité, quatre appels maximum, zéro retry/fallback.
  Le plafond conditionnel `1,258760 USD` du panel 10 × 2 reste non arbitré. Le
  plafond `0,21 USD` est celui du gate Sonnet borné historique, clos ; il n'est
  pas le plafond evidence-assist et n'est pas transférable.
- Résultat du gate : autorisation HMAC consommée une seule fois, deux appels
  effectués, `0,025622 USD` réconciliés, puis arrêt obligatoire sur
  `SEMANTIC_DISAGREEMENT`. Le cas négatif oppose le gold
  `NOT_DEMONSTRATED` au signal plausible `EVIDENCE_AGAINST_ELEMENT` sur deux
  éléments. Rapport : `docs/V4_EVIDENCE_ASSIST_GATE4_RESULT.md`.
- Clôture historique : campagne `cc4dd0df…` close sans replay. L'arbitrage
  sémantique `EXPLICITLY_REFUTED` a depuis été intégré dans le contrat
  framework-selection. Le panel 10 × 2 de cette ancienne campagne reste
  interdit et ses résultats ne sont pas réutilisés.
- Définition bornée : le **corpus de développement complet** est exactement la
  sélection scellée
  `writing-fr-semantic-development-v2@2.0.0`, soit 10 cas synthétiques distincts
  exécutés deux fois, pour 20 workflows frais. Les quatre workflows de
  faisabilité ne sont pas comptés dans ces 20 et aucun résultat historique
  n'est réutilisé. L'identifiant, le SHA-256, l'ordre et les deux répétitions
  doivent être liés au manifeste de campagne avant le premier appel.
- Toute modification d'un cas, d'une attente, de l'ordre, du nombre de
  répétitions ou de la sélection crée une nouvelle version de corpus, une
  nouvelle identité de campagne et un retour au gate quatre cas.
- La comparaison d'au moins trois candidats devient une phase secondaire de
  robustesse et d'économie, après preuve de faisabilité du prochain pipeline
  exact. Elle ne bloque ni son premier gate 4/4, ni son corpus 10 × 2, ni son
  holdout autonome borné ; elle bloque la calibration économique V4-018 et
  toute généralisation commerciale.
- Le manifeste actif de holdout est
  `benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v3.manifest.json` ;
  ses 24 cas sont qualifiés et scellés en AES-256-GCM, mais il reste fermé et
  inexécutable. Le v2 reste intact comme
  `SUPERSEDED_HISTORICAL_DRAFT`. Le falsificateur, le holdout, la publication
  V4-002 et le live V4-010 restent fermés ; les deux tickets avancent hors ligne.

### Les deux GO autonomes

1. `GO_TO_SEALED_HOLDOUT` ne peut être demandé qu'après `4/4`, puis `20/20`
   sur le corpus de développement complet sous la même identité, tous les
   gates absolus satisfaits et les coûts réconciliés. Il conserve
   `pipelinePromoted=false` et rend seulement éligible la demande d'ouverture
   du holdout v3 déjà scellé. Son ouverture one-shot exige une autorisation
   propriétaire distincte.
2. `GO_AUTONOMOUS_FORMATIVE` ne peut être rendu qu'après succès one-shot du
   holdout sous cette identité, réconciliation complète et absence de retuning
   post-résultat. Il promeut uniquement le pipeline exact pour le feedback
   `WRITING/fr-FR` faible risque. Il autorise la publication V4-002 et la
   préparation du pilote V4-010, jamais son activation automatique.

Un échec ou une modification entre ces gates ferme l'identité. Aucune seconde
ouverture du holdout, approbation humaine fictive ou vote de modèles n'est
admis.

### Gate B — premier contrat publiable

Ticket principal : `V4-002`.

Statut : `ACTIVE_OFFLINE / PUBLICATION_BLOCKED`.

- Cible unique : `WRITING/fr-FR`, texte, faible risque.
- Le contrat doit être `PUBLISHED` et `FULLY_COMPILABLE`.
- Il doit authorer éléments atomiques, propriétaires des pénalités, variantes,
  contre-exemples, contradictions, règles de preuve, ambiguïtés, templates et
  remédiations. Niveaux et pondérations ne sont admis que dans une sous-grille
  mécanique explicite, indépendante des relations IA candidates ; sans constat
  mécanique, score et niveau restent désactivés et nuls.
- Les critères `HOLISTIC` ou non formalisables restent hors MVP autonome.
- La publication reste interdite tant que le compilateur, les tests de mutation
  et le gate autonome ne passent pas.
- Le funnel autoritaire d'authoring est
  `docs/V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md`. Il impose trois arbitrages
  propriétaires explicites : activité, critères/templates, puis identité gelée.

### Gate C — premier flow utilisateur

Ticket principal : `V4-010`.

Statut : `ACTIVE_OFFLINE / LIVE_BLOCKED` avec fake provider et feature flag
forcé à off ; aucun réseau ou débit réel.

- Brancher remise → devis/réservation → recherche de preuves → règles LearnX →
  certificat → feedback authoré.
- États publics : `FEEDBACK_READY`, `REVISION_REQUIRED`,
  `CLARIFICATION_REQUIRED`, `TEMPORARILY_UNAVAILABLE`.
- Aucun niveau, score, `PASS/FAIL`, feedback libre ou progression ne vient du
  modèle.
- Une correction inutilisable ne produit ni résultat ni débit complet.
- Première activation : feature flag, crédits offerts, cohorte fermée, texte
  français, contenu faible risque.

### Gate D — pilote, économie et release

Tickets principaux : `V4-012`, `V4-017`, `V4-018`, `V4-018A`, `V4-019`.

- Mesurer risque parmi les résultats publiés, couverture, abstention,
  variabilité, coût P50/P90, retries, incidents et compréhension utilisateur.
- Calibrer les crédits et marges uniquement depuis ces mesures.
- Le paiement reste après la preuve qualité et les validations externes.
- La release exige une procédure de rollback et un kill switch opérationnel.

## Registre unique de progression par ticket

`Oui` signifie que le lot cité peut commencer maintenant ; cela ne l'autorise
jamais à franchir son gate live.

| Ticket | Statut unique | Niveau de preuve actuel | Reprenable maintenant | Dépendance ou gate de sortie | Responsable de la prochaine action |
| --- | --- | --- | --- | --- | --- |
| V4-001 | `LIVRÉ_INACTIF` | ADR intégrée. | Non. | Réouvrir seulement si l'architecture change. | Développement. |
| V4-002 | `V4-002C_DONE_OFFLINE` | `V4-002A/B` validés ; compilateur et certificat v2 validés hors ligne ; contrat toujours DRAFT, 0 contrat publié. | Non : ticket clos. | Publication interdite avant corpus, audit et gates ultérieurs. | `AGENT-METHODOLOGIE` reprend via V4-003A. |
| V4-003 | `V4_003E_Q1_R1_FROZEN_HARD_OFF` | Q1 Gemini 3.6 clos après `1/4` appel HTTP 400 ; R1 `00cd27d8…` est gelée et passe `4/4` en fake-only, sans réseau ni modèle. | Oui, réconciliation Q1 et préparation d'arbitrage seulement. | Finance R1 séparée et nouveau GO avant le canari ; aucun appel couvert par ce statut. | Finance puis Rayan, après réconciliation. |
| V4-004 | `LIVRÉ_INACTIF` | Adaptateurs et extension evidence-assist 3.0.0 intégrés dans le runtime canonique. | Non. | Activation par V4-009C/V4-010 seulement. | Développement. |
| V4-005 | `LIVRÉ_INACTIF` | Persistance fondée, aucun runtime utilisateur branché. | Non hors intégration V4-010. | Pipeline promu et contrat publié. | Développement. |
| V4-006 | `LIVRÉ_INACTIF` | Ledger et réservation fondés. | Non. | Calibration après pilote. | Développement + Finance. |
| V4-007 | `LIVRÉ_INACTIF` | Catalogue DRAFT, aucun prix actif. | Non. | Coûts P50/P90 puis arbitrage propriétaire. | Finance & Pricing. |
| V4-008 | `LIVRÉ_INACTIF` | Allocations et limites fondées. | Non. | Revue avant cohorte fermée. | Développement + Finance. |
| V4-008A | `LIVRÉ_INACTIF` | Preuve historique ; juge composite abandonné. | Non. | Aucun travail sur l'ancien pipeline. | Produit & pédagogie. |
| V4-009 | `LIVRÉ_INACTIF` | Orchestration et réconciliation intégrées/rejouées. | Non hors branchement V4-010. | Pipeline exact promu. | Développement. |
| V4-009B | `LIVRÉ_INACTIF` | NO-GO historique immuable. | Non. | Ne jamais reprendre l'enveloppe close. | Produit & pédagogie. |
| V4-009C | `Q1_NO_GO_TECHNICAL_R1_FROZEN_HARD_OFF` | Gate Sonnet clos historiquement ; Q1 Gemini 3.6 clos après HTTP 400 ; R1 `00cd27d8…` gelée et fake preflight `4/4`, sans réseau. | Oui pour réconcilier Q1 et préparer l'arbitrage ; non pour exécuter. | Finance R1 et GO Rayan distincts après réconciliation ; le gel existe déjà. | Finance puis Rayan. |
| V4-010 | `ACTIF_HORS_LIGNE` | Fake-flow complet intégré sur `dev`, persistant, testé responsive et maintenu sous hard-off ; 0 flow live. | Oui : réaudit UX/contrats et tests sans réseau/débit. | Pipeline promu + contrat publié + gate de cohorte. | Développement, avec Produit & Direction artistique. |
| V4-011 | `BLOQUÉ` | Aucun gate de maîtrise cumulatif déterministe. | Non. | V4-010 calibré + contrôle multi-notions serveur livré. | Produit & pédagogie + Développement. |
| V4-012 | `BLOQUÉ` | Fondations financières sans données de pilote. | Non. | Pilote V4-010 instrumenté. | Finance & Pricing. |
| V4-013 | `BLOQUÉ` | Sandbox marchand non activé. | Non. | Qualité prouvée + validations externes. | Développement + conseil externe. |
| V4-014 | `BLOQUÉ` | Aucun SKU ni checkout actif. | Non. | V4-013 + prix V4-018 validés. | Développement + Finance. |
| V4-015 | `BLOQUÉ` | Aucune clôture financière live. | Non. | V4-012 + V4-014 + règles externes. | Finance & Pricing. |
| V4-016 | `DESIGN_VALIDATED_WAIT_GO` | Annonce V5 Totem validée ; aucune capacité V5 disponible. | Non hors audit de promesse. | V4-016D/E, promesse V5 et GO d'implémentation. | Produit & pédagogie. |
| V4-016A | `DESIGN_VALIDATED_WAIT_GO` | Landing/compte Totem validés ; aucune promesse IA/prix activable. | Non hors audit de contenu. | V4-016D/E, contrats publics et GO d'implémentation. | Direction artistique + Produit + Finance. |
| V4-016B | `SHELL_ADMIN_EXISTANT_QA_GREEN_LOCAL` | Shell desktop/mobile et routes admin existantes migrés ; matrice responsive/accessibilité verte. | Partiellement, sans surface correction/paiement. | Contrats stabilisés des surfaces correction, historique, checkout et paiement. | Direction artistique + Développement. |
| V4-016C | `PRODUCT_SURFACES_QA_GREEN_LOCAL` | Runtime multi-programmes préservé ; Aujourd'hui, Parcours/Programme, Notes et Profil migrés vers Totem. | Oui localement, sans rollout. | Validation propriétaire du rendu puis intégration ordonnée D→E→urgent→B→C. | Produit & pédagogie + Développement. |
| V4-016D | `IMPLEMENTED_QA_GREEN_PENDING_PUSH` | Fondations Totem implémentées dans un commit isolé ; aucune bascule globale. | Oui hors intégration. | Revue propriétaire puis push sur `dev`. | Direction artistique + Développement. |
| V4-016E | `IMPLEMENTED_QA_GREEN_PENDING_PUSH` | Primitives, états, shells et catalogue local implémentés ; QA automatisée verte. | Oui hors intégration. | Intégrer V4-016D puis V4-016E sur `dev`. | Direction artistique + Développement. |
| V4-016F | `DESIGN_VALIDATED_WAIT_GO` | Flow d'apprentissage Totem validé, non codé. | Non. | V4-016D/E, contrats pédagogiques et GO. | Produit & pédagogie + Direction artistique. |
| V4-016G | `DESIGN_VALIDATED_CONTRACTS_PENDING` | Surfaces Totem validées, contrats runtime absents. | Non. | V4-007/010/011/014 et V4-016D/E disponibles. | Direction artistique. |
| V4-016H | `WAIT_PREVIOUS_TOTEM_LOTS` | Matrice QA définie. | Non. | Lots Totem effectivement implémentés. | Développement + Direction artistique. |
| V4-016I | `DESIGN_VALIDATED_WAIT_GO` | Recherche et surfaces publiques Totem validées. | Non. | V4-016D/E, contenu réel et GO d'implémentation. | Direction artistique + Recherche. |
| V4-017 | `BLOQUÉ` | Fondations sécurité présentes, audit final non clos. | Non comme ticket complet. | V4-013 + pipeline/pilote bornés. | Développement. |
| V4-018 | `BLOQUÉ` | Aucun coût de correction produit promu. | Non. | V4-003/010/012/014/017 ; comparaison secondaire ≥3 candidats. | Finance & Pricing. |
| V4-018A | `BLOQUÉ` | Cohortes non ouvertes. | Non. | V4-018 + budgets approuvés. | Finance & Pricing. |
| V4-019 | `BLOQUÉ` | V4 incomplète et gate release externe V3.5 ouvert. | Non. | Tous gates qualité, UX, finance, sécurité, rollback et assurance release externe. | Développement ; GO final du Propriétaire. |

## Protocole autonome — aucune fausse validation humaine

La V4 n'a aucun évaluateur humain opérationnel. Les nouvelles campagnes ne
doivent donc pas utiliser `humanReviewApproved` ni présenter un accord entre
modèles comme une vérité humaine.

Le substitut autonome combine des preuves distinctes dont les métriques ne sont
pas fusionnées :

1. **oracle mécanique** : cas construits par composants et résultat exécutable ;
2. **tests métamorphiques** : paraphrase, ordre, fautes superficielles,
   concision, verbosité, Unicode, injection et canari ;
3. **mutation testing** : propriétaire erroné, double pénalisation, règle non
   monotone, niveau inatteignable et combinaison sans décision ;
4. **pseudo-oracle synthétique scellé** : diversité sémantique indépendante des
   sorties candidates, explicitement non présenté comme oracle formel ;
5. **shadow réel non annoté et consenti** : stabilité, couverture, abstention,
   dérive et coût seulement, jamais exactitude pédagogique revendiquée.

Le holdout actif v3 devra être authoré indépendamment des résultats candidats,
qualifié par ses gates autonomes, puis scellé avant ouverture et consommé une
seule fois après une autorisation propriétaire distincte suivant
`GO_TO_SEALED_HOLDOUT`. Le v2 est conservé intact comme
`SUPERSEDED_HISTORICAL_DRAFT`. Un résultat ambigu ou non supporté produit une
abstention, pas une validation humaine fictive.

## Pistes parallèles et frontières de version

- Le registre `SourceVersion → Passage → Claim → KnowledgePack →
  RubricElement` est une fondation de provenance future. Il sépare les sources
  externes des preuves tirées de la réponse et traite la vectorisation comme un
  index dérivé. Il ne bloque pas le premier pilote WRITING court.
- V5 porte la création conversationnelle de formations et la refonte du flow de
  publication. La vue V4 « Créer une formation » reste une annonce seulement.
- `V5-CATALOG-001` porte la fiche programme enrichie : prérequis, niveau
  d'entrée, savoirs visés, compétences, outils, visée et niveau de sortie.
  `V5-CATALOG-002` porte les notes et avis, avec éligibilité, version de
  programme, taille d'échantillon, modération et anti-abus. Ces deux candidats
  sont détaillés dans `BACKLOG_V4.md` pour mémoire, mais ne bloquent ni ne
  modifient le chemin critique V4.
- V6 porte support/ticketing et passe RGPD approfondie.
- L'audio, l'image, les fichiers, les domaines santé/réglementés et les critères
  holistiques sont hors premier pilote.

## Responsabilités sur le chemin critique

| Décision | Pilote | Consultations bloquantes |
| --- | --- | --- |
| Rubrique, oracles, gates et verdict expérimental | Produit & pédagogie | Développement, Finance pour tout appel |
| Code, migrations, runner, idempotence et sécurité | Développement | Produit & pédagogie avant clôture |
| Budget R&D, coût, plafonds et activation économique | Finance & Pricing | Propriétaire |
| États et écrans Totem | Direction artistique | Produit & pédagogie, Finance si montants |
| Appel facturable, paiement et release | Propriétaire | Tous les avis exigés par le ticket |

## Prochaines décisions du propriétaire

Aucune décision de prix produit ou de paiement n'est nécessaire maintenant.
Les deux enveloppes Sonnet sont closes et non transférables : le gate historique
du 20 août a coûté `0,025622 USD` pour `2/4`, et le gate courant du 21 août
`0,018828 USD` pour `1/4`. Aucun budget d'appel n'est ouvert.

Gemini 3.6 était le candidat 1. Son autorisation single-use a été consommée au
premier appel, arrêté sur HTTP 400 avant sortie, usage, identifiant ou coût
réconcilié. Les trois autres appels n'ont pas été envoyés. Il faut maintenant
réconcilier la réserve `0,1208415 USD` et diagnostiquer le payload hors ligne ;
aucun replay n'est autorisé. Gemini 3.7 reste rang 2
et Mistral Medium 3.5 rang 3 ; chaque dossier futur exigera son propre mandat.
Le panel 10 × 2 et le holdout restent fermés. Après un futur `4/4` sous une
identité autorisée, une autorisation distincte du panel sera nécessaire ;
après un futur `20/20`, la décision suivante sera `GO_TO_SEALED_HOLDOUT`, jamais
une promotion ni une autorisation implicite d'ouverture.
