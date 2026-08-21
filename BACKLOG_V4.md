# Backlog V4 — Corrections IA et économie d'usage LearnX

## Statut et autorité

- Version : 1.10.3
- Statut : **V4 en cours — fondations livrées, preuve autonome IA sur le chemin critique**
- Dernière consolidation : 21 août 2026 — gate evidence-assist clos après deux
  appels réconciliés ; arbitrage `EXPLICITLY_REFUTED` approuvé pour le
  successeur hors ligne, sans nouvelle identité exécutable ni dépense
- Baseline technique : candidat V3.5 et système visuel documentés. Le rapport
  `docs/V3_5_RELEASE_REPORT.md` conserve honnêtement un gate externe ouvert :
  promotion effective, appareil/PWA, iPhone/VoiceOver, zoom et smoke authentifié
  post-promotion ne sont pas attestés comme achevés.
- Sources de cadrage : décisions produit sur la correction IA, OpenRouter,
  crédits LearnX, modèle économique, séparation V4/V5 et direction artistique
  Atlas sans vert validée le 10 août 2026

La vue de pilotage courante est `docs/V4_ROADMAP.md`. Elle constitue le registre
humain unique de l'état, des tickets reprenables, des prochaines actions et des
gates ; le présent backlog conserve les périmètres, dépendances et critères
détaillés sans maintenir un second statut concurrent. La spécification
autoritaire du moteur de correction est
`docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`. La nouvelle identité de protocole
de recherche sémantique est régie par
`docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`. Cette identité est désormais close
et inchangée. Son successeur hors ligne est régi par
`docs/V4_EVIDENCE_SEMANTIC_ARBITRATION.md` et son authoring par
`docs/V4_CORRECTION_CONTRACT_AUTHORING_FUNNEL.md`. La carte de domaine
`docs/LEARNX_DOMAIN_KNOWLEDGE.md` reste le point d'entrée explicatif. La
spécification composite locale
reste une baseline historique utile pour les garanties de coût, d'idempotence
et de réconciliation ; elle n'est plus une autorité active. Les deux références
Atlas validées pour les crédits et la correction sont :

- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-correction-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-atlas-surfaces.html`.

Ce document fixe le périmètre détaillé de V4. Le travail V4 hors ligne est
autorisé et a démarré sur la baseline technique V3.5. Cette autorisation ne
réécrit pas `docs/V3_5_RELEASE_REPORT.md` et ne transforme pas son gate externe
ouvert en validation accomplie ; ce gate devra être fermé avant la clôture V4.
Un ticket ne devient une instruction d'implémentation qu'après réaudit du code
et du schéma réellement livrés, puis reformulation détaillée du ticket actif.

La validation produit du scope a été donnée le 11 août 2026. Toute modification
de périmètre exige désormais un amendement explicite, versionné et approuvé ;
les paramètres de calibration et gates externes listés en fin de document ne
rouvrent pas le scope.

### Amendement historique — notation formative et pipeline composite expérimental

Le 12 août 2026, le Propriétaire a validé l'exploration d'une
correction formative à deux modèles. Cet amendement remplace les anciennes
contraintes incompatibles de modèle unique, de verdict binaire faisant autorité
et de seconde passe nécessairement exécutée par le même modèle. La direction
exécutable validée le 14 août ci-dessous remplace ses choix d'architecture pour
les nouvelles implémentations ; cette section conserve la décision historique.

- L'expérience apprenant n'affiche plus un verdict académique binaire
  « validé/rejeté » pour les productions libres. Elle présente des niveaux par
  critère, un score **indicatif** calculé côté serveur, une appréciation
  formative, les preuves issues de la réponse et une amélioration prioritaire.
- Le score IA n'autorise, ne bloque et ne termine jamais la progression. La
  soumission et la progression restent gouvernées par leurs règles serveur
  indépendantes.
- V4-003 doit comparer un modèle unique et un pipeline composite versionné. La
  piste prioritaire à éprouver est un correcteur primaire économique, puis un
  vérificateur plus conservateur uniquement sur les résultats sensibles selon
  une règle serveur préenregistrée. Aucun routeur fournisseur ne choisit les
  rôles silencieusement.
- Un désaccord mineur peut produire une appréciation prudente ; un désaccord
  important ne doit jamais être transformé en précision artificielle. Il
  produit un état `UNCERTAIN` ou une fourchette explicitement indicative selon
  le contrat UX qui sera validé par V4-010.
- Les noms de modèles, les tokens et une logique de « vote d'IA » ne sont pas
  exposés à l'apprenant. L'interface indique seulement qu'une vérification peut
  être déclenchée dans le plafond accepté.
- La vérification automatique fait partie du même workflow, du même devis et de
  la même réservation. Elle n'est ni un retry technique, ni une nouvelle action
  vendue séparément.
- Les campagnes historiques restent inchangées et non promues. Leur simulation
  composite est directionnelle, car les prompts/protocoles diffèrent. Le
  pipeline final devra recevoir une identité propre et être évalué comme un
  produit unique avant activation.
- Aucun modèle ni pipeline n'est encore promu ; le holdout scellé reste fermé
  tant qu'un candidat n'a pas franchi le corpus complet de développement et le
  gate d'admission one-shot défini par l'autorité active. Son ouverture ne vaut
  jamais promotion.

Les états `CONFIRMED`, `UNCERTAIN`, `PROVISIONAL` et la contestation par seconde
analyse décrits dans les amendements historiques ne sont plus les états cibles
du MVP. Ils sont remplacés par les états et règles du moteur exécutable.

### Amendement validé — preuve autonome et validation de maîtrise séparée

La correction V4 fonctionne sans évaluateur humain opérationnel ou de
promotion. Les campagnes historiques et leurs revues restent des preuves
immuables, mais aucune nouvelle campagne ne peut simuler une approbation humaine
ou utiliser `humanReviewApproved` comme autorité. Le manifeste canonique de la
phase est `docs/V4_AI_CORRECTION_PHASE_MANIFEST_V3.json`. Le manifeste sans
suffixe reste l'autorité historique épinglée par les campagnes closes.

- Le holdout est qualifié et scellé indépendamment avant les appels candidats.
  `GO_TO_SEALED_HOLDOUT`, après le corpus complet, conserve
  `pipelinePromoted=false` et rend seulement éligible une demande d'ouverture
  one-shot. Une autorisation propriétaire distincte permet cette ouverture. Le
  gate final de promotion devient
  `GO_AUTONOMOUS_FORMATIVE` après succès du holdout : oracle autonome scellé,
  cas déterministes, métamorphismes, sécurité et citations exactes, variabilité
  bornée et abstention obligatoire.
- Une preuve autonome publiable fournit un feedback formatif ; une ambiguïté
  matérielle masque le score exact et exige une clarification ; une exécution
  indisponible ne publie ni feedback ni débit.
- Aucun résultat IA ne modifie `ConceptProgress`, `StageProgress` ou une preuve
  de maîtrise. Une production libre peut être obligatoire comme remise, jamais
  comme validation calculée par l'IA.
- V4-011 reste fermé jusqu'à l'existence d'un contrôle cumulatif déterministe,
  multi-notions et corrigé côté serveur. Complétion, feedback et maîtrise sont
  trois états distincts.
- La première cible éditoriale est le contrat DRAFT
  `docs/V4_WRITING_RECOMMENDATION_FR_CONTRACT_DRAFT.md`. Il n'autorise aucun
  appel ni aucune activité avant publication versionnée et gates satisfaits.

### Amendement validé — moteur de rubrique exécutable

Le 14 août 2026, le Propriétaire a validé un changement d'autorité : LearnX ne
cherche plus un modèle chargé de noter. La spécification canonique devient
`docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`.

- Les modèles ont uniquement les rôles de chercheur de preuves et, dans une
  expérience séparée, de falsificateur indépendant. Ils ne produisent ni
  niveau final, ni score, ni `PASS/FAIL`, ni feedback libre.
- Une rubrique atomique, compilée et versionnée détermine les niveaux. Le
  successeur authoré distingue `SUPPORTED`, `CONTRADICTED`,
  `NOT_DEMONSTRATED`, `EXPLICITLY_REFUTED` et `AMBIGUOUS`. Les statuts prouvés
  sont rattachés à des spans exacts de la réponse ; l'absence simple conserve
  zéro span.
- Cette phrase décrit uniquement le canal mécanique historique/exécutable. Sous
  evidence-assist 3.0.0, une relation IA candidate ne peut produire aucun de
  ces statuts atomiques ni alimenter une règle de niveau. Seuls des constats
  mécaniques indépendants, calculés par une règle LearnX pure et authorée, sont
  scorables. En leur absence, niveau et score restent `null`.
- LearnX contrôle les spans, la propriété des pénalités, les injections et les
  règles, puis émet un certificat de preuve reconstructible. Le feedback MVP
  provient uniquement de templates authorés.
- Une ambiguïté est résolue sur toutes ses issues authorisées. Si elles donnent
  des niveaux différents, aucun score exact n'est affiché et l'état devient
  `CLARIFICATION_REQUIRED`.
- Les états publics deviennent `FEEDBACK_READY`, `REVISION_REQUIRED`,
  `CLARIFICATION_REQUIRED` et `TEMPORARILY_UNAVAILABLE`. Aucun n'agit sur la
  progression.
- Les anciennes campagnes de modèles juge et le pipeline composite Mistral +
  Sonnet restent des baselines historiques `NO_GO`. Elles ne définissent plus
  l'architecture cible et ne sont pas requalifiées.
- La première nouvelle campagne Gemini évalue exclusivement l'extraction de
  preuves. Un falsificateur d'une autre famille n'est ajouté que dans une
  expérience indépendante démontrant un gain net.

### Amendement validé — evidence-assist à passages déterministes

Le 16 août 2026, le Propriétaire a approuvé
`docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md` comme nouvelle autorité de protocole
pour la prochaine expérimentation. Cette décision ne modifie ni ne requalifie
aucune campagne Gemini ou Sonnet 5 antérieure : leurs verdicts, coûts, ledgers,
raws et règles d'arrêt restent immuables et append-only.

- LearnX segmente la réponse avant appel, attribue des identifiants opaques aux
  passages et conserve seul les offsets, textes exacts et empreintes.
- Le modèle ne peut proposer que `EVIDENCE_FOR_ELEMENT`,
  `EVIDENCE_AGAINST_ELEMENT` ou `ABSTAIN` sur des identifiants fournis. Ces
  relations restent candidates et ne peuvent alimenter aucun score, niveau ou
  statut atomique du moteur historique. Il ne produit ni citation libre, score,
  `PASS/FAIL`, progression ou
  feedback libre. Une omission ou une abstention devient `UNRESOLVED`, jamais
  automatiquement `NOT_DEMONSTRATED`.
- La cible expérimentale reste `anthropic/claude-sonnet-5`, catalogue snapshot
  `anthropic/claude-sonnet-5-20260630`, via `OPENROUTER_CHAT`, route exacte
  `Anthropic` et fallback interdit. Le prompt et le protocole portent la version
  `3.0.0`, le validateur et le segmenter `2.0.0` ; l'empreinte du protocole
  hors ligne est
  `cbbb273979027fc1654a11e68202b5c7aa55876c2019f1262db35d19f9a41c5a`.
- Le raisonnement doit être explicitement `DISABLED` par une capacité attestée
  de la route exacte. Une omission du paramètre ne vaut jamais désactivation.
  L'attestation route-specific du 16 août prouve hors ligne
  `reasoning: { effort: "none" }`. Le statut pré-exécution était
  `OFFLINE_CAMPAIGN_FROZEN / NO_MODEL_CALL`. L'autorisation ultérieure a été
  consommée par le gate clos ; elle n'est ni réutilisable ni transférable.
- L'identité `learnx-writing-fr-sonnet-5-evidence-assist-v3@1.0.0`, le profil
  de requête et les deux gates sont attribués et gelés hors ligne. Toute
  modification versionne l'identité et recommence au gate quatre cas.
- Les quatre cas positif, négatif, mutation et injection sont le premier gate.
  Le panel 10 cas × 2 n'est exécuté que si le gate fait `4/4`. Les deux étages,
  leurs seuils et leurs règles d'arrêt sont gelés ensemble avant le premier
  appel ; toute modification recommence au gate quatre cas sous une nouvelle
  identité.
- Le panel 10 × 2 est le corpus de développement complet, pas un prélude à un
  ensemble indéfini : il lie la sélection scellée
  `writing-fr-semantic-development-v2@2.0.0`, ses 10 cas, leur ordre et deux
  répétitions fraîches, soit 20 workflows hors des quatre cas. Changer un seul
  de ces paramètres versionne le corpus, ferme la campagne et recommence à 4.
- Deux décisions sont distinctes : `GO_TO_SEALED_HOLDOUT`, après 4/4 puis 20/20
  et scellement indépendant déjà réalisé, confirme l'éligibilité sans ouvrir
  ni promouvoir ; une autorisation propriétaire distincte permet l'ouverture
  one-shot. `GO_AUTONOMOUS_FORMATIVE`, après succès one-shot du holdout,
  promeut uniquement le pipeline exact pour le pilote formatif borné.
- La comparaison de trois candidats devient une preuve secondaire de robustesse
  et d'économie après faisabilité du pipeline exact. Elle ne bloque pas le gate
  Sonnet 5, le 10 × 2, le holdout ou le pilote borné ; elle reste bloquante pour
  V4-018, la tarification et toute généralisation commerciale.
- Le holdout actif devient
  `benchmarks/ai-correction/executable-rubric/writing-fr-holdout.v3.manifest.json`.
  Ses 24 cas sont authorés, qualifiés par les gates autonomes et scellés en
  AES-256-GCM, mais le paquet reste fermé et inexécutable. Le manifeste v2 est conservé
  intact avec le statut `SUPERSEDED_HISTORICAL_DRAFT`.
- Le falsificateur, le holdout, la publication V4-002 et l'activation réelle de
  V4-010 restent fermés. V4-002 et V4-010 avancent hors ligne : authoring,
  compilation, fake provider, feature flag forcé à off et tests sans réseau ni
  débit réel.

V4 ne doit jamais être anticipée dans un ticket V3 ou V3.5. Un ticket V4
correspond idéalement à un commit ou une pull request autonome.

## Vue de pilotage au 21 août 2026

Cette section est la synthèse courte. Les statuts détaillés, dépendances et
preuves sont maintenus dans `docs/V4_ROADMAP.md`.

### Maintenant — fermer la preuve autonome

1. Conserver le segmenter, le contexte de requête, le raw provider, le schéma
   evidence-assist et l'attestation de capacité sous tests fail-closed. Fait
   hors ligne.
2. Conserver l'identité immuable et désormais close
   `learnx-writing-fr-sonnet-5-evidence-assist-v3@1.0.0`, ses deux appels et
   les deux manifestes quatre cas puis 10 × 2 gelés ensemble. Aucun replay
   n'est permis sous cette identité.
3. Le gate evidence-assist quatre cas a consommé son GO éphémère et s'est
   arrêté après deux appels sur `SEMANTIC_DISAGREEMENT` : coût exact
   `0,025622 USD`, réconciliation `100 %`, cas positif `9/9`, cas négatif
   `7/9`. Mutation et injection n'ont pas été envoyés. Le plafond historique de
   `0,21 USD` reste propre au gate Sonnet borné clos.
4. Fermer cette identité sans replay. Le panel conditionnel 10 × 2 reste non
   arbitré et interdit. Arbitrer hors ligne la frontière entre absence de preuve
   et preuve explicite du contraire ; toute modification crée une nouvelle
   identité et recommence par un gate quatre cas nouvellement autorisé.
5. Si l'arbitrage modifie l'ontologie, le mapping, le gold, l'évaluateur ou la
   télémétrie, créer une nouvelle identité, la soumettre à un nouvel arbitrage
   Finance et à un nouveau GO propriétaire, puis recommencer par quatre cas.
   Aucun budget d'appel n'est actuellement ouvert.
6. Après un futur `4/4`, exécuter le panel 10 × 2 sous autorisation distincte.
   Après un futur `20/20`, confirmer la préparation du holdout scellé via
   `GO_TO_SEALED_HOLDOUT`, demander une autorisation one-shot distincte, puis
   rendre `GO_AUTONOMOUS_FORMATIVE` uniquement si son exécution réussit sans
   retuning.
7. Publier un premier contrat `WRITING/fr-FR` seulement après ce GO, s'il est
   `FULLY_COMPILABLE`, versionné, couvert par ses templates/remédiations et s'il
   prouve que les relations candidates ne sont jamais scorées.

### Ensuite — livrer le premier flow apprenant

8. Conserver le fake-flow V4-010 intégré au runtime de développement et forcé
   à `OFF` en production ; remplacer son fake provider uniquement par un
   pipeline et un contrat ayant franchi les gates autonomes.
9. Piloter sous feature flag, sur contenu faible risque, avec crédits offerts et
   aucun effet sur `ConceptProgress`, `StageProgress` ou `VALIDATED`.
10. Mesurer qualité publiée, couverture, abstention, coût P50/P90, incidents et
   compréhension UX avant d'activer prix ou paiement.

### Plus tard — économie, paiement et extension

11. Comparer au moins trois candidats sur des identités reproductibles, puis
    calibrer catalogue, dashboard, marges et cohortes sur les coûts réellement
    observés ; les catalogues actuels restent `DRAFT/INACTIVE`.
12. Ouvrir Revolut, packs et clôture financière seulement après gates qualité,
    finance et conseil externe.
13. Maintenir V4-011 fermé tant qu'un contrôle cumulatif déterministe,
    multi-notions et corrigé serveur ne peut pas prouver la maîtrise.

### Vérités à ne plus perdre

- 0 contrat V4 est `PUBLISHED` ; 0 activité est éligible au runtime IA.
- Le moteur de rubrique exécutable existe en recherche/hors ligne. Le fake-flow
  V4-010 est branché au runtime de développement, mais son flag reste forcé à
  `OFF` en production et il ne valide aucun modèle réel.
- Le smoke Gemini 1.3 positif et les NO-GO Gemini/Sonnet 5 restent des preuves
  historiques ; aucun ne promeut un pipeline. Le protocole 3.0.0 a effectué
  deux appels réconciliés avant son arrêt obligatoire sur divergence
  sémantique ; mutation, injection, panel et holdout n'ont pas été exécutés.
- Le registre `SourceVersion → Passage → Claim → KnowledgePack →
  RubricElement` est une fondation future. Il sépare grounding externe et preuve
  apprenant ; son absence ne bloque pas le premier pilote court et faible risque.
- Remise, feedback et maîtrise sont trois états indépendants.

## Responsabilités et validation

### Rôles

- **Propriétaire** : arbitrages et validation finale du scope, des prix, du
  lancement et du GO de release.
- **Produit & pédagogie** : contrats de correction, règles pédagogiques,
  priorisation, critères d'acceptation et cohérence du backlog.
- **Développement** : architecture technique, schéma, API, sécurité,
  implémentation, migrations, tests et déploiement. Il est le seul responsable
  de l'écriture du code applicatif.
- **Direction artistique** : spécifications et revues Atlas des nouvelles
  surfaces. Elle ne modifie ni règles métier, ni prix, ni code.
- **Finance & Pricing** : coûts, crédits, devis, marges, packs, réconciliation et
  scénarios économiques. Elle ne modifie ni code, ni critères pédagogiques.
- **Conseil externe** : validation juridique, fiscale, comptable ou conformité
  lorsqu'elle est exigée ; il ne constitue pas un agent d'implémentation.

`Pilote` signifie responsable de faire aboutir le ticket et son dossier de
preuve. `Implémentation` identifie qui produit le code. `Consultation obligatoire`
signifie qu'un ticket ne peut être déclaré terminé sans la revue indiquée. Le
Propriétaire conserve le dernier arbitrage pour toute contradiction.

### Matrice par ticket

| Ticket | Pilote | Implémentation | Consultation obligatoire | Validation finale |
| --- | --- | --- | --- | --- |
| V4-001 | Développement | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-002 | `AGENT-PEDAGOGIE` | `AGENT-DEV-LEARNX` à partir de V4-002C | `AGENT-METHODOLOGIE` | Rayan A puis B |
| V4-003 | `AGENT-METHODOLOGIE` | `AGENT-DEV-LEARNX` pour les runners | `AGENT-PROTOCOLE-IA`, puis `AGENT-FINANCE` | Rayan C puis GO réseau distinct |
| V4-004 | Développement | Développement | Produit & pédagogie | Propriétaire |
| V4-005 | Développement | Développement | Produit & pédagogie | Propriétaire |
| V4-006 | Développement | Développement | Finance & Pricing | Propriétaire |
| V4-007 | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-008 | Développement | Développement | Finance & Pricing, Produit & pédagogie | Propriétaire |
| V4-008A | Historique clos | Aucune | Aucune | Aucun nouveau GO |
| V4-009 | Développement | Développement | Finance & Pricing, Produit & pédagogie | Propriétaire |
| V4-009B | Historique clos | Aucune | Aucune | Aucun replay |
| V4-009C | `AGENT-DEV-LEARNX` pour chaque exécution autorisée | `AGENT-DEV-LEARNX` | `AGENT-PROTOCOLE-IA`, `AGENT-METHODOLOGIE`, `AGENT-FINANCE` | Message direct de Rayan après gates |
| V4-010 | Développement | Développement | Produit & pédagogie, Direction artistique | Propriétaire |
| V4-011 | Produit & pédagogie | Développement | Finance & Pricing, Direction artistique | Propriétaire |
| V4-012 | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-013 | Développement | Développement | Finance & Pricing, conseil externe | Propriétaire |
| V4-014 | Développement | Développement | Finance & Pricing, Direction artistique, conseil externe | Propriétaire |
| V4-015 | Finance & Pricing | Développement | Développement, conseil externe | Propriétaire |
| V4-016 | Produit & pédagogie | Développement | Direction artistique | Propriétaire |
| V4-016A | Direction artistique | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-016B | Direction artistique | Développement | Produit & pédagogie | Propriétaire |
| V4-016C | Produit & pédagogie | Développement | Direction artistique | Propriétaire |
| V4-016G | Direction artistique | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-017 | Développement | Développement | Produit & pédagogie, Finance & Pricing | Propriétaire |
| V4-018 | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-018A | Finance & Pricing | Développement | Produit & pédagogie | Propriétaire |
| V4-019 | Développement | Développement | Produit & pédagogie, Direction artistique, Finance & Pricing, conseil externe selon les gates | Propriétaire |

### Règles de passage entre agents

1. Le pilote reformule le ticket actif et rassemble ses décisions avant code.
2. Développement réaudite les hypothèses et signale toute incompatibilité
   technique avant d'implémenter ; il n'invente ni barème, ni prix, ni design.
3. Les agents consultés rendent leur avis sur les critères relevant de leur
   domaine avant la clôture du ticket, pas après le merge.
4. Direction artistique et Finance & Pricing produisent spécifications, mesures
   et revues ; leurs recommandations deviennent exécutoires seulement après
   arbitrage produit/propriétaire et transmission à Développement.
5. Aucun ticket nécessitant un conseil externe ne peut ouvrir la fonctionnalité
   concernée sur la seule base d'une auto-évaluation interne.

### File P0 assignée — moteur de correction formative

Les codes ci-dessous désignent des **rôles d'agent stables**, pas le nom
temporaire d'un chat. Un seul agent est responsable de chaque ticket. Un autre
agent peut être consulté, mais ne modifie pas le même lot simultanément.

| Code | Rôle et frontière |
| --- | --- |
| `AGENT-PEDAGOGIE` | Consigne, objectifs, critères, éléments, templates et remédiations. Aucun code applicatif ni budget. |
| `AGENT-DEV-LEARNX` | Schémas, compilateur, runtime, tests, idempotence et exécution autorisée. N'invente aucune règle pédagogique. |
| `AGENT-METHODOLOGIE` | Oracles mécaniques, métamorphismes, mutation testing et audit indépendant. Ne retune ni contrat ni modèle. |
| `AGENT-PROTOCOLE-IA` | Identité expérimentale, route, profil, manifests, stop-policy et dossier reproductible. Aucun dispatch. |
| `AGENT-FINANCE` | Borne de coût, plafond, réconciliation et décision d'enveloppe. Aucun choix pédagogique. |
| `AGENT-RECHERCHE` | Journal append-only, article public après verdict stabilisé et limites méthodologiques. Aucun résultat inventé. |
| `AGENT-DA` | Restitution Atlas et compréhension utilisateur après stabilisation des états. Aucune règle métier. |
| `RAYAN` | Arbitrages propriétaire, autorisations d'appel, holdout, publication et activation. |

#### Tickets immédiats

| Ordre | Ticket | Statut de départ | Agent responsable | Consultés | Livrable obligatoire | Gate de sortie |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `V4-002A — Cadrage de l'activité pilote` | `DONE_RAYAN_A` | `AGENT-PEDAGOGIE` | `AGENT-DEV-LEARNX` | `docs/V4_WRITING_PILOT_BRIEF.md` : activité réelle, consigne, objectif observable, exclusions et risque | **Clos le 21 août 2026** : activité, scénarios, consigne, objectif et exclusions validés |
| 2 | `V4-002B — Contrat atomique successeur` | `IN_PROGRESS_WAIT_RAYAN_B` | `AGENT-PEDAGOGIE` | `AGENT-METHODOLOGIE`, `AGENT-DEV-LEARNX` | Contrat Markdown et JSON v2 `DRAFT` authorés : 3 critères, 10 éléments/propriétaires, règles, `EXPLICITLY_REFUTED`, templates et remédiations ; deux consultations reçues | **Rayan B** valide critères, faits libres distincts, variantes de cadres, propriété des lacunes et feedback |
| 3 | `V4-002C — Compilateur sémantique v2` | `WAIT_V4-002B` | `AGENT-DEV-LEARNX` | `AGENT-PEDAGOGIE` | Schéma/compilateur hors ligne, certificat v2, compatibilité historique et tests unitaires | Tous les contrôles statiques passent ; aucune publication |
| 4 | `V4-003A — Corpus mécanique successeur` | `WAIT_V4-002C` | `AGENT-METHODOLOGIE` | `AGENT-PEDAGOGIE` | Paires minimales, localité, monotonie, métamorphismes, injections et mutations | Oracle mécanique complet et reproductible |
| 5 | `V4-003B — Audit autonome indépendant` | `WAIT_V4-003A` | `AGENT-METHODOLOGIE` | `AGENT-DEV-LEARNX` | Rapport défauts/gaps sans modifier contrat, golds ou seuils | `READY_TO_FREEZE` ou `BLOCKED_WITH_FINDINGS` |
| 6 | `V4-003C — Gel de la nouvelle identité` | `WAIT_V4-003B_GO` | `AGENT-PROTOCOLE-IA` | `AGENT-DEV-LEARNX`, `AGENT-PEDAGOGIE` | Modèle/route/profil, corpus, mapping, runner, télémétrie et stop-policy empreintés | **Rayan C** valide le dossier exact, sans appel |
| 7 | `V4-003D — Enveloppe Finance du gate 4` | `WAIT_V4-003C` | `AGENT-FINANCE` | `AGENT-PROTOCOLE-IA` | Coût maximal par tentative, plafond total, nombre d'appels, politique coût absent | Finance `ARBITRATED`, puis autorisation réseau séparée de Rayan |
| 8 | `V4-009C-S2 — Exécution du nouveau gate 4` | `WAIT_FINANCE_AND_OWNER_GO` | `AGENT-DEV-LEARNX` | `AGENT-PROTOCOLE-IA`, `AGENT-METHODOLOGIE` | 4 workflows maximum, raw/usage/coûts persistés, verdict append-only, zéro replay | `4/4 GO` ou campagne close `NO-GO` |
| 9 | `V4-003E — Analyse et publication du verdict` | `WAIT_V4-009C-S2` | `AGENT-METHODOLOGIE` | `AGENT-RECHERCHE`, `AGENT-FINANCE` | Rapport méthodologique, comparaison historique, limites et entrée append-only | Rayan décide arrêt ou panel 10 × 2 |

