# Brief de design LearnX pour Stitch

## Usage

Ce document est un prompt de génération de design. Il peut être transmis tel
quel à Stitch. L'objectif est d'obtenir une alternative produit complète, et
non une landing page ou une simple variation colorimétrique de l'interface
actuelle.

---

## Prompt

Agis comme un Lead Product Designer spécialisé dans les applications SaaS, les
produits éducatifs et les expériences mobile-first.

Conçois une alternative complète et cohérente de LearnX. Il s'agit de
l'application produit authentifiée, pas d'une landing page marketing.

L'objectif est de rendre LearnX beaucoup plus lean, calme, sobre, éditoriale et
centrée sur les contenus. La structure pédagogique reste rigoureuse, mais cette
complexité ne doit jamais produire une interface lourde.

### 1. Contexte produit

LearnX est une PWA mobile-first permettant à un utilisateur de suivre plusieurs
parcours d'apprentissage autonomes.

Le produit n'est lié à aucune discipline particulière. Il doit pouvoir
accueillir de la psychologie, de la pharmacie, de la cybersécurité, de la
préparation professionnelle ou tout autre domaine.

Exemples de programmes actuellement disponibles :

1. **Fondamentaux de la psychologie**
   - Parcours autonome pour comprendre les bases scientifiques de la
     psychologie.
   - Durée indicative : 120 jours.
   - Structure longue : 13 étapes, plusieurs modules et environ 70 leçons.
2. **Officine Express**
   - Parcours court de reconnaissance de médicaments rencontrés en officine.
   - Structure : une étape, plusieurs modules, leçons de 5 à 8 minutes.
3. **Platform APM — Entretien TryHackMe**
   - Parcours intensif de préparation à un entretien Associate Product Manager
     Platform.
   - Structure : deux étapes, plusieurs modules, leçons de 25 à 45 minutes.

La plateforme est multi-utilisateur. Les programmes publiés peuvent être
partagés entre utilisateurs, tandis que les notes, progressions, reprises,
évaluations, tentatives et révisions restent personnelles.

L'application est actuellement en français, avec une fondation bilingue
français/anglais en cours de préparation. Les écrans doivent donc rester
robustes avec des libellés anglais potentiellement plus longs.

### 2. Principes métier incontournables

La hiérarchie pédagogique est toujours :

```text
Programme
→ Étape
→ Module
→ Leçon
→ Activités ordonnées
```

Ne jamais introduire d'année universitaire ou de semestre.

La leçon est le contexte principal de l'expérience d'apprentissage. Une leçon
peut contenir une séquence explicitement ordonnée de :

- contenu pédagogique ;
- ressource à lire ;
- vidéo à regarder ;
- podcast à écouter ;
- ressource interactive à explorer ;
- tâche légère ;
- mini-évaluation d'une notion ;
- exercice avec production ;
- quiz de consolidation ;
- fin de leçon.

Cette séquence peut alterner librement théorie et pratique. Ne pas regrouper
artificiellement tous les contenus, puis toutes les évaluations.

Le serveur est l'autorité pour :

- la progression ;
- la réussite ;
- la maîtrise d'une notion ;
- les prérequis ;
- le verrouillage ;
- la disponibilité d'une activité ;
- la prochaine activité recommandée.

Une ressource consultée ne prouve jamais la maîtrise d'une notion.

Une ressource obligatoire peut empêcher de terminer une leçon tant que sa
consultation n'a pas été déclarée, mais elle ne doit pas gonfler
artificiellement le pourcentage de progression.

Une seule action principale doit dominer chaque écran.

### 3. Utilisateurs et rôles

#### Apprenant

- explore les programmes publics ;
- s'inscrit à un programme ;
- suit sa progression personnelle ;
- reprend exactement sa dernière activité ;
- effectue les évaluations ;
- consulte ses révisions ;
- crée des notes personnelles ou contextuelles ;
- peut quitter un programme sans perdre ses données.

#### Créateur

- possède actuellement les mêmes fonctions d'apprentissage ;
- le rôle peut être attribué par l'administration ;
- ne possède pas encore de portail de création ou de publication.

#### Administrateur

