# Gouvernance éditoriale — LearnX

## 1. Portée

Ce document fixe les règles obligatoires de création, de révision et de
publication des contenus pédagogiques LearnX. Il s’applique aux
`PEDAGOGY_SPEC_XXX.json`, aux textes internes, aux notions, aux évaluations et
aux ressources proposées à l’apprenant.

Il ne modifie ni Prisma, ni l’API, ni le schéma du seed, ni le backlog. Le format
technique à employer est défini par `PEDAGOGY_AUTHORING_GUIDE.md`. Lorsqu’une
exigence éditoriale ne peut pas être stockée par le moteur, elle reste dans le
sidecar `editorial` de la spécification et n’est pas ajoutée au payload du seed.

Les termes **DOIT**, **NE DOIT PAS**, **DEVRAIT** et **PEUT** expriment une
obligation, une interdiction, une recommandation forte et une option.

## 2. Principes obligatoires

1. Toute affirmation factuelle du contenu interne DOIT être traçable vers au
   moins une source consultée et pertinente.
2. Une source est synthétisée dans une rédaction originale ; elle n’est ni
   copiée ni paraphrasée de trop près.
3. Les faits établis, interprétations, hypothèses, controverses et exemples
   inventés sont distingués.
4. Le degré d’assurance du texte reste proportionné à la qualité et à la
   convergence des preuves.
5. Les limites importantes, conflits de sources et incertitudes ne sont pas
   masqués.
6. Une ressource consultée ne valide jamais une notion.
7. Toute notion obligatoire possède une activité courte de validation et toute
   étape publiée possède une évaluation finale.
8. La pédagogie détermine le nombre d’étapes, modules, leçons et notions. Aucun
   quota structurel ne justifie un découpage artificiel ou un regroupement
   incohérent.
9. Le programme de psychologie reste un contenu d’exemple ; aucune règle ne
   code ce domaine dans le moteur générique.

## 3. `references` et ressources recommandées

Ces deux rôles NE DOIVENT PAS être confondus.

### 3.1 `references` : sources de rédaction

Une référence est une source utilisée pour établir ou vérifier le contenu
interne. Elle assure la traçabilité scientifique et éditoriale. L’apprenant n’a
pas nécessairement à la consulter.

Chaque bloc de connaissance (`definition`, `rich_text`, `example`, `callout`,
`quote` ou `objective` contenant une affirmation) DOIT être relié, dans
`editorial.contentBlockSources`, à au moins une entrée de
`editorial.references`. Le lien précise ce que la source soutient et, lorsque
possible, une page, section, figure ou plage temporelle.

Un `divider`, une consigne originale ou un exemple explicitement inventé PEUT
ne pas avoir de référence. Le sidecar indique alors `notApplicableReason`. Un
exemple factuel, un cas réel, une statistique ou une citation restent sourcés.

### 3.2 Ressources recommandées à l’apprenant

Une ressource recommandée sert l’apprentissage. Dans le modèle éditorial, on
parle de `recommendedResources` ; dans le payload actuellement accepté par le
seed, elles sont stockées sous `lesson.resources`.

Chaque ressource recommandée DOIT préciser, avec les champs disponibles :

- la source exacte (`title`, `author`, `url`, `citation`) ;
- la consigne et l’utilité pédagogique dans `description` ;
- son caractère obligatoire ou facultatif (`isRequired`) ;
- une durée réaliste (`estimatedMinutes`) ;
- pour une vidéo ou un document long, le segment à consulter ;
- la langue, l’accès et l’alternative éventuelle dans le sidecar éditorial.

Une même œuvre PEUT être à la fois référence de rédaction et ressource
recommandée. Elle est alors déclarée séparément dans les deux rôles. Aucun rôle
n’est déduit automatiquement de l’autre.

## 4. Sélection et qualité des sources

### 4.1 Hiérarchie indicative

| Niveau | Sources typiques | Usage |
| --- | --- | --- |
| A | revue systématique, méta-analyse robuste, consensus documenté | État global des connaissances |
| B | manuel universitaire récent, handbook, chapitre de synthèse évalué | Définitions et cadres établis |
| C | article primaire évalué par les pairs, réplication | Résultat précis, mécanisme ou limite |
| D | organisme scientifique, université, agence publique, texte officiel | Définition, règle ou contexte institutionnel |
| E | cours ouvert, conférence ou vulgarisation éditée | Introduction ou illustration |

Le niveau qualifie la nature de la source, pas sa véracité absolue. La
pertinence, la méthode, la date, l’indépendance et les conflits d’intérêts sont
évalués séparément.

