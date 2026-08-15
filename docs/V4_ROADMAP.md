# Roadmap V4 — vue de pilotage LearnX

## Objet et autorité

Cette page donne une vision opérationnelle de V4. Elle répond à quatre
questions : où en sommes-nous, quel est le prochain gate, qu'est-ce qui bloque
la valeur utilisateur et qu'est-ce qui est volontairement différé.

- `BACKLOG_V4.md` reste l'autorité détaillée des tickets et critères.
- `docs/V4_AI_CORRECTION_PHASE_MANIFEST.json` reste l'état machine de la
  recherche IA.
- `docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` reste l'historique append-only.
- Cette roadmap ne transforme jamais une preuve expérimentale en livraison
  produit.

Dernière consolidation : 15 août 2026.

## Légende

| Statut | Signification |
| --- | --- |
| `LIVRÉ — INACTIF` | Fondation intégrée, mais non disponible comme offre utilisateur. |
| `ACTIF` | Travail courant sur le chemin critique. |
| `BLOQUÉ` | Le ticket ne doit pas démarrer avant son gate explicite. |
| `PLANIFIÉ` | Périmètre décidé, dépendances non encore réunies. |
| `HISTORIQUE` | Preuve conservée, architecture ou expérience non promue. |
| `À AUDITER` | Une baseline existe, mais son reliquat V4 doit être vérifié avant clôture. |

## Résumé exécutif

V4 n'est plus au stade de la conception générale : ledger, réconciliation,
adaptateurs, moteur de rubrique et outillage expérimental existent. En revanche,
la correction IA n'est pas encore une fonctionnalité de l'application.

Le chemin critique est désormais très étroit :

1. prouver qu'un modèle sait rechercher des preuves exactes et sûres ;
2. publier une rubrique `WRITING/fr-FR` réellement exécutable ;
3. brancher ce moteur au flow apprenant sous feature flag ;
4. mesurer qualité et coûts réels ;
5. seulement ensuite activer tarification, paiement et extension.

État honnête : **0 contrat V4 publié, 0 activité éligible, aucun pipeline promu,
V4-010 non branché et V4-011 fermé.**

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
- Préparation 10×2 terminée hors ligne : route demandée et fournisseur observé
  sont séparés, la sélection v2 remplace le seul pseudo-oracle inconclusif sans
  réécrire les corpus historiques, et le runner reste validate-only. Le
  panel v2 clos après 10 workflows valides puis une citation non exacte ; aucun
  appel supplémentaire ni V4-002 avant nouvel arbitrage
  pessimistes ; Finance doit arbitrer cet écart avant tout GO.
- Gate suivant : arbitrage Finance puis autorisation propriétaire distincte du
  panel 10 × 2, exécution et verdict autonome. Le falsificateur, le holdout et
  V4-002 restent fermés jusque-là.

### Gate B — premier contrat publiable

Ticket principal : `V4-002`.

- Cible unique : `WRITING/fr-FR`, texte, faible risque.
- Le contrat doit être `PUBLISHED` et `FULLY_COMPILABLE`.
- Il doit authorer éléments atomiques, propriétaires des pénalités, variantes,
  contre-exemples, contradictions, règles de preuve, ambiguïtés, niveaux,
  templates et remédiations.
- Les critères `HOLISTIC` ou non formalisables restent hors MVP autonome.
- La publication reste interdite tant que le compilateur, les tests de mutation
  et le gate autonome ne passent pas.

### Gate C — premier flow utilisateur

Ticket principal : `V4-010`.

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

## Registre d'état par ticket