- examine les demandes d'accès ;
- accepte ou refuse une demande ;
- attribue un rôle ;
- suspend ou réactive un compte ;
- gère les programmes dont il est propriétaire ;
- prévisualise et confirme les plans de publication ;
- édite les métadonnées des modules et leçons.

Ne pas concevoir de portail Créateur complet.

### 4. Architecture de navigation

Navigation principale authentifiée :

1. Accueil
2. Parcours
3. Réviser
4. Notes
5. Profil

#### Mobile

- navigation fixe en bas ;
- cinq destinations avec icônes simples et libellés ;
- respect des safe areas iOS ;
- le contenu ne doit jamais être masqué par la navigation.

#### Desktop

- transformer cette navigation en rail latéral compact ;
- conserver exactement les mêmes destinations ;
- éviter une sidebar massive ;
- utiliser une largeur stable et discrète.

#### En-tête global

- marque LearnX sobre ;
- bouton Retour seulement dans les vues profondes ;
- aucun hero décoratif ;
- aucun slogan envahissant ;
- les alertes critiques hors ligne ou mise à jour peuvent apparaître
  globalement.

L'installation de la PWA ne doit jamais interrompre un parcours. L'action
« Installer l'application » appartient au Profil.

### 5. Écrans et fonctionnalités à concevoir

#### A. Connexion et accès

Créer une famille cohérente d'écrans très simples :

- Connexion avec e-mail et mot de passe.
- Action secondaire « Demander un accès ».
- Demande d'accès sans mot de passe.
- Confirmation que la demande a été enregistrée.
- Vérification de l'adresse e-mail.
- État indiquant que la demande attend une approbation.
- Activation du compte depuis une invitation.
- Choix du nom affiché, du mot de passe et confirmation.
- États lien expiré, invalide, hors ligne et erreur.

Parcours d'accès :

```text
Demande d'accès
→ vérification de l'e-mail
→ examen par un administrateur
→ invitation
→ création du mot de passe
→ compte actif
→ connexion
→ Accueil
```

L'interface publique ne doit jamais révéler si une adresse possède déjà un
compte.

#### B. Accueil

L'Accueil est l'écran d'orientation principal.

Afficher :

- titre « Aujourd'hui » ;
- programme actif ;
- prochaine activité exacte recommandée ;
- type d'activité ;
- contexte discret : étape, module et leçon ;
- durée indicative ;
- CTA principal « Continuer » ;
- progression globale du programme ;
- nombre de révisions dues ;
- dernière activité significative.

Exemple :

```text
Aujourd'hui

CONTENU · 8 MIN
Les grands domaines de la psychologie

Fondamentaux de la psychologie
Étape 1 · Découvrir la discipline
Qu'est-ce que la psychologie ?

[Continuer]

Progression du programme : 18 %
3 révisions dues
Dernière activité : Définir la psychologie, aujourd'hui à 09:42
```

Le CTA doit reprendre l'activité exacte, pas seulement ouvrir le programme ou
la leçon.

État vide : « Aucun programme actif ». Action : « Explorer les programmes ».

#### C. Parcours

La destination « Parcours » contient deux onglets :

- Mes programmes ;
- Explorer.

Fonctionnalités :

- recherche par titre ou description ;
- filtre des programmes suivis : en cours ou quittés ;
- catalogue paginé ;
- inscription à un programme ;
- désinscription avec confirmation ;
- conservation annoncée des notes, progressions et tentatives ;
- distinction entre programme suivi, programme disponible et programme
  possédé ;
- états privé, public, brouillon ou version publiée lorsque pertinent.

Mes programmes doit privilégier une liste éditoriale sobre plutôt qu'une grille
de grandes cartes identiques.

Chaque programme suivi affiche :

- titre ;
- description courte ;
- durée indicative ;
- progression ;
- statut ;
- prochaine action ;
- CTA « Commencer » ou « Continuer ».

Explorer affiche :

- titre ;
- description ;
- durée ;
- nombre d'étapes ;
- version publiée ;
- statut « Disponible » ou « Inscrit » ;
- action « S'inscrire » ou « Ouvrir ».

#### D. Détail d'un programme

C'est un écran central à particulièrement soigner.

Afficher :

- label discret « Programme » ;
- titre ;
- description concise ;
- une seule barre de progression globale ;
- liste ordonnée des étapes sous forme d'accordéon plat.

