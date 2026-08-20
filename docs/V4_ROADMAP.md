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
- `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md` régit la nouvelle identité de
  protocole à passages déterministes.
- Cette roadmap ne transforme jamais une preuve expérimentale en livraison
  produit.
- En cas d'écart sur le statut courant, cette page tranche pour la lecture
  humaine et le manifeste V3 tranche pour l'automatisation. L'écart doit alors
  être corrigé dans le même ticket documentaire.

Dernière consolidation : 20 août 2026.

## Plans d'état à ne pas confondre

| Plan | État au 16 août 2026 | Ce que cela prouve | Ce que cela ne prouve pas |
| --- | --- | --- | --- |
| Runtime canonique | `origin/dev` à `b38732f` | Fondations V4-001 à V4-009 intégrées mais inactives. | Le protocole evidence-assist 3.0.0 n'y est pas encore intégré. |
| Candidat local | `b366ec9`, branche `codex/v4-evidence-assist-protocol` | Segmenter, contexte, raw, schéma candidate-only et capacité `reasoning=DISABLED` testés hors ligne. | Ni CI de livraison complète, ni appel, ni qualité du modèle, ni disponibilité utilisateur. |
| Expérimentation | `OFFLINE_CAMPAIGN_FROZEN / FINANCE_GATE4_ARBITRATED / OWNER_NOT_GRANTED / NO_MODEL_CALL` | Route, identité, gate quatre cas et panel 10 × 2 sont gelés hors ligne ; le plafond du gate quatre cas est arbitré. | Le GO propriétaire du gate quatre cas et l'arbitrage du panel conditionnel sont absents ; aucun pipeline n'est promu. |
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

1. éprouver un modèle limité à des relations candidates sur des spans LearnX ;
2. publier une rubrique `WRITING/fr-FR` réellement exécutable ;
3. brancher ce moteur au flow apprenant sous feature flag ;
4. mesurer qualité et coûts réels ;
5. seulement ensuite activer tarification, paiement et extension.

État honnête : **0 contrat V4 publié, 0 activité éligible, aucun pipeline promu,
V4-010 non branché et V4-011 fermé.**

### Prochaines actions sans ambiguïté

1. **Développement** fait passer le candidat local fondé sur `b366ec9` par la
   gate de livraison du dépôt, puis l'intègre au runtime canonique ; tant que ce
   n'est pas fait, ses capacités restent `LOCAL_NOT_INTEGRATED`.
2. **Produit & pédagogie avec Développement** conserve byte-identiques
   l'identité, les quatre cas, le corpus complet 10 × 2, les seuils et les règles
   d'arrêt désormais gelés. Ce travail reste hors ligne.
3. Le **Propriétaire** décide séparément du GO éphémère sur le plafond Finance
   arbitré de `0,251136 USD` pour les quatre premiers appels. Finance devra
   arbitrer séparément le panel conditionnel seulement après un résultat `4/4`.

V4-002 et V4-010 peuvent avancer en parallèle sous leurs hard-off respectifs.
Aucune de ces actions n'autorise encore un appel modèle ou un utilisateur.

## Chemin critique

### Gate A — preuve du chercheur de preuves

Ticket principal : `V4-009C`, avec mesures dans `V4-003`.

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
  directe est écartée tant que son coût reste estimé. L'état est
  `OFFLINE_CAMPAIGN_FROZEN / NO_MODEL_CALL`, pas un GO d'appel.
- Acquis hors ligne : runner validate-only, gate quatre cas et panel 10 × 2
  gelés ensemble, zéro résultat historique réutilisé.
- Le plafond prudent `0,251136 USD` du gate quatre cas est arbitré par Finance
  uniquement pour cette identité, quatre appels maximum, zéro retry/fallback.
  Le plafond conditionnel `1,258760 USD` du panel 10 × 2 reste non arbitré. Le
  plafond `0,21 USD` est celui du gate Sonnet borné historique, clos ; il n'est
  pas le plafond evidence-assist et n'est pas transférable.
- Blocage courant : GO propriétaire distinct non accordé pour le gate quatre
  cas. Aucun artefact HMAC d'exécution n'existe dans le dépôt.