| Ticket | Statut courant | Réalité vérifiée / limite | Prochaine condition |
| --- | --- | --- | --- |
| V4-001 | `LIVRÉ — INACTIF` | ADR et frontières établies. | Réviser seulement si l'architecture cible change. |
| V4-002 | `ACTIF` | Schéma et archétype DRAFT ; 0 contrat publié. | Publier un premier WRITING/fr-FR entièrement compilable. |
| V4-003 | `ACTIF` | Baselines historiques conservées ; aucun modèle promu. | Fermer les gates 009C puis comparer sur identités reproductibles. |
| V4-004 | `LIVRÉ — INACTIF` | Adaptateurs et tests existent pour la recherche. | Activation uniquement via 009C/010. |
| V4-005 | `LIVRÉ — INACTIF` | Persistance et états fondés, runtime utilisateur non branché. | Intégration V4-010. |
| V4-006 | `LIVRÉ — INACTIF` | Ledger/réservations fondés. | Calibration et activation après qualité. |
| V4-007 | `LIVRÉ — INACTIF` | Catalogue générique DRAFT ; aucun prix actif. | Coûts P50/P90 et arbitrage propriétaire. |
| V4-008 | `LIVRÉ — INACTIF` | Allocations et limites administratives fondées. | Revue avant pilote fermé. |
| V4-008A | `HISTORIQUE` | Garanties techniques réutilisées ; juge composite abandonné. | Aucun nouveau travail pédagogique sur l'ancien pipeline. |
| V4-009 | `LIVRÉ — INACTIF` | Orchestration et réconciliation disponibles/rejouées. | Brancher uniquement un pipeline promu. |
| V4-009B | `HISTORIQUE` | Mistral + Sonnet = NO-GO pédagogique. | Conserver comme comparaison, ne pas relancer par défaut. |
| V4-009C | `ACTIF` | Gemini panel v2 NO-GO ; Sonnet 5 passe 3/3. Panel Sonnet 10×2 préparé sous identité `PROVIDER_DEFAULT/UNSPECIFIED`, aucune promotion. | Arbitrer Produit/Finance puis demander un GO propriétaire exact avant tout appel. |
| V4-010 | `BLOQUÉ` | Aucun flow IA utilisateur actif. | 009C GO + contrat V4-002 publié. |
| V4-011 | `BLOQUÉ` | Aucun gate cumulatif déterministe livré. | Preuve de maîtrise multi-notions côté serveur. |
| V4-012 | `PLANIFIÉ` | Données de production absentes. | Pilote V4-010 instrumenté. |
| V4-013 | `PLANIFIÉ` | Sandbox marchand non activé. | Qualité, finance et conseil externe. |
| V4-014 | `PLANIFIÉ` | Packs/SKU non actifs. | V4-013 + prix validés. |
| V4-015 | `PLANIFIÉ` | Clôture financière non active. | Paiement réel et règles externes. |
| V4-016 | `À AUDITER` | Vue d'annonce V5 à distinguer du créateur fonctionnel. | Vérifier baseline et promesse avant clôture. |
| V4-016A | `À AUDITER` | Landing V3.5 existe ; enrichissements V4 à confirmer. | N'afficher que preuves/prix validés. |
| V4-016B | `PLANIFIÉ` | Les nouvelles surfaces V4 nécessitent leurs gabarits desktop. | Spécifications Atlas + écrans V4 stabilisés. |
| V4-016C | `PLANIFIÉ` | Reprise multi-programmes à confirmer dans le runtime. | Audit UX et données disponibles. |
| V4-016G | `PLANIFIÉ` | Direction Atlas validée, surfaces runtime absentes. | Implémenter avec V4-010 et les écrans crédits. |
| V4-017 | `PLANIFIÉ` | Plusieurs fondations existent, audit final non clos. | Avant pilote réel et avant paiement. |
| V4-018 | `BLOQUÉ` | Aucun coût de correction produit promu. | Mesures du pilote et modèle/pipeline retenu. |
| V4-018A | `BLOQUÉ` | Cohortes commerciales non ouvertes. | V4-018 + budgets approuvés. |
| V4-019 | `BLOQUÉ` | V4 incomplète. | Tous gates qualité, UX, finance, sécurité et rollback. |

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

Le holdout de remplacement devra être authoré indépendamment des résultats
candidats, scellé avant ouverture et consommé une seule fois après GO du corpus
de développement. Un résultat ambigu ou non supporté produit une abstention,
pas une validation humaine fictive.

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

Aucune décision de prix ou de paiement n'est nécessaire maintenant. Le prochain
arbitrage utile intervient lorsque le gate « maîtrisé + négatif + injection »
est préenregistré et chiffré : Finance arbitre alors l'enveloppe exacte, puis le
Propriétaire autorise ou refuse séparément les appels.