Une étape repliée affiche uniquement :

- numéro intégré au titre, par exemple « 1. Découvrir la discipline » ;
- durée indicative ;
- statut textuel avec icône ;
- chevron.

Une seule étape peut être ouverte à la fois, mais l'utilisateur peut aussi
toutes les refermer.

Une étape ouverte :

- reste la seule surface délimitée ;
- ne contient aucune carte imbriquée ;
- ne répète pas sa longue description ;
- affiche les modules comme de simples intertitres lorsqu'il y en a plusieurs ;
- masque visuellement l'intertitre Module lorsqu'il n'y en a qu'un ;
- affiche chaque leçon sous forme de ligne séparée par un filet.

Ligne de leçon sur mobile :

- première ligne : titre de la leçon sur toute la largeur disponible ;
- deuxième ligne : durée et statut ;
- colonne stable à droite : chevron ou verrou.

États de leçon :

- Disponible ;
- En cours ;
- Terminée ;
- À revoir ;
- Verrouillée ;
- Brouillon en prévisualisation.

Une ligne disponible, en cours ou terminée ouvre directement la leçon. Une
ligne verrouillée ne doit pas imiter un lien actif.

Ne jamais afficher ici :

- une barre de progression par étape ;
- une barre par module ;
- une barre par leçon ;
- un pourcentage redondant ;
- le nombre d'activités ;
- de longues descriptions ;
- un bouton pleine largeur par leçon ;
- une timeline avec axe, points ou connecteurs.

Exemple de contenu :

```text
Fondamentaux de la psychologie
Progression : 18 %

1. Découvrir la discipline
14 jours · En cours

Qu'est-ce que la psychologie ?

Définir la psychologie
12 min · Terminée

Les grands domaines
15 min · En cours

Les métiers et l'éthique
18 min · Disponible

2. Comprendre les grands courants
21 jours · Verrouillée

3. Raisonner scientifiquement
35 jours · Verrouillée
```

#### E. Détail d'une étape

Cette vue donne davantage de contexte que l'accordéon Programme.

Afficher :

- titre et objectif ;
- durée indicative ;
- éventuellement date de début et date cible ;
- progression réelle et progression attendue ;
- écart compréhensible : « 8 points d'avance », « Dans les temps », « 13 points
  de retard » ou « Échéance dépassée de 4 jours » ;
- modules ;
- prérequis ;
- évaluation finale.

Ne jamais transmettre l'avance ou le retard uniquement par la couleur.

Afficher une synthèse textuelle des exigences :

- notions obligatoires validées ;
- tâches obligatoires terminées ;
- exercices obligatoires soumis ;
- évaluation finale validée ;
- liste des prérequis manquants.

#### F. Détail d'un module

Afficher :

- titre ;
- description ;
- progression/statut ;
- liste compacte des leçons ;
- prochaine action.

Prévoir une zone secondaire « Recommencer ce module ».

Ce flow est destructif pour la reprise courante, mais conserve l'historique.
Avant confirmation, afficher clairement ce qui sera remis à zéro et ce qui sera
conservé.

Sera remis à zéro :

- leçons ;
- tâches ;
- ressources ;
- notions ;
- quiz réussis ;
- exercices de la reprise courante.

Sera conservé :

- notes ;
- tentatives de quiz ;
- tentatives de mini-évaluation ;
- soumissions d'exercice.

#### G. Leçon et activité courante

La leçon est une expérience de lecture focalisée.

En-tête de contexte compact :

- programme ;
- étape ;
- module ;
- titre de la leçon ;
- progression de la leçon ;
- position dans la séquence.

Puis afficher uniquement l'activité courante.

Ordre visuel :

1. type d'activité ;
2. titre ;
3. durée ;
4. contenu intégral ;
5. ressources guidées et sources liées ;
6. action secondaire « Prendre une note » ;
7. action secondaire « Sommaire de la leçon » ;
8. navigation finale « Précédent » et « Continuer ».

La navigation pédagogique reste dans le flux du document. Elle ne doit être ni
sticky ni fixed.

Un seul bouton d'avancement :

- « Continuer » pendant la séquence ;
- « Terminer la leçon » à la dernière activité ;
- « Leçon suivante » après terminaison réussie ;
- « Retour au module » s'il n'existe aucune leçon suivante.

