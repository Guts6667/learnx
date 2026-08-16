# Spécification V4 — protocole evidence-assist à passages déterministes

- **Statut** : `APPROVED_FOR_OFFLINE_IMPLEMENTATION`
- **Version du protocole** : `3.0.0`
- **Version du validateur** : `2.0.0`
- **Version du segmenter** : `2.0.0`
- **Date d'arbitrage** : 16 août 2026
- **Portée initiale** : `WRITING`, `fr-FR`, risque faible
- **Autorité sémantique du modèle** : relations candidates uniquement
- **Autorité de score, niveau, maîtrise et progression** : aucune

Cette spécification crée une nouvelle identité de protocole. Elle ne modifie ni
ne requalifie les campagnes Gemini et Sonnet 5 antérieures. Leurs verdicts,
coûts et artefacts restent append-only.

La promesse publique reste un feedback formatif assisté. Une relation proposée
par un modèle n'est pas une note, une validation ou une preuve de maîtrise.

## 1. Deux canaux qui ne se mélangent jamais

LearnX sépare par les types et les tests :

1. les constats mécaniques, décidés par des règles serveur authorées et seuls
   éventuellement scorables ;
2. les relations sémantiques candidates proposées par l'IA, jamais scorables.

| Canal | Producteur autorisé | Valeurs | Peut alimenter niveau/score ? | Peut agir sur maîtrise/progression ? |
| --- | --- | --- | --- | --- |
| Constat mécanique | Règle LearnX pure, authorée, versionnée et testée | Faits calculables depuis des entrées déterministes | Oui, uniquement dans sa sous-rubrique mécanique explicite | Non, sauf gate de maîtrise serveur distinct autorisé par V4-011 |
| Relation evidence-assist | Modèle sous schéma candidate-only, puis validateur LearnX | `EVIDENCE_FOR_ELEMENT`, `EVIDENCE_AGAINST_ELEMENT`, `ABSTAIN`, `UNRESOLVED` | **Jamais**, directement ou par agrégation, comptage, polarité ou couverture | **Jamais** |

Une relation candidate ne peut être convertie en `SUPPORTED`, `CONTRADICTED`,
`NOT_DEMONSTRATED` ou `AMBIGUOUS` pour alimenter l'ancien moteur de niveaux.
Elle ne peut écrire aucun score, niveau, état de maîtrise, progression ou
`StageAssessmentSubmission.VALIDATED`. Le résultat evidence-assist expose
toujours `level: null`, `indicativeScore: null`, `scoreAuthority: NONE`,
`progressionEffect: NONE` et `masteryEffect: NONE`.

Un contrat qui ne possède aucun constat mécanique indépendant doit publier
`indicativeScoreEnabled=false` et ne rendre aucun niveau. Les poids, points et
bandes d'une rubrique historique ne suffisent pas à rendre une observation
sémantique scorable. Le contrat `WRITING/fr-FR` actuel reste donc DRAFT jusqu'à
ce que sa version publiable rende cette séparation explicite et passe ses tests
négatifs de non-consommation.

## 2. Préparation déterministe de la requête

Avant tout appel, LearnX :

- fige la réponse, la consigne, le contexte, la rubrique et leurs empreintes ;
- construit une vue candidate de la rubrique sans points, poids, niveaux,
  politique de score ou templates de décision ;
- segmente la réponse sans normalisation et attribue des identifiants opaques ;
- génère côté serveur un canari aléatoire de 128 bits ;
- lie canari, rubrique, tâche, réponse, manifeste de spans, versions et messages
  dans un contexte de requête immuable et empreinté ;
- place les instructions dans un message `system` et les passages apprenant,
  explicitement non fiables, dans un message `user` distinct.

Le segmenter accepte au maximum 20 000 caractères, 256 passages et 800
caractères par passage. Il conserve les offsets UTF-16 exacts, le texte
`responseText.slice(start, end)`, un SHA-256 et sa version. Les textes répétés
restent distingués par leurs identifiants et offsets. Aucune recherche floue,
correction typographique ou normalisation Unicode n'est autorisée.

## 3. Contrat de sortie du modèle

Le modèle retourne seulement `elementKey`, `relation` et `spanIds` :

- `EVIDENCE_FOR_ELEMENT` : les passages étayent la proposition exacte de
  l'élément ; si l'élément décrit un défaut, montrer ce défaut reste bien
  `EVIDENCE_FOR_ELEMENT` ;
- `EVIDENCE_AGAINST_ELEMENT` : les passages réfutent explicitement cette même
  proposition ;