Une affirmation centrale, sensible ou controversée DEVRAIT reposer sur une
synthèse de niveau A ou B et, si utile, sur des sources primaires de niveau C.
Une source de niveau E ne suffit pas seule. Plusieurs éditions du même ouvrage
ou plusieurs articles utilisant le même jeu de données ne comptent pas comme
des confirmations indépendantes.

### 4.2 Critères d’acceptation

Une source utilisée DOIT :

- avoir été réellement ouverte et consultée ;
- soutenir directement l’affirmation associée ;
- être identifiable sans ambiguïté ;
- être assez récente pour le sujet, ou justifiée comme source historique ;
- signaler rétractation, correction, prépublication ou absence de revue par les
  pairs lorsque cela s’applique ;
- être remplacée si elle est introuvable, trompeuse ou insuffisante.

Les contenus de santé mentale NE DOIVENT PAS poser de diagnostic individuel,
promettre un résultat thérapeutique ou remplacer un professionnel. Une version
destinée à un usage personnel peut être publiée avant relecture de domaine si
son absence de validation scientifique est explicite. La relecture de domaine
reste obligatoire avant d'afficher une validation scientifique ou d'élargir la
diffusion en présentant le contenu comme professionnellement vérifié.

## 5. Règles de citation

La bibliographie suit une forme APA 7 cohérente. Chaque entrée contient les
métadonnées applicables : auteurs ou organisme, année, titre, publication,
édition, volume, numéro, pages, DOI et URL.

Règles obligatoires :

- ne jamais inventer un auteur, une date, une édition, une pagination, un DOI,
  une citation ou une URL ;
- écrire le DOI sous forme `https://doi.org/...` lorsqu’il existe ;
- privilégier l’URL de l’éditeur, de l’organisme ou du dépôt officiel ;
- fournir un localisateur précis dans le rattachement au bloc, et non seulement
  une référence générale à l’ouvrage ;
- dater la consultation des pages web évolutives ;
- garder les citations directes rares, brèves, entre guillemets et localisées ;
- signaler toute traduction d’une citation ;
- respecter la licence et ne pas reproduire un contenu au-delà de ce qu’elle
  autorise.

## 6. Éditions et versions

Pour un livre, manuel, guide, norme ou classification :

- l’édition utilisée est toujours indiquée ;
- le chapitre et les pages correspondent à cette édition exacte ;
- une numérotation variable entre formats papier, PDF et web est signalée ;
- une nouvelle édition ne remplace pas automatiquement l’ancienne : les
  passages utilisés, différences substantielles et liens sont revérifiés ;
- une édition ancienne reste possible pour une source historique, avec ce rôle
  explicitement indiqué ;
- le numéro de version et la date sont indiqués pour les documents vivants.

Si une édition change le sens d’un contenu, il s’agit d’une modification
substantielle soumise à une nouvelle revue.

### 6.1 Variantes linguistiques

Une variante traduite est un programme éditorial autonome relié à une version
publiée précise de sa source canonique. Elle conserve son propre brouillon, ses
revues et sa publication. Une modification ultérieure de la source ne met jamais
silencieusement la traduction à jour.

Avant publication d'une variante traduite :

- la structure canonique source/cible est identique ou tout écart est bloqué ;
- le glossaire versionné applicable est déclaré ;
- une revue linguistique humaine contrôle sens, registre et terminologie ;
- une revue pédagogique humaine contrôle objectifs, consignes, évaluations,
  distracteurs et rubriques ;
- une revue culturelle et juridique signale les adaptations nécessaires ;
- les liens, ressources, niveaux de langue et titres bibliographiques sont
  contrôlés par la QA bilingue.

Les titres d'œuvres, de sources et de ressources restent ceux de la publication
réellement consultée. Une traduction explicative peut les accompagner, mais ne
remplace jamais le titre bibliographique. Aucune traduction automatique ne peut
être publiée sans ces revues humaines.

Ce workflow éditorial est indépendant d'une éventuelle validation scientifique :
approuver une traduction n'affirme rien sur l'exactitude scientifique du contenu.

## 7. Liens, documents et vidéos

### 7.1 Liens et documents

Avant publication, chaque URL est ouverte dans une session non authentifiée
quand cela est possible. Le réviseur contrôle :

- que la destination est la bonne ressource et non une page voisine ;
- que le protocole est HTTPS, sauf justification ;
- la stabilité et l’autorité du domaine ;
- le paywall, l’inscription, la géorestriction ou l’expiration ;
- la langue, le format, l’accessibilité et la compatibilité mobile ;
- la présence d’une alternative pour toute ressource obligatoire difficile
  d’accès.

Une réponse HTTP réussie ne suffit pas : le titre, l’auteur, l’édition et le
contenu doivent également correspondre. Les paramètres de suivi sont retirés.

### 7.2 Vidéos et contenus audio

Une vidéo ou un audio indique :