Le bouton « Précédent » conserve une place stable à gauche.

Le sommaire de la leçon s'ouvre dans un drawer sur mobile. Il affiche numéro,
verbe ou type, titre, statut, activité actuelle et toutes les activités
accessibles.

#### H. Présentation des contenus

Priorité absolue à la lisibilité.

Largeur de lecture confortable :

- environ 65 à 72 caractères ;
- centrée ou légèrement décalée selon le contexte ;
- ne pas étirer un texte pédagogique sur toute la largeur desktop.

Prévoir les types de blocs suivants :

- texte riche ;
- définition ;
- objectif ;
- exemple ;
- point à retenir ;
- citation ;
- contenu intégré ;
- séparateur.

Ne pas transformer automatiquement chaque bloc en carte. Utiliser titres,
rythme vertical, indentation, filets et un léger changement de fond seulement
quand la sémantique le justifie.

Les sources bibliographiques apparaissent après le passage qu'elles soutiennent,
dans un panneau secondaire repliable « Sources de ce contenu ». Elles ne
possèdent aucune progression.

#### I. Ressources guidées

Une ressource doit apparaître à son point exact dans la séquence.

Adapter le verbe au média : Lire, Regarder, Écouter ou Explorer.

Ressource obligatoire :

- badge discret « Obligatoire » ;
- objectif ;
- périmètre précis : pages, section ou timestamps ;
- courte consigne ;
- durée ;
- CTA adapté ;
- statut « À consulter » ou « Consultée » ;
- action « Marquer comme consultée ».

Ressource facultative :

- label « Pour aller plus loin » ;
- rendu plus secondaire ;
- aucun blocage de progression.

Ressource indisponible :

- état explicite ;
- alternative accessible lorsqu'elle existe ;
- aucun faux succès.

#### J. Mini-évaluation et quiz

Conserver l'expérience actuelle :

- une question à la fois ;
- barre de position « Question 2 sur 5 » ;
- choix unique, choix multiple, vrai/faux ou réponse courte ;
- aucune correction révélatrice pendant la tentative ;
- soumission de l'évaluation complète ;
- score seulement à la fin ;
- seuil de réussite ;
- statut « Réussi » ou « À reprendre » ;
- correction détaillée question par question ;
- réponse attendue si erreur ;
- explication ;
- historique des tentatives ;
- action « Recommencer ».

Une mini-évaluation cible une notion précise. Un quiz consolide plusieurs acquis
d'une leçon.

En cas d'échec, prévoir une remédiation vers un contenu, une ressource ou un
exercice précis, puis une nouvelle tentative.

#### K. Exercices

Un exercice peut demander une production longue en Markdown.

États : pas commencé, brouillon et soumis.

Actions : Commencer l'exercice, Enregistrer le brouillon et Soumettre
l'exercice.

Une soumission terminée affiche la date et le contenu envoyé.

#### L. Évaluation finale d'étape

Afficher :

- titre ;
- type : étude de cas, projet, exercice pratique, devoir écrit, simulation,
  oral ou examen cumulatif ;
- objectif ;
- consignes organisées en sections ;
- seuil de réussite ;
- grille d'évaluation ;
- poids éventuel des critères ;
- zone de réponse ;
- lien de pièce jointe ;
- actions brouillon et soumission.

États : Brouillon, Soumise, À réviser et Validée.

Afficher le retour du correcteur lorsqu'une révision est demandée.

#### M. Révisions

La vue « Réviser » affiche les notions à renforcer.

Chaque entrée affiche :

- notion ou leçon concernée ;
- programme et leçon ;
- date prévue ;
- statut « À réviser » ou « En retard » ;
- ressources suggérées ;
- action principale « Refaire l'évaluation » ;
- action secondaire « Marquer comme terminée ».

État vide calme : « Aucune révision en attente ».

#### N. Notes

Deux types de notes : note personnelle et note liée à une leçon, éventuellement
à l'activité courante.

Vue liste :

- recherche ;
- action « Nouvelle note » ;
- titre ;
- extrait ;
- contexte ;
- date de dernière modification ;
- statut de liaison.

Éditeur :

