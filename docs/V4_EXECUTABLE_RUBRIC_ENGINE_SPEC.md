# Spécification V4 — moteur de rubrique exécutable

- **Statut** : `APPROVED_FOR_IMPLEMENTATION`
- **Version** : `1.1.0`
- **Date de réconciliation** : 22 août 2026
- **Portée initiale** : `WRITING`, `fr-FR`, risque faible
- **Autorité pédagogique** : règles LearnX versionnées
- **Autorité de progression** : aucune

Cette spécification remplace, pour les nouvelles expériences V4, l'approche où
un modèle attribue librement des niveaux. Les campagnes précédentes restent des
preuves historiques ; elles ne sont ni effacées, ni requalifiées.

Pour toute interface sémantique, `docs/V4_EVIDENCE_ASSIST_PROTOCOL_SPEC.md`
est l'autorité canonique la plus récente. Il supersède l'ancien composite,
l'attribution de statuts par le modèle et la seconde passe automatique. La
présente spécification reste autoritaire pour le compilateur, les constats
mécaniques authorés et leurs calculs serveur.

La promesse publique reste :

> Feedback formatif autonome, critériel et appuyé sur les preuves présentes
> dans la réponse de l'apprenant.

LearnX ne promet ni correction certifiée, ni vérité pédagogique universelle,
ni validation de maîtrise par l'IA.

## 1. Principe d'autorité

Le pipeline cible est :

```text
rubrique versionnée
  -> compilation et contrôles statiques
  -> constats mécaniques par règles serveur pures
  -> segmentation déterministe de la réponse
  -> relations sémantiques candidates optionnelles
  -> validation et certificat evidence-assist
  -> feedback authoré par templates
```

Les modèles ne retournent ni statut atomique, ni niveau final, ni score, ni
`PASS/FAIL`, ni faiblesse libre. Ils proposent uniquement des relations
candidates vers des passages présegmentés par LearnX. Ces relations ne sont
jamais consommées par un calcul de statut, niveau, score, maîtrise ou progression.

## 2. Rubrique atomique

Chaque critère référence des éléments adressables. Un élément définit au
minimum :

- une clé stable ;
- un type `FACT`, `RELATION`, `JUSTIFICATION`, `CONTRADICTION` ou `HOLISTIC` ;
- un critère propriétaire unique, sauf partage explicitement authoré ;
- son caractère obligatoire ou complémentaire ;
- le niveau à partir duquel il est requis ;
- des exemples positifs, négatifs et variantes acceptables ;
- une règle de preuve et, pour une relation, le nombre minimal de spans ;
- les contradictions recherchées ;
- les critères exclus de son effet ;
- des messages de force, révision, contradiction et clarification authorés.

Une phrase peut démontrer plusieurs éléments indépendants. En revanche, une
même lacune ne peut dégrader plusieurs critères si son élément ne leur
appartient pas. Le compilateur bloque notamment les cas suivants :

- l'absence de cible dégrade aussi la cohérence du plan ;
- la concision dégrade une réflexion pourtant complète ;
- le style ou l'orthographe deviennent implicitement des exigences ;
- une preuve appartenant au contexte est présentée comme une preuve de la
  production de l'apprenant.

`HOLISTIC` signale une propriété insuffisamment formalisable. Un contrat qui en
dépend ne peut pas être déclaré `FULLY_COMPILABLE`.

## 3. Statuts atomiques

Les règles mécaniques serveur reconnaissent cinq statuts atomiques :

- `SUPPORTED` : l'élément est démontré par une preuve exacte et valide ;
- `CONTRADICTED` : une contradiction explicite est prouvée ;
- `NOT_DEMONSTRATED` : cette réponse ne démontre pas suffisamment l'élément ;
- `EXPLICITLY_REFUTED` : la réponse refuse explicitement l'élément attendu ;
- `AMBIGUOUS` : plusieurs interprétations plausibles subsistent.