- le créateur ou l’institution et le titre exact ;
- la page officielle ou la source la plus pérenne ;
- la durée totale et la plage réellement demandée (`HH:MM:SS-HH:MM:SS`) ;
- la langue et la présence de sous-titres ou d’une transcription ;
- une consigne d’écoute ou de visionnage observable ;
- une alternative textuelle pour une ressource obligatoire inaccessible.

Le réviseur lance la ressource, vérifie le début et la fin du segment, le son,
l’image, les sous-titres, la correspondance avec la consigne et l’absence de
contenu retiré. Une vidéo intégrée depuis une plateforme tierce est aussi testée
sur mobile.

## 8. Rédaction et alignement pédagogique

Chaque leçon :

- annonce des objectifs observables et évaluables ;
- définit les termes avant de les employer comme acquis ;
- progresse du simple vers le complexe ;
- applique la règle « une intention pédagogique = une activité » : une
  ressource reste un support consultable et n'est jamais une étape autonome de
  progression ;
- encode en tâche uniquement une action légère sans production (`reading`,
  `watching`, `listening`, `checklist`) et en exercice toute production attendue
  (`writing`, `practice`, `reflection`, `project`) ;
- ne duplique jamais une lecture sous la forme ressource obligatoire, tâche et
  exercice miroir ; la tâche de lecture référence directement son support ;
- relie chaque notion obligatoire à une explication, un exemple ou une
  application, une tâche et une évaluation ;
- distingue exemple illustratif et preuve ;
- évite sensationnalisme, stéréotypes et généralisations abusives ;
- ne présente pas une corrélation comme une causalité ;
- ne transforme pas un résultat de groupe en conclusion individuelle ;
- adapte le vocabulaire, la charge et les prérequis au public annoncé.

La chaîne suivante doit être vérifiable pour chaque notion obligatoire :

```text
objectif -> contenu sourcé -> ressource -> tâche -> évaluation -> seuil
```

L’évaluation porte sur ce qui a été enseigné, au niveau de difficulté annoncé.
Le feedback n’expose jamais une bonne réponse avant la soumission.

## 9. Statuts et changements

Le sidecar éditorial suit le cycle de disponibilité :

```text
draft -> editorial_review -> approved -> published -> archived
```

- `draft` : incomplet, non publiable ;
- `editorial_review` : structure, clarté, liens et citations contrôlés ;
- `subject_review` : état de travail optionnel pendant une revue scientifique,
  avant ou après publication ;
- `approved` : contrôles éditoriaux, pédagogiques et techniques satisfaits ;
- `published` : contenu disponible, sans implication automatique de validation
  scientifique ;
- `archived` : retiré ou remplacé, motif conservé.

La validation scientifique constitue un axe séparé. Elle renseigne le réviseur,
ses qualifications, la date, le périmètre, la version contrôlée et, si elle
existe, une preuve consultable. Seule une validation active correspondant à la
version courante autorise la mention ou la pastille « Validé scientifiquement ».
Un contenu publié sans cette preuve reste utilisable et affiche un état neutre
« Revue scientifique non réalisée » dans sa vue détaillée.

Toute modification d’une affirmation, d’une ressource obligatoire, d’un
objectif ou d’une évaluation déclenche une revue proportionnée. La classification
MVP, validation technique ou V2 suit `PEDAGOGY_CHANGE_POLICY.md`.

## 10. Contrôle bloquant avant publication

Une spécification ne peut être `approved` ou publiée pour usage personnel que
si :

- 100 % des blocs de connaissance sont reliés à des références vérifiées ;
- 100 % des références citées existent et leurs localisateurs ont été contrôlés ;
- 100 % des notions obligatoires ont une activité de validation ;
- l’étape possède une évaluation finale dans le seed ;
- chaque `resourceKey` correspond à une ressource de la leçon ;
- les objectifs, blocs, tâches et évaluations sont alignés ;
- chaque ressource a une consigne, une durée, un statut d’accès et une
  justification ;
- tous les liens et segments vidéo ont été contrôlés à la date déclarée ;
- les éditions, DOI, citations, licences et alternatives sont exacts ;
- les risques d’accessibilité, de biais et de santé ont été examinés ;
- la structure JSON passe les tests du seed ;
- les responsables, dates de revue et historique sont renseignés.

Le nom d'un réviseur de domaine et `scientificAccuracy: true` ne sont pas des
conditions de publication personnelle. Ils sont en revanche obligatoires pour
afficher une validation scientifique. La publication et la validation
scientifique ne doivent jamais partager le même booléen ni être déduites l'une
de l'autre.

Une case manquante conserve le statut `draft` ou `editorial_review`. Une
exception documentée ne peut pas contourner le sourcing, la validation des
notions, l’évaluation finale d’étape ou la compatibilité du seed.