- titre ;
- contenu Markdown ;
- onglets Écrire/Aperçu ;
- autosauvegarde ;
- états « Enregistrement », « Enregistrée », « Échec » ;
- retour vers la leçon liée ;
- suppression avec confirmation.

Depuis une activité, « Prendre une note » ouvre un drawer sans perdre la
position de lecture. Après sauvegarde, proposer « Voir la note ».

#### O. Profil

Afficher :

- nom ;
- e-mail ;
- rôle si utile ;
- préférence de langue français/anglais ;
- section Application ;
- installer la PWA ;
- aide iOS ;
- état de disponibilité hors ligne ;
- accès à l'administration pour un administrateur ;
- déconnexion.

L'installation doit rester secondaire.

#### P. Administration

Cette zone doit rester fonctionnelle, sobre et cohérente avec le produit, mais
elle n'est pas le cœur émotionnel du design.

Accueil administration :

- demandes d'accès ;
- comptes utilisateurs ;
- programmes.

Demandes d'accès :

- recherche et filtre par statut ;
- pagination ;
- e-mail vérifié, date et statut ;
- accepter ou refuser ;
- choix du rôle ;
- motif interne ;
- prévisualisation de la décision ;
- confirmation ;
- renvoi d'invitation.

Comptes :

- recherche ;
- filtre actif/suspendu ;
- nom, e-mail, rôle et statut ;
- attribuer ou retirer le rôle Créateur ;
- suspendre ou réactiver ;
- confirmation ;
- annonce que les données d'apprentissage restent conservées.

Gestion des programmes :

- navigation progressive Programme → Étape → Module → Leçon ;
- fil d'Ariane ;
- détails du niveau courant dans un drawer ;
- édition de titre, résumé et ordre ;
- visibilité privée ou publique ;
- statut brouillon, actif ou archivé ;
- prévisualisation d'un plan de publication ;
- avertissements et prérequis manquants ;
- confirmation explicite avant application.

### 6. Direction visuelle

Direction générale :

- sombre ;
- sobre ;
- premium sans effet luxueux ;
- éditoriale ;
- calme ;
- structurée ;
- très lisible ;
- dense en information mais jamais tassée ;
- contemporaine sans suivre une mode éphémère.

Le contenu doit être plus visible que le chrome de l'application.

Préserver un thème sombre. Ne pas créer de thème clair dans cette proposition.

Palette indicative :

- fond principal : noir bleuté très profond, proche de `#050810` ;
- surface principale : `#0B1220` ;
- surface secondaire rare : `#111A2B` ;
- texte principal : `#F7F9FC` ;
- texte secondaire : `#A8B3C3` ;
- filets : `#253247` ;
- accent cyan : proche de `#22D3EE`.

Utiliser le cyan avec parcimonie, uniquement pour :

- action principale ;
- focus ;
- sélection active ;
- lien important ;
- état nécessitant réellement l'accent.

Ne pas utiliser du cyan sur tous les labels, eyebrows, bordures et badges.

Typographie :

- Inter, Geist ou grotesque neutre équivalente ;
- hiérarchie nette ;
- titres expressifs mais compacts ;
- corps 16 à 18 px pour les contenus pédagogiques ;
- hauteur de ligne généreuse ;
- métadonnées lisibles, jamais minuscules ;
- éviter les textes entièrement en capitales sauf micro-label très ponctuel.

Surfaces :

- limiter fortement le nombre de cartes ;
- une surface principale par niveau de contexte ;
- pas de cartes imbriquées ;
- rayons mesurés, environ 10 à 14 px ;
- ombres rares et très légères ;
- privilégier espace, typographie et séparateurs ;
- ne pas entourer chaque information d'une bordure.

Composants :

- bouton principal rempli ;
- bouton secondaire outlined ou surface discrète ;
- bouton ghost uniquement pour une action vraiment tertiaire ;
- lien textuel identifiable comme lien ;
- bouton icône avec tooltip ou nom accessible ;
- badges réservés aux vrais statuts ;
- ne pas utiliser des pills pour toutes les métadonnées ;
- champs sobres avec label permanent ;
- drawers clairs, sans multiplication de panneaux.

Icônes :

- famille unique d'icônes linéaires ;
- traits simples ;
- pas d'emojis ;
- les icônes accompagnent les statuts mais ne remplacent jamais leur libellé.

Éviter :

