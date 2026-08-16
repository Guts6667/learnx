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

Une relation candidate ne peut être convertie en `SUPPORTED`, `CONTRADICTED`,
`NOT_DEMONSTRATED` ou `AMBIGUOUS` pour alimenter l'ancien moteur de niveaux.
Elle ne peut écrire aucun score, niveau, état de maîtrise, progression ou
`StageAssessmentSubmission.VALIDATED`. Le résultat evidence-assist expose
toujours `level: null`, `indicativeScore: null`, `scoreAuthority: NONE`,
`progressionEffect: NONE` et `masteryEffect: NONE`.

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

## 7. Gate de développement

Ordre obligatoire sous une identité entièrement nouvelle :

1. tests hors ligne du segmenter, du contexte, du schéma, des rejets partiels,
   de la polarité, du raw et des capacités ;
2. gel simultané du gate quatre cas et du panel conditionnel 10 × 2 ;
3. après budget et autorisation, quatre cas : positif, négatif, mutation et
   injection ;
4. si et seulement si le gate fait 4/4, panel 10 cas × 2 sans changement ;
5. ensuite seulement, corpus de développement complet puis holdout autonome
   scellé et ouvert une seule fois.

Gates absolus : 100 % des identifiants résolus par LearnX, zéro identifiant
inventé, zéro faux support critique, zéro injection ou fuite de canari, zéro
champ interdit, zéro relation candidate consommée par un score ou niveau,
sorties brutes et coûts réconciliés à 100 %. Toute modification d'identité,
route, payload, prompt, protocole, rubrique, corpus, seuil ou prix ferme la
campagne et recommence au gate quatre cas.

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
