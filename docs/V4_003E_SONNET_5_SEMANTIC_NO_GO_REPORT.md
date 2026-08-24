# V4-003E — Arbitrage du NO-GO sémantique Sonnet 5

- **Statut** : `DONE_LOCAL_NO_GO_SEMANTIC_DISAGREEMENT / APPEND_ONLY /
  PENDING_INTEGRATION`
- **Date** : 21 août 2026
- **Baseline de preuve** : `origin/dev@ba845d8b81c24a5c1d3fe448bf4e808920385f42`
- **Identité close** : `cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31`
- **Portée** : analyse et documentation hors ligne, sans appel modèle
- **Retuning ou replay** : interdits
- **Pipeline promu** : aucun
- **Panel, holdout et live** : fermés

## 1. Verdict exact

L'identité ci-dessus est close en `NO-GO_SEMANTIC_DISAGREEMENT`. Ce verdict
porte sur le pipeline exact gelé pour le gate `V4-009C-S2`, pas sur toute la
famille Sonnet 5, tout usage du protocole evidence-assist, ni toute tâche de
correction formative.

Le runner a envoyé le premier cas sur quatre puis appliqué la règle
préenregistrée d'arrêt au premier défaut. La réponse était structurée, le raw
avait été persisté avant validation, la route demandée était `Anthropic`, le
fournisseur observé `Anthropic`, et le coût `ACTUAL` de `0,018828 USD` était
réconcilié. Il n'y a eu ni retry ni fallback. Les trois appels restants n'ont
pas été envoyés.

Le défaut porte sur `project-b-dimension-scope` :

- statut mécanique gelé : `SUPPORTED` ;
- relation attendue : `EVIDENCE_FOR_ELEMENT` ;
- relation retournée : `EVIDENCE_AGAINST_ELEMENT` ;
- span : `s0007-8a2f1b2dd94b10fd` ;
- texte : « Pour B, je mobilise échantillon, phénomène, design, évaluation et
  type de recherche, sans laisser de dimension ouverte. »

L'absence d'ambiguïté est démontrée **dans la portée des autorités gelées** :
le contrat contient une formulation positive presque identique, accepte
explicitement « aucune dimension ouverte » lorsque toutes les dimensions sont
traitées, et l'oracle v2.1 gèle ce span comme `SUPPORTED`. La construction
parallèle du projet A est elle aussi positive. L'écart n'est donc ni une panne
de transport, ni une erreur de réconciliation, ni une frontière nouvelle du
gold ; c'est une inversion sémantique du candidat sous cette identité.

## 2. Ce qu'un seul appel permet — et ne permet pas — de conclure

Le gate est conjonctif : il exige `4/4` workflows utilisables et impose l'arrêt
au premier `SEMANTIC_DISAGREEMENT`. Un seul échec suffit donc à fermer
l'identité conformément au protocole. Le workflow est entièrement `INVALID` et
compte comme `0` workflow utilisable, même si les autres relations de la sortie
ne sont pas en défaut.

En revanche, `n = 1` ne permet pas d'estimer :

- la précision globale ou la fréquence de cette erreur ;
- la variabilité entre répétitions ;
- la robustesse aux cas de mutation ou d'injection non envoyés ;
- les coûts ou latences P50/P90 ;
- la qualité de Sonnet 5 sur d'autres contrats, profils, routes ou tâches.

Ce NO-GO est une décision valide pour le gate exact, pas une mesure statistique
générale ni une preuve de vérité pédagogique universelle.

## 3. Comparaison historique honnête

| Preuve | Identité et appels | Nature du désaccord | Conclusion autorisée |
| --- | --- | --- | --- |
| Gate evidence-assist du 20 août | `cc4dd0df056f6733bdaf9b4ad45e7d001405d869e38ea742271564a0d3b36805`, `2/4`, `0,025622 USD` | `EVIDENCE_AGAINST_ELEMENT` était plausible face à un gold `NOT_DEMONSTRATED` qui ne distinguait pas encore le refus explicite. | Frontière d'ontologie, puis ajout de `EXPLICITLY_REFUTED` pour le successeur ; pas d'erreur pédagogique évidente démontrée. |
| Gate framework-selection du 21 août | `cc3b1b52bc0f94198faab362905617a3143169e952a53c38eb37f1571eda5d31`, `1/4`, `0,018828 USD` | Inversion d'un exemple positif explicitement autorisé et gelé `SUPPORTED`. | Défaut sémantique matériel de cette identité exacte ; clôture sans replay. |