- `ABSTAIN` : aucune relation prudente n'est établie.

Une relation positive ou négative utilise un à quatre identifiants fournis.
`ABSTAIN` utilise une liste vide. Un élément peut être omis et un seul passage
peut suffire à une relation complète.

Le modèle ne retourne ni citation, texte recopié, offset, confiance, exigence
nouvelle, statut final, niveau, score, `PASS/FAIL`, conseil ou feedback libre.

## 4. Validation fail-closed et résultat partiel

LearnX conserve la chaîne brute exacte de l'assistant avant de la parser. Aucun
adapter ne la tronque avant le calcul du SHA-256 ; seule la copie persistée est
bornée et porte explicitement son indicateur de troncature. Le validateur reçoit
le même contexte de requête, recalcule toutes ses empreintes, vérifie le canari
dans le raw, puis résout chaque identifiant contre le manifeste serveur.

Une enveloppe globale invalide, une identité ou empreinte différente, une fuite
de canari ou un incident de traçabilité rend l'exécution entière indisponible.
En revanche, un finding individuel mal formé, dupliqué ou utilisant une clé ou
un span inconnu est rejeté localement avec son code ; les findings indépendants
valides sont conservés. Une omission ou une abstention devient `UNRESOLVED`,
jamais automatiquement `NOT_DEMONSTRATED`.

La complétude `FULL|PARTIAL` mesure uniquement la couverture structurelle des
relations candidates. Elle ne certifie jamais leur justesse sémantique.

## 5. Restitution formative

Après promotion et seulement dans le périmètre exact du pilote, LearnX peut
présenter les passages reliés comme observations de révision, avec une
formulation issue de templates authorés. Ils restent étiquetés comme assistance
IA et ne deviennent pas des résultats académiques.

Le score éventuellement affiché pour une autre partie de l'activité doit être
entièrement issu de constats mécaniques indépendants. Aucun score global ou
niveau ne peut dépendre, même partiellement, du nombre, de la polarité ou de la
couverture des relations candidates.

Les états publics restent `FEEDBACK_READY`, `REVISION_REQUIRED`,
`CLARIFICATION_REQUIRED` et `TEMPORARILY_UNAVAILABLE`, mais seul un constat
mécanique peut imposer `REVISION_REQUIRED`. Un doute sémantique est présenté
comme non résolu, jamais comme un échec.

## 6. Capacité et route fournisseur

Les profils distinguent obligatoirement :

- `DISABLED` : désactivation explicite, jamais une omission ;
- `PROVIDER_DEFAULT` : paramètre volontairement omis ;
- `ADAPTIVE` : raisonnement adaptatif avec effort attesté ;
- `LEGACY_BUDGET` : uniquement si le modèle et la route l'attestent.

L'attestation du 16 août prouve hors ligne la sérialisation de `DISABLED` pour
Sonnet 5. La voie expérimentale retenue est l'adapter `OPENROUTER_CHAT`, modèle
`anthropic/claude-sonnet-5`, route exacte `Anthropic`, fallback interdit et
payload `reasoning: { effort: "none" }`. Chaque tentative doit fournir un coût
`ACTUAL`; son absence bloque la finalisation. La route Anthropic directe accepte
`thinking: { type: "disabled" }`, mais reste exclue de la campagne tant que son
coût n'est disponible qu'en estimation.

Cette attestation ne prouve ni disponibilité du compte, ni succès d'un appel,
ni qualité pédagogique. Le statut reste
`CAPABILITY_ATTESTED_OFFLINE / NO_MODEL_CALL` jusqu'au gel d'une identité de
campagne, au budget Finance et au GO propriétaire.

## 7. Gates de développement et de promotion

### 7.1 Identité et corpus bornés avant le premier appel

L'identité de campagne lie au minimum : identifiant de campagne, modèle et
snapshot, adapter, route observée attendue, fallback, payload de raisonnement,
prompt/protocole/validateur/segmenter, rubrique et empreinte, manifeste des
quatre cas, sélection de développement et empreinte, nombre et ordre des
répétitions, seuils, tarif, plafond, retry et règle d'arrêt. Aucun de ces
identifiants n'est déduit après un résultat.

Le **corpus de développement complet** n'est pas un futur ensemble ouvert. Il
est exactement la sélection scellée
`writing-fr-semantic-development-v2@2.0.0`, SHA-256
`d8266d0387330aaa7da477d91b8af99bec24ca065c0c0ed4206d32bf157573dd` :
10 cas synthétiques distincts, deux répétitions fraîches par cas, soit 20
workflows. Les quatre workflows de faisabilité sont une enveloppe préalable et
ne sont pas comptés dans ces 20. Aucun résultat historique n'est réutilisé.