- gradients décoratifs ;
- glassmorphism ;
- néons ;
- grandes illustrations ;
- mascotte ;
- confettis ;
- gamification ;
- streaks ;
- points ou niveaux ;
- cartes flottantes uniformes ;
- dashboards remplis de métriques ;
- timeline verticale décorative ;
- animations inutiles ;
- esthétique « application crypto » ;
- esthétique « plateforme scolaire enfantine ».

### 7. Responsive et accessibilité

Concevoir d'abord à 390 × 844 px, puis adapter à 320 px, tablette et desktop
1440 px.

Exigences :

- aucune troncature fonctionnelle ;
- aucun scroll horizontal global ;
- titres longs non comprimés par les badges ;
- cibles tactiles minimales 44 × 44 px ;
- focus clavier très visible ;
- ordre DOM logique ;
- navigation entièrement utilisable au clavier ;
- états jamais transmis uniquement par couleur ;
- contraste au minimum WCAG AA ;
- interface utilisable avec texte ou zoom à 200 % ;
- respect de `prefers-reduced-motion` ;
- drawers avec focus piégé, fermeture Échap et restauration du focus ;
- contenu non masqué par la navigation fixe ;
- safe areas iOS respectées.

### 8. États transversaux

Créer des variantes cohérentes pour :

- chargement avec skeleton ;
- erreur avec action Réessayer ;
- état vide ;
- hors ligne ;
- mise à jour disponible ;
- action en cours ;
- succès ;
- désactivé ;
- verrouillé avec motif ;
- brouillon en lecture seule ;
- contenu retiré ;
- programme privé ;
- programme quitté ;
- activité disponible ;
- activité en cours ;
- activité terminée ;
- activité à revoir.

Ne jamais afficher un spinner infini.

### 9. Direction future à anticiper

Le design doit pouvoir évoluer vers :

- une interface complète en français et en anglais ;
- une préférence de langue liée au compte ;
- des variantes linguistiques des programmes ;
- des programmes partagés et versionnés ;
- un catalogue plus fourni ;
- plusieurs programmes simultanés ;
- des parcours courts et des parcours très longs ;
- un desktop avec contexte latéral optionnel pendant la lecture ;
- une meilleure harmonisation des primitives entre produit et administration.

Cependant, ne pas ajouter aujourd'hui :

- paiement ;
- marketplace commerciale ;
- organisations ;
- réseau social ;
- messagerie ;
- commentaires collaboratifs ;
- IA générative ;
- assistant conversationnel ;
- quotas IA ;
- portail Créateur ;
- validation scientifique visible comme workflow produit ;
- gamification ;
- thème clair.

### 10. Écrans à produire en priorité

Créer un système cohérent et des maquettes haute fidélité pour :

1. Accueil — mobile et desktop.
2. Mes programmes — mobile et desktop.
3. Explorer les programmes.
4. Détail du programme avec accordéon d'étapes.
5. Leçon — activité de contenu longue.
6. Leçon — ressource guidée obligatoire.
7. Sommaire mobile de la leçon.
8. Mini-évaluation — question.
9. Mini-évaluation — résultat et correction.
10. Révisions.
11. Liste de notes.
12. Note contextuelle dans un drawer.
13. Profil et installation PWA.
14. Connexion et demande d'accès.
15. Administration — demandes d'accès.

Si le nombre d'écrans est limité, commencer par :

- Accueil ;
- Programme ;
- Leçon ;
- Évaluation ;
- Notes.

### 11. Livrable attendu

Produire une alternative complète d'application, pas une simple variation
colorimétrique.

Fournir :

- une direction visuelle unifiée ;
- un shell mobile et desktop ;
- les écrans prioritaires ;
- les composants partagés ;
- les variantes d'état ;
- une hiérarchie d'actions cohérente ;
- des exemples avec du vrai contenu LearnX ;
- des interactions compréhensibles entre les écrans.

Le résultat doit donner l'impression d'un outil d'apprentissage personnel
sérieux, calme et précis : moins de chrome, moins de cartes, moins de couleurs,
et davantage de contenu, d'espace et de clarté.

Le point le plus important à contrôler est la page Leçon : si elle ressemble
encore à une succession de cartes dans des cartes, la direction lean n'est pas
réellement atteinte.