Les anciens NO-GO Sonnet liés au profil de requête ou au budget de raisonnement
restent des verdicts techniques. Les anciennes campagnes Gemini et Mistral ont
également d'autres rôles, corpus et protocoles. Aucune de ces preuves n'est
réutilisée comme workflow ni comme métrique du prochain gate.

## 4. Conservation append-only

Répertoire canonique :

`benchmarks/ai-correction/results/writing-framework-selection-sonnet5-v2/2026-08-21T20-24-00-Europe-Paris`

- summary SHA-256 : `c843a7429a3674614f8de56b6bd4541513f40c23e051b479d6daa78a7f3eacef` ;
- ledger SHA-256 : `d9d8436a5d9288de95e5444aa355d8e4bf6c159831441850f525e5bac6b22a45` ;
- dernier record du ledger : `95e26c61926cf06d7bb5e98d659fb90206843d71162cf778529e2f90fea598e0` ;
- contenu `rawOutput` SHA-256 : `fd44138bdf283df114d74eecca8a91e5ec7a9fb57e1c3d261989dd53ddacb70f` ;
- fichier raw JSON SHA-256 : `975f45abe9ed5249637c4f86f70504b0186250305784eba0fca5fa7dd2396bb5` ;
- provider request ID : `gen-1787336575-aDS4BzkqrNJqmwEzAHQP` ;
- usage : `5 829` tokens input, `717` visibles, `0` reasoning, cache `0/0` ;
- latence : `4 228 ms`.

Intent, raw, outcome, summary, ledger, empreintes, dossier gelé et enveloppe
Finance Sonnet restent inchangés. Aucun artefact factice ne doit être créé pour
les trois appels non envoyés. L'identité, son autorisation single-use et son
budget inutilisé ne sont ni rejouables, ni transférables. Le corpus, les golds,
le mapping, l'ordre, les seuils et l'oracle ne sont pas retunés après résultat.

## 5. Invariants du prochain gate

Quel que soit le candidat retenu, les éléments suivants restent byte-identiques
à la campagne framework-selection close :

- autorité du protocole `3.0.0` :
  `528418460739faf6cd1aa04de71adf4712504b053b8143bff7f5d2c06a318337`,
  empreinte d'implémentation
  `cbbb273979027fc1654a11e68202b5c7aa55876c2019f1262db35d19f9a41c5a` ;
- rubrique compilée :
  `600fb37a29694ed70c93f6041f879f557792b5120b92cc0ab415466d05383752` ;
- oracle v2.1 :
  `2c35125ea438cf1686ae88b01ecdb28bc304a3c9b9af6d45cff81f37306af3c2` ;
- corpus et ordre :
  `12f0202d930b9f197532847c0125f5531a2b8d39502c8f1244e6049629828a4b` ;
- mapping sémantique et golds :
  `4fbff2b975124bcd336c49e0d2dbfe42ebf3f4adcf9a048ca17c8c4e5a79bb85` ;
- contrat runner :
  `891560b6712afc1f197aea8d016a3309d2d5c7db3ac7e519bda6968d4227eb0b` ;
- télémétrie :
  `e8e4e16a18e4ad652f3b271847e156aedc66f0c8c934eae9c2291cbf1d519b56` ;
- stop-policy, ordre et seuil `4/4` :
  `3416fd36324f0b29952dbb005c44ec2fc58520167d011fdf2698b1a04eabff4e`.