- Ordre : exécuter les quatre cas après ces autorisations, puis exécuter le 10 × 2
  uniquement si le gate fait `4/4`, sous la même identité. Tout changement
  recommence à quatre cas.
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
  robustesse et d'économie, après preuve de faisabilité du pipeline Sonnet 5
  exact. Elle ne bloque ni son premier gate 4/4, ni son corpus 10 × 2, ni son
  holdout autonome borné ; elle bloque la calibration économique V4-018 et
  toute généralisation commerciale.
- Le manifeste actif de holdout est
  `benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v3.manifest.json` ;
  il reste non authoré, non scellé et inexécutable. Le v2 reste intact comme
  `SUPERSEDED_HISTORICAL_DRAFT`. Le falsificateur, le holdout, la publication
  V4-002 et le live V4-010 restent fermés ; les deux tickets avancent hors ligne.

### Les deux GO autonomes

1. `GO_TO_SEALED_HOLDOUT` ne peut être demandé qu'après `4/4`, puis `20/20`
   sur le corpus de développement complet sous la même identité, tous les
   gates absolus satisfaits et les coûts réconciliés. Il conserve
   `pipelinePromoted=false` et autorise seulement la préparation et le
   scellement du holdout v3. Son ouverture one-shot exige une autorisation
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
| V4-002 | `ACTIF_HORS_LIGNE` | Archétype `FULLY_COMPILABLE`, lifecycle DRAFT ; 0 contrat publié. | Oui : contrat candidate-only, canal mécanique séparé, templates et mutations. | Publication après `GO_AUTONOMOUS_FORMATIVE` et approbation propriétaire. | Produit & pédagogie, avec Développement. |
| V4-003 | `ACTIF_HORS_LIGNE` | Baselines historiques closes ; archétype V4-002 DRAFT suffisant pour la recherche hors ligne ; nouveau protocole sans appel. | Oui : identités, corpus, seuils et rapport reproductible. | Faisabilité Sonnet 5, puis comparaison ≥3 candidats avant V4-018, pas avant le premier gate. La publication V4-002 n'est requise que pour le live. | Produit & pédagogie ; Finance pour chaque enveloppe. |
| V4-004 | `LIVRÉ_INACTIF` | Adaptateurs disponibles dans le runtime canonique ; extension 3.0.0 locale. | Non hors intégration du candidat local. | Activation par V4-009C/V4-010 seulement. | Développement. |
| V4-005 | `LIVRÉ_INACTIF` | Persistance fondée, aucun runtime utilisateur branché. | Non hors intégration V4-010. | Pipeline promu et contrat publié. | Développement. |
| V4-006 | `LIVRÉ_INACTIF` | Ledger et réservation fondés. | Non. | Calibration après pilote. | Développement + Finance. |
| V4-007 | `LIVRÉ_INACTIF` | Catalogue DRAFT, aucun prix actif. | Non. | Coûts P50/P90 puis arbitrage propriétaire. | Finance & Pricing. |
| V4-008 | `LIVRÉ_INACTIF` | Allocations et limites fondées. | Non. | Revue avant cohorte fermée. | Développement + Finance. |
| V4-008A | `LIVRÉ_INACTIF` | Preuve historique ; juge composite abandonné. | Non. | Aucun travail sur l'ancien pipeline. | Produit & pédagogie. |
| V4-009 | `LIVRÉ_INACTIF` | Orchestration et réconciliation intégrées/rejouées. | Non hors branchement V4-010. | Pipeline exact promu. | Développement. |
| V4-009B | `LIVRÉ_INACTIF` | NO-GO historique immuable. | Non. | Ne jamais reprendre l'enveloppe close. | Produit & pédagogie. |
| V4-009C | `ACTIF_HORS_LIGNE` | Protocole 3.0.0, runner, identité et deux étages gelés ; budgets proposés seulement, `NO_MODEL_CALL`. | Oui : durcir hors ligne le runner, les coûts et le holdout indépendant. | Finance + GO propriétaire → 4/4 → 20/20 → `GO_TO_SEALED_HOLDOUT` sans promotion → autorisation one-shot → holdout → `GO_AUTONOMOUS_FORMATIVE`. | Produit & pédagogie ; Développement ; Finance ; Propriétaire aux GO. |
| V4-010 | `ACTIF_HORS_LIGNE` | 0 flow live ; fake provider et hard-off autorisés. | Oui : persistance, UX et tests sans réseau/débit. | Pipeline promu + contrat publié + gate de cohorte. | Développement, avec Produit & Direction artistique. |
| V4-011 | `BLOQUÉ` | Aucun gate de maîtrise cumulatif déterministe. | Non. | V4-010 calibré + contrôle multi-notions serveur livré. | Produit & pédagogie + Développement. |
| V4-012 | `BLOQUÉ` | Fondations financières sans données de pilote. | Non. | Pilote V4-010 instrumenté. | Finance & Pricing. |
| V4-013 | `BLOQUÉ` | Sandbox marchand non activé. | Non. | Qualité prouvée + validations externes. | Développement + conseil externe. |
| V4-014 | `BLOQUÉ` | Aucun SKU ni checkout actif. | Non. | V4-013 + prix V4-018 validés. | Développement + Finance. |
| V4-015 | `BLOQUÉ` | Aucune clôture financière live. | Non. | V4-012 + V4-014 + règles externes. | Finance & Pricing. |
| V4-016 | `ACTIF_HORS_LIGNE` | Baseline d'annonce à réauditer. | Oui : audit de promesse uniquement. | Pas de clôture release tant que le gate externe V3.5 reste ouvert. | Produit & pédagogie. |
| V4-016A | `ACTIF_HORS_LIGNE` | Landing V3.5 disponible, aucune promesse IA/prix activable. | Oui : audit de contenu sans publier de capacité. | V4-010 live, prix V4-018 et gate externe V3.5. | Direction artistique + Produit + Finance. |
| V4-016B | `BLOQUÉ` | Nouvelles surfaces V4 non stabilisées. | Non. | V4-010/012/014/016A/016G stabilisés. | Direction artistique. |
| V4-016C | `ACTIF_HORS_LIGNE` | Besoin multi-programmes documenté, runtime à réauditer. | Oui : réaudit API/UX sans effet IA. | Revue desktop V4-016B et gate release externe pour la clôture. | Produit & pédagogie + Développement. |
| V4-016G | `BLOQUÉ` | Direction Atlas validée, contrats runtime absents. | Non hors spécification. | V4-007/010/011/014 disponibles. | Direction artistique. |
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
- V6 porte support/ticketing et passe RGPD approfondie.
- L'audio, l'image, les fichiers, les domaines santé/réglementés et les critères
  holistiques sont hors premier pilote.