#### Tickets conditionnels

| Ticket | Agent responsable | Condition d'ouverture | Résultat autorisé |
| --- | --- | --- | --- |
| `V4-009C-S3 — Corpus complet 10 × 2` | `AGENT-DEV-LEARNX` | Gate 4 réussi, budget Finance distinct et nouveau GO Rayan | `GO_TO_SEALED_HOLDOUT` éligible ou campagne close |
| `V4-003F — Article public de recherche` | `AGENT-RECHERCHE` | Verdict stabilisé et artefacts réconciliés | Nouvel article FR/EN immuable ; jamais réécriture silencieuse de l'ancien |
| `V4-009C-S4 — Holdout one-shot` | `AGENT-DEV-LEARNX` | `GO_TO_SEALED_HOLDOUT` + autorisation one-shot Rayan | `GO_AUTONOMOUS_FORMATIVE` ou NO-GO définitif de l'identité |
| `V4-010A — Branchement du pipeline promu` | `AGENT-DEV-LEARNX` | `GO_AUTONOMOUS_FORMATIVE`, contrat `PUBLISHED`, activité éligible | Pilote fermé derrière feature flag, sans effet progression |
| `V4-010B — Revue Atlas du pilote` | `AGENT-DA` | États et contrats runtime stabilisés | QA compréhension/accessibilité ; aucune modification des règles |

#### Handoffs obligatoires

Chaque agent termine par un paquet de reprise contenant : commit/baseline,
fichiers modifiés, validations exactes, limites, décision attendue et liste des
actions explicitement interdites. Le ticket suivant ne démarre pas sur un
simple résumé conversationnel. `AGENT-DEV-LEARNX` reste le seul agent autorisé
à exécuter un appel facturable, et uniquement après Finance et message direct
de Rayan portant modèle, données, nombre d'appels et plafond.

### Gates de consultation et preuves obligatoires

La matrice ne constitue pas à elle seule une consultation. Pour qu'une
consultation obligatoire soit considérée comme réalisée, le dossier du ticket
doit contenir, dans le rapport de l'agent de développement ou dans un artefact
explicitement cité :

- l'agent ou le conseil consulté, la date et le périmètre transmis ;
- la réponse reçue et les décisions qui en résultent ;
- les désaccords ou inconnues encore ouverts ;
- l'arbitrage du Propriétaire lorsque la réponse fixe un prix, une règle
  pédagogique, une promesse marketing, un design ou un gate externe ;
- la traduction de ces décisions en critères d'acceptation vérifiables.

Les statuts de consultation sont `NOT_REQUESTED`, `REQUESTED`, `RECEIVED`,
`ARBITRATED` et `BLOCKED`. `REQUESTED` ne vaut pas validation. Un ticket ne peut
pas être déclaré terminé tant que chaque consultation obligatoire n'est pas
`RECEIVED`, puis `ARBITRATED` lorsque le Propriétaire doit trancher.

Avant de coder, l'agent de développement doit publier un **registre de
consultation du ticket** contenant les lignes de la matrice applicables et leur
statut. Il peut construire un squelette technique réversible pendant une attente
uniquement si :

- aucune valeur métier, tarif, formulation ou décision visuelle n'est inventée ;
- la fonctionnalité concernée reste désactivée ;
- les hypothèses sont marquées explicitement comme non validées ;
- aucun commit de clôture ni push présenté comme ticket terminé n'intervient.

Avant commit de clôture, le rapport doit inclure une section **Consultations et
arbitrages**. Une phrase telle que « le backlog a été lu » ou « l'agent sera
consulté » ne constitue pas une preuve. Pour V4-001 à V4-006 déjà livrés, les
preuves manquantes sont inventoriées rétrospectivement avant la clôture de
V4-007 ; un conflit matériel ouvre un correctif séparé, sans réécrire
silencieusement l'historique.

### Livrables attendus des consultations à partir de V4-007

| Ticket | Livrable externe obligatoire avant clôture |
| --- | --- |
| V4-007 | Finance & Pricing : unité de crédit, actions facturables, coût prudent, marge de sécurité, arrondis, plafonds, version/date d'effet et règle anti-vente à perte. Produit & pédagogie : libellés apprenant, différence entre modes, vérification ciblée automatique, nouvelle analyse volontaire et contenu du devis. Aucun prix actif sans mesures et arbitrage du Propriétaire. |
| V4-008 | Finance & Pricing : allocation offerte, renouvellement, report, limites et ordre de consommation. Produit & pédagogie : compréhension des deux soldes, alertes et demande d'augmentation sans promesse trompeuse. |
| V4-008A | Produit & pédagogie : identité, déclenchement, consolidation et états du pipeline composite. Finance & Pricing : coût, plafond et retries absorbés du workflow. Direction artistique : conformité du contrat aux surfaces Atlas validées. Aucun appel facturable avant gel de l'identité. |
| V4-009 | Finance & Pricing : réservation, règlement, libération, retries absorbés et réconciliation. Produit & pédagogie : consentement, absence de débit surprise et historique compréhensible. |
| V4-009B | Produit & pédagogie : protocole préenregistré, oracle autonome scellé, métamorphismes et verdict `GO_AUTONOMOUS_FORMATIVE`. Finance & Pricing : budget maximal, coût complet par correction utilisable et règle d'arrêt. Développement : répétition Neon, instrumentation et identité technique reproductible. Aucun `24×3` ni holdout sans GO du mini-panel. |
| V4-009C | Produit & pédagogie : pipeline evidence-assist exact, quatre cas, corpus complet 10 × 2, holdout autonome et abstention. Finance & Pricing : plafonds R&D distincts et coût par correction utilisable. Développement : enveloppe de sécurité déterministe, manifeste et traçabilité append-only. Le Propriétaire rend séparément `GO_TO_SEALED_HOLDOUT` puis `GO_AUTONOMOUS_FORMATIVE` ; aucun appel facturable sans GO d'enveloppe. |
| V4-010 | Produit & pédagogie : flow complet de preuve, feedback, révision et clarification ciblée. Direction artistique : quatre états du moteur exécutable et hiérarchie mobile/desktop avant validation visuelle. |
| V4-011 | Produit & pédagogie : séparation remise/feedback/maîtrise, formats éligibles, contrat cumulatif déterministe et absence de revue humaine. Finance & Pricing : coût/devis des nouvelles versions de soumission. Direction artistique : comparaison des versions, révision et clarification. Ticket fermé tant que le gate déterministe n'est pas livré. |
| V4-012 | Finance & Pricing : définitions des coûts, marge, réconciliation et alertes. Produit & pédagogie : métriques de qualité interprétables sans réduire la pédagogie à une moyenne. |
| V4-013 | Finance & Pricing : flux marchand et hypothèses de trésorerie. Conseil externe : validation juridique, fiscale, comptable et conditions Revolut avant toute activation. |
| V4-014 | Finance & Pricing : packs, capacités moyennes et absence de vente à perte. Direction artistique : checkout et confiance. Conseil externe : paiement, facturation, rétractation et moyens de paiement autorisés. |
| V4-015 | Finance & Pricing : remboursements, litiges et clôture. Développement : faisabilité et réconciliation. Conseil externe : règles comptables, fiscales et de remboursement. |
| V4-016 | Produit & pédagogie : promesse V5 exacte et placement dans Parcours. Direction artistique : vue d'annonce sans contrôle factice. |
| V4-016A | Direction artistique : landing commerciale. Produit & pédagogie : promesses et preuves produit. Finance & Pricing : seules offres et capacités réellement validées. |
| V4-016B | Direction artistique : gabarits desktop des surfaces V4. Produit & pédagogie : maintien des flows et de la hiérarchie pédagogique. |
| V4-016C | Produit & pédagogie : reprise multi-programmes et priorités. Direction artistique : représentation mobile/desktop sans surcharge. |
| V4-016G | Direction artistique : présentation correction/crédits/paiement. Produit & pédagogie : confiance, limites de l'IA et compréhension du résultat. Finance & Pricing : exactitude des devis, soldes et historiques. |
| V4-017 | Produit & pédagogie : comportements sûrs et messages en cas de blocage. Finance & Pricing : budgets, seuils, kill switch et abus économiques. |
| V4-018 | Finance & Pricing : coûts observés, marges, scénarios et recommandation GO/NO-GO. Produit & pédagogie : qualité minimale et analyse des désaccords. |
| V4-018A | Finance & Pricing : budgets et coût d'acquisition par cohorte. Produit & pédagogie : compréhension de l'essai, absence de promesse trompeuse et séparation public/famille-amis/early adopters. |
| V4-019 | Produit & pédagogie, Direction artistique et Finance & Pricing : rapports finaux de leur domaine. Conseil externe : preuves exigées par les gates paiement/conformité. Le Propriétaire rend seul le GO final. |

## Cap V4

V4 livre :

- la correction assistée par IA des productions textuelles libres non
  déterministes ;
- des contrats de correction pédagogiques versionnés et auditables ;
- un fournisseur IA central OpenRouter, appelé uniquement côté serveur ;
- un benchmark reproductible pour sélectionner et mettre à jour les modèles ;
- une comptabilité d'usage LearnX exprimée en crédits, jamais en tokens pour
  l'utilisateur ;
- des allocations offertes et des crédits achetés strictement séparés ;
- un devis ou plafond visible avant chaque action payante ;
- une réservation atomique, un règlement au coût LearnX final et la libération
  immédiate de la différence ;
- un tableau de bord administrateur sur coûts, usages, marge et incidents ;
- l'achat de packs via Revolut Merchant, avec les moyens de paiement disponibles
  dont carte, Revolut Pay, Apple Pay et Google Pay lorsque l'appareil et le
  compte commerçant les permettent ;
- les protections de sécurité, confidentialité, budget et exploitation
  nécessaires à un service IA payant ;
- une vue « Créer une formation » explicitement non fonctionnelle annonçant V5 ;
- l'enrichissement commercial de la landing V3.5 avec capacités IA et tarifs
  réellement validés ;
- l'intégration des nouvelles surfaces V4 dans les gabarits, tokens et
  primitives mobile/desktop livrés et documentés par V3.5.

V4 ne livre pas :

- de chatbot, tuteur conversationnel ou assistant omniprésent ;
- d'explication IA libre en dehors de la correction structurée ;
- de génération de programme, étape, module, leçon, quiz ou exercice ;
- d'éditeur Créateur, de brouillon généré ou de publication assistée ;
- de marketplace, abonnement illimité, transfert ou retrait de crédits ;
- de correction automatique des quiz déjà déterministes ;
- de validation scientifique ou professionnelle par l'IA ;
- de revue ou correction opérationnelle par un étudiant, un administrateur, un
  créateur ou un autre humain ;
- de correction audio, image, vidéo ou autre preuve multimodale, préparée dans
  les contrats mais reportée à une version ultérieure ;
- de promesse de note fiable sans contrat, calibration et garde-fous ;
- de modèle ou tarif fournisseur codé en dur dans l'interface.

La génération guidée de formations, son questionnaire adaptatif, le funnel
auteur → contrôles → réviseur, la détection des parcours existants, l'analyse
des compétences manquantes, la composition de contenus réutilisés et la
publication de contenu généré appartiennent à V5.

## Responsabilités transférées à V3.5

La création de `BACKLOG_V3_5.md` retire de V4 les fondations qui doivent être
visibles et stabilisées avant l'IA et le billing :

| Ancien cadrage V4 | Source de vérité | Rôle restant en V4 |
| --- | --- | --- |
| V4-016D marque et tokens | V3.5-001 | Aucun ; V4 consomme les tokens validés |
| V4-016E primitives | V3.5-002 | Aucun ; V4 réutilise les primitives |
| Shells/navigation | V3.5-003 | V4 réutilise les shells sans navigation IA/finance parallèle |
| V4-016F apprentissage mobile | V3.5-004 | Revue des seules nouvelles surfaces V4 |
| V4-016B desktop global | V3.5-005 | V4-016B adapte correction, admin et paiement |
| V4-016A landing initiale | V3.5-006 | V4-016A ajoute capacités et offres validées |
| Contacts landing | V3.5-007 | Aucun CRM V4 ; cette vue reste le suivi simple |
| Icône application | V3.5-006B | Aucun redesign V4 ; manifestes et variantes sont réutilisés |
| V4-016H QA/design system | V3.5-008 et V3.5-009 | V4-019 contrôle l'intégration finale |

Les identifiants V4-016D, V4-016E, V4-016F et V4-016H restent volontairement
inutilisés dans V4 après ce transfert. Ils ne doivent pas être recréés.

## Références Atlas héritées de V3.5