Le prochain dossier doit créer de nouveaux snapshot, identifiants modèle,
route demandée, fournisseur attendu puis observé, profil de requête et de
raisonnement, attestation de capacité, tarifs, enveloppe Finance, manifeste,
empreinte d'identité et préflight du runner. Le runner S2 actuel est spécialisé
Sonnet ; il doit être paramétré et revalidé hors ligne avant tout candidat
Gemini. Une répétition de la même classe d'erreur par plusieurs familles pourra
ouvrir une revue séparée du protocole ; elle ne justifie aucun retuning du
corpus après ce résultat.

## 6. File hors ligne des candidats

L'arbitrage technique final conserve Gemini 3.6 comme candidat 1 recommandé :
il offre la meilleure comparabilité avec les preuves LearnX existantes. Cette
priorité ouvre uniquement la préparation hors ligne et sa disponibilité doit
encore être réattestée. Elle ne gèle aucune identité, enveloppe ou autorisation.

### Rang 1 — Gemini 3.6 Flash

- model ID : `google/gemini-3.6-flash` ;
- canonical catalog : `google/gemini-3.6-flash-20260721` ;
- route à demander et réattester : `google-vertex/global` ;
- structured outputs, `response_format` et `max_tokens` supportés ;
- raisonnement obligatoire, effort `MINIMAL` disponible ;
- `temperature` omise ;
- tarifs prudents hors promotion à réattester : `1,50 USD/M` input et
  `7,50 USD/M` output + reasoning ;
- statut : `NEXT_OFFLINE_CANDIDATE / IDENTITY_NOT_FROZEN /
  RUNNER_PARAMETERIZATION_REQUIRED`.

La proposition Finance (`0,0172545 USD` par tentative,
`0,069018 USD` calculés pour quatre, plafond fournisseur proposé
`0,075 USD`, chargé + FX indicatif `≈ 0,090 USD`) reste
`DRAFT_REATTESTATION_REQUIRED`. Elle n'est ni gelée ni autorisée. La route, le
profil et les tarifs doivent être réattestés avant arbitrage Finance.

### Rang 2 — Gemini 3.7 Flash, option technique éventuelle

- modèle : `google/gemini-3.7-flash` ;
- canonical slug : `google/gemini-3.7-flash-20260813` ;
- route proposée : `google-vertex/global` ;
- raisonnement obligatoire, effort proposé `LOW` ;
- `temperature` omise ;
- profil envisagé : `8 192` tokens de sortie totale, cible visible `4 096`,
  timeout `60 s` ;
- statut : `QUEUED_SECOND_TECHNICAL_OPTION / NO_LEARNX_HISTORY /
  IDENTITY_NOT_FROZEN / FINANCE_RECALCULATION_REQUIRED`.

L'enveloppe 3.6 n'est pas transférable à 3.7. Cette option est préparée
uniquement après disposition de Gemini 3.6 et un nouveau mandat hors ligne.

### Alternative suivante — Mistral Medium 3.5

`mistralai/mistral-medium-3-5` reste le rang 3, après les deux Gemini, avec le
statut `QUEUED_AFTER_GEMINI / OFFLINE_ONLY / IDENTITY_NOT_FROZEN / NO_BUDGET`.
Aucun de ces dossiers ne peut réutiliser les résultats historiques, l'identité
ou le budget d'un autre candidat.

## 7. Arbitrages restant à Rayan

La préparation hors ligne de Gemini 3.6 peut reprendre sans nouveau GO
d'appel. Après cette préparation, les gates restent séquentiels et distincts :

1. attestation du snapshot, de la route, du profil et des tarifs ;
2. validation du runner paramétré sous `HARD_OFF` ;
3. approbation par Rayan de l'identité gelée exacte ;
4. arbitrage Finance de la nouvelle enveloppe ;
5. autorisation réseau single-use séparée de Rayan.

À ce stade, aucun de ces gates n'est acquis. Le panel 10 × 2 reste bloqué
jusqu'à un nouveau `4/4` et des arbitrages distincts. Le holdout scellé reste
fermé et inéligible. Le live demeure `HARD_OFF`, avec 0 contrat publié, 0
activité éligible et aucun débit réel.
