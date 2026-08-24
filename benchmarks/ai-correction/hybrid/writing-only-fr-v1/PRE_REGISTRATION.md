# Préenregistrement — promotion limitée WRITING/fr-FR

- **Statut** : `PREREGISTERED_BEFORE_AUTHORING`
- **Identité** : `learnx-french-writing-correction-sonnet-v3-1-guarded-v1`
- **Corpus futur** : `learnx-french-writing-holdout-v1`
- **Modèle** : `anthropic/claude-sonnet-4.6`
- **Route** : Anthropic épinglée via OpenRouter, sans fallback
- **Prompt** : `2.2.0`
- **Protocole** : `3.0.1`
- **Langue et périmètre** : `fr-FR`, `activityType=writing` uniquement
- **Livraison** : `PARTIAL_CRITERION`
- **Examen** : 24 cas frais × 3 répétitions
- **Plafond fournisseur absolu** : `2.18 USD`
- **Appel autorisé au stade du préenregistrement** : aucun

Ce document est gelé et committé avant toute rédaction de cas ou de gold. Il
ne promeut aucun modèle et n'autorise pas l'activation de V4-010.

## 1. Hypothèse testée

La campagne générale à quatre familles est définitivement `NO-GO`. La nouvelle
hypothèse est plus étroite : l'identité Sonnet v3-1 peut fournir un feedback
formatif utilisable sur des productions textuelles françaises de faible risque,
si LearnX refuse tout autre type d'activité, calcule le score côté serveur,
borne les cas proches du seuil et ne publie que des remédiations authorées.

Un GO ne vaudra donc ni pour les activités `practice`, `project` ou
`reflection`, ni pour une correction certifiée, ni pour la progression.

## 2. Corpus frais et auteurs indépendants

Deux auteurs autonomes indépendants produisent chacun 24 propositions à partir
de la même matrice scellée : six profils × quatre archétypes Writing. Ils ne
communiquent pas, ne consultent ni les sorties candidates, ni les anciens
holdouts consommés, ni le travail de l'autre avant gel de leur propre lot.

Après gel des deux lots, chaque auteur annote les 24 propositions de l'autre
sans voir ses golds. Le taux de désaccord est calculé sur les niveaux des trois
critères : nombre de niveaux différents divisé par 144 annotations croisées.
Un cas n'est convergent que si les trois niveaux, l'état attendu dans la garde
de seuil et le besoin de seconde passe concordent.

- désaccord inter-auteurs `> 15 %` : arrêt et demande au Propriétaire ;
- cellule sans aucune proposition convergente : arrêt et demande ;
- seuls les étalons convergents peuvent être conservés ;
- aucune troisième rédaction, correction opportuniste ou boucle de remédiation ;
- si deux propositions convergent pour une cellule, la sélection alterne A/B
  selon l'index de la cellule afin d'éviter qu'un seul auteur domine le corpus.

Les 24 cas retenus sont scellés sous un nouveau digest avant tout appel. Les
trois répétitions mesurent la stabilité ; elles ne sont pas présentées comme 72
situations sémantiques indépendantes.

## 3. Dette méthodologique obligatoire

Les deux auteurs reçoivent exactement les consignes suivantes :

1. sur les profils `ERRONEOUS_DECIDABLE`, le gold est strictement décidable ;
   aucune générosité de formulation ne corrige une erreur matérielle ;
2. ne pas reproduire le défaut Practice historique : aucune préséance implicite,
   et toute portée, priorité ou précondition doit être écrite explicitement ;
3. intégrer trois sondes distinctes issues de l'erreur Writing confirmée :
   fallback séduisant mais trop tardif, fallback moins coûteux mais hors
   capacité/plafond, et fallback admissible seulement après un fait nouveau qui
   ne peut pas être supposé.

## 4. Garde déterministe autour du seuil

Pour chaque contrat, LearnX calcule le score à partir des niveaux et des poids.

- si `abs(score - passingScore) > 5`, le résultat peut suivre le contrat normal ;
- si `abs(score - passingScore) <= 5`, une seconde passe du même modèle est
  obligatoire dans le workflow initial ;
- dans cette zone, aucun score exact ni verdict `PASS/FAIL` n'est publié, même
  après la seconde passe ; seuls les constats matériels sûrs et les remédiations
  authorées peuvent être rendus ;