- **A1 — Pack principal** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-screen-pack.html` ;
- **A2 — Contrat de composants** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-component-contract.html` ;
- **A3 — Pack complémentaire** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-screen-pack-two.html` ;
- **A4 — Administration Contacts** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-admin-contacts.html` ;
- **A5 — Landing avec preuves produit** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-landing-product.html` ;
- **A6 — Icône Atlas papier** :
  `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-icon-paper-option.html`.

Ces références fixent Atlas sans vert. V4 consomme les tokens, primitives,
shells et règles de QA clôturés en V3.5 sans rouvrir la palette, les fontes ou
la grammaire visuelle.

## Invariants produit, pédagogie et finance

1. Le serveur reste l'unique autorité de solde, réservation, règlement, score,
   validation, progression et droits d'accès.
2. L'utilisateur ne voit jamais de tokens. Il voit des crédits LearnX, une
   allocation, un prix estimé, un plafond et un historique compréhensible.
3. Une correction n'est possible que si l'activité possède un contrat de
   correction publié, versionné et compatible.
4. Le modèle ne choisit ni les critères, ni les niveaux, ni leurs poids, ni le
   seuil. Il propose seulement des relations candidates entre des éléments et
   des passages fournis. Ces relations ne sont jamais une entrée du calcul de
   niveau, de score, de maîtrise ou de progression.
5. Les constats mécaniques scorables et les relations IA candidates utilisent
   des types et certificats séparés. LearnX rejette toute clé ou span inconnu,
   conserve les offsets et hashes, et interdit toute conversion des candidats
   IA vers les statuts atomiques scorables de l'ancien moteur.
6. Le modèle, le prompt, le contrat, le catalogue de prix et le résultat sont
   versionnés afin de rendre toute correction reproductible et auditable.
7. Aucun routeur automatique ne choisit silencieusement un modèle. V4 promeut
   d'abord un chercheur de preuves unique ; un falsificateur indépendant n'est
   ajouté que par une campagne distincte démontrant un gain. Chaque rôle,
   modèle, fournisseur, profil, prompt et règle est épinglé. Un changement crée
   une nouvelle identité et exige une nouvelle promotion.
8. Une correction IA est étiquetée comme telle et ne vaut jamais validation
   scientifique, professionnelle ou humaine.
9. Toute évaluation dont la correction est déterministe conserve le moteur
   actuel et ne consomme aucun crédit IA. Cela inclut les quiz et
   mini-évaluations, y compris une réponse courte comparée à une liste de
   réponses acceptées. Une production libre évaluée par rubrique relève en
   revanche de la correction IA V4.
10. Une erreur sans résultat utilisable rend intégralement les crédits réservés
    à l'utilisateur ; LearnX absorbe l'éventuel coût fournisseur.
11. Le ledger est immuable, idempotent, lié à l'utilisateur et ne permet jamais
    un solde négatif ni une double attribution.
12. L'allocation offerte et les crédits achetés restent séparés jusque dans la
    ventilation des réservations et règlements. Leur ordre de consommation est
    une politique serveur versionnée encore à arbitrer. Les crédits achetés sont
    non transférables, non convertibles en espèces et utilisables uniquement
    dans LearnX ; leur éventuelle expiration n'est pas inventée par V4-008.
13. Les crédits vendus représentent une obligation future d'exécution : la
    trésorerie correspondante ne peut pas être considérée intégralement comme
    marge disponible.
14. Le prix utilisateur inclut coût fournisseur, frais, incidents,
    infrastructure, prélèvements et marge cible. Le coût fournisseur et le prix
    utilisateur restent deux données distinctes.
14A. Le coût fournisseur d'un workflow est la somme des coûts OpenRouter réels
    de tous ses appels utilisables ou absorbés. Il n'est jamais reconstruit à
    des fins de règlement à partir d'un nombre de tokens affiché publiquement.
15. Les exemples commerciaux d'usage utilisent la médiane observée ; les prix
    et plafonds utilisent un percentile prudent, initialement P90.
16. Aucune action ne devient « illimitée ». Des limites globales, individuelles,
    temporelles et par action existent côté serveur.
17. Les secrets fournisseurs et paiements ne sont jamais exposés au navigateur,
    journalisés ou inclus dans une réponse API.
18. La page V5 « Créer une formation » ne lance aucun appel IA, ne réserve aucun
    crédit et ne simule aucune fonctionnalité inexistante.
19. L'application installée ouvre toujours l'origine applicative : page d'accueil
    authentifiée si la session est valide, connexion sinon. Elle n'ouvre jamais
    la landing page marketing par défaut.
20. Toute correction opérationnelle est soit déterministe, soit réalisée par
    IA. Aucun étudiant, administrateur, créateur ou autre utilisateur ne peut
    attribuer, confirmer ou remplacer un score.
21. Une ambiguïté matérielle déclenche au maximum une clarification ciblée
    issue du contrat ; elle ne transforme pas la correction en conversation.
22. Aucune relation sémantique IA ne fonde un niveau ou un score, stable ou non.
    L'apprenant peut réviser ou clarifier sa réponse complète à partir des
    observations formatives ; seul un constat mécanique indépendant est
    scoré.
23. Toute révision ou clarification crée une nouvelle version immuable de la
    soumission et conserve le même snapshot de rubrique. Une réponse strictement
    identique restitue le certificat existant sans nouvel appel ni débit.
24. Toute nouvelle version complète faisant l'objet d'une correction reçoit un
    devis, une réservation et un règlement propres. Une erreur technique reste
    à la charge de LearnX.
25. Une nouvelle correction n'écrase jamais la précédente et n'a aucun pouvoir
    sur la progression. Les versions de soumission et certificats restent
    auditables.
26. Si un falsificateur est ultérieurement promu et déclenché, son coût prudent
    est inclus dans le plafond du devis initial. Aucun débit ou consentement
    surprise n'intervient ; la part non consommée est libérée.
26A. Le débit final ne dépasse jamais le plafond accepté. Un dépassement de coût
    fournisseur est absorbé par LearnX, audité et déclenche le seuil d'alerte ou
    la coupure configurée ; il ne crée jamais un débit complémentaire silencieux.
27. Les identités produit globales sont `Membre` et `Administrateur`. Le rôle
    technique `CREATOR` reste transitoirement compatible mais aucune nouvelle
    fonctionnalité V4/V5 ne doit dépendre directement de sa valeur.
28. Apprenant, propriétaire, auteur, éditeur et futur distributeur sont des
    relations ou capacités contextuelles à un programme. Tout membre actif peut
    apprendre et, en V5, créer un brouillon ; créer, publier et commercialiser
    restent des permissions distinctes.

## Décisions produit validées

- Ligne directrice de marque et d'interface V4 :

  > L'image à construire est celle d'un produit éditorial sérieux et calme, à
  > mi-chemin entre un environnement personnel d'apprentissage et une plateforme
  > de formation structurée — pas celle d'un « AI learning copilot » générique.

  Cette direction s'applique à la landing, à l'application mobile installée, au
  desktop, aux corrections, au billing et aux surfaces d'administration. Elle
  implique une hiérarchie claire, une densité maîtrisée, des formulations
  précises, des preuves visibles et une présence de l'IA limitée aux endroits où
  elle rend un service explicite.
- V4 hérite intégralement des invariants, tokens, primitives, gabarits et usages
  interdits de `BACKLOG_V3_5.md`. Un ticket V4 peut appliquer ou étendre ce
  système aux nouvelles surfaces, jamais réinventer silencieusement la marque.
- V4 couvre les productions textuelles qui nécessitent un jugement par rubrique :
  exercices libres puis évaluations d'étape textuelles. Audio, image, vidéo et
  autres preuves multimodales sont reportés, sans empêcher un contrat extensible.
- Les quiz et mini-évaluations dont la réponse peut être corrigée par le moteur
  déterministe existant n'appellent jamais l'IA.
- Il n'existe aucune file de correction humaine. L'apprenant peut réviser son
  retour ou répondre à une clarification ciblée ; LearnX enregistre alors une
  nouvelle version complète sans écraser le certificat précédent.
- Chaque version applique le même snapshot de rubrique. Aucune contestation
  libre, aucun complément isolé et aucune réponse identique ne déclenchent une
  nouvelle analyse facturable.
- Les campagnes Terra, Sonnet, Gemini Flash, Mistral, Opus et autres candidats
  documentés sont des preuves de sélection, jamais des choix implicites de
  production. V4-003 évalue désormais aussi une architecture composite
  explicite, avec correcteur primaire et vérificateur ciblé épinglés.
- La piste composite Mistral + Sonnet est une baseline historique `NO_GO`. La
  cible utilise d'abord Gemini comme chercheur de preuves ; LearnX calcule les
  niveaux et le feedback. Un falsificateur d'une autre famille n'est ajouté que
  si une expérience séparée démontre son gain, sans vote ni moyenne.
- Une nouvelle version complète est facturée selon son devis propre et son coût
  final. Elle ne devient jamais une autorité de progression.
- Si un falsificateur promu est imposé par le pipeline, il est couvert par la
  réservation du devis initial.
- LearnX n'expose pas deux statuts globaux et exclusifs `Étudiant`/`Créateur`.
  Tout compte actif est un membre capable d'apprendre ; les droits sur un
  programme proviennent de relations et capacités contextuelles. `ADMIN` reste
  un rôle global de gouvernance et `CREATOR` un mécanisme transitoire à migrer.
- La page Parcours devient le point d'entrée vers « mes parcours », la découverte
  des parcours et « créer une formation ».
- En V4, « créer une formation » ouvre uniquement une annonce honnête. En V5,
  cette même entrée ouvrira une nouvelle session conversationnelle de conception.
- En V5, aucune génération ne commence avant une recherche des parcours publiés
  pouvant satisfaire tout ou partie du besoin. Une couverture partielle doit
  conduire à proposer un parcours composite et la génération des seuls manques,
  jamais à copier silencieusement un programme existant.
- Le domaine public principal présente LearnX et son lancement ; l'application
  et sa PWA utilisent une entrée dédiée. L'architecture recommandée est un
  sous-domaine applicatif afin d'isoler routes, session, service worker et cache.

## Décisions commerciales provisoires

Ces valeurs servent à concevoir le système ; elles restent configurables et ne
doivent être publiées qu'après benchmark et validation fiscale/comptable.

- Unité lisible envisagée : `1 crédit LearnX = 0,01 €` de prix utilisateur.
- Cette parité, équivalente à 100 crédits par euro, est une hypothèse non
  validée. Elle reste configurable, versionnée et inactive tant que le
  Propriétaire ne l'a pas explicitement arbitrée.
- Recharges initiales envisagées, sans différence fonctionnelle :
  `Essentiel` 1 000 crédits / 10 €, `Régulier` 2 500 / 25 € et
  `Intensif` 5 000 / 50 €.
- Aucun bonus de volume au lancement.
- Marge de contribution cible initiale : 10 % ; alerte sous 8 % ; revue
  tarifaire sous 5 %. Ne parler de marge nette qu'après déduction des coûts
  fixes, CFE, comptabilité et autres charges réellement applicables.
- Le stress-test utilise provisoirement le scénario micro-BNC prudent. BIC ou
  BNC dépend de la qualification réelle de l'activité et ne constitue pas un
  paramètre commercial librement choisi.
- Le calcul de marge de contribution intègre cotisations et CFP, VFL seulement
  s'il est applicable et choisi, frais de paiement, coût OpenRouter chargé,
  change, TVA non récupérable si elle est confirmée, infrastructure variable et
  erreurs ou incidents absorbés.
- Aucun prix ne dépend de l'inactivité supposée des utilisateurs ni d'une
  promotion fournisseur temporaire.
- Coefficients de sensibilité à tester : environ 2,6 fois le coût fournisseur
  brut agrégé dans le scénario central prudent et jusqu'à 2,9–3,0 dans le
  scénario défavorable. Aucun coefficient ne devient une constante définitive.
- Les crédits achetés sont reportables et sans expiration au lancement sous
  réserve de validation juridique/comptable. L'allocation offerte ne se reporte
  pas et sa période de renouvellement est explicite.
- Recharge OpenRouter centralisée et suffisamment grande pour amortir les frais
  fixes de recharge.
- Points externes bloquants avant vente : qualification BIC/BNC, éligibilité au
  versement libératoire, traitement TVA des factures OpenRouter, conditions
  Revolut Merchant, qualification fiscale/juridique des crédits fermés et
  obligations de facturation, rétractation et remboursement.

### Baseline OpenRouter de simulation — 12 août 2026

Cette baseline sert aux stress-tests et au dimensionnement des benchmarks. Elle
ne constitue ni un catalogue LearnX actif, ni une garantie fournisseur. Les
prix prudents ignorent les promotions temporaires.

| Candidat | Identifiant canonique épinglé | Entrée prudente / M | Sortie / M | Cache read / M | Particularité |
| --- | --- | ---: | ---: | ---: | --- |
| GPT-5.6 Terra | `openai/gpt-5.6-terra-20260709` | 2 $ | 12 $ | 0,20 $ | tarif hors promotion 50 % |
| Claude Sonnet 4.6 | `anthropic/claude-4.6-sonnet-20260217` | 3 $ | 15 $ | 0,30 $ | cache write 3,75 $, ou 6 $ pour 1 h |
| Gemini 3.6 Flash | `google/gemini-3.6-flash-20260721` | 1,50 $ | 7,50 $ | 0,15 $ | recherche web 0,014 $ |
| GPT-5.6 Luna, V5 seulement | `openai/gpt-5.6-luna-20260709` | 0,20 $ | 1,20 $ | 0,02 $ | tarif hors promotion 50 % |
| GPT-5.6 Sol, V5 seulement | `openai/gpt-5.6-sol-20260709` | 5 $ | 30 $ | 0,50 $ | recours exceptionnel à démontrer |

- Les identifiants d'appel non datés peuvent être conservés dans une table de
  découverte, mais les benchmarks et résultats utilisent le slug canonique.
- Les recherches web sont budgétées séparément : hypothèse prudente de 0,01 $
  pour OpenAI/Sonnet et 0,014 $ pour Flash.
- L'approvisionnement OpenRouter ajoute 5,5 %, avec minimum de 0,80 $ par achat.
- Le scénario TVA défavorable reste une sensibilité séparée : coût fournisseur
  × 1,055 × 1,20 = × 1,266, hors change.
- Au-delà de 272k tokens d'entrée sur les modèles OpenAI, une grille majorée est
  déclarée ; la conception de programmes longs V5 doit donc travailler par lots.

Pour V4-003, les profils théoriques de passage unique sont :

| Taille hypothétique | Terra médiane/P90 | Sonnet médiane/P90 | Flash médiane/P90 |
| --- | ---: | ---: | ---: |
| Courte, 4k/2k puis 8k/4k entrée/sortie | 0,032/0,064 $ | 0,042/0,084 $ | 0,021/0,042 $ |
| Moyenne, 15k/4k puis 30k/8k | 0,078/0,156 $ | 0,105/0,210 $ | 0,053/0,105 $ |
| Longue, 60k/8k puis 120k/16k | 0,216/0,432 $ | 0,300/0,600 $ | 0,150/0,300 $ |

Ces coûts théoriques ne remplacent jamais `usage.cost`, les répétitions du
benchmark ou les mesures live. Le prix seul ne sélectionne pas le modèle.

## États principaux à spécifier

### Correction

```text
NOT_REQUESTED
    ↓ devis accepté + crédits réservés
RESERVED
    ↓ recherche de preuves
EXTRACTING_EVIDENCE
    ├── certificat stable ──► FEEDBACK_READY
    ├── élément requis non démontré ──► REVISION_REQUIRED
    ├── ambiguïté matérielle ──► CLARIFICATION_REQUIRED
    ├── erreur récupérable ──► RETRY_PENDING
    └── échec final ──► TEMPORARILY_UNAVAILABLE + RELEASED
```

`COMPLETE` ou la réussite pédagogique ne provient jamais du modèle ni du
certificat. Le serveur valide la structure, exécute la rubrique et décide la
transition autorisée. Une révision ou clarification produit une nouvelle version
complète et ne modifie jamais silencieusement la précédente. Aucun résultat IA
ne devient une autorité de progression.

### Réservation de crédits

```text
CREATED
    ├── fonds insuffisants ──► REJECTED
    └── fonds bloqués ──► RESERVED
                              ├── succès ──► SETTLED + différence RELEASED
                              ├── annulation ──► RELEASED
                              └── expiration ──► RELEASED
```

### Paiement

```text
CREATED → PENDING → PAID → FULFILLED
              ├── FAILED
              └── EXPIRED

PAID/FULFILLED → REFUND_PENDING → REFUNDED
PAID/FULFILLED → DISPUTED → WON | LOST
```

Le webhook serveur vérifié fait autorité. Une page de retour navigateur ne peut
jamais créditer un compte.

## Ordre de livraison proposé

```text
Lot cadrage et preuves
V4-001 → V4-002 → V4-003

Lot fournisseur et moteur de correction
V4-003 → V4-004 → V4-005

Lot crédits et tarification
V4-001 → V4-006 → V4-007 → V4-008

Lot alignement composite correctif
V4-003 + V4-004 + V4-005 + V4-007 + V4-008 → V4-008A