`NOT_DEMONSTRATED` ne constitue jamais une affirmation sur la maîtrise réelle
de l'apprenant. Pour le MVP, `EXPLICITLY_REFUTED` conserve un certificat et un
template distincts mais le même effet de niveau que `NOT_DEMONSTRATED` sur un
élément positif requis. Une relation candidate, y compris
`EVIDENCE_AGAINST_ELEMENT`, n'établit jamais seule aucun de ces cinq statuts.

## 4. Interface sémantique canonique

LearnX segmente d'abord la réponse et fournit des identifiants de passages
opaques. Le modèle reçoit une vue candidate sans points, poids, niveaux ou
templates de décision. Il retourne uniquement :

- `elementKey` ;
- `relation`, parmi `EVIDENCE_FOR_ELEMENT`, `EVIDENCE_AGAINST_ELEMENT` et
  `ABSTAIN` ;
- `spanIds`, limités aux identifiants fournis par LearnX.

Le modèle ne retourne ni citation libre, ni offset, ni hash, ni confiance, ni
contradiction libre, ni exigence nouvelle. LearnX résout les `spanIds`, recalcule
offsets et hashes et rejette tout identifiant inconnu. Omission et `ABSTAIN`
deviennent `UNRESOLVED`, jamais `NOT_DEMONSTRATED`.

Le chercheur primaire, le composite et la seconde passe automatique décrits
dans les baselines antérieures sont `SUPERSEDED_HISTORICAL`. Il n'existe aucun
vote ou arbitre actif. Un futur falsificateur serait une campagne distincte,
avec identité et budget propres, et seulement après un gain mesuré ; il est
actuellement fermé.

## 5. Contrôles déterministes et certificat

Avant toute restitution, LearnX contrôle :

- les offsets et le hash du texte exact ;
- l'absence de preuve hors réponse ;
- les frontières de l'injection et les canaris ;
- les clés, relations et identifiants de passages autorisés ;
- la propriété et les règles de partage ;
- l'absence d'exigence inconnue et de double pénalisation ;
- la couverture de tous les éléments ;
- le schéma et l'identité du pipeline.

Une citation n'a pas besoin d'être unique dans le texte. Son couple d'offsets et
son hash désigne l'occurrence exacte.

Chaque constat mécanique publiable possède un certificat reconstructible :

- identité et version de la rubrique ;
- empreinte du pipeline ;
- règle et version appliquées ;
- statut et preuves de chaque élément ;
- contradictions ;
- niveau calculé et ensemble des niveaux possibles par critère ;
- état pédagogique calculé.

Le certificat evidence-assist reste séparé. Il porte l'identité de protocole,
les relations candidates, les `spanIds` résolus et leurs empreintes, avec
`level: null`, `indicativeScore: null`, `scoreAuthority: NONE`,
`masteryEffect: NONE` et `progressionEffect: NONE`.

Le feedback est dérivé du certificat. Au MVP, il utilise uniquement les
templates authorés ; aucune reformulation libre par modèle n'est publiée.

## 6. Résolution de l'incertitude

Pour les seuls constats mécaniques, le moteur évalue toutes les résolutions
authorisées d'un élément `AMBIGUOUS`.

- Si toutes les résolutions conduisent au même niveau, l'ambiguïté est sans
  effet matériel et le résultat peut être publié.
- Si les résolutions conduisent à plusieurs niveaux, aucun score exact n'est
  publié et une clarification minimale est demandée.

Les états pédagogiques visibles sont :

- `FEEDBACK_READY` : résultat déterminable et feedback disponible ;
- `REVISION_REQUIRED` : élément obligatoire non démontré ou contredit ;
- `CLARIFICATION_REQUIRED` : ambiguïté matérielle ;
- `TEMPORARILY_UNAVAILABLE` : incident technique, sans résultat ni débit.

Une clarification crée une nouvelle version immuable de la soumission. Une
réponse identique restitue son résultat existant.

## 7. Éligibilité

- `FULLY_COMPILABLE` : tous les niveaux et l'éventuel score indicatif sont
  calculables par règles déterministes ;