## Responsabilités sur le chemin critique

| Décision | Pilote | Consultations bloquantes |
| --- | --- | --- |
| Rubrique, oracles, gates et verdict expérimental | Produit & pédagogie | Développement, Finance pour tout appel |
| Code, migrations, runner, idempotence et sécurité | Développement | Produit & pédagogie avant clôture |
| Budget R&D, coût, plafonds et activation économique | Finance & Pricing | Propriétaire |
| États et écrans Atlas | Direction artistique | Produit & pédagogie, Finance si montants |
| Appel facturable, paiement et release | Propriétaire | Tous les avis exigés par le ticket |

## Prochaines décisions du propriétaire

Aucune décision de prix produit ou de paiement n'est nécessaire maintenant. La
capacité route-specific `DISABLED`, l'identité et les deux étages quatre cas puis
10 × 2 sont gelés hors ligne. La prochaine décision exécutable est d'arbitrer le
budget R&D maximal proposé de `0,251136 USD` et d'accorder un GO propriétaire
avant tout appel. Finance arbitre alors uniquement l'enveloppe des quatre cas, puis le
Propriétaire autorise ou refuse ces appels. Une autorisation distincte du panel
n'est demandée qu'après un résultat `4/4`, sans changement d'identité. Après
`20/20`, la décision suivante est `GO_TO_SEALED_HOLDOUT`, jamais une promotion
ni une autorisation d'ouverture. Le pipeline ne devient promu qu'après une
autorisation distincte, le holdout one-shot et
`GO_AUTONOMOUS_FORMATIVE`. La comparaison ≥3 candidats vient ensuite pour
V4-018 et ne retarde pas ce premier parcours de faisabilité.
