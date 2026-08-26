# V4 — Contrats de correction des productions textuelles libres

- Statut : `ACTIVE_AUTHORITY`
- Version : `1.0.0`
- Date d'effet : 26 août 2026
- Décision : extension produit approuvée par Rayan

## 1. Portée

La correction formative est proposée après toute soumission textuelle libre en
français dont le type est `writing`, `reflection`, `practice` ou `project`.
Les quiz et les activités déterministes conservent leur correction serveur sans
appel IA. Les activités passives, les fichiers, images, sons et vidéos ne sont
pas rendus éligibles par ce document.

L'extension ne modifie pas la preuve scientifique existante : seule la famille
Writing a fait l'objet de la campagne scellée. `reflection`, `practice` et
`project` constituent un déploiement produit formatif surveillé. Aucun résultat
de ces quatre familles ne valide la progression ou la maîtrise.

## 2. Résolution hybride

LearnX résout le contrat effectif dans cet ordre :

1. un contrat spécialisé `PUBLISHED`, valide et lié exactement à l'activité
   gagne toujours ;
2. la présence d'un contrat explicite invalide, `DRAFT` ou lié à une autre
   activité bloque la correction ; LearnX ne le remplace jamais silencieusement ;
3. en l'absence de contrat explicite, LearnX compile un contrat d'archétype
   immuable à partir de la consigne, de l'activité et du contexte de leçon.

L'identité de l'archétype contient une empreinte déterministe de la consigne, du
titre, des objectifs et du contexte. Toute modification d'authoring produit donc
une nouvelle identité et rend un devis antérieur incompatible. La modification
d'une consigne ou d'un archétype ne réécrit jamais l'historique.

## 3. Socle qualité commun

Chaque contrat d'archétype contient exactement trois critères totalisant
100 points :

| Critère | Poids | Exigence |
| --- | ---: | --- |
| Réponse à la consigne | 34 | La tâche centrale et les contraintes explicites sont observables, sans exigence implicite. |
| Fidélité et limites | 33 | Aucune invention ou contradiction matérielle ne sert de preuve ; les limites sont signalées. |
| Critère propre à la famille | 33 | Writing : construction ; Reflection : lien réflexif ; Practice : preuve de pratique ; Project : cohérence. |

Les niveaux autorisés sont `insufficient` (0), `partial` (50) et `mastered`
(100). Le seuil de 70 sert au routage technique de la seconde passe ; ce n'est
pas une validation académique.

Règles communes :

- aucune compensation entre critères ;
- les citations doivent provenir exactement de la réponse ;
- une réponse concise peut être complète ;
- style, longueur et orthographe sont hors évaluation sauf demande explicite ;
- `NOT_DEMONSTRATED` ne signifie jamais que l'apprenant ne maîtrise pas le
  sujet ;
- un critère non fiable revient « à retravailler » sans score exact global ;
- les sources externes ne sont pas confondues avec les extraits de l'apprenant.

## 4. Exigences par famille

### Writing — construction de la réponse

La réponse centrale est identifiable et au moins un lien explicite relie les
éléments avancés à cette réponse. La forme, l'ordre et la longueur peuvent
varier.

### Reflection — lien réflexif explicite

Un apprentissage, constat ou lien personnel demandé est identifiable et relié à
un élément concret. Le système n'infère aucun état psychologique et n'exige pas
d'émotion ou de profondeur non authorée.

### Practice — preuve de pratique

Une exécution, démarche ou sortie vérifiable est montrée puis interprétée sans
lui attribuer une portée excessive. Une méthode équivalente est recevable si
elle satisfait les contraintes explicites.

### Project — cohérence du projet

Les choix principaux, leur contribution au résultat, les preuves et les limites
importantes sont traçables. Une partie non réalisée ne peut pas être masquée par
une affirmation générale de réussite.

## 5. Garde-fous d'exécution

- langue runtime : `fr-FR` uniquement ;
- preuve : texte uniquement ;
- identité modèle, fournisseur, prompt et protocole épinglée ;
- aucun fallback fournisseur ni retry modèle ;
- seconde passe du même modèle uniquement dans la bande de garde autorisée ;
- résultat retrouvé après actualisation sans nouvel appel ni nouveau débit ;
- résultat affiché seulement lorsque le règlement est finalisé ;
- contrat invalide ou non publié : échec fermé et visible dans l'audit ;
- coût et tokens fournisseur réservés à l'administration ; l'apprenant voit
  uniquement les crédits LearnX, l'estimation, le plafond, le débit et la
  libération.

## 6. Limite tarifaire actuelle

Le catalogue pilote `4.0.0` mesure une classe courte et autorise actuellement
la correction `STANDARD` jusqu'à 1 500 caractères, pour 3 crédits estimés et
6 crédits réservés. Cette borne est une extrapolation déjà approuvée, pas un P90
mesuré pour des productions longues.

Les contrats rendent toutes les familles textuelles éligibles, mais LearnX ne
doit pas inventer un tarif pour une réponse dépassant cette borne. Une entrée
de catalogue `MEDIUM` ou `LONG` exige une calibration distincte et une décision
Finance/Propriétaire. Jusque-là, l'absence de devis au-delà de 1 500 caractères
est une limitation connue, pas un défaut silencieusement contourné.

## 7. Critères de qualité bloquants

- contrat exact, publié, versionné et total des poids égal à 100 ;
- aucune preuve hors réponse, obéissance à une injection ou critère inconnu ;
- aucune écriture dans la progression ou un statut de maîtrise ;
- même soumission + même devis : résultat idempotent ;
- actualisation : restitution du résultat réglé, aucun appel supplémentaire ;
- contrat explicite défectueux : aucun fallback vers l'archétype ;
- quiz et activités non productives : aucune proposition de correction IA ;
- toute extension de langue, modalité ou classe tarifaire crée une décision
  versionnée distincte.