Changer un texte, un gold, une attente, un ordre, une répétition, un seuil ou la
sélection impose une nouvelle version de corpus, une nouvelle identité de
campagne et un retour au gate quatre cas. Le manifeste exact du lot d'exécution
reste à attribuer avant tout appel ; la présente définition n'invente pas son
identifiant.

### 7.2 Séquence obligatoire

1. tests hors ligne du segmenter, du contexte, du schéma, des rejets partiels,
   de la polarité, du raw et des capacités ;
2. gel simultané de l'identité, des quatre cas et du corpus complet 10 × 2 ;
3. après budget Finance et GO propriétaire, quatre cas frais : positif,
   négatif, mutation et injection ;
4. si et seulement si le gate fait 4/4, nouvelle autorisation de dépense puis
   corpus complet 10 cas × 2, sans changement d'identité ;
5. en parallèle des appels mais indépendamment de leurs sorties, authoring,
   validation autonome, chiffrement et scellement du holdout v3 ;
6. après 20/20 et tous les seuils de développement, décision
   `GO_TO_SEALED_HOLDOUT` autorisant une seule ouverture/exécution ;
7. après succès one-shot du holdout et réconciliation complète, décision
   `GO_AUTONOMOUS_FORMATIVE` sur le pipeline exact.

Gates absolus : 100 % des identifiants résolus par LearnX, zéro identifiant
inventé, zéro faux support critique, zéro injection ou fuite de canari, zéro
champ interdit, zéro relation candidate consommée par un score ou niveau,
sorties brutes et coûts réconciliés à 100 %. Toute modification d'identité,
route, payload, prompt, protocole, rubrique, corpus, seuil ou prix ferme la
campagne et recommence au gate quatre cas.

### 7.3 Portée des deux décisions

- `GO_TO_SEALED_HOLDOUT` exige : 4/4, 20/20, seuils absolus satisfaits, aucune
  adaptation post-résultat, coûts réconciliés, holdout v3 indépendant et
  scellé, puis autorisation one-shot du Propriétaire. Il ne promeut pas le
  modèle et n'ouvre aucun ticket live.
- `GO_AUTONOMOUS_FORMATIVE` exige : holdout one-shot valide sous la même
  identité, seuils préenregistrés satisfaits, zéro incident non réconcilié et
  aucun retuning. Il promeut seulement ce pipeline pour le feedback
  `WRITING/fr-FR` faible risque. V4-002 doit encore publier le contrat et V4-010
  doit encore franchir son propre gate de cohorte avant un utilisateur.

La comparaison d'au moins trois candidats devient un benchmark secondaire de
robustesse et d'économie après la faisabilité du pipeline exact. Elle ne bloque
pas le gate initial Sonnet 5, le 10 × 2, le holdout ou le pilote formatif borné.
Elle reste requise avant V4-018, la fixation des prix et toute généralisation
commerciale. Les campagnes historiques sous un autre rôle ne comptent pas dans
ces trois candidats.

## 8. Frontières produit

- V4-002 est `ACTIVE_OFFLINE / PUBLICATION_BLOCKED` : authoring, compilation et
  mutations sont autorisés ; aucun contrat ne devient éligible au live.
- V4-010 est `ACTIVE_OFFLINE / LIVE_BLOCKED` : fake provider, feature flag
  forcé à off, persistance et UX peuvent être développés sans réseau ni débit.
- Publication, appel modèle, débit réel, activation utilisateur, falsificateur
  et holdout restent bloqués jusqu'à leurs gates explicites.
- V4-011 reste indépendant : seule une évaluation cumulative déterministe,
  multi-notions et corrigée côté serveur peut valider la maîtrise.

Le registre de sources et ses futurs index vectoriels servent au grounding de
faits et à l'authoring. Ils ne remplacent jamais une preuve présente dans la
réponse de l'apprenant et ne bloquent pas ce premier pilote court.

Le rapport V3.5 conserve un gate externe de release réel appareil/PWA,
iPhone/VoiceOver, zoom et smoke authentifié post-promotion. Cette dette
d'assurance ne change aucun gate autonome ci-dessus et n'introduit aucun
évaluateur humain dans la correction. Elle interdit toutefois de déclarer V4
clôturée tant qu'elle n'est pas réconciliée dans le rapport de release.