- une seconde passe n'est ni un retry transport ni un produit supplémentaire.

Les métriques de faux PASS, d'accord décisionnel et de calibration n'intègrent
que les verdicts effectivement publiables. Une abstention conforme à la garde
n'est pas comptée comme un verdict erroné.

## 5. Gates gelés

Les seuils de `benchmark.v3_1.json` ne sont pas modifiés après résultat. La
surcouche autonome conserve en plus les gates déjà utilisés lors de l'examen
général :

- `falsePassCountMaximum = 0` ;
- `injectionSafetyMinimum = 1` ;
- `twoLevelOrdinalGapCountMaximum = 0` ;
- `unsureCriterionRateMaximum = 0.05`.

S'ajoutent comme invariants, sans retuning :

- activité exclusivement `writing` ;
- aucun critère inconnu ou preuve hors réponse ;
- aucune recommandation contraire à une contrainte dure ;
- coût et identité fournisseur réconciliés à 100 % ;
- aucun résultat de la zone ±5 présenté comme verdict exact ;
- aucun effet sur `ConceptProgress`, `StageProgress` ou `VALIDATED`.

## 6. Budget et arrêt

Le budget total autorisé pour cette séquence est de 4 USD. La campagne générale
a consommé 1.817373 USD ; le plafond fournisseur restant est fixé à 2.18 USD.

- aucun retry transport et aucun fallback ;
- seules les secondes passes déclenchées par la garde ±5 sont autorisées ;
- contrôle du budget avant chaque dispatch ;
- coût absent ou non réconcilié : arrêt immédiat ;
- prochain dispatch incompatible avec le plafond : `PANEL_INCOMPLETE`, sans
  transformer l'incident en NO-GO pédagogique ;
- une seule campagne, puis arrêt et rapport quel que soit le verdict.

Le garde budgétaire fonctionne en deux phases. Avant le premier appel, un
préflight lié au corpus scellé calcule :

`pireCas = 72 primaires + secondes passes de garde + retries bornés`.

Pour cette identité, `maxRetries=0` : le terme retry vaut donc zéro. Le pire
cas sans borne de secondes passes vaut deux fois la somme conservatrice des 72
primaires. Comme il peut dépasser 2.18 USD, le budget des secondes passes est
borné séparément : tous les primaires sont exécutés d'abord, puis les secondes
passes sont ordonnées par proximité du seuil et ne sont envoyées que si leur
coût conservateur tient dans le reliquat. Une seconde passe sautée produit le
signal explicite `SCORE_GUARD_SECOND_PASS_SKIPPED_BUDGET`; elle ne rend aucun
verdict exact et reste un écart de mesure diagnostique.

Si le coût conservateur des 72 primaires dépasse à lui seul 2.18 USD, le runner
s'arrête avant tout appel et demande une contingency explicite. Une fois le
premier appel envoyé, le garde-fou fournisseur ne peut plus interrompre la
phase primaire pour raison budgétaire. Les contrôles d'identité et de coût
inconnu restent fail-closed et ne sont pas requalifiés en décisions
pédagogiques.

## 7. Revue, digests et verdict

Le paquet de revue autonome est aveugle au modèle, au fournisseur, au coût, aux
golds et au verdict automatique. La revue est liée par digest et ne simule
jamais une approbation humaine : `humanReviewApproved` reste faux.

La chaîne finale relie le préenregistrement, les deux lots auteurs, les deux
annotations croisées, le manifeste de comparaison, le corpus scellé, la revue
autonome du corpus, l'autorisation propriétaire, les tentatives, le paquet
aveugle, le manifeste de revue et le résumé final. Tout manifeste remplacé est
marqué `SUPERSEDED` sans être supprimé.

Après l'unique exécution : verdict `GO` ou `NO_GO`, puis arrêt. En cas de GO,
seul un plan de scellement runtime est proposé au Propriétaire ; aucune
activation n'est exécutée sans nouvelle autorisation.

## 8. Critère runtime non négociable

Le pin d'identité refuse avant devis, réservation ou appel fournisseur tout
contrat dont `activityType` n'est pas `writing`. Le filtre et son ordre
d'exécution sont couverts par test. Motif consigné : « défaut éliminatoire
Practice confirmé par revue canonique du 24 août ».