- `PARTIALLY_COMPILABLE` : seuls certains constats sont publiables, sans score
  global ;
- `UNSUPPORTED_AUTONOMOUSLY` : aucune correction autonome publique.

Le MVP n'active que `FULLY_COMPILABLE`. `MODEL_LEVEL_PROPOSAL` n'existe pas
comme mode public.

## 8. Compilateur

Le compilateur refuse au minimum :

- niveau impossible à atteindre ou seuil non couvert ;
- règles contradictoires, chevauchantes ou non monotones ;
- combinaison de statuts sans décision ;
- ajout d'une preuve qui abaisse un résultat ;
- élément exclusif avec plusieurs propriétaires ;
- pénalité applicable à plusieurs critères sans partage explicite ;
- `AMBIGUOUS` assimilé silencieusement à `NOT_DEMONSTRATED` ;
- `EXPLICITLY_REFUTED` assimilé silencieusement à `CONTRADICTED` ;
- critère `HOLISTIC` prétendument pleinement compilable ;
- seuil annoncé impossible à atteindre.

## 9. Preuves de qualité séparées

Les résultats de trois ensembles ne sont jamais fusionnés :

1. **Corpus mécanique** : vecteurs de composants garantis par construction ;
   oracle réellement exécutable.
2. **Corpus sémantique synthétique** : textes générés puis contre-vérifiés ;
   pseudo-oracle explicitement synthétique.
3. **Shadow réel non annoté** : productions consenties ; mesure uniquement la
   stabilité, la couverture, l'abstention, le coût et la dérive.

Les répétitions d'un même cas mesurent la stabilité, pas la diversité
sémantique. Elles ne justifient pas seules une garantie statistique.

## 10. Tests obligatoires

Le corpus mécanique et les tests couvrent :

- invariance à la paraphrase, à l'ordre des phrases, à la typographie, au
  registre et aux fautes sans perte de sens ;
- concision complète et verbosité inutile ;
- localité d'une mutation sur son seul critère propriétaire ;
- monotonie lorsqu'une preuve correcte est ajoutée ;
- paires minimales, dont réponse sans cible puis réponse identique avec cible ;
- contradictions, injections et canaris ;
- mutation testing du compilateur : mauvais propriétaire, exigence supprimée,
  règle non monotone, niveau inatteignable et double pénalisation.

Gates absolus : zéro citation inventée, fuite de canari, obéissance à une
injection, élément inconnu, mauvais propriétaire, double pénalisation, score
exact sous ambiguïté matérielle, coût inconnu traité comme nul et effet sur la
progression.

## 11. États techniques et financiers

Les machines d'état restent distinctes :

- correction : `FEEDBACK_READY`, `REVISION_REQUIRED`,
  `CLARIFICATION_REQUIRED`, `TEMPORARILY_UNAVAILABLE` ;
- exécution : `PENDING`, `SENT`, `CONFIRMED`, `ORPHANED` ;
- finance : `RESERVED`, `SETTLED`, `RELEASED`,
  `RECONCILIATION_REQUIRED`.

`CALL_INTENT`, l'idempotence locale et la réconciliation appel par appel restent
obligatoires. Un circuit breaker global ne les remplace pas.

## 12. Périmètre du premier pilote

- une famille `WRITING` en français ;
- trois critères et six à dix éléments ;
- un contrat `FULLY_COMPILABLE` ;
- un candidat testé comme chercheur de relations evidence-assist sous une
  identité gelée et autorisée ;
- aucun falsificateur actif ; une campagne séparée d'une autre famille devient
  éligible seulement si son gain est mesuré ;
- score entièrement déterministe et feedback par templates ;
- une clarification maximale ;
- feature flag, crédits offerts, aucun effet sur la progression ;
- aucun domaine santé, réglementé ou professionnel.

V4-011 reste fermé : une remise libre et son feedback ne prouvent pas la
maîtrise. Cette dernière exige une preuve déterministe indépendante couvrant
réellement l'objectif.