Lot correction apprenant
V4-008A → V4-009 → V4-009B (NO-GO documenté) → V4-009C → V4-010
→ V4-011 (fermé jusqu'au gate déterministe de maîtrise)

Lot administration et exploitation
V4-009 → V4-012
V4-004 + V4-006 → V4-017

Lot paiement
V4-006 + V4-008 → V4-013 → V4-014 → V4-015

Lot annonce V5
V4-016, indépendant du moteur IA ; préparation possible sur le GO technique
V3.5, rollout après sign-off humain V3.5

Lot acquisition et lancement
V3.5-006 fournit la landing et la collecte initiale ; V4-016A ajoute les
capacités IA et les tiers après V4-018, puis ouvre l'achat après V4-014

Lot polish desktop
V3.5-005 fournit les gabarits ; V4-016B les applique aux surfaces V4-010,
V4-012, V4-014, V4-016, V4-016A et V4-016G

Lot accueil multi-programmes
V4-016C est indépendant du moteur IA ; préparation possible sur le GO technique
V3.5, clôture et rollout après sign-off humain V3.5 ; son rendu desktop est revu
par V4-016B

Lot expérience correction et finance
V3.5-009 + surfaces V4-007/V4-010/V4-011/V4-014 → V4-016G

Lot sortie
V4-001…V4-017 + V4-016A + V4-016B + V4-016C + V4-016G
→ V4-018 → V4-019
```

### Gates de livraison validées

- **V4A — correction pilote sans paiement réel** : V4-001 à V4-010, y compris
  le correctif V4-008A, la preuve V4-009B et le gate V4-009C, V4-012,
  V4-016, V4-016C, V4-016G pour les surfaces disponibles et V4-017 au niveau
  requis. Elle livre corrections d'exercices textuels, allocations gratuites,
  ledger, administration et mesure des coûts. Les évaluations d'étape et les
  achats restent désactivés.
- **V4B — évaluations, commerce et clôture** : V4-011, V4-013 à V4-015,
  compléments V4-016A/B/G, V4-018 et V4-019. Elle n'ouvre les évaluations
  d'étape qu'après livraison du gate déterministe de maîtrise, et les packs et
  paiements seulement après validation économique, fiscale,
  juridique, sécurité et exploitation.
- V4A peut être testée et déployée à un groupe pilote sans attendre V4B. V4 ne
  reçoit toutefois son verdict final qu'après V4B et V4-019.

## Jalons livrables et changements visibles

Le découpage doit permettre de tester V4 avant que l'ensemble du billing soit
ouvert. Un jalon n'autorise pas à contourner les dépendances de ses tickets.

### Jalon A — Fondations contrôlables

Tickets principaux : V4-001 à V4-008A et V4-017 au niveau requis par le pilote.

- Les contrats, modèles, coûts, crédits et limites sont testables par
  l'administration, sans paiement réel.
- Les utilisateurs ne voient encore aucune promesse de correction payante.
- La vue V4-016 peut être livrée dès ce jalon : c'est le premier changement
  visible, mais elle demeure strictement informative.
- La landing, la liste d'attente, les primitives et les gabarits V3.5 sont la
  baseline ; V4-016A n'affiche encore aucun prix ou achat non validé.
- V4-016B peut préparer l'intégration desktop des nouvelles surfaces dès que
  leurs contrats sont stables.
- L'accueil multi-programmes V4-016C peut être livré indépendamment de l'IA :
  chaque programme suivi redevient visible et reprenable depuis Aujourd'hui.

### Jalon B — Première correction utilisable

Tickets principaux : V4-009 et V4-010.

V4-009 ne commence qu'après clôture de V4-008A. Le jalon ne peut donc pas
réutiliser le chemin mono-modèle ou binaire des anciennes fondations.

- Un utilisateur pilote peut faire corriger un exercice textuel éligible avec
  une allocation offerte.
- Il voit le coût maximal avant confirmation, puis la correction, le montant
  réellement débité et la différence libérée.
- Aucun achat n'est encore nécessaire : ce jalon valide la qualité et
  l'économie réelle avant d'accepter de l'argent.

### Jalon C — Supervision et évaluation élargie

Tickets principaux : V4-011 et V4-012.

- Les ambiguïtés matérielles reçoivent une clarification ciblée ; aucun humain
  ne corrige ou n'arbitre la soumission et aucune réponse identique n'est
  recorrigée.
- L'administrateur suit qualité, coûts, incidents, soldes et marge projetée.
- Les évaluations d'étape sont ouvertes après preuve de fiabilité sur les
  exercices textuels **et** livraison du gate cumulatif déterministe de maîtrise.
  Cette progression réduit le risque de lancement mais ne
  les repousse pas hors de V4.

### Jalon D — Achat de crédits

Tickets principaux : V4-013 à V4-015.

- Les packs et moyens de paiement validés sont disponibles à un groupe pilote.
- L'attribution repose exclusivement sur les webhooks vérifiés et le ledger.
- Remboursements, litiges et clôture sont opérationnels avant élargissement.

### Jalon E — V4 publiable

Tickets principaux : V4-016A, V4-016B, V4-016G, V4-018 et V4-019.

- Les prix sont issus des mesures, le pilote respecte les seuils stop/go et les
  parcours critiques disposent d'un rollback.
- La landing affiche uniquement le catalogue commercial validé et distingue
  clairement inscription au lancement, candidature pilote et création de compte.
- L'audit final confirme que landing, correction, administration et paiement
  respectent la baseline V3.5 avec des données réalistes.
- V4 n'est officiellement terminée qu'après audit GO explicite.

---

## V4-001 — ADR correction IA, financement et frontières de confiance

**Priorité : P0. Dépendance historique satisfaite par la baseline technique
V3.5 ; son assurance de release externe reste à réconcilier avant V4-019.**

### Périmètre

- Réauditer les soumissions, rubriques, rôles, capacités, progression, audit,
  confidentialité, environnements et déploiement réellement livrés par V3.
- Comparer et arrêter l'architecture du fournisseur central, des contrats de
  correction, du ledger, des réservations, du catalogue de prix et des paiements.
- Définir les frontières de données entre LearnX, OpenRouter, les fournisseurs
  de modèles et Revolut.
- Documenter les menaces : prompt injection, exfiltration, double dépense,
  replay webhook, concurrence, fuite de clé, dépassement de budget et résultat
  non conforme.
- Inventorier toutes les productions non déterministes à couvrir dans V4 et
  définir l'ordre de calibration de leurs formats de preuve.

### Hors périmètre

- Migration, SDK, secret, appel fournisseur, paiement ou UI.

### Critères d'acceptation

- L'ADR contient options rejetées, décisions, états, responsabilités, stratégie
  de migration et rollback.
- Les données envoyées au fournisseur, leur rétention et l'information de
  l'utilisateur sont explicites.
- Les quiz et mini-évaluations corrigibles de manière déterministe, ainsi que
  les activités sans contrat, restent hors IA.

### Tests et risques

- Revue produit, pédagogique, sécurité, finance et exploitation.
- Risque principal : concevoir un wallet ou un score piloté par le frontend.

---

## V4-002 — Contrat de correction pédagogique versionné

**Statut : ACTIF HORS LIGNE — PUBLICATION BLOQUÉE. Priorité : P0 pédagogie.
Dépendances : V4-001.**

### Périmètre

- Définir un schéma versionné de contrat de correction pour toute production
  non déterministe : exercice libre, projet, étude de cas, exercice pratique,
  devoir écrit, oral documenté, simulation documentée ou examen cumulatif.
- Inclure objectifs, critères, poids, niveaux de performance, éléments attendus,
  variantes acceptables, erreurs fréquentes, sources autorisées, exemples
  étalonnés, seuil, règles de preuve, propriété des pénalités et clarification.
- Authorer explicitement la différence entre absence, refus explicite,
  contradiction et ambiguïté suivant
  `docs/V4_EVIDENCE_SEMANTIC_ARBITRATION.md`. Pour le MVP, le refus explicite
  d'un élément positif requis partage l'effet de niveau de l'absence, mais pas
  son certificat ni son template.
- Définir une vue candidate distincte du contrat : proposition de l'élément,
  variantes, contre-exemples, règle candidate de un à quatre spans et aucune
  donnée de points, poids, niveau ou score. Le modèle retourne uniquement
  `elementKey + EVIDENCE_FOR_ELEMENT|EVIDENCE_AGAINST_ELEMENT|ABSTAIN +
  spanIds`. Le serveur résout les spans et conserve les relations comme
  observations candidates non scorables.
- Définir séparément les constats mécaniques authorés qui peuvent, eux seuls,
  alimenter une règle de niveau ou un score indicatif côté serveur.
- Si le contrat ne possède aucun constat mécanique indépendant, sa version
  publiable impose `indicativeScoreEnabled=false`, `level:null` et
  `indicativeScore:null`. Les poids et points historiques ne rendent jamais une
  relation evidence-assist scorable.
- Étendre le guide d'authoring sans imposer un nombre arbitraire de critères.
- Préparer un inventaire des activités existantes éligibles, incomplètes ou
  explicitement non compatibles.
- Séparer strictement les preuves tirées de la réponse de l'apprenant du
  grounding externe. Une source, un passage ou un claim externe ne peut jamais
  être présenté comme « Extrait de votre réponse ».
- Préparer, sans bloquer le premier pilote court, la provenance canonique
  `SourceVersion → Passage → Claim → KnowledgePack → RubricElement`. La
  vectorisation éventuelle reste un index dérivé et reconstructible, jamais une
  autorité éditoriale ou pédagogique.
- Limiter l'exécution V4 au texte. Le contrat peut réserver des types de preuve
  futurs — fichier, image, audio, transcription ou données structurées — sans
  les rendre acceptables tant qu'un ticket ultérieur ne les autorise pas.

### Hors périmètre

- Génération automatique de rubriques, migration globale, publication éligible
  et correction live avant le gate autonome.

### Critères d'acceptation

- Les poids totalisent 100 % et sont authorés, jamais inférés au runtime.
- Les bandes et règles de score mécanique sont versionnées ; une relation IA
  candidate ne peut en modifier ni l'entrée ni la sortie.
- Le contrat publié est immuable ; une nouvelle version n'altère pas les
  corrections historiques.
- Une activité sans contrat valide ne peut pas proposer une correction IA.
- Un test négatif prouve qu'aucun candidat evidence-assist ne peut être consommé
  par un calcul de niveau, score, maîtrise ou progression.
- Un second test négatif prouve qu'un comptage, une polarité, une couverture ou
  une absence de relations candidates ne peut contourner cette interdiction.
- Les informations éditoriales de preuve restent compatibles avec les règles
  de sourcing existantes.
- Le premier contrat faible risque peut être publié sans registre de knowledge
  packs si ses éléments sont entièrement authorés et traçables. Toute référence
  externe affichée reste séparée du certificat de preuve apprenant.

### Tests et risques

- Fixtures valides/invalides, compatibilité avec les rubriques existantes,
  mutations unitaires des critères et oracle autonome scellé.
- Risque : transformer une rubrique vague en fausse précision chiffrée.

---

## V4-003 — Corpus étalon et banc d'essai des modèles

**Priorité : P0. Dépendances : V4-002.**

### Périmètre

- Séparer trois ensembles dont les métriques ne sont jamais fusionnées : corpus
  mécanique à oracle exécutable, corpus sémantique synthétique qualifié de
  pseudo-oracle et shadow réel non annoté mesurant seulement stabilité,
  couverture, abstention, coût et dérive.
- Valider d'abord le contrat et le compilateur successeur sans appel. Le modèle,
  la route et le profil de la nouvelle identité sont choisis et gelés seulement
  dans `V4-003C`, après l'audit autonome. La faisabilité recommence ensuite par
  4/4 puis un corpus de développement 10 × 2 ; aucune identité historique n'est
  reprise.
- Comparer ensuite au moins trois candidats sur des identités reproductibles
  pour robustesse, latence et coût complet. Cette phase secondaire ne bloque pas
  le premier gate Sonnet 5 ; elle bloque V4-018, le prix et la généralisation
  commerciale. Les campagnes historiques sous un autre rôle ne comptent pas.
- Mesurer médiane, P75, P90, retry, clarification, faux statuts, couverture,
  abstention et variabilité.
- Mesurer les relations candidates, les identifiants de spans, faux supports,
  omissions, abstentions, polarité, couverture et variabilité. Ne jamais
  recalculer de niveau depuis ces relations : le corpus mécanique du moteur et
  le corpus sémantique evidence-assist restent deux preuves séparées.
- Définir les seuils de promotion, régression et rollback d'un modèle.
- Produire un rapport sans envoyer de donnée réelle non anonymisée.
- Conserver les campagnes mono-modèle et composites comme baselines historiques.
  Sonnet reste `NO_GO`, Mistral + Sonnet reste `NO_GO_PEDAGOGICAL` et Gemini
  juge reste `NO_GO_TECHNICAL_PANEL_INCOMPLETE`. Aucun de ces verdicts n'est
  requalifié. Sous le nouveau rôle de chercheur de preuves, Gemini 1.3 possède
  seulement un smoke positif sur cas évident ; il n'est ni promu ni comparable
  rétroactivement aux campagnes de notation.
- Préenregistrer avant appel la rubrique et son empreinte, le rôle exact du
  candidat, le budget, le profil, le corpus et les gates. Le falsificateur est
  une campagne séparée ; aucun second modèle n'est ajouté par défaut.
- Mesurer séparément chercheur seul, futur chercheur + falsificateur, retry
  technique et nouvelle version de soumission. Aucun de ces workflows ne
  partage abusivement ses métriques ou son identité de promotion.

### Hors périmètre

- Choix intuitif fondé seulement sur une réputation ou un benchmark public.
- Déploiement en production.
- Vote à la majorité, moyenne naïve, sélection du modèle le plus sévère ou
  délégation du niveau/score final à un modèle.
- Benchmark de conception ou de génération de formations V5.

### Critères d'acceptation

- Une rubrique finale est choisie par preuve et compilée. Les identités du
  chercheur, du falsificateur éventuel, des règles de consolidation et des
  coûts sont versionnées ; aucune combinaison ad hoc n'est autorisée.
- Les identifiants exacts sont épinglés ; aucun alias `latest` ou routeur auto.
- Le jeu de régression est réutilisable lors de tout changement.
- Les gates durs portent sur la sécurité, les preuves et l'utilisabilité finale.
  Pour la bêta, `eventualUnusableRunRate` doit rester ≤ 2 % et aucune sortie
  invalide ne peut être montrée ou débitée. `firstAttemptInvalidRate` devient un
  indicateur opérationnel avec cible ≤ 10 %, sans masquer les retries.
- Le gate evidence-assist impose d'abord 4/4, puis les 20/20 du corpus complet
  borné sous la même identité :
  spans connus, raw et contexte liés, sécurité injection/canari et coûts
  réconciliés à 100 %, zéro faux support critique, clé inconnue, champ interdit
  ou consommation d'une relation candidate par un score/niveau.
- Le gate mécanique du moteur impose zéro double pénalisation, combinaison non
  couverte ou niveau inatteignable, ainsi que monotonie et localité. Ses entrées
  ne proviennent jamais des relations candidates IA.
- Le holdout reste scellé jusqu'au GO du corpus complet de développement. Aucun
  `UNCERTAIN` ou `UNUSABLE` n'est présenté ou facturé comme correction complète.
- `GO_TO_SEALED_HOLDOUT` rend éligible la demande d'ouverture après les gates de
  développement ; une autorisation propriétaire distincte ouvre le holdout une
  seule fois, et seul son succès one-shot permet ensuite
  `GO_AUTONOMOUS_FORMATIVE`. Aucun des deux ne peut être remplacé par une revue
  humaine ou un vote de modèles.

### Tests et risques

- Tests métamorphiques, paires minimales et mutation testing du compilateur :
  mauvais propriétaire, exigence supprimée, règle non monotone, niveau
  inatteignable et double pénalisation. Les juges IA éventuels génèrent des
  attaques ou vetos diagnostiques ; ils ne fabriquent jamais la vérité.
- Risque : suradapter le prompt à un corpus trop petit.

---

## V4-004 — Adaptateur OpenRouter central et sortie structurée

**Priorité : P0 technique. Dépendances : V4-001 et V4-003.**

### Périmètre

- Implémenter un adaptateur serveur isolé, remplaçable et testé sans appel réel.
- Gérer modèles épinglés par rôle, timeouts, annulation, idempotence, limites de
  contexte, réponses structurées, erreurs normalisées et coût `usage`.
- Séparer strictement configuration dev, preview et production.
- Mettre en place secrets, rotation, allowlist modèle/fournisseur et kill switch.
- Autoriser un fallback de capacité seulement selon la politique validée, sans
  changement silencieux de modèle pour un résultat évalué.

### Hors périmètre

- Ledger, paiement, UI et génération de formation.

### Critères d'acceptation

- Aucun secret ou prompt sensible ne revient au client ou aux logs.
- Une réponse non conforme au schéma est un échec, jamais une correction valide.
- Le coût, le modèle, le fournisseur, la latence et l'identifiant de génération
  sont disponibles pour la comptabilité interne.
- Les tests utilisent un faux fournisseur déterministe ; les tests live sont
  séparés, plafonnés et désactivés par défaut.

### Tests et risques

- Timeouts, 402/429/5xx, réponse tronquée, JSON invalide, retry et kill switch.
- Risque : double facturation lors d'une nouvelle tentative non idempotente.

---

## V4-005 — Moteur persistant de correction et score serveur

**Priorité : P0. Dépendances : V4-002 et V4-004.**

### Périmètre

- Persister requête, raw fournisseur, contexte et canari empreintés, soumission,
  snapshot du contrat, identité du pipeline, prompts, modèles, relations IA
  candidates, constats mécaniques et certificats distincts.
- Rendre la création et les transitions idempotentes et concurrent-safe.
- Exécuter côté serveur les éventuelles règles mécaniques de niveau/score et les
  templates formatifs. Les relations IA candidates ne peuvent être passées à
  ces règles ni décider d'une validation ou modifier la progression.
- Préserver les soumissions, historiques antérieurs et redémarrages existants ;
  aucune nouvelle correction manuelle ne peut être créée dans le flow V4.
- Distinguer correction déterministe, correction IA et validation scientifique.

### Hors périmètre

- Crédit utilisateur, paiement et exposition UI complète.

### Critères d'acceptation

- Une même clé d'idempotence ne crée ni double correction ni double coût logique.
- Une sortie fournisseur valide conserve sa chaîne assistant brute exacte ; le
  parse ne peut pas devenir rétrospectivement la source de preuve brute.
- Le texte, le score et l'appréciation IA ne peuvent pas modifier directement
  la progression ou terminer l'activité.
- Les corrections historiques restent lisibles après évolution du contrat.
- Les cas publiables, à réviser, à clarifier ou indisponibles passent par des
  états serveur explicites (`FEEDBACK_READY`, `REVISION_REQUIRED`,
  `CLARIFICATION_REQUIRED`, `TEMPORARILY_UNAVAILABLE`) et ne deviennent jamais
  une tâche attribuée à un humain.

### Tests et risques

- Transactions, concurrence, replay, contrats obsolètes, modèle indisponible et
  coexistence avec les historiques antérieurs sans nouveau flow manuel.
- Risque : valider rétroactivement une activité sur un nouveau barème.

---

## V4-006 — Ledger immuable, deux soldes et réservations atomiques

**Priorité : P0 finance. Dépendances : V4-001.**

### Périmètre

- Concevoir et migrer un ledger append-only avec montants entiers, devise de
  crédit, provenance, référence, idempotence et audit.
- Séparer allocation offerte et crédits achetés ; définir ordre de consommation,
  renouvellement et report.
- Implémenter réservation, règlement, libération, expiration et ajustement
  administratif compensatoire sans mutation silencieuse.
- Fournir un solde serveur cohérent, recalculable depuis le ledger.
- Garantir aucune double dépense sous requêtes concurrentes.

### Hors périmètre

- OpenRouter live, catalogue de prix, pack et paiement Revolut.

### Critères d'acceptation

- Aucun montant flottant ; aucun solde négatif ; aucune suppression d'écriture.
- Les crédits achetés ne sont ni transférables ni convertibles en espèces.
- Une allocation expirée n'efface jamais les crédits achetés.
- Toute correction administrative produit une écriture inverse ou compensatoire
  liée à une raison et un acteur audité.

### Tests et risques

- Property tests, concurrence, retry, expiration, fuseaux UTC et reconstruction
  du solde depuis zéro.
- Risque : traiter un cache de solde comme source de vérité.

---

## V4-007 — Catalogue de prix versionné et devis serveur

**Priorité : P0 finance/produit. Dépendances : V4-003 et V4-006.**

### Gate de consultation avant clôture

- **Finance & Pricing — pilote** : fournir par écrit les décisions économiques
  listées dans la table des livrables. Sans mesures V4-003 exploitables, toutes
  les versions de catalogue restent `DRAFT` ou `INACTIVE` et aucun montant n'est
  présenté comme validé.
- **Produit & pédagogie — consultation obligatoire** : utiliser les libellés
  apprenant « Correction standard », « Correction détaillée », « Correction
  renforcée » et « Demander une nouvelle analyse ». Une option plus chère ne
  change jamais la grille, le seuil ou la probabilité de réussite ; elle ne peut
  promettre que la profondeur ou la vérification effectivement fournie.
- **Propriétaire — arbitrage** : valider toute unité, valeur, marge, activation
  d'action et formulation commerciale avant passage à `ACTIVE`.
- **Gate économique** : tant que V4-003 reste `NO-GO`, seuls schéma, états et
  catalogue générique `DRAFT` sont autorisés. Aucun prix, capacité, abonnement,
  pack, SKU ou endpoint de devis utilisable ne peut être activé.

### Périmètre

- Définir des actions facturables versionnées : correction standard, détaillée,
  renforcée et futures catégories réservées sans les activer. À ce stade,
  `DETAILED` et `REINFORCED` restent des possibilités de catalogue, pas des
  offres approuvées ; `REINFORCED` exige un gain supplémentaire benchmarké.
- Distinguer dans le devis : correction primaire avec vérification ciblée
  potentielle incluse dans le plafond, et nouvelle analyse volontaire comme action
  séparée avec son propre devis.
- Calculer prix estimé, plafond, plancher, coefficient de sécurité, modèle et
  expiration du devis à partir de données mesurées.
- Segmenter les plafonds P90 par type d'action et classe de taille d'entrée ; un
  document court et un travail long ne partagent pas un P90 global artificiel.
- Fournir un devis signé ou identifié côté serveur avant chaque réservation.
- Conserver coût fournisseur, prix LearnX, frais et marge comme dimensions
  distinctes visibles seulement par l'administration.
- Rattacher au catalogue les hypothèses et la date du tarif fournisseur. Les
  prix prudents et plafonds utilisent les tarifs hors promotion, jamais une
  remise temporaire observée le jour du calcul.
- Préparer le calcul des capacités moyennes des packs à partir des médianes.
  Pour un pack de `Q` crédits et une médiane observée `M_action`, afficher au
  plus `floor(Q / M_action)` comme estimation, jamais comme maximum garanti.

### Hors périmètre

- Affichage de tokens, tarif illimité ou prix définitif sans benchmark.

### Critères d'acceptation

- Le client ne peut modifier action, quantité, version ou plafond du devis.
- Un devis expiré ou incompatible doit être recalculé.
- Les prix historiques restent attachés aux opérations historiques.
- Un changement de modèle ou de prompt invalide les métriques concernées.
- Le coût interne agrège tous les appels du workflow. Le règlement utilisateur
  agrège uniquement le primaire et le vérificateur ciblé d'un résultat
  utilisable ; les retries techniques et incidents restent à la charge de
  LearnX et demeurent visibles dans les mesures internes.
- Le devis apprenant expose dans cet ordre : action et portée, estimation,
  maximum réservé dominant, inclusion éventuelle de la vérification ciblée
  automatique, règle de libération du reliquat et expiration locale.
- La vérification ciblée automatique n'est ni une action ni un consentement
  séparé ; son coût prudent est inclus dans le maximum initial. Une nouvelle analyse
  volontaire utilise `RECONSIDERATION`, un nouveau devis et une confirmation.
- Il n'existe aucune action de « réparation gratuite ». Une erreur technique ou
  un résultat inutilisable libère la réservation ; une nouvelle analyse
  volontaire est une nouvelle action facturable.
- `STANDARD`, `DETAILED`, `REINFORCED` et `RECONSIDERATION` restent des clés
  internes localisables. `REINFORCED` n'est activable qu'après preuve d'une
  vérification supplémentaire réellement implémentée et benchmarkée.
- En l'absence de prix actif, l'API renvoie un état indisponible explicite et ne
  retourne ni zéro, ni « gratuit », ni estimation fictive.
- La parité crédit/euro est configurable et versionnée ; `100 crédits/€` reste
  une hypothèse sans effet commercial tant qu'elle n'est pas arbitrée.
- Les recharges `10 €/1 000`, `25 €/2 500` et `50 €/5 000` restent des fixtures
  de simulation sans SKU ni paiement actif dans ce ticket.
- L'apprenant ne voit jamais tokens, fournisseur, modèle, coefficient de
  sécurité, percentile, coût fournisseur ou marge. Ces dimensions restent
  réservées à l'administration.

### Tests et risques

- Arrondis, bornes, changement de catalogue, prix plancher et marge négative.
- Risque : publier une capacité moyenne comme garantie contractuelle.

---

## V4-008 — Administration des allocations, limites et budgets

**Priorité : P1. Dépendances : V4-006 et RBAC V3.**

### Périmètre

- Permettre à Admin d'accorder, réduire par compensation et renouveler une
  allocation offerte avec raison, période et plafond.
- Représenter les attributions et ajustements par lots et écritures immuables ;
  les montants disponibles, réservés, consommés et expirés sont des projections
  dérivées, jamais une deuxième source de vérité mutable.
- Définir limites par utilisateur, capacité contextuelle, action et période,
  plus plafond global. Un rôle transitoire ne constitue pas une tarification.
- Exposer solde offert, solde acheté, réservations et historique à l'utilisateur.
- Ajouter alertes de seuil et demande d'augmentation sans l'accorder
  automatiquement.
- Auditer toute mutation administrative.

### Hors périmètre

- Paiement, transfert entre utilisateurs et allocation autoréglée par le client.

### Critères d'acceptation

- Aucun utilisateur ne voit le coût, le solde ou l'historique d'un autre.
- Une modification de rôle ou capacité n'altère aucun crédit acheté.
- Les plafonds s'appliquent côté serveur avant tout appel fournisseur.
- « Allocation offerte » et « Crédits achetés » sont les deux informations
  principales ; « Disponible au total » est une donnée dérivée secondaire.
- L'ajustement admin est préparé pour un panneau latéral desktop et une surface
  plein écran mobile, avec récapitulatif obligatoire avant validation.
- Les règles de période, expiration, renouvellement, grâce, ordre de consommation,
  montant et bornes restent configurables et inactives tant que leurs arbitrages
  ne sont pas validés. Le ticket ne leur attribue aucune valeur fictive.

### Tests et risques

- RBAC, IDOR, concurrence admin/utilisateur, renouvellement UTC et suspension.
- Risque : confondre autorisation métier et capacité financière.

---

## V4-008A — Alignement composite des fondations déjà livrées

**Priorité : P0 corrective. Dépendances : V4-003 à V4-008 ; commence après
V4-008 et bloque V4-009.**

**Statut historique : LIVRÉ comme fondation et baseline composite. Depuis
V4-009C, ses choix `primaire juge + vérificateur` et ses états pédagogiques ne
sont plus la cible produit. Les garanties financières, d'idempotence, de retry,
de route épinglée et de réconciliation restent réutilisées.**

### Gate de consultation avant code

- **Produit & pédagogie — pilote** : appliquer l'autorité courante
  `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md` et vérifier que modèle, serveur et
  progression conservent leurs autorités respectives. La spec composite locale
  non versionnée n'est pas une autorité active.
- **Finance & Pricing — consultation obligatoire** : confirmer le périmètre du
  devis unique, les appels inclus, les retries absorbés, le règlement et les
  dimensions de coût à mesurer sans activer de prix.
- **Direction artistique — consultation obligatoire** : confirmer que les
  états et données du contrat suffisent aux deux références Atlas validées,
  sans créer de nouvelle règle métier.
- **Propriétaire — arbitrage** : autoriser explicitement l'identité et le budget
  avant tout nouveau benchmark facturable. La construction et les tests hors
  ligne peuvent précéder ce GO.

### Périmètre historique livré

- Réauditer les livraisons V4-003, V4-004, V4-005 et V4-007 contre leurs
  contrats historiques, puis documenter les écarts avec l'autorité
  evidence-assist sans réécrire l'historique.
- Déprécier dans le chemin V4 toute autorité binaire, score, confiance globale
  ou décision de seconde passe provenant directement du modèle.
- Ajouter une identité composite immuable : primaire, vérificateur ciblé,
  profils, prompts, routes, règle de déclenchement et consolidateur versionnés.
- Étendre l'adaptateur à des rôles épinglés et indépendants, sans routeur auto,
  alias `latest` ou fallback inter-modèle silencieux.
- Étendre le moteur persistant aux tentatives par rôle et aux états
  `VERIFYING`, `PROVISIONAL`, `UNCERTAIN` et `UNUSABLE_RELEASED`.
- Implémenter hors ligne la règle de déclenchement et la consolidation définies
  dans la spec : le primaire reste la proposition, le vérificateur signale la
  stabilité et un écart matériel produit `UNCERTAIN`, jamais un vote ou une
  moyenne.
- Adapter le devis inactif pour inclure primaire et vérification ciblée dans un
  seul plafond, tout en excluant les retries techniques du règlement utilisateur.
- Préparer le benchmark composite sous une identité neuve ; ne lancer aucun
  appel facturable sans le GO explicite du Propriétaire.

### Hors périmètre

- Interface apprenant finale, prix actifs, paiement, promotion implicite d'un
  modèle, ouverture du holdout avant gate de développement.

### Critères d'acceptation

- Le registre d'écarts nomme chaque incompatibilité livrée et sa résolution.
- Les campagnes mono-modèle historiques restent lisibles et non comparables à
  la nouvelle identité composite.
- Le modèle ne produit ni verdict de réussite, ni score faisant autorité, ni
  décision de progression ou de routage.
- Le vérificateur reçoit la soumission et le même contrat, mais jamais la sortie
  primaire avant son analyse.
- Un retry conserve l'échec initial dans les métriques, reste invisible et à la
  charge de LearnX ; après échec final, la réservation est libérée.
- Une sortie `UNCERTAIN` n'expose aucun score exact ; une plage exige un calcul
  serveur versionné. `UNUSABLE_RELEASED` n'expose ni score ni débit.
- Le coût interne conserve tous les appels ; le règlement utilisateur n'inclut
  que les rôles utiles du workflow et reste borné au plafond accepté.
- L'ensemble reste désactivé en production tant que benchmark, consultations et
  GO du Propriétaire ne sont pas réunis.

### Tests et risques

- Tests unitaires des autorités, transitions, déclencheurs, désaccords,
  idempotence, retries, preuves et absence d'effet sur la progression.
- Test d'intégration hors ligne primaire seul, primaire + vérificateur, écart
  matériel, sortie invalide, timeout et règlement/libération simulés.
- Risque principal : adapter la persistance au nouveau vocabulaire tout en
  laissant un ancien chemin binaire continuer à faire autorité.

---

## V4-009 — Orchestration correction, réservation et règlement

**Priorité : P0. Dépendances : V4-005, V4-007, V4-008 et V4-008A.**

### Périmètre

- Orchestrer devis accepté, réservation, correction, validation structurée,
  règlement final, libération de différence et historique.
- Exécuter le correcteur primaire puis, lorsque la règle versionnée le demande,
  le vérificateur ciblé dans la réservation initiale sans nouvelle confirmation.
  Régler uniquement le coût réellement consommé et libérer la différence.
- Définir la politique de retry et l'absorption du coût en cas d'échec sans
  résultat utilisable.
- Protéger contre double clic, rechargement, reprise réseau et requête concurrente.
- Gérer insuffisance de crédit, devis expiré, kill switch et budget fournisseur.
- Réconcilier le coût OpenRouter avec l'opération LearnX.
- Régler à partir de la somme des coûts réels OpenRouter de tous les appels du
  workflow facturables, sans reconstruire le coût final depuis les tokens. Les
  retries techniques restent mesurés séparément et absorbés par LearnX.
- Réserver au plafond prudent du workflow composite, jamais à son coût moyen.
  Le devis utilisateur reste unique et n'expose ni noms de modèles ni vote.

### Hors périmètre

- Paiement pour acheter de nouveaux crédits.

### Critères d'acceptation

- Aucun appel fournisseur ne part sans réservation valide, sauf outil admin de
  benchmark explicitement séparé et plafonné.
- Un succès ne peut régler qu'une réservation ; un échec libère les crédits.
- Le devis, la réservation et le règlement forment une seule opération visible,
  même lorsque la vérification ciblée est appelée.
- La différence entre plafond et prix final revient immédiatement au bon solde.
- Le débit final est borné au plafond accepté. Tout dépassement fournisseur est
  absorbé par LearnX, audité et déclenche une alerte ou le kill switch prévu.
- Un coût orphelin déclenche une alerte et une réconciliation, jamais un débit
  silencieux de l'utilisateur.
- Après correction, le résumé plafond accepté / montant réglé / montant libéré
  reste disponible ; sa ventilation par origine est consultable séparément.

### Tests et risques

- Pannes à chaque frontière transactionnelle, replay et récupération après crash.
- Risque : impossibilité de transaction distribuée avec le fournisseur externe.

---

## V4-009B — Validation intégrée et progressive du pipeline composite

**Priorité : P0 gate. Dépendances : V4-003, V4-008A et V4-009. Bloque
l'activation de V4-010.**

### Périmètre

- Répéter les migrations et les scénarios de V4-009 sur une branche Neon
  jetable : devis, réservation, primaire, vérificateur éventuel, consolidation,
  règlement ou libération, reprise et idempotence. Aucune donnée de production
  ne doit être modifiée.
- Figer avant tout appel facturable l'identité complète du pipeline : modèles et
  routes épinglés, profils, prompts, règles de déclenchement, consolidation,
  désaccord, retry, budget et version du protocole.
- Vérifier hors ligne la chaîne complète avec des fournisseurs déterministes
  simulés, notamment primaire seul, vérification ciblée, désaccord matériel,
  sortie invalide, timeout, dépassement absorbé et résultat inutilisable.
- Exécuter ensuite un mini-panel réel plafonné de six cas représentatifs avec
  deux répétitions : réponse clairement réussie, clairement insuffisante,
  proche du seuil, critères mixtes, réponse concise et tentative d'injection.
- Mesurer qualité formative, faux positifs et faux négatifs, stabilité,
  citations, sorties invalides, sécurité, états incertains, latence, appels du
  vérificateur et coût complet du workflow par correction utilisable.
- Évaluer toutes les sorties contre l'oracle autonome scellé et les contrôles
  déterministes, sans modèle, fournisseur ni prix dans le paquet de décision.
- Si et seulement si le mini-panel reçoit un GO explicite du Propriétaire,
  exécuter le `24 cas × 3 répétitions` sous la même identité. Le holdout scellé
  reste une étape ultérieure, irréversible et distincte du réglage.
- Documenter les campagnes historiques et expliquer pourquoi elles ne peuvent
  pas être recombinées comme preuve de promotion lorsque leurs prompts,
  protocoles ou identités diffèrent.

### Hors périmètre

- Activation publique de la correction ou branchement de V4-010 sur des appels
  réels.
- Assouplissement silencieux du corpus, des golds ou des seuils pour faire passer
  un candidat.
- Ouverture du holdout après un mini-panel seulement.
- Benchmark exhaustif de nouveaux modèles sans hypothèse ni budget préenregistré.
- Décision tarifaire, packs ou parité définitive des crédits.

### Critères d'acceptation

- La répétition Neon est documentée et réussit sans toucher à la base partagée ;
  les migrations, le règlement et la libération sont rejouables et idempotents.
- Le mini-panel possède une enveloppe de run, une empreinte et un budget maximum
  vérifiables ; aucun appel extérieur au panel autorisé n'est mélangé aux coûts.
- Une sortie invalide ou inutilisable n'est jamais publiée ni débitée ; son coût
  fournisseur et son éventuel retry restent mesurés séparément.
- La vérification ciblée utilise la règle serveur figée. Elle n'est déclenchée ni
  par la seule confiance auto-déclarée d'un modèle, ni par une règle inventée
  après lecture des résultats.
- La décision autonome rend un verdict écrit et distingue non-conformité à
  l'oracle, défaillance technique, sécurité et frontière explicitement marquée
  comme abstention attendue.
- Le rapport présente au minimum accord de décision, faux positifs, faux
  négatifs, écarts par critère, variabilité, sécurité, preuves, sorties
  invalides, état `UNCERTAIN`, latence et coûts P50/P90 observés lorsque
  l'échantillon le permet.
- Un échec du mini-panel arrête la campagne avant le `24×3`. Toute modification
  de prompt, modèle, route ou règle crée une nouvelle identité et recommence au
  mini-panel.
- V4-010 peut être préparé uniquement derrière un feature flag désactivé et avec
  des fixtures simulées tant que le GO intégré n'est pas donné. Aucun utilisateur
  ne peut déclencher un appel réel avant validation de V4-009B.

### Tests et risques

- Tests unitaires des règles de déclenchement et consolidation ; intégration avec
  providers simulés ; répétition Neon ; mini-panel facturable plafonné puis gate
  autonome reproductible.
- Risques : dépenser sur un pipeline non viable, suradapter le prompt aux six cas,
  confondre une simulation rétrospective avec une preuve intégrée ou ouvrir le
  holdout trop tôt.

---

## V4-009C — Moteur de rubrique exécutable et validation du chercheur de preuves

Mise à jour du 16 août 2026 : le panel Gemini v2 est figé en NO-GO après une
citation non exacte. Le screening Sonnet 5 termine 3/3 `VALID`, mais son panel
s'arrête techniquement au 11e appel avec 2 500 tokens de raisonnement et aucune
sortie visible. Une nouvelle identité bornée à 1 024 tokens de raisonnement a
ensuite dépassé cette limite dès son premier appel (`1 082`) et s'est arrêtée
avant validation sémantique. Ce second résultat est un NO-GO technique de
profil, pas un verdict pédagogique sur Sonnet 5. Le retuning de profil et la
recherche large de modèles sont arrêtés ; à cet instant historique, la prochaine
étape était un arbitrage d'architecture et aucun holdout ou travail live n'était
ouvert.

Arbitrage postérieur du 16 août 2026 : le protocole evidence-assist à passages
déterministes est adopté sous une nouvelle identité conformément à
`docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`. Une attestation ultérieure lie la
désactivation explicite à `OPENROUTER_CHAT`, modèle
`anthropic/claude-sonnet-5`, route exacte `Anthropic`, fallback interdit et
`reasoning.effort=none`. L'état historique pré-exécution était
`OFFLINE_CAMPAIGN_FROZEN / NO_MODEL_CALL` : identité, profil et gates sont
attribués et empreintés ; aucun budget Finance/GO propriétaire n'était accordé.
Les NO-GO ci-dessus restent inchangés.

**Priorité : P0 expérimentation. Dépendances : V4-003, V4-009 et clôture
documentée du mini-panel V4-009B. Bloque l'activation réelle de V4-010.**

**État au 15 août 2026 : SMOKE POSITIF 1.3.0 APPROUVÉ, GATE TROIS CAS V1
`FAILED_INCONCLUSIVE_ORACLE_BOUNDARY`, GATE V2 `VALID`, PANEL 10×2
`OFFLINE_READY_BLOCKED` — le
smoke chercheur 1.1.0 s'est arrêté sur `MODEL_OUTPUT_TRUNCATED` et le smoke
1.2.0 sur `EVIDENCE_RESEARCHER_SPAN_MISMATCH`. Aucun n'est un verdict
pédagogique. Produit/pédagogie a arbitré une nouvelle identité où LearnX dérive
les offsets depuis une citation exacte unique et persiste le raw avant
validation. L'unique smoke frais a terminé `VALID`, Finance l'a réconcilié et
Produit/pédagogie l'a approuvé comme cas positif seulement. Il autorise la
préparation, pas l'exécution, du gate maîtrisé + négatif + injection. Le panel
reste fermé.**

**État courant au 20 août 2026 : le gate evidence-assist 3.0.0 a exécuté deux
appels synthétiques sous son autorisation HMAC single-use, sans retry/fallback,
pour `0,025622 USD` réconciliés à 100 %. Le positif est à `9/9`; le négatif à
`7/9` car `EVIDENCE_AGAINST_ELEMENT` est plausible mais incompatible avec le
gold gelé `NOT_DEMONSTRATED`. Le stop `SEMANTIC_DISAGREEMENT` clôt l'identité
sans replay. Mutation, injection, panel 10 × 2, holdout, publication V4-002 et
live V4-010 restent fermés.**

**Arbitrage du 21 août 2026 : le successeur ajoute
`EXPLICITLY_REFUTED` pour une exigence explicitement refusée. Sur un élément
positif requis, il partage provisoirement l'effet de niveau
`NOT_DEMONSTRATED`, tout en conservant un certificat et un template distincts.
`CONTRADICTED` reste séparé. La campagne 3.0.0, ses golds et son verdict ne sont
pas recalculés. Toute exécution future exige nouvelle identité, nouvel
arbitrage Finance et nouveau GO propriétaire.**

### Point de reprise pour le développement

- Livré hors ligne : spécification autoritaire, compilateur, archétype
  `WRITING/fr-FR`, oracle mécanique, pseudo-oracle sémantique 10×2, protocole
  `EVIDENCE_RESEARCHER`, calcul des gates, attestation catalogue et préflight
  bloqué par défaut.
- Livré hors ligne : runner evidence-assist 3.0 validate-only, deux manifestes
  liés par un freeze set, identité
  `cc4dd0df056f6733bdaf9b4ad45e7d001405d869e38ea742271564a0d3b36805`
  et commande idempotente de régénération/validation sans réseau.
- Livré hors ligne : décision sémantique successeur, paires minimales exactes
  absence/refus/contradiction/ambiguïté et funnel d'authoring. Ces artefacts
  n'étendent aucune autorité live et n'ouvrent aucun budget.
- La migration P0 dispatch/coût a été répétée sur une branche Neon jetable par
  le run Integration #125 (`31785569786`) ; son rapport est conservé dans
  `docs/V4_EXECUTABLE_RUBRIC_NEON_REHEARSAL_REPORT.md`.
- Le smoke 1.1.0 autorisé a dépensé `0,008241 USD` sur une tentative. Le modèle
  a utilisé 1 725 tokens de raisonnement sur une limite totale de 1 800, puis
  seulement 59 tokens visibles. Les deux autres appels n'ont pas été envoyés.
- Le diagnostic hors ligne est consigné dans
  `docs/V4_EXECUTABLE_RUBRIC_GEMINI_PROFILE_DIAGNOSIS.md` : le catalogue rend
  le raisonnement obligatoire et activé par défaut, donc l'omission du champ ne
  pouvait pas signifier `OFF`.
- Une identité 1.2.0 distincte propose `reasoning.effort=minimal`, une cible
  visible inchangée à 1 800 et une limite totale de 2 500. Finance a arbitré le
  14 août 2026 son plafond expérimental à `0,055 USD`, pour trois tentatives
  maximum, sans retry. Seule l'autorisation explicite du Propriétaire,
  postérieure à cet arbitrage, a permis le smoke.
- Le smoke 1.2.0 a consommé `0,00489225 USD` sur une tentative, avec zéro token
  de raisonnement et 891 tokens visibles, puis le validateur a rejeté au moins
  un triplet `start/end/text`. Aucun autre appel n'a été envoyé.
- La sortie structurée rejetée 1.2.0 n'a pas été persistée ; la cause exacte de
  l'offset reste indémontrable. L'identité 1.3.0 corrige cette lacune sans
  réécrire l'historique : le modèle fournit une citation exacte, LearnX exige
  une occurrence unique, dérive `start/end/hash`, et persiste un raw borné
  avant validation sémantique. Zéro ou plusieurs occurrences rendent la sortie
  invalide ; aucune normalisation ni approximation n'est autorisée.
- La campagne 1.3.0 préenregistrée porte le SHA-256
  `8694b09458a572687c9846292424bfa694b790a94076271739036553fc370087`.
  Elle prévoit un seul appel sur `writing-fr-base-mastered`, aucun retry, une
  borne pessimiste de `0,0172545 USD` et un plafond proposé de `0,0200000 USD`.
  Finance a arbitré ces montants pour une seule tentative, sans retry ni
  fallback. Après GO écrit, la tentative a terminé `VALID` pour un coût réel de
  `0,0041025 USD`, sans retry. Finance a clos l'enveloppe ; son reliquat n'est
  pas transférable.
- Produit/pédagogie approuve ce cas positif uniquement. Le prochain gate doit
  préenregistrer exactement un cas maîtrisé, un négatif/contradictoire et une
  injection sous la même identité technique, puis recevoir une nouvelle
  enveloppe Finance et un nouveau GO propriétaire.
- Ce gate trois cas dispose désormais d'un manifeste distinct, source unique
  pour 3 workflows, 3 appels maximum, aucun retry et arrêt au premier défaut.
  Il exige 3/3 sorties valides, 27/27 éléments couverts, citations exactes,
  discrimination du négatif, sécurité injection/canari et coût réconcilié à
  100 %. Les métriques de variabilité/métamorphisme sont non applicables à une
  répétition et restent réservées au futur panel 10×2. Produit/pédagogie et
  Finance ont arbitré son empreinte. Après GO propriétaire, le cas maîtrisé a
  terminé valide, puis le cas négatif a exposé une frontière insuffisamment
  discriminante du pseudo-oracle ; l'injection n'a pas été appelée. Ce NO-GO
  formel ne constitue pas un échec pédagogique démontré de Gemini. Le panel
  reste fermé.
- Une nouvelle fixture négative v2 indique explicitement qu'aucune option n'est
  choisie et qu'aucune recommandation n'est formulée, tout en conservant deux
  faits exacts du dossier. Produit/pédagogie l'a approuvée hors ligne comme
  pseudo-oracle synthétique non ambigu. Elle possède un corpus, une campagne et
  une empreinte distincts. Après arbitrage et GO distincts, ses trois cas ont
  terminé `VALID` : 27/27 statuts attendus, citations exactes, négatif
  discriminé et injection sûre, sans retry ni fallback. Ce résultat autorise
  seulement la préparation du panel 10×2. La nouvelle identité sépare désormais
  `requestedRoute=google-vertex/global` de
  `observedProvider=Google`, sans réécrire le champ historique ambigu.
- Le panel 10×2 v2 est préenregistré hors ligne avec neuf cas stables du corpus
  historique et le négatif atomique v2. Le cas frontière v1 est explicitement
  exclu ; les deux sources et la sélection sont liées par SHA-256. Le runner
  reste validate-only, `feature.enabled=false` et `networkCallsAllowed=false`.
- La campagne 10×2 reste proposée, non autorisée : coût attendu `0,20 USD`,
  plafond dur `0,50 USD`, 28 tentatives fournisseur maximum. Ces nombres ne
  sont ni un prix produit ni une calibration économique et ne sont pas
  transférés automatiquement au smoke 1.2.0. Le préflight calcule une borne de
  `0,34545 USD` pour les 20 appels initiaux et `0,518175 USD` pour 30
  tentatives ; sous le hard cap proposé, 28 tentatives seulement sont garanties
  au pire cas. Finance doit arbitrer cette capacité de retry avant tout GO.
- Après GO : exécuter 10 cas ×2 sans réutiliser les résultats historiques,
  produire ledger, sorties brutes, résumé et verdict append-only, puis arrêter
  immédiatement en cas d'échec du gate.
- Le holdout, le falsificateur et l'intégration utilisateur restent interdits à
  ce stade. Un GO du chercheur n'autorise que l'étape de preuve suivante.
- Les instructions Gemini et citation libre de cette section décrivent les
  identités historiques. Pour toute nouvelle campagne, la spécification
  evidence-assist impose des passages déterministes, des relations candidates
  seulement et le statut `CAPABILITY_ATTESTED_OFFLINE / NO_MODEL_CALL` jusqu'au
  gel de campagne, budget Finance et GO propriétaire.

### Décision et continuité de preuve

- Conserver définitivement le verdict `NO-GO` de
  `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0` ; mettre en pause son
  extension diagnostique `24×3` sans supprimer son manifeste ni ses artefacts.
- Référencer le journal append-only
  `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md`. Toute nouvelle campagne y ajoute
  son identité, ses empreintes, ses résultats et son verdict sans réécrire les
  campagnes antérieures.
- Traiter les résultats Gemini historiques comme un signal, pas comme une preuve
  actuelle : le modèle y attribuait encore des niveaux. La nouvelle identité ne
  réutilise aucun workflow historique.
- Appliquer `docs/V4_EXECUTABLE_RUBRIC_ENGINE_SPEC.md`. Le contrat authoring
  historique ne peut plus autoriser une campagne.

### Périmètre hors ligne — moteur

- Implémenter les schémas des éléments, règles, niveaux, spans et certificats,
  puis un compilateur bloquant les niveaux inatteignables, règles non monotones,
  combinaisons sans décision, propriétaires multiples, effets non autorisés,
  doubles pénalisations et critères holistiques déclarés pleinement compilables.
- Authorer un archétype `WRITING/fr-FR` de trois critères et six à dix éléments,
  avec propriété, exemples, contre-exemples, variantes, règles de preuve et
  templates de remédiation.
- Pour les identités historiques, valider les spans proposés par offsets et
  SHA-256 dans `responseText`. Pour l'identité 1.3.0, exiger une citation exacte
  dont l'occurrence est unique, puis dériver côté serveur les offsets et le
  SHA-256. Aucun passage du contexte ne peut être présenté comme extrait de
  l'apprenant.
- Produire un certificat candidate-only reconstructible. Ne jamais convertir
  ses relations en statuts atomiques, niveau, score, maîtrise ou progression ;
  seuls des constats mécaniques indépendants peuvent alimenter ces calculs.
- Séparer correction, exécution et finance ; conserver les garanties `CALL_INTENT`,
  idempotence locale et réconciliation du P0.

### Périmètre expérimental — chercheur de preuves

- Utiliser Gemini uniquement comme `EVIDENCE_RESEARCHER`. Dans le protocole
  1.3.0, il propose les statuts, citations exactes, contradictions et ambiguïtés
  des éléments ; LearnX seul dérive les spans. Le schéma lui interdit niveau,
  score, `PASS/FAIL`, effet de progression et feedback libre.
- Épingler avant appel l'identifiant exact, la route, le profil, le prompt
  d'extraction, le snapshot tarifaire, le corpus, les gates et la règle d'arrêt.
  Aucun alias, fallback ou route automatique.
- Ne pas inclure de falsificateur dans le premier panel. Une autre famille de
  modèle ne peut être ajoutée que dans une campagne distincte, aveugle aux
  niveaux calculés, après preuve d'un gain net sur les statuts et preuves.
- Conserver l'enveloppe de sécurité : séparation contexte/consigne/réponse,
  canari, limites, schéma strict et citations limitées à `responseText`.

### Jeux de preuve et mini-panel

- Construire d'abord un corpus mécanique de vecteurs atomiques avec oracle
  exécutable, paires minimales, localité, monotonie, contradictions et
  ambiguïtés matérielles/non matérielles.
- Construire séparément dix productions `WRITING` synthétiques × deux
  répétitions pour évaluer Gemini. Ce jeu est un pseudo-oracle sémantique et ne
  doit jamais être présenté comme un oracle formel ou une validation humaine.
- Les transformations couvrent paraphrase, ordre des phrases, fautes sans perte
  de sens, registre, concision complète, verbosité, typographie, retrait/ajout
  d'une seule preuve, contradiction, injection et canari.
- Ne jamais ouvrir ni utiliser le holdout scellé pour préparer, régler ou
  interpréter ce panel.
- Ne fixer aucun budget à partir des campagnes de notation historiques. Finance
  mesure le nouveau profil d'extraction, puis le Propriétaire donne un GO écrit.
- Produire un paquet réellement aveugle, un mapping scellé, un ledger append-only
  et des artefacts bruts empreintés. Aucun appel concurrent ou hors manifeste ne
  participe aux métriques.

### Gates historiques et successeur evidence-assist

- Compilateur : zéro propriétaire illégal, double pénalisation, niveau
  inatteignable, règle non monotone, combinaison non couverte ou score exact
  sous ambiguïté matérielle. Les mutations prévues doivent toutes être détectées.
- Les métriques `SUPPORTED`/`NOT_DEMONSTRATED` appartiennent uniquement aux
  campagnes historiques. Le successeur 3.0.0 mesure
  `EVIDENCE_FOR_ELEMENT|EVIDENCE_AGAINST_ELEMENT|ABSTAIN`, d'abord sur 4/4 puis
  sur 20/20 sous la même identité.
- Le successeur exige à 100 % : IDs/offsets/hashes LearnX, raw lié au contexte,
  sécurité injection/canari, identité/route et coûts réconciliés ; il exige
  zéro faux support critique, champ interdit ou relation candidate consommée
  par un score, niveau, maîtrise ou progression.
- Mesurer séparément relation, polarité, faux support, couverture, abstention,
  rejets locaux, variabilité, latence et coûts. Ne pas fusionner corpus
  mécanique, synthétique et shadow réel.
- Les golds synthétiques, métamorphismes et seuils sont scellés avant le
  candidat. Aucun `humanReviewApproved` n'est simulé.
- Aucun seuil, gold, prompt, cas ou contrôle n'est modifié après lecture des
  résultats. Tout changement crée une nouvelle identité et un nouveau panel.

### Suite conditionnelle

- Si le chercheur exact échoue, arrêter et documenter la famille d'éléments
  concernée. Ne pas revenir silencieusement à un modèle juge.
- S'il passe 4/4, exécuter exactement le corpus complet 10 × 2 défini par le
  protocole 3.0.0. Après 20/20 et scellement indépendant du holdout, demander
  `GO_TO_SEALED_HOLDOUT`, qui conserve `pipelinePromoted=false` et n'ouvre pas
  le holdout. Après autorisation one-shot, seul un holdout qualifié d'au moins
  24 cas, ouvert une fois et réussi selon les seuils préenregistrés peut
  produire `GO_AUTONOMOUS_FORMATIVE` et la mutation explicite
  `eligibility.pipelinePromoted: false → true`.
- Un falsificateur est comparé à Gemini seul sur les mêmes sorties. Il n'est
  retenu que s'il réduit les faux statuts sans augmenter indûment l'abstention,
  la latence et le coût.
- Aucun vote, moyenne, troisième arbitre ou pipeline à trois juges.

### Tests et risques

- Tests du compilateur, oracle mécanique, métamorphismes, mutation testing,
  Unicode/canari/citations, schéma invalide, retry, idempotence, réconciliation
  et paquet aveugle ; mini-panel facturable uniquement après autorisation.
- Risques : formaliser abusivement une propriété holistique, transformer
  `NOT_DEMONSTRATED` en jugement de maîtrise, suradapter un pseudo-oracle ou
  ajouter un falsificateur sans bénéfice mesuré.

---

## V4-010 — Correction des productions libres d'exercice

**Statut : ACTIF HORS LIGNE — ACTIVATION LIVE BLOQUÉE. Priorité : P0
utilisateur. Le fake provider, le feature flag forcé à off et les tests peuvent
avancer ; tout réseau/débit/live dépend du GO V4-009C et d'un contrat publié.**

### Périmètre

- Intégrer la correction aux exercices à production libre éligibles sans casser
  le parcours authoré, la navigation ni l'historique existant.
- Limiter le premier pilote aux exercices `WRITING/fr-FR` rattachés à une
  rubrique publiée et `FULLY_COMPILABLE`. Un exercice sans contrat éligible ne
  propose aucun appel IA.
- Afficher prix estimé/plafond, soldes utilisés et confirmation avant lancement.
- Afficher attente, reprise, erreur, crédits libérés et résultat structuré.
- Présenter les constats mécaniques indépendants et, dans une zone distincte,
  les passages associés à des observations IA candidates, les éléments non
  résolus et les propositions de révision issues des templates authorés.
- Nommer les preuves internes « Extrait de votre réponse » et séparer toute
  source externe dans une zone « Références mobilisées ».
- Ne présenter un score indicatif que pour une partie intégralement mécanique et
  indépendante. Aucun score ou niveau ne dépend du nombre, de la polarité ou de
  la couverture des relations IA candidates.
- Expliquer sobrement les états `FEEDBACK_READY`, `REVISION_REQUIRED`,
  `CLARIFICATION_REQUIRED` et `TEMPORARILY_UNAVAILABLE` avec des libellés
  humains. Ils ne sont jamais présentés comme une validation académique.
- Conserver et comparer les tentatives/corrections d'un même module run.
- Étiqueter clairement « Correction assistée par IA ».
- En cas d'ambiguïté matérielle, poser au maximum une clarification ciblée,
  dérivée du contrat. La réponse à cette clarification crée une nouvelle version
  immuable de la soumission ; elle ne devient pas un chat de négociation.
- Permettre à l'apprenant de dupliquer ou reprendre son travail pour le compléter,
  mais enregistrer le résultat comme une nouvelle soumission complète, avec son
  propre devis, sa propre correction et son propre historique.
- Une réponse strictement identique restitue son résultat existant sans nouvel
  appel ni nouveau débit. Seule une nouvelle version complète peut être corrigée
  à nouveau ; aucun résultat antérieur n'est réécrit.
- Le feedback public est rendu depuis le certificat de preuve et les templates
  authorés. Une reformulation libre par modèle reste hors MVP.

### Hors périmètre

- Chat libre, nouvelle consigne générée et évaluations corrigibles de manière
  déterministe.
- Critère `HOLISTIC`, domaine santé/réglementé/professionnel et modalité autre
  que texte tant qu'un contrat spécifique n'a pas franchi ses propres gates.

### Critères d'acceptation

- L'utilisateur connaît le maximum avant confirmation et le débit final après.
- Un état de révision, clarification ou indisponibilité est expliqué sans produire une fausse
  conclusion, exposer les modèles ni suggérer qu'un humain répondra.
- Le serveur contrôle raw, contexte, canari, spans, clés, injections et
  couverture. Il conserve les relations comme candidats non scorables ; aucun
  modèle ni mapping applicatif ne fournit le niveau, score, verdict ou feedback
  final.
- Un futur falsificateur n'est appelé que s'il a été promu séparément et inclus
  dans le devis initial. Il ne vote pas, ne moyenne pas et ne remplace jamais la
  décision déterministe de LearnX.
- Un retry imposé par une erreur technique reste invisible et à la charge de
  LearnX. Une sortie inutilisable ne produit ni résultat pédagogique ni débit.
- Une nouvelle tentative ne concatène jamais automatiquement l'ancien devoir et
  un complément : le payload soumis doit représenter la réponse complète que
  l'apprenant souhaite faire évaluer.
- Le certificat sépare les constats mécaniques des observations candidates et
  restitue les spans `start/end/hash`, versions et éléments non résolus. Sa
  partie IA expose toujours `level:null` et `indicativeScore:null`.
- Aucun état, score, certificat ou événement de correction ne modifie
  `ConceptProgress`, `StageProgress` ou `StageAssessmentSubmission.VALIDATED`.
- Clavier, lecteur d'écran, 320/390 px, zoom 200 % et erreurs réseau sont couverts.
- Les états et actions respectent les références Atlas validées aux largeurs
  320/390, 1440/1920 px, au zoom 200 %, avec focus visible, contrastes WCAG et
  reduced motion. Aucun état ne dépend de la couleur seule.
- Une actualisation ne relance ni l'appel ni le débit.

### Tests et risques

- Composants, E2E, réseau lent/hors ligne, double clic et textes longs.
- Risque : présenter le feedback IA comme une vérité ou un jugement personnel.

---

## V4-011 — Évaluations d'étape et maîtrise déterministe

**Statut : FERMÉ. Priorité : P1. Dépendances : V4-010, calibration exercice
réussie et gate cumulatif déterministe de maîtrise spécifié puis livré.**

### Périmètre

- Séparer explicitement trois états : production authentique remise, feedback IA
  formatif et maîtrise validée.
- Étendre le feedback aux productions d'étape entièrement textuelles : étude de
  cas, devoir écrit ou simulation décrite. Leur remise peut être obligatoire,
  mais leur correction IA ne constitue jamais une validation de maîtrise.
- Définir et livrer un contrôle cumulatif déterministe, multi-notions, corrigé
  côté serveur et indépendant de l'IA. Lui seul peut produire la preuve de
  maîtrise requise par la validation finale d'étape.
- Ne jamais proposer de correction IA pour un oral, une image, un fichier ou
  une preuve non textuelle tant que son format n'est pas implémenté et calibré.
- Réutiliser uniquement un moteur de rubrique exécutable et un chercheur de
  preuves ayant franchi leurs gates propres pour la famille d'évaluation visée.
- Une réponse identique restitue le certificat existant. Une révision ou une
  clarification crée une nouvelle version complète et immuable ; aucun argument
  séparé n'étend silencieusement la production évaluée.
- Auditer versions de rubrique, règles, prompts, certificat, score serveur,
  feedback, coût et absence d'effet sur la progression.
- Si la preuve reste ambiguë ou insuffisante, ne pas inventer une note : proposer
  remédiation, clarification ciblée ou nouvelle soumission selon le contrat.
- Interdire toute assimilation à une validation professionnelle/scientifique.
- Si un objectif ne peut être évalué ni déterministiquement ni humainement,
  LearnX ne prétend pas l'avoir validé.

### Hors périmètre

- Évaluation sans texte exploitable, domaine non calibré, observation live,
  image, fichier, audio, vidéo, transcription ou correction humaine.
- Chat de négociation avec le modèle, nouvelle analyse d'une réponse identique ou
  contestation libre transformée en preuve.
- Activation du ticket avant publication du contrat de maîtrise déterministe et
  de ses banques, seuils, remédiations et règles de nouvelle tentative.

### Critères d'acceptation

- Aucun écran, endpoint ou statut n'assigne une correction à un humain ou ne
  permet à un utilisateur de modifier le score.
- Toutes les versions de soumission et leurs certificats restent visibles,
  versionnés et non modifiables.
- Le moteur de progression reste indépendant du score et des résultats IA ; une
  analyse incertaine conduit à une nouvelle soumission formative sans bloquer
  artificiellement le parcours. La validation d'étape dépend exclusivement du
  gate déterministe de maîtrise et des autres prérequis serveur authorés.
- La production remise, le feedback reçu et la maîtrise validée ont des états,
  événements et historiques distincts ; aucun statut IA ne peut être traduit en
  `VALIDATED`.
- Un échec déterministe produit `NEEDS_REVIEW`, des ressources ordonnées liées
  aux notions et l'action « Revoir puis retenter ». Consulter une ressource ne
  valide jamais une notion et toutes les tentatives restent conservées.
- La politique de clarification et de révision est versionnée et validée par le
  Propriétaire avant activation ; le ticket n'invente aucune valeur au-delà de
  la clarification unique autorisée par le MVP V4-010.
- Un futur falsificateur promu utilise la réservation initiale ; une nouvelle
  version de soumission utilise une nouvelle réservation et un nouveau devis.
- Le passage à l'échelle est bloqué si les métriques de calibration régressent.

### Tests et risques

- Statuts atomiques erronés, ambiguïté matérielle, clarification répétée,
  idempotence, coûts, stabilité du score indicatif, indépendance de la
  progression, couverture multi-notions et remédiation déterministe.
- Risque : forte conséquence pédagogique d'une correction erronée.

---

## V4-012 — Tableau de bord IA, coûts, marge et réconciliation

**Priorité : P1 administration. Dépendances : V4-009.**

### Périmètre

- Afficher usage par période, utilisateur, action, modèle, statut et programme.
- Afficher coût fournisseur, prix utilisateur, crédits libérés, marge brute,
  erreurs absorbées et écarts de réconciliation.
- Afficher la marge de contribution disponible après coûts variables, sans la
  présenter comme bénéfice net. Séparer cotisations/CFP, VFL si applicable,
  paiement, OpenRouter, change, TVA confirmée, infrastructure variable et
  incidents absorbés lorsque ces dimensions sont disponibles.
- Suivre solde OpenRouter, crédits LearnX en circulation et réserve d'exécution.
- Exporter un journal exploitable sans contenu pédagogique ou donnée sensible.
- Définir alertes de marge, budget, coût anormal, fraude et coût orphelin.

### Hors périmètre

- Comptabilité officielle, déclaration fiscale automatisée ou accès apprenant aux
  marges internes.

### Critères d'acceptation

- Les agrégats se réconcilient avec ledger et usages bruts.
- Les données financières requièrent une capacité admin dédiée.
- Les exports minimisent les données et ne contiennent aucun secret ou texte de
  soumission.

### Tests et risques

- Agrégations, fuseaux, pagination, grands volumes et IDOR.
- Risque : dashboard cohérent visuellement mais faux comptablement.

---

## V4-013 — ADR et sandbox Revolut Merchant

**Priorité : P0 paiement. Dépendances : V4-006, V4-007 et validations externes.**

### Périmètre

- Vérifier compte Merchant, contrats, frais, devises, moyens de paiement,
  remboursements, litiges, facturation et environnements disponibles.
- Comparer Checkout hébergé et widget ; choisir la surface initiale la plus sûre.
- Définir ordre, paiement, webhook, fulfillment, référence utilisateur,
  idempotence et données conservées.
- Réaliser un flux sandbox sans valeur réelle et un plan de test Apple Pay dont
  les contraintes d'environnement sont explicites.
- Documenter rotation des secrets, signature webhook et procédure d'incident.

### Hors périmètre

- Vente réelle, pack public et crédit de production.

### Critères d'acceptation

- La décision se fonde sur les conditions du compte LearnX réel, pas seulement
  sur une page marketing.
- Le webhook vérifié est l'unique source d'attribution automatique.
- Aucun numéro de carte n'est manipulé ou stocké par LearnX.

### Tests et risques

- Webhook faux/rejoué/désordonné, paiement différé, expiration et retour client.
- Risque : environnement Apple Pay non testable comme Google Pay en sandbox.

---

## V4-014 — Packs, Checkout et attribution automatique

**Priorité : P0 paiement. Dépendances : V4-013.**

### Périmètre

- Après validation explicite des gates, permettre de configurer des recharges
  versionnées. Les hypothèses `Essentiel` 10 €/1 000, `Régulier` 25 €/2 500 et
  `Intensif` 50 €/5 000, sans bonus, ne sont ni des prix approuvés ni des SKU
  activables avant V4-018 et l'arbitrage du Propriétaire.
- Présenter ces offres comme des volumes prépayés, pas comme des abonnements ou
  niveaux fonctionnels ; aucune capacité produit n'est réservée au pack supérieur.
- Créer un Checkout authentifié lié à l'utilisateur et au pack choisi.
- Gérer carte, Revolut Pay, Apple Pay et Google Pay via les capacités du Checkout.
- Attribuer les crédits achetés une seule fois après paiement confirmé.
- Présenter montant, crédits, capacité moyenne indicative et conditions avant
  paiement, puis reçu et nouveau solde.
- Ne publier les capacités moyennes qu'après benchmark V4-018.

### Hors périmètre

- Abonnement, paiement récurrent, prix choisi librement et achat anonyme.

### Critères d'acceptation

- Le client ne choisit jamais librement le nombre de crédits attribués.
- Un événement rejoué ou concurrent ne double pas le fulfillment.
- Les capacités indiquent « en moyenne », avec périmètre et fourchette.
- L'estimation médiane, le plafond P90 réservé et le coût final réglé sont trois
  valeurs distinctes et nommées sans ambiguïté.
- Un paiement réussi reste récupérable si le retour navigateur est perdu.

### Tests et risques

- E2E sandbox, devise, paiement différé, webhook avant/après redirect et reprise.
- Risque : petits packs rendus non rentables par le forfait de transaction.

---

## V4-015 — Remboursements, litiges et clôture financière mensuelle

**Priorité : P0 exploitation. Dépendances : V4-012 et V4-014.**

### Périmètre

- Définir et implémenter remboursements autorisés, annulation des crédits non
  consommés selon politique validée, chargebacks et écritures compensatoires.
- Empêcher l'usage de crédits pendant un litige lorsque nécessaire sans supprimer
  l'historique.
- Produire une clôture mensuelle : ventes, frais, coût IA, crédits en circulation,
  réserve fiscale, réserve d'exécution, incidents et marge.
- Documenter les opérations manuelles et les preuves attendues.
- Alerter sur marge sous les seuils décidés.

### Hors périmètre

- Conseil fiscal automatisé ou retrait libre de crédits en espèces.

### Critères d'acceptation

- Un remboursement ou litige ne supprime aucune écriture historique.
- La clôture détecte coût orphelin, fulfillment manquant et solde incohérent.
- La marge n'est pas calculée avant provision des crédits encore en circulation.

### Tests et risques

- Remboursement partiel, double litige, solde déjà consommé et événement tardif.
- Risque : considérer le chiffre d'affaires encaissé comme bénéfice disponible.

---

## V4-016 — Vue « Créer une formation » annoncée pour V5

**Priorité : P2 produit. Dépendances : V3.5-009 et compte Membre actif.**

**Références : A3, vue `Création de formations`, et A2, vues `Navigation` et
`Actions`.**

### Périmètre

- Faire évoluer la page Parcours en point d'entrée cohérent vers la recherche de
  parcours, les parcours de l'utilisateur, les parcours disponibles et la
  création, sans dupliquer les fonctions déjà livrées en V3.
- Ajouter dans cet espace une action « Créer une formation » accessible aux
  membres actifs ; en V4, elle ouvre une vue d'annonce dédiée. `CREATOR` ne
  constitue ni une condition d'affichage ni une identité produit exclusive.
- Expliquer sobrement que la création guidée de formations est en cours de
  conception et arrivera dans une prochaine version.
- Présenter sans interaction factice les grandes intentions : cadrage du besoin,
  recherche des parcours existants, analyse de couverture, proposition de
  blueprint complémentaire, estimation avant génération et validation humaine.
- Offrir une action de retour claire vers les programmes.
- Choisir une entrée qui ne surcharge pas la navigation principale des apprenants.
- Préparer le contrat de navigation V5 : la même action ouvrira alors une nouvelle
  session conversationnelle de conception, sans implémenter ce chat en V4.
- Documenter dans la préfiguration le principe V5 « rechercher, réutiliser,
  compléter, puis générer », sans promettre que le moteur est déjà disponible.

### Hors périmètre

- Formulaire, chat, liste d'attente externe, appel IA, upload, estimation,
  paiement, brouillon, mutation éditoriale et promesse de date.

### Critères d'acceptation

- Aucun contrôle ne laisse croire qu'il fonctionne déjà.
- La route directe exige un compte actif sans distinguer étudiant/créateur ;
  aucune API de création n'existe.
- Depuis Parcours, la distinction entre « mes parcours », « découvrir » et
  « créer » est compréhensible sans ajouter un sixième item à la navigation.
- La page est traduite selon le socle i18n V3 et accessible sur mobile/desktop.
- La fonctionnalité est nommée « bientôt disponible », jamais « indisponible à
  cause d'une erreur ».
- La vue emploie les tokens Atlas, une seule action bleue dominante, aucun
  contrôle factice, aucune grande tuile active, aucun gradient IA et aucun
  motif cartographique suggérant qu'une génération a commencé.
- À 320/390, 1024, 1440 et 1920 px et au zoom 200 %, le texte ne déborde pas,
  les cibles font ≥ 44 × 44 px et le retour vers Parcours reste accessible au
  clavier avec focus visible.

### Tests et risques

- Session active/suspendue, route directe, navigation,
  320/390/1024/1440/1920 px, zoom 200 %,
  clavier, lecteur d'écran, reduced motion et traductions.
- Captures réalistes du membre actif et du compte non autorisé, sans faux état de
  chargement ni formulaire vide laissant croire à une panne.
- Risque : frustrer un apprenant avec une entrée trop présente ou ambiguë.

---

## V4-016A — Enrichissement commercial de la landing V3.5

**Priorité : P1 lancement commercial. Dépendances : V3.5-006 et V3.5-009 ;
V4-010 pour présenter une correction réelle, V4-007/V4-018 pour les prix
publiés et V4-014 avant tout achat réel.**

**Références : A5 pour la landing et ses preuves produit ; A3, vue `Landing
détaillée` ; A2, vues `Fondations`, `Actions` et `Formulaires`.**

### Périmètre

- Étendre la landing V3.5 sans reconstruire son architecture, sa marque, ses
  formulaires publics ou sa séparation avec l'application/PWA.
- Conserver Atlas sans vert : papier chaud, bleu ardoise pour marque et CTA,
  laiton éditorial rare, Manrope + Source Serif 4 et cartographie liée au
  parcours plutôt qu'à l'IA ou au paiement.
- Présenter les corrections IA désormais disponibles avec leur périmètre réel :
  productions libres compatibles, rubrique authorée, coût connu avant action,
  retour assisté et possibilité de réessai.
- Remplacer l'annonce V3.5 de correction à venir par l'aperçu A5 uniquement
  lorsque V4-010 est disponible pour le public concerné. L'exemple emploie une
  activité, une rubrique et un retour réellement compatibles ; il n'invente ni
  réponse utilisateur ni résultat impossible.
- Conserver l'aperçu de parcours dans le hero et les preuves Programme/Leçon
  déjà réelles. Les enrichissements commerciaux ne les remplacent jamais par
  des illustrations génériques, des rendus conceptuels ou des cartes de vente.
- Présenter les tiers commerciaux avec prix, crédits et capacités moyennes
  uniquement depuis le catalogue versionné et les mesures V4-018.
- Dater les exemples d'usage et indiquer `en moyenne` ; ne jamais publier un
  chiffre provisoire, des tokens ou une promesse illimitée.
- Relier la landing au checkout uniquement après V4-014, en conservant
  authentification, information tarifaire et confirmation dans l'application.
- Mettre à jour FAQ, confiance, confidentialité et limites pour OpenRouter,
  correction assistée, crédits LearnX, expiration éventuelle et paiements.
- Remplacer les annonces `à venir` par des capacités disponibles uniquement
  lorsque leur rollout est réellement ouvert au public concerné.
- Mesurer compréhension des offres et conversion sans assimiler lead, candidat,
  invité, compte activé et acheteur.

### Hors périmètre

- Refaire le design system, la landing initiale, les formulaires de liste
  d'attente ou l'architecture de domaine livrés par V3.5.
- Génération de formation V5, prix non calibré, faux compteur, témoignage
  inventé, fausse rareté, promesse d'IA objective ou capacité illimitée.
- Achat public avant validation juridique/comptable, V4-014 et rollout V4-018.

### Critères d'acceptation

- Les prix correspondent exactement à une version publiée du catalogue ; sans
  catalogue validé, ils restent absents ou explicitement en préparation.
- Chaque offre indique prix, crédits et capacité moyenne datée sans exposer de
  tokens ni garantir un nombre exact d'actions.
- La différence entre correction déterministe, retour assisté par IA et future
  création de formation est compréhensible sans ouvrir l'application.
- Les aperçus Programme, Leçon et Correction affichent des contenus cohérents,
  vérifiables et représentatifs des composants Atlas livrés ; aucun faux texte,
  témoignage, compteur, progression ou contrôle ne sert de preuve.
- Une seule action remplie domine chaque zone commerciale ; l'achat reste
  distinct de la liste d'attente, de la candidature et de la connexion.
- Les états offre indisponible, catalogue en chargement, erreur, formulaire
  vide/rempli/envoyé et checkout autorisé/interdit possèdent un libellé et une
  action sûre ; aucun montant de démonstration n'est affiché comme réel.
- Les critères de marque, responsive et accessibilité de V3.5-008 restent
  respectés avec les contenus commerciaux réels.
- Aucun vert, gradient IA, halo, glassmorphism, CTA laiton ou motif
  cartographique décoratif n'apparaît dans l'extension commerciale.
- Les métriques distinguent visiteur, lead, candidat, invité, utilisateur activé
  et acheteur sans profilage excessif.
- À 320/390, 1024, 1440 et 1920 px et au zoom 200 %, la lecture reste sans
  scroll horizontal global, les cibles font ≥ 44 × 44 px et une seule action
  bleue remplie domine chaque zone.

### Tests et risques

- Tests catalogue publié/non publié, capacités datées, langues FR/EN, CTA,
  connexion, checkout autorisé/interdit et absence de flash de données privées.
- Captures 320/390, 1024, 1440 et 1920 px couvrant default, loading, error et
  offre non publiée ; clavier, focus 2 px bleu clair, lecteur d'écran et reduced
  motion.
- Captures dédiées du hero et des trois preuves produit à 320/390 et desktop,
  avec contrôle de cohérence entre contenu montré et état applicatif publié.
- Revue juridique, fiscale, marketing, accessibilité et sécurité avant ouverture.
- Risque : transformer la landing éditoriale en page tarifaire fintech ou SaaS
  IA générique. Les preuves d'apprentissage restent prioritaires sur le billing.

### Migration et rollback

- Prix, corrections et achat sont activables indépendamment. Le rollback
  restaure la landing V3.5 sans interrompre liste d'attente, connexion ou app.

---

## V4-016B — Adaptation desktop des nouvelles surfaces V4

**Priorité : P1 polish. Dépendances : V3.5-005 et V3.5-009 ; revue finale après
V4-010, V4-012, V4-014, V4-016, V4-016A et V4-016G.**

**Références : A1, vues `Correction IA` et `Administration` ; A3, vues
`Leçon desktop`, `Crédits et paiement` et `Création de formations` ; A2, vue
`Navigation`.**

### Périmètre

- Appliquer les gabarits `lecture`, `travail` et `administration` de V3.5
  aux nouvelles vues V4 : devis, correction, historique, solde/crédits,
  dashboard coûts, checkout et annonce V5.
- Utiliser les vues Correction IA et Administration du screen pack Atlas comme
  références de direction pour hiérarchie, densité et surfaces, sans en faire
  des contrats pixel-perfect.
- Choisir le gabarit selon la tâche et documenter toute exception ; ne pas
  inventer une quatrième grammaire propre au billing ou à l'IA.
- Adapter correction et historique aux comparaisons lisibles sur grand écran
  sans afficher simultanément des étapes pédagogiques qui restent séquentielles.
- Adapter tableaux, filtres, alertes, limites et coûts admin à une densité
  maîtrisée, avec actions groupées sûres et tiroirs correctement dimensionnés.
- Conserver routes, permissions, tokens, primitives, navigation et règles
  d'accessibilité issus de V3.5.
- Vérifier que les nouvelles surfaces restent cohérentes sur mobile sans
  reproduire le gabarit desktop dans une largeur réduite.

### Hors périmètre

- Refaire les écrans V3 déjà validés par V3.5, redéfinir tokens/primitives ou
  modifier les règles de correction, prix, paiement, progression ou accès.
- Dashboard décoratif, carte étirée, sidebar vide, cockpit technique ou
  esthétique fintech/IA générique.

### Critères d'acceptation

- Chaque nouvelle surface V4 utilise un gabarit V3.5 ou justifie son exception.
- Chaque surface conserve la base encre/navy/ardoise, l'action bleue et le
  laiton rare sans réintroduire de vert ni créer une esthétique fintech.
- À 1024/1440/1920 px, aucune vue n'est une PWA mobile étirée et aucune longueur
  de ligne pédagogique ne dépasse la mesure validée.
- À zoom 200 %, aucun chevauchement ni scroll horizontal global.
- Les états default, hover, focus, disabled, loading, error et empty sont
  couverts lorsqu'ils existent ; tableaux et actions admin restent
  compréhensibles sans dépendre de la couleur.
- Les parcours principaux nécessitent le même nombre d'actions ou moins que leur
  équivalent mobile.
- Une revue réaliste couvre au minimum correction, historique, dashboard
  crédits, checkout et annonce V5 sur mobile et desktop.

### Tests et risques

- Tests visuels 768/1024/1440/1920, zoom 100/200 %, clavier, lecteur d'écran,
  hover/focus, reduced motion et E2E des parcours critiques.
- Captures avec données réalistes pour correction, historique, administration,
  checkout et annonce V5 ; aucun renouvellement aveugle de baseline.
- Risque : réouvrir la refonte V3.5 au lieu d'intégrer les seules surfaces V4.

### Migration et rollback

- Livrer par famille correction, administration et paiement avec rollback
  isolable, sans migration de données liée à la présentation.

---

## V4-016C — Accueil et reprise multi-programmes

**Priorité : P1 UX. Dépendances : GO technique V3.5 ; sign-off humain V3.5
avant clôture et rollout ; V4-016B pour la revue desktop finale.**

**Références canoniques :**

- `docs/EMOTIONAL_DESIGN_CONTRACT.md` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/emotional-design-renders/`.

Ces références fixent hiérarchie, densité, ton et ordre de l'information, pas
des pixels ni une modification de la logique de recommandation.

### Constat

- L'API `/api/today` sélectionne une recommandation globale puis ne renvoie que
  le programme associé comme `program` actif.
- L'écran Aujourd'hui affiche donc un seul lien de reprise et une seule
  progression, même lorsque l'utilisateur suit plusieurs programmes.
- Dans le cas observé, le parcours Psychologie masque de fait les autres
  programmes suivis depuis l'accueil, alors qu'ils restent accessibles dans
  Mes programmes.
- Le vide d'un nouveau compte est aujourd'hui traité comme un état courant,
  alors qu'il doit orienter vers un premier choix sans montrer des outils ou
  des métriques sans contenu.
- `Mes parcours` et `Découvrir` servent deux intentions différentes : reprendre
  un engagement existant ou choisir un nouveau parcours.

### Périmètre

- Conserver une recommandation principale unique, choisie côté serveur selon
  les priorités pédagogiques existantes, sans favoriser un slug ou un programme
  codé en dur.
- Rendre trois états explicitement distincts :
  - zéro programme : première arrivée, phrase d'orientation et seul CTA rempli
    `Choisir mon premier parcours`, sans compteur, recherche ou filtre vide ;
  - un programme : recommandation et reprise uniques, sans seconde liste qui
    répète la même destination ;
  - trois programmes ou plus : recommandation dominante, puis autres parcours
    actifs en lignes compactes, tous retrouvables sans transformer Aujourd'hui
    en catalogue.
- Après le choix du premier parcours, ramener le compte vers la première
  activité disponible fournie par le serveur ; un chargement ou une erreur ne
  doit jamais être interprété comme une première arrivée.
- Faire retourner par l'API Aujourd'hui un résumé borné de chaque programme
  effectivement suivi et accessible au compte : identité, titre, progression,
  dernière activité ou prochaine action canonique et destination de reprise.
- Afficher sous l'action principale une section `Mes programmes en cours` quand
  au moins une reprise secondaire existe ; chaque programme actif est
  reprenable en une interaction.
- Distinguer clairement la recommandation du jour des reprises secondaires :
  une seule action primaire, puis des lignes ou cartes compactes par programme.
- Ordonner les reprises par activité récente et priorité serveur, avec un ordre
  déterministe pour les programmes jamais commencés.
- Couvrir les programmes inscrits, privés possédés et publiés accessibles sans
  exposer un brouillon ou un programme auquel le compte n'a pas droit.
- Garder la liste lisible et bornée ; si le nombre devient élevé, proposer un
  accès explicite à Mes programmes sans tronquer silencieusement l'existence des
  autres parcours.
- Séparer `Mes parcours`, destiné à la reprise, de `Découvrir`, destiné au choix.
  Révéler la recherche à la demande et n'afficher des filtres que s'ils réduisent
  une collection réelle ; ne pas imposer `Découvrir` comme destination par
  défaut à tous les comptes.
- Prévoir titres de programme longs, métadonnées secondaires et états
  chargement/vide/erreur sans masquer l'identité ou la destination de reprise.
- Traduire les nouveaux libellés FR/EN et conserver calculs de progression,
  recommandations et droits d'accès exclusivement côté serveur.

### Hors périmètre

- Modifier l'ordre pédagogique interne d'un programme, fusionner les
  progressions, recommander plusieurs actions primaires ou introduire une
  personnalisation IA.
- Remplacer Mes programmes, afficher les programmes du catalogue non suivis ou
  rendre publics des contenus privés.
- Ajouter statistiques, gamification, carrousels, recommandation IA ou recherche
  et filtres permanents pour remplir l'état vide.

### Critères d'acceptation

- Sans programme, le compte comprend en cinq secondes qu'il doit choisir son
  premier parcours ; le seul CTA rempli est `Choisir mon premier parcours` et
  aucun compteur à zéro, historique, recherche ou filtre n'est rendu.
- Avec un seul programme, sa recommandation et sa reprise ne sont pas dupliquées
  dans une section secondaire ; la destination serveur reste exacte.
- Avec trois programmes, les trois sont identifiables sur Aujourd'hui : le
  programme recommandé est présent une seule fois comme action dominante et
  les deux autres sont reprenables en une interaction dans des lignes compactes.
- La recommandation principale reste unique et identifiable ; elle peut provenir
  de n'importe lequel des programmes accessibles selon les priorités existantes.
- Chaque progression et destination correspond au bon couple utilisateur +
  programme ; aucune donnée d'un autre compte ou d'un programme inaccessible
  n'est renvoyée.
- Un programme jamais commencé propose `Commencer`; un programme entamé propose
  `Reprendre`; un programme terminé expose un état terminé sans fausse action.
- L'état vide reste correct lorsque le compte ne suit aucun programme, et un
  programme retiré ou devenu inaccessible disparaît dès invalidation serveur.
- `Mes parcours` et `Découvrir` ont des libellés, états vides et destinations
  distincts ; ouvrir la recherche est une action explicite, pas l'état initial.
- Un titre long FR/EN se replie sans ellipses masquant l'identité, sans pousser
  l'action hors écran et sans augmenter la cardification.
- Le rendu reste utilisable à 320/390 px, 720 px de reflow, 1440/1920 px, zoom
  200 %, clavier et lecteur d'écran ; l'état actif, la progression et la
  destination ne dépendent jamais de la couleur seule.
- Une seule action remplie domine chaque zone ; bleu Atlas et laiton rare
  respectent les contrats V3.5, sans vert, cyan électrique ou dashboard de
  métriques.

### Tests et risques

- Tests API avec zéro, un, trois et de nombreux programmes, propriété privée,
  inscriptions, retraits, permissions, progression et ordre déterministe.
- Tests composants et E2E couvrant première arrivée, retour après première
  inscription, un programme sans duplication, trois programmes, titres longs,
  chargement, erreur, retraits, destinations et libellés FR/EN.
- Captures de preuve à 320/390/720/1440/1920 px avec données réalistes, zoom
  200 %, clavier, lecteur d'écran, reduced motion et forced colors ; la revue
  utilise les questions de compréhension de `docs/V3_5_QA_MATRIX.md`.
- Test de requêtes bornées et absence de N+1 avant d'élargir le payload Today.
- Risque principal : transformer l'accueil en deuxième catalogue. Garder un
  résumé compact et renvoyer les détails complets vers Mes programmes.

### Migration et rollback

- Aucune migration Prisma attendue : les enrollments, propriétés, progressions
  et destinations existent déjà. Le contrat API est étendu de façon additive.
- Le rollback restaure l'ancien rendu mono-programme sans modifier les données.

---

## V4-016G — Présentation des corrections IA, crédits et paiement

**Priorité : P1 confiance. Dépendances : V3.5-009 et contrats des V4-007,
V4-010, V4-011 et V4-014 disponibles.**

**Références canoniques complémentaires :**

- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-correction-flow.html` ;
- `/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-v4-atlas-surfaces.html` ;
- `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`.

### Périmètre

- Définir une grammaire de confiance commune aux surfaces de correction et de
  finance, sans modifier leurs règles serveur ni leurs contrats métier.
- Appliquer Atlas sans vert et la vue Correction IA validée : surfaces mates,
  bleu pour action/progression/positif, laiton seulement éditorial, Manrope pour
  l'interface et Source Serif 4 pour les titres ou synthèses définis.
- Distinguer explicitement : résultat déterministe, retour assisté par IA,
  critères/rubrique authorés, preuves utilisées, état de révision ou
  clarification, versions de soumission et possibilité de réessai.
- Présenter la correction par critère avec preuve tirée de la réponse, synthèse,
  historique et action suivante ; ne jamais donner au texte généré l'apparence
  d'une vérité scientifique ou d'une décision serveur.
- Nommer ces preuves « Extrait de votre réponse » et réserver « Références
  mobilisées » aux sources externes, dans une zone distincte.
- La signature cartographique peut situer la correction dans le parcours mais
  ne représente jamais intelligence, génération, qualité ou niveau de confiance.
- Avant confirmation d'une action payante, afficher unité en crédits LearnX,
  prix/plafond, consommation estimée et règle de règlement/libération. Après
  exécution, afficher débit réel, différence libérée et destination dans
  l'historique.
- Rendre allocation offerte, crédits achetés, solde disponible, réservation,
  expiration éventuelle et historique compréhensibles sans exposer de tokens.
- Conserver allocation offerte et crédits achetés comme lignes principales ; le
  total disponible n'est qu'un résumé secondaire. Après correction, garder le
  règlement synthétique visible et rendre son détail dépliable.
- Présenter `FEEDBACK_READY`, `REVISION_REQUIRED`, `CLARIFICATION_REQUIRED` et
  `TEMPORARILY_UNAVAILABLE` avec des libellés humains. Une ambiguïté matérielle
  masque tout score exact.
- Présenter l'ajustement admin dans un panneau latéral desktop et une surface
  plein écran mobile, puis afficher un récapitulatif avant validation.
- Expliquer sobrement échec, remboursement de réservation, paiement, litige et
  indisponibilité, avec une action principale sûre et aucune mutation silencieuse.
- Adapter les mêmes informations aux vues apprenant et admin sans esthétique de
  wallet spéculatif, banque grand public, casino, cockpit technique ou SaaS IA.

### Hors périmètre

- Modifier prix, marge, modèle, score, seuil, contrat pédagogique, ledger,
  provider ou règle de remboursement.
- Chat, avatar IA, animation de génération, gradient magique, score de confiance
  présenté comme certitude ou vocabulaire de tokens côté utilisateur.
- Vert, CTA laiton, halo, glassmorphism ou habillage cartographique décoratif
  des prix, soldes et paiements.

### Critères d'acceptation

- Avant chaque confirmation payante, l'utilisateur peut répondre clairement à
  `combien au maximum`, `quelle unité`, `pour quelle action` et `que se passe-t-il
  en cas d'échec`.
- Après correction, il distingue résultat déterministe, appréciation IA,
  rubrique, preuves/sources, historique et réessai sans se fier à la couleur.
- Le résumé du règlement reste visible sans ouvrir le détail, et ses chiffres
  proviennent exclusivement des contrats serveur ; aucune fixture financière
  ne peut apparaître en production.
- L'IA apparaît comme `correction assistée` fondée sur des critères et ne prend
  jamais la place de la marque, du titre d'écran ou de l'action pédagogique.
- Une seule action remplie domine chaque devis, correction, recharge ou erreur ;
  les actions secondaires restent disponibles et hiérarchisées.
- Texte ≥ 4,5:1, contrôles ≥ 3:1, cibles ≥ 44 × 44 px, zoom 200 % et reduced
  motion sont validés sur mobile et desktop.
- Aucun état positif ou financier ne repose uniquement sur le bleu et aucun
  vert n'est réintroduit pour simuler une convention de succès.
- Les revues de design utilisent feedback prêt, révision, clarification,
  indisponibilité, versions successives, solde faible,
  réservation, libération, paiement refusé et historique réaliste.
- Default, loading, error, empty, solde insuffisant, réservation en cours,
  clarification, correction indisponible et paiement refusé conservent
  unité, autorité et prochaine action explicites.
- Les valeurs utilisent exclusivement les contrats serveur et catalogues
  publiés ; le ticket n'invente aucun montant, pack, expiration ou capacité.
- Les rayons restent 4/7/12 px, les espaces 4/8/12/16/24/32/48 px ; aucune
  carte imbriquée au-delà d'un niveau, CTA concurrent, cyan électrique, vert,
  ombre décorative ou grosse tuile active.

### Tests et risques

- Tests de compréhension qualitatifs, composants, E2E, lecteur d'écran et
  captures réalistes pour chaque état financier et de correction.
- Captures 320/390 et 1024/1440/1920 px, zoom 200 %, clavier, focus visible,
  contrastes, reduced motion et contenus longs FR/EN.
- Risque : rendre une opération financière rassurante mais ambiguë. La précision
  du montant, de l'unité et de l'autorité serveur prime sur la simplification.

### Migration et rollback

- Aucun changement métier attendu. Les vues consomment uniquement les contrats
  versionnés ; rollback par surface correction, crédits ou paiement.

---

## V4-017 — Sécurité IA, confidentialité, abus et contrôle des dépenses

**Priorité : P0. Dépendances : V4-004, V4-006 et V4-013.**

### Périmètre

- Threat model final sur fournisseur IA, prompts, soumissions, secrets, paiements,
  ledger, webhooks, exports et administration.
- Limiter taille, fréquence, concurrence, budget et modèles par utilisateur.
- Résister aux prompt injections contenues dans les réponses d'apprenants.
- Définir minimisation, consentement/information, rétention et suppression des
  données envoyées aux fournisseurs.
- Publier une information de confidentialité cohérente avec les fournisseurs
  réellement utilisés et documenter un traitement manuel sûr des demandes de
  fermeture, accès ou suppression en attendant le centre V6.
- Fournir avant tout pilote payant un canal de contact identifiable pour support,
  paiement et signalement de sécurité ; il ne constitue pas encore le ticketing V6.
- Mettre en place alertes, kill switches indépendants correction/paiement et
  procédure de rotation/révocation.
- Tester abus de crédits, IDOR, replay, contournement de prix et fuite de données.
- Prévoir budgets P90 et limites anti-abus distincts pour l'essai public, les
  allocations privées famille/amis et les avantages early adopters.

### Hors périmètre

- Certification formelle ou promesse de sécurité absolue.

### Critères d'acceptation

- Aucun P0/P1 ouvert avant pilote payant.
- Une panne fournisseur ou budget global atteint échoue fermé et rend les crédits.
- Les journaux techniques n'exposent ni réponse complète ni donnée de paiement.
- L'utilisateur sait qu'une correction envoie sa réponse à un fournisseur IA.
- Les contacts support/sécurité, la procédure manuelle de demande sur les données
  et les règles de rétention applicables sont accessibles et testées.

### Tests et risques

- Tests adversariaux, charge bornée, secrets, dépendances et contrôle multi-compte.
- Risque : coût financier direct d'une faille logique sans fuite de données.

---

## V4-018 — Calibration économique et pilote progressif

**Priorité : P0 release. Dépendances : V4-003, V4-010, V4-012, V4-014 et V4-017.**

### Périmètre

- Exécuter le benchmark V4 complet de l'extraction de preuves, de l'exécution de
  rubrique, des erreurs, retries, révisions et clarifications. Un éventuel
  falsificateur possède ses propres mesures. La génération de blueprints ou de
  leçons appartient à un benchmark V5 séparé.
- Mesurer coût médian/P75/P90, exactitude atomique, couverture, abstention,
  latence, retry, clarification et marge de contribution avant coûts fixes.
- Fixer prix et plafonds initiaux, capacités moyennes des packs et alertes.
- Déployer successivement admin, utilisateurs invités gratuits, puis achats réels
  limités avec plafonds conservateurs.
- Comparer résultats réels au modèle financier et documenter les écarts.

### Hors périmètre

- Génération de contenu accessible aux utilisateurs ou ouverture publique.

### Critères d'acceptation

- Les chiffres commerciaux proviennent des mesures et portent leur date/version.
- La marge de contribution projetée reste supérieure au plancher dans les
  scénarios validés ; la rentabilité nette inclut ensuite les coûts fixes réels.
- Chaque étape du rollout dispose de critères stop/go et d'un rollback testé.

### Tests et risques

- Données anonymisées, coûts plafonnés et absence de facturation involontaire.
- Risque : données friends and family insuffisantes pour extrapoler une activité.

---

## V4-018A — Essai public et cohortes pilotes

**Priorité : P1 acquisition maîtrisée. Dépendances : V4-010, V4-012, V4-017 et
calibration V4-018.**

### Périmètre

- Configurer un essai public unique de trois corrections standard, sans carte,
  non renouvelable. Une exécution sans résultat utilisable ne consomme pas une
  correction d'essai.
- Appliquer à l'essai des limites anti-abus, un budget P90 et un kill switch
  indépendants des crédits achetés.
- Configurer séparément une allocation privée `FAMILY_AND_FRIENDS`, sponsorisée,
  renouvelable et non reportable, absente de la landing et exclue du CAC
  commercial.
- Configurer une cohorte `EARLY_ADOPTER` avec avantage ponctuel ou temporaire,
  sans gratuité à vie ni confusion avec le consentement e-mail de la landing.
- Mesurer coût moyen, médiane, P75 et P90 de l'essai, coût d'essai par inscrit,
  CAC IA par client payant, CAC complet et funnel correction 1 → 2 → 3 → achat.

### Hors périmètre

- Essai renouvelable, abonnement gratuit permanent, parrainage, bonus public ou
  fusion des cohortes privées avec les offres commerciales.

### Critères d'acceptation

- Les trois cohortes possèdent règles, budgets, métriques et audit distincts ;
  une allocation famille/amis n'apparaît jamais comme acquisition commerciale.
- L'utilisateur comprend le nombre de corrections d'essai restant et qu'une
  erreur technique inutilisable n'en consomme aucune.
- La limite d'essai est appliquée côté serveur et résiste aux reprises, doubles
  clics, changements de session et abus raisonnablement détectables.
- Toute modification de volume ou durée est versionnée et requiert l'arbitrage
  du Propriétaire ; aucun avantage early adopter n'est présenté comme perpétuel.

### Tests et risques

- Comptes multiples, concurrence, échec fournisseur, épuisement du budget,
  conversion et séparation des cohortes.
- Risque : confondre coût pilote subventionné, CAC et économie unitaire payante.

---

## V4-019 — Audit final, déploiement et clôture V4

**Priorité : P0 release. Dépendances : assurance release V3.5 réconciliée,
V4-001 à V4-018A, V4-016A, V4-016B, V4-016C et V4-016G.**

### Périmètre

- Réaudit fonctionnel, pédagogique, sécurité, confidentialité, accessibilité,
  responsive mobile/desktop, performance, acquisition publique, PWA,
  migrations, finance et exploitation.
- Vérifier la conformité au système de marque, aux gabarits, aux primitives et
  à la matrice V3.5-008 sans assimiler fidélité à l'atlas et qualité d'usage.
- Exécuter lint, typecheck, tests, build, E2E, migrations sur clone Neon,
  tests sandbox paiement et smoke production borné.
- Réconcilier explicitement le rapport V3.5 encore marqué « clôture officielle
  en attente » avec la preuve de promotion, les contrôles appareil/PWA,
  iPhone/VoiceOver, zoom et le smoke authentifié post-promotion. V4-019 ne les
  déclare jamais implicitement réussis.
- Vérifier clés, budgets, kill switches, alertes, sauvegarde et rollback.
- Réconcilier un cycle complet : achat → crédits → correction → règlement →
  clôture, ainsi qu'un échec et un litige.
- Rejouer domaine public → liste d'attente/early adopter et domaine public →
  connexion → installation → réouverture directe de l'application.
- Produire le rapport de clôture et mettre à jour les sources de vérité.

### Hors périmètre

- V5, génération de formation et dette sans preuve issue de l'audit.

### Critères d'acceptation

- Aucun P0/P1 ouvert ; toutes les migrations sont répétables et réversibles selon
  la stratégie approuvée.
- Les soldes et agrégats se réconcilient ; aucun secret ou coût orphelin.
- Les paiements réels restent désactivables indépendamment des corrections.
- Le canal minimal de support, les informations de confidentialité et les
  procédures manuelles de fermeture/export/suppression nécessaires avant V6
  fonctionnent sur les environnements réellement ouverts.
- La matrice finale couvre les nouvelles surfaces V4 en default, loading,
  error, empty et disabled lorsque pertinents, avec captures 320/390,
  768/1024, 1440/1920 et zoom 200 %.
- Aucune régression ne réintroduit cyan électrique, vert, gradients IA,
  cardification imbriquée, rayons hors contrat, ombres décoratives desktop ou
  plusieurs CTA remplis concurrents.
- V4 n'est déclarée terminée qu'après rapport GO explicite.

### Tests et risques

- Matrice desktop/mobile/WebKit, réseau lent, concurrence, reprise et sécurité.
- Risque : déclarer V4 terminée sur tests locaux sans parcours financier réel.

## Candidats post-V4 — qualité et lisibilité du catalogue

Ces candidats sont consignés pour les prochaines versions. Ils ne font pas
partie du chemin critique V4, n'autorisent aucune migration et devront être
repris dans le backlog de la version qui les implémentera. Ils partagent une
dépendance : l'identité et la version d'un programme doivent rester explicites
afin qu'une fiche éditoriale ou un avis ne change pas silencieusement de sens.

### V5-CATALOG-001 — Fiche programme, niveau et positionnement

**Objectif :** permettre à un apprenant de comprendre avant inscription si le
programme lui correspond, ce qu'il doit déjà savoir et ce qu'il pourra en
retirer.

#### Périmètre candidat

- niveau d'entrée et prérequis, avec distinction entre `REQUIRED` et
  `RECOMMENDED` ;
- savoirs visés et résultats d'apprentissage observables ;
- compétences développées et outils pratiqués, sans confondre exposition,
  pratique guidée et autonomie attendue ;
- visée du programme et niveau de sortie attendu, à partir d'un vocabulaire
  contrôlé : découverte, remise à niveau, complément à un cursus, montée en
  compétence professionnelle, préparation à un métier ou préparation à une
  certification ;
- texte éditorial précis lorsque le vocabulaire contrôlé ne suffit pas ;
- authoring, versionnage, affichage FR/EN et reprise explicite des programmes
  existants.

#### Critères à préserver lors du futur cadrage

- La fiche distingue le niveau d'entrée, le niveau visé et la visée du
  programme ; ces champs ne sont jamais déduits l'un de l'autre.
- Les prérequis obligatoires sont vérifiables et ne sont pas inventés à partir
  du titre, de la durée ou du public supposé.
- Les savoirs, compétences et outils sont reliés aux objectifs et activités du
  programme ; une simple mention dans un texte ne vaut pas compétence acquise.
- Aucune équivalence universitaire, reconnaissance professionnelle,
  certification ou employabilité n'est promise sans preuve et autorité
  explicites.
- Une migration ne remplit jamais silencieusement des valeurs fictives pour les
  programmes existants ; l'absence est visible jusqu'à leur revue éditoriale.
- Les cartes catalogue restent synthétiques ; la fiche programme porte le
  détail et demeure accessible sur mobile, au clavier et en FR/EN.

#### Arbitrages différés

- taxonomie exacte des niveaux d'entrée et de sortie ;
- listes contrôlées de visées, compétences et outils ;
- règles de filtrage du catalogue à partir de ces métadonnées ;
- gouvernance éditoriale et preuve requise pour les allégations externes.

### V5-CATALOG-002 — Notes et avis sur les programmes

**Objectif :** ajouter un signal d'expérience apprenant partageable sans le
présenter comme une preuve de qualité pédagogique ou comme une autorité de
publication.

#### Décisions requises avant implémentation

- échelle de notation et éventuelle structure d'un avis ;
- éligibilité : inscrit, activité minimale ou programme terminé ;
- règle par utilisateur et par version de programme, avec modification et
  suppression auditables ;
- seuil minimal d'avis avant affichage d'une moyenne et traitement explicite de
  l'état « pas encore noté » ;
- modération, signalement, confidentialité, anti-abus et conservation ;
- comportement lors d'une nouvelle version substantielle d'un programme.

#### Garde-fous candidats

- Afficher moyenne, distribution et taille de l'échantillon ; ne jamais masquer
  un faible volume derrière une note précise.
- Séparer l'avis utilisateur des preuves éditoriales, des résultats
  d'apprentissage et de la validation pédagogique du programme.
- Une note ne modifie jamais automatiquement la progression, le contenu, la
  publication ou le classement sans règle produit versionnée.
- Les avis restent accessibles, traduisibles et modérables ; aucun dark pattern
  ne force une note positive.

#### Dépendances

- identité/version du programme stabilisée ;
- surfaces catalogue et fiche programme ;
- politique de modération, rétention et données personnelles.

## Gates externes et paramètres à résoudre avant ouverture commerciale

Le scope produit 1.0 est figé. Les éléments suivants déterminent les valeurs de
configuration, la conformité et le GO de V4B ; ils ne peuvent ajouter une
fonctionnalité au backlog sans amendement produit explicite.

1. Qualification BIC ou BNC et traitement TVA des factures OpenRouter.
2. Éligibilité au versement libératoire et réserve fiscale initiale.
3. Conditions et frais réels du compte Revolut Merchant LearnX.
4. Valeur commerciale définitive du crédit et politique de validité des crédits
   achetés.
5. Politique de rétention des soumissions et corrections chez LearnX et les
   fournisseurs.
6. Données minimales du benchmark autorisées et anonymisation.
7. Domaine canonique, orthographe de marque et sous-domaine applicatif définitif.
8. Fournisseur d'envoi/gestion de liste, durée de rétention et texte
   d'information des prospects.
9. Noms des tiers, promesse marketing, capacité moyenne publiée et politique
    d'admission des early adopters.
10. Qualification fiscale/juridique des crédits fermés : moment de taxation,
    rétractation, remboursement, clôture de compte et exclusion éventuelle des
    services de paiement, à confirmer professionnellement.
11. Coefficients finaux par scénario, prix plancher, classes de taille P90 et
    réserve d'exécution des crédits encore en circulation.
12. Écarts V4 acceptés par rapport au système V3.5 pour correction, crédits,
    paiement et landing commerciale.
13. Évolutions éventuelles de l'atlas ou des tokens : elles nécessitent une
    décision de marque explicite et ne sont pas inventées dans un ticket V4.
