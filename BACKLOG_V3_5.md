# Backlog V3.5 — Fondations visuelles et présence publique LearnX

## Statut et autorité

- Version : 0.9.0
- Statut : **GO technique obtenu — clôture officielle en attente de validation humaine finale**
- Date : 20 août 2026
- Baseline : V3 officiellement clôturée, stable et documentée
- Suite : V4 corrections IA, crédits, paiement et infrastructure

Les tickets V3.5-001 à V3.5-009 ont atteint leur GO technique sur le candidat
audité. Ce statut ne vaut pas clôture officielle : installation/réouverture PWA
réelle, VoiceOver, zoom 200 % et smoke authentifié doivent encore être consignés
sur la version effectivement promue, conformément à
`docs/V3_5_RELEASE_REPORT.md` et `docs/V3_5_QA_MATRIX.md`.

Ce backlog constitue une release intermédiaire autonome. Il permet de faire
évoluer l'image et l'expérience de LearnX avant d'ajouter les surfaces complexes
de V4. Aucun ticket ne doit commencer avant :

1. la clôture officielle de V3 ;
2. un réaudit rapide du code et des écrans effectivement livrés ;
3. la reformulation du ticket actif avec les fichiers concernés ;
4. la validation humaine requise par V3.5-001.

Un ticket correspond idéalement à un commit ou une pull request autonome. V3.5
ne modifie ni les règles pédagogiques, ni la progression, ni les droits d'accès,
ni le schéma de données, sauf nécessité démontrée par la collecte publique de la
landing.

## Cap V3.5

V3.5 livre :

- une direction de marque validée et des tokens sémantiques documentés ;
- des primitives UI cohérentes et une réduction de la cardification ;
- une passe complète sur l'apprentissage mobile ;
- de vrais gabarits desktop de lecture, travail et administration ;
- une landing publique initiale présentant honnêtement le produit disponible ;
- des preuves réelles Programme/Leçon sur la landing et une icône Atlas
  cohérente sur PWA, iOS et favicons ;
- une liste d'attente et une candidature early adopter distinctes ;
- une séparation sûre entre site public et application/PWA privée ;
- une matrice de QA visuelle, responsive et accessibilité ;
- une documentation réutilisable du système de design.

V3.5 ne livre pas :

- correction assistée par IA, OpenRouter, crédits LearnX ou paiement ;
- prix, packs ou capacités commerciales non mesurés et non validés ;
- génération de formation, chat ou workflow Créateur ;
- modification de l'ordre pédagogique authoré ou des calculs serveur ;
- refonte métier dissimulée dans un ticket de design ;
- identité fondée sur les clichés d'un copilote IA générique.

## Ligne directrice validée

> L'image à construire est celle d'un produit éditorial sérieux et calme, à
> mi-chemin entre un environnement personnel d'apprentissage et une plateforme
> de formation structurée — pas celle d'un « AI learning copilot » générique.

Cette direction concerne la landing, l'apprentissage mobile, l'apprentissage
desktop et l'administration. Ces contextes possèdent des gabarits distincts mais
une marque, des tokens et des principes de hiérarchie communs.

## Invariants d'expérience

1. Préserver les actifs pédagogiques existants : parcours séquentiel, prochaine
   activité, sources, tentatives, états textuels et action principale claire.
2. Le bleu ardoise Atlas est la couleur de marque validée ; le cyan lumineux,
   Inter et l'ancienne combinaison de cartes sombres arrondies/bordées ne sont
   pas à préserver.
3. Une carte sert uniquement un bloc autonome d'action, d'état ou de navigation.
   Les cartes imbriquées ne dépassent jamais un niveau.
4. Typographie, espace, alignement et séparateurs précèdent les surfaces,
   badges, ombres et couleurs.
5. Une zone de décision ne présente qu'une action remplie dominante.
6. Les états sont exprimés par texte et forme, jamais par couleur seule.
7. La largeur de lecture vise 62 à 68 caractères et ne dépasse pas 72.
8. Le corps de leçon utilise 16 à 18 px et un interligne de 1,65 à 1,75.
9. Le texte courant atteint au moins 4,5:1 et les limites de contrôles 3:1.
10. Toute cible tactile mesure au moins 44 × 44 px.
11. La validation couvre 320, 390, 768/1024, 1440 et 1920 px, zoom 200 % et
    reduced motion.
12. Les revues avant/après utilisent des données réalistes, jamais seulement
    des états vides ou du faux contenu.
13. Sont exclus : fausses preuves ou témoignages, compteurs invérifiables,
    gradient IA, robot, halo néon, glassmorphism systématique et gamification
    artificielle.

## Direction artistique validée — LearnX Atlas sans vert

Références canoniques, auxquelles les tickets font référence par identifiant :

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

A1 couvre Programme, Exercice, Correction IA, Réviser, Profil et Administration
sur mobile/desktop. A2 fixe le contrat. A3 couvre Landing, Leçon desktop, Notes
mobile, Crédits/paiement et annonce Création. A4 couvre Contacts sur desktop,
390 px, vide, chargement et erreur. A5 fixe la landing fondée sur des preuves
produit réelles. A6 fixe l'usage chromatique de l'icône sans modifier sa
géométrie. Ces références fixent direction et contrats, pas une reproduction
aveugle de chaque écran.

Principes validés :

1. bleu ardoise mûri comme couleur de marque unique et pour les états positifs
   et la progression ;
2. base applicative sombre en encre, navy et ardoise ;
3. papier chaud pour la landing et les contextes éditoriaux clairs ;
4. laiton comme accent éditorial rare, jamais concurrent du bleu ;
5. Manrope pour l'interface et Source Serif 4 pour les rôles éditoriaux validés ;
6. signature cartographique discrète — tracés, points, coordonnées — directement
   reliée à `un parcours, pas une bibliothèque` ;
7. surfaces mates et calmes, peu de cartes, ombres limitées et arrondis contenus ;
8. correction IA fondée sur des critères, jamais IA comme identité principale ;
9. aucun vert dans la direction retenue.

Palette de travail validée comme baseline de tokenisation :

- encre : `#121C24` ;
- navy : `#1A2933` ;
- surface : `#243641` ;
- surface haute : `#304650` ;
- bleu : `#557F9A` ;
- bleu clair : `#89ACBE` ;
- bleu doux : `#D9E4E8` ;
- laiton : `#BEA169` ;
- papier : `#F1EEE6` ;
- papier profond : `#E2DDD3` ;
- ivoire : `#F8F5EE` ;
- texte secondaire : `#B8C4C9` ;
- danger : `#C4766C`.

Ces valeurs sont celles du contrat A2. Elles ne peuvent être ajustées qu'après
mesure de contraste, avec raison documentée et validation humaine. `danger`
reste un token sémantique fonctionnel et non une couleur de marque ; le laiton
peut signaler une attention secondaire rare, toujours avec texte et forme, mais
ne devient ni CTA ni code d'état principal. Focus, désactivation, erreur et
texte secondaire utilisent les tokens du contrat sans dépendre de la couleur
seule.

Ces six assets annulent et remplacent les explorations antérieures :

- comparateur initial, Minéral calme, Atelier éditorial, Studio pédagogique et
  Atlas avec vert ne constituent plus des options à arbitrer ;
- elles ne doivent fournir aucun token ou motif absent de la référence validée.

## Ordre de livraison

```text
Clôture V3
    ↓
V3.5-001 — fondations et tokens Atlas
    ↓
V3.5-002 — primitives UI
    ↓
V3.5-003 — shells et navigation
    ├──► V3.5-004 — apprentissage mobile
    ├──► V3.5-005 — desktop et administration
    └──► V3.5-006 — landing publique et collecte
                    ↓
        V3.5-006A — liens publics et renouvellement PWA
                    ↓
        V3.5-007 — admin contacts landing
V3.5-001 ─────────► V3.5-006B — icône Atlas et exports

V3.5-004 + V3.5-005 + V3.5-006 + V3.5-006A + V3.5-006B + V3.5-007
                    ↓
V3.5-008 — QA et documentation
                    ↓
V3.5-009 — audit, déploiement et clôture
                    ↓
V4
```

## Jalons visibles

### Jalon A — Fondations Atlas contractualisées

- La direction est déjà validée ; tokens, rôles typographiques, espaces,
  rayons, états et contrastes sont contractualisés.
- Aucun changement transversal n'est encore déployé.

### Jalon B — Nouveau langage d'interface

- Les primitives partagées sont disponibles et testables sur un échantillon
  représentatif.
- Shells et navigation responsive respectent les règles Atlas.

### Jalon C — Expérience applicative renouvelée

- Les parcours mobile et les gabarits desktop/admin utilisent le système validé.
- Les règles pédagogiques et le nombre d'actions ne régressent pas.

### Jalon D — Présence publique

- La landing, la liste d'attente et la candidature early adopter sont publiables.
- L'administration affiche les deux indicateurs et la liste de contacts sans
  CRM ni total trompeur.
- La landing montre des preuves Programme/Leçon réelles et les manifestes
  utilisent l'icône papier sans modifier sa géométrie.
- L'application installée continue d'ouvrir l'app ou la connexion, jamais la
  landing marketing.

### Jalon E — V3.5 clôturée

- La QA multi-écran et accessible est validée sur données réalistes.
- V4 peut construire ses surfaces IA et financières sur une base stable.

---

## V3.5-001 — Fondations Atlas et tokens visuels

**Priorité : P0. Dépendances : V3 officiellement clôturée. Gate bloquant :
table de tokens sémantiques, contrastes et usages Atlas validée humainement avant
V3.5-002 à V3.5-007.**

**Référence : A2, vue `Fondations`. A1/A3/A4 servent aux preuves d'application.**

### Périmètre

- Auditer la baseline réelle sur landing éventuelle, apprentissage mobile,
  apprentissage desktop et administration par rapport au screen pack validé.
- Formaliser les tokens Atlas à partir de la palette de travail : canevas,
  surfaces, textes, filets, contrôles, marque/action, progression/positif, focus,
  erreur, avertissement, désactivé, overlay, papier et accent éditorial.
- Ne créer aucun token vert. Le bleu ardoise porte marque, action principale,
  progression et états positifs, toujours avec texte ou forme complémentaire.
- Réserver le laiton aux accents éditoriaux rares ; il ne représente ni succès,
  action principale, prix avantageux ni état financier.
- Définir Manrope et Source Serif 4 par rôles, poids, fallbacks, licences,
  chargement, chiffres et accents FR/EN.
- Définir espacements, rayons contenus, bordures mates, élévations limitées,
  icônes et mouvement réduit.
- Définir la grammaire cartographique : tracé, nœud, point actif, coordonnée,
  repère de chapitre et marque. Chaque motif possède une intention, une fréquence
  maximale et un traitement sémantique ou décoratif explicite.
- Cartographier les styles actuels vers les tokens Atlas et documenter migration,
  exceptions temporaires et rollback.

### Hors périmètre

- Revenir à un arbitrage entre pistes ou réintroduire le vert.
- Reproduire le screen pack pixel par pixel sans tenir compte des flows réels.
- Modifier un flow, une règle métier ou une donnée dans le ticket de fondation.
- Utiliser gradient IA, halo néon, glassmorphism systématique, ombres flottantes,
  arrondis excessifs ou gamification artificielle.

### Critères d'acceptation

- Une table versionnée relie chacun des treize tokens de couleur A2 à sa valeur,
  ses usages,
  états, contrastes, équivalent papier/sombre éventuel et règle de rollback.
- La baseline utilise les valeurs validées ou documente tout ajustement WCAG
  avec comparaison avant/après et accord humain.
- Aucun token vert n'existe dans la direction Atlas.
- Le bleu reste l'unique accent de marque et d'action ; le laiton ne le
  concurrence dans aucune zone de décision.
- Les états positifs/progression combinent bleu, texte et forme ; erreurs et
  avertissements restent distincts sans dépendre de la couleur seule.
- Le danger `#C4766C` est réservé aux erreurs/destructions ; le laiton ne sert
  qu'à une attention ou un repère éditorial secondaire et jamais seul.
- Manrope et Source Serif 4 sont testées en FR/EN, sur contenus longs et chiffres.
- Texte courant ≥ 4,5:1, limites de contrôles ≥ 3:1, focus visible et cibles
  ≥ 44 × 44 px.
- Le corps de leçon permet 16–18 px, interligne 1,65–1,75 et 62–68 caractères
  sans dépasser 72.
- La signature cartographique soutient orientation ou progression ; ses éléments
  décoratifs sont rares et ignorés par les technologies d'assistance.

### Tests et risques

- Revue à 320/390, 768/1024, 1440 et 1920 px, zoom 200 %, contraste,
  daltonisme, forced colors, reduced motion, fontes, FR/EN et données réalistes.
- Risque : transformer la signature cartographique en décoration répétitive ou
  faire du bleu un signal ambigu pour trop d'états simultanés.

### Migration et rollback

- Aucun remplacement global avant validation de la table et preuve sur Programme,
  Exercice, Réviser, Profil et Administration.
- Prévoir rollback par groupe de tokens et conserver la baseline V3.

---

## V3.5-002 — Primitives UI et réduction de la cardification

**Priorité : P0. Dépendances : V3.5-001 validé.**

**Référence : A2, vues `Actions`, `Formulaires` et `Apprentissage & confiance`.**

### Périmètre

- Inventorier boutons, liens, champs, progressions, statuts, cartes, lignes,
  sections, alertes, dialogues, tiroirs, tableaux et navigations existants.
- Décliner les primitives depuis Atlas : encre/navy et surfaces mates dans
  l'app, papier pour les contextes clairs, bleu pour marque, action,
  progression et positif, laiton uniquement en accent éditorial rare.
- Définir quand utiliser carte, section typographique, ligne, filet ou groupe.
- Limiter les cartes à un bloc autonome et leur imbrication à un niveau.
- Hiérarchiser actions primaire remplie, secondaire, tertiaire et destructive.
- Unifier les états actif, disponible, en cours, terminé, verrouillé, erreur,
  attention, désactivé et chargement par texte, forme et iconographie.
- Créer des primitives sobres pour durée, date, progression et autres
  métadonnées secondaires.
- Définir des primitives cartographiques bornées — tracé, nœud, point actif et
  coordonnée — uniquement lorsqu'elles expliquent position ou parcours.
- Appliquer l'échelle 4/8/12/16/24/32/48 px et les rayons : 4 px pour
  filets/blocs directionnels, 7 px pour contrôles, 12 px pour blocs bornés,
  20 px uniquement pour le cadre mobile de présentation.
- Couvrir pour boutons, liens et contrôles : default, hover (+8 % de luminosité
  sans translation), focus (anneau bleu clair 2 px décalé), disabled (libellé
  explicite), loading (largeur stable) et erreur lorsque pertinente.
- Les champs conservent toujours un libellé visible ; placeholder, icône ou
  couleur ne remplace jamais le nom, l'aide ou le message d'erreur.
- Garantir focus visible, ordre clavier, cibles 44 × 44 px et contrastes.
- Classer les primitives actuelles : conserver, adapter, déprécier ou supprimer.

### Hors périmètre

- Modifier les règles métier ou ajouter une bibliothèque UI lourde.
- Transformer chaque information en badge ou chaque action en bouton rempli.

### Critères d'acceptation

- Chaque primitive documente intention, anatomie, variantes, états, bon usage,
  anti-exemple et accessibilité.
- Primaire bleu plein/ivoire, secondaire ardoise, discrète textuelle et
  destructive possèdent une hiérarchie stable sur fond sombre et papier.
- Aucun exemple ne dépasse une carte imbriquée ni une action remplie dominante
  par zone.
- Aucun composant ne réintroduit de vert, gradient IA, halo, surface vitrée,
  rayon excessif ou laiton concurrent de l'action bleue.
- Une comparaison Programme, Leçon, Administration et Notes démontre moins de
  surfaces et bordures sans perte d'information ou d'action.
- Texte ≥ 4,5:1, contrôles ≥ 3:1, cibles ≥ 44 × 44 px et états sans couleur.
- Espaces et rayons n'utilisent que les valeurs du contrat ; aucune pilule,
  grosse tuile active ou ombre décorative desktop n'est acceptée.

### Tests et risques

- Tests composants, clavier, focus, lecteur d'écran, contrastes et snapshots à
  320, 390, 1024 et 1440 px.
- Captures des états default/hover/focus/disabled/loading/error sur fond sombre
  et papier, avec comparaison automatisée ou checklist visuelle versionnée.
- Risque : confondre minimalisme et suppression de repères utiles.

### Migration et rollback

- Migrer les primitives communes puis une famille d'écrans à la fois. Maintenir
  temporairement les variantes dépréciées jusqu'à validation des parcours.

---

## V3.5-003 — Shells, navigation et contextes Atlas

**Priorité : P0 structure UI. Dépendances : V3.5-001 et V3.5-002.**

### Références canoniques

- A2, vue `Navigation`.
- A1, navigation mobile et desktop.
- A3, Leçon desktop, Notes mobile, Crédits et Création.

### Périmètre

- Définir quatre shells cohérents utilisant les mêmes tokens : public,
  authentification, application apprenant et administration.
- Définir topbar, marque, navigation basse mobile, rail desktop, navigation
  admin, retour/contexte, fil d'Ariane et onglets locaux.
- Limiter la profondeur visible à trois niveaux : navigation globale, contexte
  du parcours et navigation locale.
- Mobile : icône + libellé, zone active signalée par texte/forme et filet bleu
  de 3 px, jamais par une grosse tuile remplie.
- Desktop : rail de 208 à 224 px lorsque le gabarit le justifie, état actif sur
  surface ardoise avec filet bleu, contenu principal non contraint par une
  largeur mobile globale.
- Utiliser un fil d'Ariane textuel ou un titre de contexte, jamais une seconde
  barre de navigation massive.
- Partager routes, permissions et libellés entre responsive variants sans
  dupliquer la logique métier.
- Couvrir session inconnue, anonyme, authentifiée, expirée, offline privé sûr,
  chargement de route et erreur de navigation sans flash de contenu privé.

### Composants et tokens concernés

- `AppShell`, `PublicShell`, `AuthShell`, `AdminShell`, `TopBar`, `BrandMark`,
  `BottomNavigation`, `DesktopRail`, `Breadcrumb`, `ContextHeader`, `LocalTabs`.
- Encre/navy pour shells, ardoise pour actif, bleu/bleu clair pour action et
  focus, laiton limité à un repère de marque rare.
- Espaces 4/8/12/16/24/32/48 ; rayon 7 px pour contrôles, 12 px maximum pour un
  bloc borné, 20 px uniquement pour le cadre de démonstration mobile.

### Hors périmètre

- Changer routes, rôles, permissions ou logique de reprise.
- Navigation flottante permanente, sixième item mobile, tuile active géante,
  cyan électrique, vert, gradient, halo ou ombre desktop décorative.

### Critères d'acceptation

- À 320 et 390 px, les cinq destinations principales affichent icône + libellé,
  restent utilisables dans les safe areas et possèdent une cible ≥ 44 × 44 px.
- À 768/1024/1440/1920 px, le shell choisit un gabarit adapté sans colonne
  mobile étirée ni scroll horizontal global.
- L'état actif utilise au plus un fond ardoise et un filet bleu de 3 px ; aucun
  item actif ne devient une grande carte ou un CTA concurrent.
- Default, hover, focus, active et disabled sont distinguables par texte/forme ;
  focus : anneau bleu clair de 2 px avec décalage visible.
- Le zoom 200 % conserve toutes les destinations, le contexte et l'action
  principale ; reduced motion n'altère aucune information.
- Les parcours principaux gardent le même nombre d'actions ou moins et le bouton
  retour ne crée aucune boucle entre leçon, module et programme.
- Aucun contenu privé ou navigation privée n'apparaît avant confirmation de la
  session serveur.

### Tests et risques

- Tests composants des états, clavier, focus, lecteur d'écran et permissions.
- Captures 320, 390, 768, 1024, 1440 et 1920 px, plus zoom 200 %.
- E2E navigation, route profonde/rechargement, retour, session expirée, offline
  et reprise mobile/desktop.
- Risque : faire du shell une refonte fonctionnelle. Toute modification de flow
  ou de route devient un ticket séparé.

### Migration et rollback

- Migrer shell public, apprenant et admin séparément avec feature flag ou
  rollback par shell ; aucune migration de données attendue.

---

## V3.5-004 — Écrans d'apprentissage mobile Atlas

**Priorité : P1 cœur produit. Dépendances : V3.5-002, V3.5-003 et flows V3
stabilisés.**

**Références : A1 — Programme, Exercice, Réviser, Profil mobile ; A3 — Notes
mobile ; A2 — `Apprentissage & confiance` ;
`docs/EMOTIONAL_DESIGN_CONTRACT.md` et la référence interactive
`/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html`.**

### Périmètre

- Appliquer le système à Aujourd'hui, Parcours, Programme, Leçon, ressources,
  quiz, exercice, évaluation d'étape, Réviser, Notes et Profil.
- Utiliser le screen pack Atlas comme référence de direction pour Programme,
  Exercice, Réviser et Profil, sans copier une anatomie contraire au flow réel.
- Préserver ordre authoré, prochaine activité, reprise, sources, tentatives,
  historique et action principale.
- Donner la priorité au contenu par la typographie et le rythme plutôt que par
  une succession de cartes, badges ou accordéons.
- Rendre l'état actif de la navigation basse lisible mais discret, avec icône,
  texte, forme, focus et safe areas correctes.
- Utiliser tracés et nœuds pour la continuité du parcours lorsqu'ils remplacent
  un repère existant ; ne jamais les ajouter en doublon d'une progression claire.
- Utiliser 16–18 px et 1,65–1,75 dans les leçons ; viser 62–68 caractères quand
  la largeur le permet, maximum 72.
- Conserver une action remplie dominante par zone et subordonner Précédent,
  Continuer, Soumettre, Réessayer et Terminer selon le contexte.
- Présenter contenus, ressources et exercices selon la séquence authorée sans
  inventer un ordre côté interface.
- Rendre les détails secondaires accessibles sans menu flottant permanent ni
  cascade de clics.
- Appliquer Source Serif 4 aux titres de page/leçon définis par A2 et Manrope aux
  consignes, contrôles, métadonnées et réponses.
- Définir pour chaque écran pertinent : contenu nominal, chargement, vide,
  erreur récupérable, action désactivée et mutation en cours sans saut de layout.
- Distinguer l’état de première arrivée sans parcours d’un vide courant : une
  phrase d’orientation, un seul CTA `Choisir mon premier parcours`, aucun
  compteur, recherche ou filtre vide. V4-016C porte le routage et les données.
- Séparer `Mes parcours`, destiné à la reprise, de `Découvrir`, destiné au choix,
  avec recherche révélée à la demande et contenu utile avant les filtres.
- À une frontière pédagogique réelle, afficher une clôture factuelle : notions
  travaillées, activités validées, notes prises, position et prochaine étape.
- Toute erreur ou indisponibilité explicite ce qui est conservé, ce qui n’a pas
  eu lieu, l’éventuel non-débit et l’action sûre, sans mutation en double.

### Hors périmètre

- Modifier séquence, progression, complétion ou correction déterministe.
- Gamification ou copie miniature du desktop.

### Critères d'acceptation

- À 320/390 px, aucun contenu, titre, contrôle ou élément de navigation ne
  déborde, se superpose ou disparaît sous une safe area.
- Cibles ≥ 44 × 44 px, texte ≥ 4,5:1, contrôles ≥ 3:1, zoom 200 % et reduced
  motion restent utilisables.
- La prochaine activité, les sources, tentatives, réessai et retour au parent
  pédagogique sont trouvables sans ambiguïté.
- Les parcours critiques utilisent le même nombre d'actions ou moins qu'avant.
- Le bleu ardoise reste compréhensible entre action, progression et positif
  grâce aux libellés et formes ; aucun vert n'apparaît dans les états mobiles.
- La revue couvre une leçon longue, titre long, ressource obligatoire, erreur,
  tentative corrigée et état verrouillé avec des données réalistes.
- Programme, Exercice, Réviser, Notes et Profil possèdent chacun des captures à
  320 et 390 px ; les contrôles visibles utilisent 7 px, les blocs bornés au
  plus 12 px et aucun écran n'empile plus d'un niveau de cartes.
- Un groupe visuel ne comporte qu'un CTA bleu dominant ; aucun cyan électrique,
  vert, CTA laiton, grosse tuile active ou ombre décorative n'est présent.
- Les tests de compréhension définis dans `docs/V3_5_QA_MATRIX.md` sont
  consignés pour première arrivée, Parcours, clôture et récupération ; les
  captures seules ne valent pas preuve de compréhension.

### Tests et risques

- Tests visuels et E2E 320/390/768 px, clavier externe et lecteurs d'écran
  mobiles lorsque possible.
- Tests composants des états nominal/loading/empty/error/disabled et focus,
  avec comparaison visuelle des références A1/A3 sans exiger le pixel-perfect.
- Risque : gagner visuellement de l'air en augmentant le scroll ou les clics.

### Migration et rollback

- Livrer par famille de parcours avec baseline et rollback isolable.

---

## V3.5-005 — Écrans desktop et administration Atlas

**Priorité : P1. Dépendances : V3.5-002, V3.5-003 et shell V3 stabilisé.**

**Références : A1 — Programme et Administration desktop ; A3 — Leçon desktop ;
A2 — navigation, apprentissage et liste administrative ;
`docs/EMOTIONAL_DESIGN_CONTRACT.md` et les captures
`/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/emotional-design-renders/`.**

### Périmètre

- Auditer à 768/1024, 1440 et 1920 px : Aujourd'hui, Parcours, Programme,
  Leçon, exercice, Réviser, Notes, Profil et administration.
- Utiliser les vues desktop Programme et Administration du screen pack Atlas
  comme références de densité, hiérarchie, surfaces mates et navigation.
- Définir trois gabarits documentés :
  1. `lecture`, centré et limité pour contenus pédagogiques longs ;
  2. `travail`, plus large pour exercice, notes et comparaison ;
  3. `administration`, dense avec listes, filtres, tableaux ou maître-détail.
- Concevoir une navigation desktop adaptée au pointeur et au clavier, distincte
  de la navigation basse mobile mais partageant routes et libellés.
- Adapter en-tête, retour, contexte et actions aux grands écrans.
- Utiliser des colonnes uniquement lorsqu'elles servent la tâche ; ne jamais
  remplir l'espace par des cartes ou sidebars décoratives.
- Dimensionner correctement formulaires, tiroirs, tableaux et actions groupées
  de l'administration.
- Réserver Source Serif 4 aux rôles éditoriaux définis ; tableaux, filtres,
  contrôles et données administratives restent en Manrope.
- Utiliser le rail 208–224 px, une zone de lecture plafonnée à 72 caractères et
  un panneau contextuel uniquement lorsque Leçon ou travail le justifie.
- Couvrir contenus nominaux, listes vides, chargement, erreur, filtres actifs,
  action désactivée et mutation en cours sans afficher d'ancienne donnée comme
  si elle était actuelle.
- Préserver ordre pédagogique et largeur de lecture ; le desktop n'affiche pas
  simultanément ce qui doit rester séquentiel.
- Adapter première arrivée, Aujourd’hui multi-parcours, Mes parcours/Découvrir,
  résultat, clôture et récupération aux gabarits desktop sans les transformer
  en dashboards ni dupliquer les actions de la version mobile.

### Hors périmètre

- Refaire les permissions, la logique admin ou chaque écran en dashboard.
- Étendre une PWA mobile au lieu d'utiliser les gabarits validés.

### Critères d'acceptation

- Chaque écran utilise un des trois gabarits ou justifie son exception.
- À 1440/1920 px, aucune vue n'est une colonne mobile perdue ou une carte
  artificiellement étirée.
- À 1024 px et zoom 200 %, aucun chevauchement ni scroll horizontal global.
- Lecture 62–68 caractères, maximum 72 ; texte et contrôles respectent les
  contrastes ; cibles interactives ≥ 44 × 44 px.
- Programme, Leçon, Notes et Administration possèdent une revue avant/après sur
  données réalistes.
- Captures obligatoires à 768/1024/1440/1920 px pour Programme, Leçon et
  Administration, plus zoom 200 % à 1024 px.
- Aucune ombre décorative desktop, grosse tuile active, carte étirée, cyan
  électrique, vert ou CTA laiton ; un seul CTA bleu dominant par zone.
- Default/hover/focus/disabled/loading/error respectent A2 et restent
  compréhensibles au clavier, au lecteur d'écran et sans couleur.
- Les preuves de compréhension Emotional Design sont revues à 1440 px et au
  reflow zoom 200 %, avec la même hiérarchie sémantique qu’à 390 px.

### Tests et risques

- Tests visuels 768/1024/1440/1920, zoom 100/200 %, clavier, lecteur d'écran,
  hover/focus et reduced motion.
- Tests composants et E2E sur changement de gabarit, filtres, listes vides,
  erreurs récupérables et navigation profonde.
- Risque : chantier diffus. Les trois gabarits et la liste d'écrans bornent le
  ticket ; toute modification métier devient un ticket distinct.

### Migration et rollback

- Livrer d'abord shell et gabarits, puis familles d'écrans isolables.

---

## V3.5-006 — Landing publique initiale et entrée PWA dédiée

**Priorité : P1 lancement. Dépendances : V3.5-002, V3.5-003 et architecture
d'authentification V3 stabilisée.**

**Références : A5 pour la structure et les preuves produit ; A3 — `Landing
détaillée` pour le cadrage initial ; A2 — actions et formulaires.**

### Périmètre

- Trancher dans un ADR l'architecture de domaine. Option recommandée : domaine
  principal marketing et sous-domaine `app` pour application/PWA.
- Documenter DNS, environnements, cookies, CORS, CSP, redirections, analytics,
  service worker, cache et rollback.
- Créer une landing publique, rapide, indexable, bilingue et accessible autour
  de `un parcours, pas une bibliothèque`.
- Utiliser le papier chaud Atlas, le bleu ardoise comme action dominante, le
  laiton comme accent rare et la cartographie comme explication du parcours,
  jamais comme texture de fond répétée.
- Présenter uniquement le produit disponible : parcours structurés, progression,
  activités, sources, tentatives et usages concrets.
- Annoncer sobrement les corrections IA V4 et la création guidée V5 comme
  fonctionnalités à venir, sans simuler leur disponibilité.
- Utiliser les tokens de marque sans reproduire le shell applicatif. La landing
  peut adopter un régime plus éditorial si V3.5-001 l'a validé.
- Montrer des preuves produit réelles et inspectables, jamais des illustrations
  génériques : aperçu du parcours dans le hero, puis détails Programme et Leçon
  issus de contenus réellement publiés et de composants Atlas disponibles.
- Reprendre dans ces aperçus des titres, statuts, progressions, extraits et
  sources cohérents avec la source de vérité applicative. Aucun lorem ipsum,
  faux utilisateur, fausse progression ou contrôle décoratif présenté comme
  fonctionnel.
- La section `Correction assistée` d'A5 ne devient une preuve de fonctionnalité
  disponible qu'après V4-010 et son rollout. En V3.5, elle est soit absente,
  soit explicitement annoncée `à venir`, sans réponse fabriquée attribuée à un
  utilisateur réel.
- Toute statistique ou citation publique est vraie, datée et vérifiable.
- Distinguer `Être informé du lancement` et `Devenir early adopter`, avec
  finalités, formulaires, confirmations, statuts et consentements distincts.
- Séparer lead, candidature, invitation et compte. Aucun formulaire public ne
  crée automatiquement compte, rôle, allocation ou accès.
- Prévoir confirmation d'adresse, désinscription, suppression, rétention,
  version du consentement et protection anti-abus.
- Définir pour les deux formulaires : default, hover, focus, disabled, loading,
  validation, erreur réseau, succès et soumission idempotente. Le bouton garde
  sa largeur pendant le chargement et annonce l'état.
- Reprendre la hiérarchie A5 : hero avec aperçu du parcours, barre de principes,
  preuves Programme/Leçon, méthode et CTA early adopter, sans inventer de
  chiffres, témoignages ou prix.
- Garantir que l'icône installée ouvre l'app ou la connexion et jamais la
  landing. Le service worker marketing ne cache aucune donnée privée.
- Proposer `Candidater comme early adopter` comme CTA principal, `Être informé`
  comme secondaire et `Se connecter` comme lien utilitaire permanent.

### Hors périmètre

- Achat, packs, prix, crédits, checkout ou promesse commerciale chiffrée.
- Chat, génération, accès automatique, CRM complexe ou campagne automatisée.
- Fausse preuve, rareté artificielle, faux témoignage, robot ou esthétique IA.
- Vert, gradient IA, halo néon, glassmorphism, cartes marketing répétitives ou
  laiton utilisé comme second CTA concurrent.

### Critères d'acceptation

- Une visite anonyme affiche la landing sans requête privée ni navigation app.
- `Se connecter` ouvre l'origine applicative et respecte l'état de session.
- Android, iOS et desktop installable ouvrent l'app, jamais la landing.
- Actualités et early adopter ne sont ni confondus ni convertis en compte.
- Chaque formulaire affiche finalité, libellés persistants, langue, information
  de consentement et confirmation propres ; un succès de l'un ne valide pas
  l'autre.
- Promesse, CTA principal et connexion sont compris dans le premier écran.
- Une seule action remplie domine chaque zone ; textes longs 62–68 caractères,
  maximum 72 ; contrôles et textes respectent les contrastes et 44 × 44 px.
- SEO, performances, 320/390/768/1024/1440/1920 px, zoom 200 %, clavier,
  lecteur d'écran, reduced motion et langues FR/EN sont validés.
- Captures landing nominale et formulaires default/focus/loading/error/success à
  320, 390, 1024, 1440 et 1920 px ; aucun scroll horizontal à zoom 200 %.
- À 320/390 px, l'aperçu hero et les preuves Programme/Leçon restent lisibles
  sans reproduire une fenêtre desktop illisible ; à 1024/1440/1920 px, leur
  hiérarchie reste celle d'A5 sans étirement artificiel.
- Les preuves affichent uniquement des contenus réalistes et cohérents entre
  leurs vues ; aucun texte factice, bouton sans destination ou état impossible.
- Boutons rayon 7 px, blocs bornés ≤ 12 px, espaces issus de l'échelle Atlas et
  aucun cyan électrique, vert, CTA concurrent ou ombre décorative.

### Tests et risques

- Tests domaines, cookies, CORS/CSP, manifest, `start_url`, service worker,
  authentification et absence de flash privé.
- Tests API rate limit, idempotence, confirmation, désinscription et suppression.
- Tests composants des deux formulaires et de tous leurs états, avec focus,
  messages `aria-live` et absence de mutation silencieuse.
- Tests ou vérification contractuelle des données utilisées par chaque aperçu,
  plus captures 320/390/1024/1440/1920 et zoom 200 % de la landing complète.
- E2E landing → inscription et landing → connexion → app, plus lancement PWA.
- Risque : partager portée ou cache entre marketing et données privées.

### Migration et rollback

- Toute persistance de leads est additive, minimale et distincte des comptes.
- Landing, collecte et domaine disposent de déploiements ou flags indépendants.

---

## V3.5-006A — Liens publics fiables et renouvellement PWA

**Priorité : P0 accès. Dépendances : V3.5-003 et V3.5-006. À livrer avant
V3.5-007.**

### Problème confirmé

Sur la version Production issue de `main`, des liens de vérification d'adresse
ont affiché une page introuvable dans un navigateur normal tout en fonctionnant
en navigation privée. Les routes serveur et client répondent correctement à
froid. L'écart provient donc d'un état persistant possible du navigateur : shell
PWA obsolète maintenu par une mise à jour manuelle, cache de navigation ou
redirection permanente mémorisée pendant un changement de domaine.

### Périmètre

- Garantir que `/login`, `/request-access`, `/verify-email`, `/activate` et
  `/interest` chargent une version réseau fraîche du shell lorsqu'une connexion
  est disponible et ne sont jamais bloquées par une ancienne route précachée.
- Activer et prendre en contrôle une nouvelle version compatible du service
  worker sans demander à un visiteur anonyme de comprendre une notification de
  mise à jour.
- Préserver intégralement le fragment contenant le jeton lors des liens directs,
  rechargements et redirections entre l'ancienne origine Vercel, `www` et
  l'origine canonique `https://learn-x.app`.
- Tester l'arrivée depuis un e-mail avec un ancien service worker, un cache
  existant, une session active, aucune session et une navigation privée neuve.
- Documenter la transition de domaine : utiliser une redirection temporaire
  pendant la propagation et ne rendre la redirection permanente qu'après smoke
  test ; fournir une procédure de purge des données de site pour les navigateurs
  déjà affectés.
- Conserver les API privées hors cache et ne jamais stocker de jeton, réponse de
  vérification, invitation ou donnée de compte dans le cache PWA.

### Hors périmètre

- Changer la durée de vie, l'usage unique ou les règles d'autorisation des
  jetons.
- Remplacer le fournisseur d'e-mail, modifier le cycle d'approbation ou créer
  automatiquement un compte.
- Transformer les pages publiques en fonctionnalités hors ligne : la validation
  d'un jeton nécessite le réseau.

### Critères d'acceptation

- Un lien e-mail valide ouvre la bonne page au premier essai dans un navigateur
  normal déjà utilisé, sans imposer navigation privée, copier-coller ou purge.
- Un ancien shell PWA ne peut plus produire une page introuvable pour une route
  publique connue ; la mise à jour se fait automatiquement et sans boucle de
  rechargement.
- Les redirections canoniques conservent chemin et fragment ; `learn-x.app`
  reste l'origine finale unique.
- Un jeton n'apparaît jamais dans une requête serveur, un log, un cache, une
  URL de destination sans fragment ou une télémétrie.
- Les états hors ligne, jeton invalide/expiré/utilisé et erreur réseau sont
  distincts, accessibles et proposent une destination publique utile.
- Les tests couvrent Chromium/WebKit, lien profond, ancien service worker,
  session active/inactive et cache froid/chaud.

### Tests et risques

- Tests du manifeste, du service worker généré, des règles Workbox, des
  redirections et des pages publiques.
- E2E avec installation d'un ancien worker puis déploiement simulé d'un nouveau
  shell ; vérification qu'aucun hash n'est perdu.
- Risque : une activation forcée pendant une mutation privée. Le changement de
  worker doit attendre ou recharger proprement sans rejouer une écriture.

### Migration et rollback

- Aucun changement Prisma.
- Déploiement progressif sur Preview puis staging avec deux versions de worker.
- Rollback applicatif accompagné d'une version de worker supérieure qui purge
  les caches incompatibles ; ne jamais compter uniquement sur le retour au
  bundle précédent.

---

## V3.5-006B — Icône d'application Atlas et exports

**Priorité : P1 marque. Dépendance : V3.5-001. Peut avancer en parallèle de
V3.5-003 à V3.5-006A ; doit être terminé avant V3.5-008.**

**Référence canonique : A6. Géométrie source immuable :
`public/learnx-icon.svg`.**

### Périmètre

- Préserver strictement le `viewBox`, les tracés, proportions et positions du L
  et du X de `public/learnx-icon.svg`. Seules les couleurs et déclinaisons
  d'export prévues par ce ticket peuvent changer.
- Définir l'icône principale sur fond papier `#F1EEE6`, L encre `#121C24` et X
  bleu Atlas `#557F9A`.
- Réserver la variante sombre — fond `#121C24`, L ivoire `#F8F5EE`, X bleu
  Atlas `#557F9A` — au favicon et aux contextes techniques où le fond clair est
  réellement inadapté.
- Produire ou vérifier les sorties nécessaires aux tailles 1024, 512, 192, 180,
  60, 40, 32 et 29 px, sans interpolation destructive ni géométrie divergente.
- Inventorier puis raccorder explicitement manifestes PWA, icônes maskable le
  cas échéant, `apple-touch-icon`, favicons et métadonnées de plateforme. Chaque
  usage documente fichier source, variante, taille et destination.
- Documenter le pipeline reproductible d'export afin qu'un changement futur de
  couleur ne crée pas huit versions manuelles incohérentes.

### Hors périmètre

- Redessiner, simplifier, arrondir ou déplacer le monogramme ; ajouter point,
  tracé cartographique, waypoint, ruban, pli, symbole ou nouvelle métaphore.
- Gradient, laiton, ombre, halo, volume, texture, transparence décorative,
  bordure ou effet intégré dans l'asset. Le cadre et l'ombre visibles dans la
  page de présentation A6 ne font pas partie de l'icône.
- Utiliser la signature cartographique dans le logo ou faire de la variante
  sombre l'icône principale installée.

### Critères d'acceptation

- Un contrôle automatisé ou une comparaison versionnée démontre que `viewBox`
  et données de tracés du L/X sont identiques à la géométrie source antérieure.
- L'icône principale n'utilise exactement que `#F1EEE6`, `#121C24` et
  `#557F9A` ; la variante sombre n'utilise que `#121C24`, `#F8F5EE` et
  `#557F9A`.
- Les exports 1024/512/192/180/60/40/32/29 px restent reconnaissables et nets à
  100 %, sans couture, clipping, effet ajouté ni perte d'une branche du X.
- Le manifeste, les métadonnées PWA, `apple-touch-icon` et les favicons pointent
  chacun vers une taille et une variante documentées ; aucun ancien asset de
  ruban, waypoint, monogramme plié ou symbole cartographique n'est référencé.
- L'installation/réouverture de la PWA conserve le comportement défini par
  V3.5-006/006A ; le changement d'icône ne modifie aucune route ni cache privé.
- Les usages sur écrans d'accueil clair/sombre, onglets et raccourcis sont
  contrôlés sans dépendre d'un fond d'aperçu artificiel.

### Tests et risques

- Snapshots ou comparaison pixel aux huit tailles, inspection à taille native
  et agrandie, contrôle des couleurs exactes et comparaison géométrique SVG.
- Tests manifestes/PWA, installation Chromium, `apple-touch-icon` WebKit/iOS et
  favicon sur fonds clair/sombre ; vérification du renouvellement de cache après
  déploiement sans demander une réinstallation complète.
- Captures des tailles 29/32/40/60/180/192/512/1024 et des deux variantes dans
  leurs seuls contextes autorisés.
- Risque : caches d'icônes persistants ou traitement automatique des plateformes.
  Versionner les URLs et documenter les limites de rafraîchissement.

### Migration et rollback

- Conserver temporairement les anciens fichiers nécessaires au rollback tant
  que les manifestes et plateformes n'ont pas été vérifiés.
- Le rollback restaure les références d'assets, jamais une géométrie alternative.

---

## V3.5-007 — Administration des contacts de la landing

**Priorité : P1 lancement. Dépendances : V3.5-003, V3.5-005, V3.5-006 et
V3.5-006A.**

### Références canoniques

- A4 : desktop, 390 px, vide, chargement et erreur.
- A2 : formulaires, navigation et états de confiance.

### Contradiction à résoudre avant implémentation

La référence affiche un compteur `Adresses avec ce consentement` tout en montrant
des inscriptions `à confirmer`. Pour éviter un consentement trompeur :

- l'indicateur `Être informé du lancement` compte uniquement les adresses dont
  le consentement de cette finalité est confirmé ;
- les demandes en attente restent visibles dans la liste avec leur statut ;
- l'indicateur `Candidatures Early adopter` compte les candidatures reçues,
  indépendamment du consentement aux e-mails marketing.

Toute autre règle exige une décision produit explicite et un libellé qui décrit
exactement le numérateur.

### Périmètre données et API

- Conserver dans la base LearnX une identité de contact dédupliquée par adresse
  normalisée, séparée de `User`, des invitations et des comptes.
- Conserver séparément, pour chaque finalité : date, langue, version du texte
  accepté, source et statut du consentement.
- Conserver la candidature Early adopter et son statut indépendamment du cycle
  de confirmation/désinscription marketing.
- Une même adresse peut compter une fois dans chacun des deux indicateurs, sans
  créer deux contacts ni produire un total unique artificiel.
- Fournir une lecture admin paginée/bornée avec deux indicateurs, recherche par
  e-mail et filtres `Toutes`, `Lancement`, `Early adopter`.
- Appliquer contrôle administrateur/propriétaire, validation, normalisation,
  rate limit des écritures publiques et réponses non énumérantes.
- Le fournisseur d'e-mail reste un exécutant ; la base LearnX fait autorité sur
  consentements, statuts, désinscription et suppression.

### Périmètre interface

- Afficher deux indicateurs séparés, sans troisième total combiné.
- Desktop : liste avec e-mail, finalité(s), date(s), langue et statut(s).
- Mobile 390 px : transformer chaque ligne en groupe vertical lisible sans
  supprimer une finalité, une date ou un statut.
- Distinguer `Early adopter` comme finalité/catégorie et le statut de candidature
  comme donnée distincte ; distinguer également le statut du consentement e-mail.
- Couvrir default, hover, focus, filtres actifs, recherche, chargement, vide,
  erreur et retry. L'erreur indique qu'aucune donnée n'a été modifiée.

### Composants et tokens concernés

- `AdminShell`, `MetricPair`, `PurposeFilter`, `SearchField`, `ContactTable`,
  `ContactRow`, `PurposeLabel`, `ConsentStatus`, `ApplicationStatus`,
  `EmptyState`, `LoadingState`, `ErrorState`.
- Papier pour le plan de travail admin, encre/navy pour le shell, bleu pour
  sélection/focus, laiton au plus pour distinguer la catégorie Early adopter
  avec texte et forme, jamais comme état de consentement implicite.

### Hors périmètre

- CRM, scoring, funnel, graphique, cohortes, campagnes, automatisation marketing,
  export avancé ou conversion silencieuse en compte/invitation.
- Total unique des personnes, car une adresse peut porter deux finalités.
- Actions de masse ou modification manuelle du consentement sans contrat dédié.

### Critères d'acceptation

- Les deux indicateurs proviennent de requêtes serveur distinctes et leurs
  définitions sont testées ; une adresse avec les deux finalités incrémente
  chaque compteur une fois et n'apparaît qu'une fois dans la liste.
- Une candidature reçue sans consentement marketing n'augmente jamais le
  compteur `Être informé du lancement`.
- À 390 px, les deux indicateurs, filtres, recherche, e-mail, finalités, dates,
  langue et statuts restent lisibles sans scroll horizontal.
- Empty/loading/error n'affichent aucune donnée obsolète ; retry est explicite,
  focusable et annoncé.
- Default/hover/focus/disabled respectent le contrat Atlas ; cibles ≥ 44 × 44 px,
  texte ≥ 4,5:1, contrôles ≥ 3:1 et focus bleu clair 2 px.
- Zoom 200 %, clavier, lecteur d'écran et reduced motion sont validés ; les
  finalités et statuts restent compréhensibles sans couleur.
- Aucun vert, cyan électrique, carte métrique massive, graphique ou CTA
  concurrent n'est introduit.

### Tests et risques

- Tests de normalisation/dédoublonnage, double finalité, confirmation,
  désinscription, suppression, permissions, pagination, recherche et filtres.
- Tests composants et E2E desktop/390 px pour default, vide, chargement, erreur,
  retry et adresse portant deux finalités.
- Captures 390, 1024 et 1440 px, plus zoom 200 %.
- Risque : confondre intérêt, consentement marketing, candidature et compte.

### Migration et rollback

- Migration additive minimale, sans transformer les leads en utilisateurs.
- Rollback de la vue sans suppression des consentements ; procédure de
  réconciliation avec le fournisseur d'e-mail documentée.

---

## V3.5-008 — QA visuelle, accessibilité et documentation

**Priorité : P0 release. Dépendances : V3.5-004, V3.5-005, V3.5-006,
V3.5-006A, V3.5-006B et V3.5-007.**

**Références : A1 à A6 dans leur intégralité.**

### Périmètre

- Construire une matrice landing, mobile apprenant, desktop apprenant et admin.
- Utiliser le screen pack Atlas comme référence validée pour Programme,
  Exercice, Réviser, Profil et Administration ; la fidélité visuelle ne remplace
  pas les tests d'usage.
- Contrôler séparément la landing A5 avec ses preuves produit réelles et les
  exports d'icône A6 ; une capture marketing ne remplace ni la cohérence des
  données affichées ni un test de manifeste.
- Valider 320, 390, 768/1024, 1440 et 1920 px, zoom 200 %, reduced motion,
  clavier, lecteur d'écran, contraste et navigateurs supportés.
- Produire des avant/après avec contenus longs, titres longs, statuts mélangés,
  erreurs, listes admin et formulaires remplis.
- Vérifier mesure de lecture, taille/interligne, cibles, contrastes, action
  dominante, cartes imbriquées et états indépendants de la couleur.
- Vérifier absence de vert, hiérarchie bleu/laiton, chargement Manrope/Source
  Serif 4, matité des surfaces et fréquence de la signature cartographique.
- Documenter tokens, primitives, gabarits desktop, règles mobiles, landing,
  usages interdits, exceptions et procédure de contribution.
- Organiser une revue humaine de cohérence de marque et une revue distincte
  d'utilisabilité/accessibilité ; consigner les écarts acceptés.

### Hors périmètre

- Ajouter des fonctionnalités pendant la QA ou approuver mécaniquement de
  nouvelles captures pour masquer une régression.

### Critères d'acceptation

- La matrice couvre explicitement : Programme, Exercice, Correction IA,
  Réviser, Profil et Administration d'A1 ; Landing, Leçon desktop et Notes
  mobile d'A3 ; Contacts desktop/390, vide, chargement et erreur d'A4 ; landing
  avec preuves réelles d'A5 ; icônes principale/sombre et huit tailles d'A6.
- Chaque famille possède baseline, résultat et décision humaine traçable, avec
  captures à ses largeurs pertinentes parmi 320, 390, 768/1024, 1440 et
  1920 px et au zoom 200 %.
- Les composants interactifs pertinents sont contrôlés en default, hover,
  focus, disabled, loading, error et empty ; une mise à jour de baseline ne
  peut jamais constituer à elle seule la résolution d'un écart.
- Les contrôles clavier couvrent ordre de tabulation, focus visible, fermeture
  Échap et restitution du focus pour dialogues/tiroirs ; les annonces lecteur
  d'écran couvrent erreurs, chargements et confirmations.
- Le contrôle statique ou la checklist versionnée rejette : couleur verte ou
  cyan électrique, rayon hors 4/7/12/20 px, ombre décorative desktop, carte
  imbriquée au-delà d'un niveau, plusieurs CTA remplis concurrents, laiton comme
  CTA/état principal et motif cartographique sans fonction de parcours.
- Texte courant ≥ 4,5:1, limites de contrôles ≥ 3:1, cibles ≥ 44 × 44 px,
  mesure de lecture ≤ 72 caractères et comportement reduced motion sont
  vérifiés sur des données réalistes.
- Aucun défaut P0/P1 visuel, responsive ou accessibilité n'est ouvert.
- Aucune validation ne repose uniquement sur un état vide ou fictif.
- La documentation permet à V4 de réutiliser le système sans réinventer palette,
  hiérarchie ou comportement.

### Tests et risques

- Régression visuelle automatisée complétée par tests manuels et parcours réels ;
  tout seuil de différence est documenté et aucune capture n'est approuvée en
  masse sans inspection.
- Captures minimales : 320/390 pour les vues mobiles, 768/1024 pour les ruptures
  de shell, 1440/1920 pour lecture et administration, plus zoom 200 % pour une
  vue de chaque gabarit. Les états A4 sont tous capturés à 390 px et desktop.
- Tests contrastes, clavier, lecteur d'écran, forced colors, reduced motion,
  titres/contenus longs FR/EN et chargement/fallback des fontes.
- Contrôle des contenus réels des aperçus A5 et tests manifeste/PWA/
  `apple-touch-icon`/favicons d'A6, avec inspection native aux petites tailles.
- Risque : confondre conformité aux captures et qualité d'usage.

### Migration et rollback

- Versionner les baselines et maintenir un rollback par famille d'écran.

---

## V3.5-009 — Audit, déploiement et clôture V3.5

**Priorité : P0 release. Dépendances : V3.5-001 à V3.5-008.**

**Références : A1 à A6, plus le rapport V3 clôturé.**

### Périmètre

- Réauditer parcours principaux, responsive, accessibilité, performance,
  sécurité publique, authentification, PWA, SEO et documentation.
- Exécuter lint, typecheck, tests, build, E2E et smoke tests sur les domaines
  réellement configurés.
- Vérifier landing → liste/early adopter, landing → connexion → app et
  installation → réouverture directe de l'app.
- Contrôler qu'aucune règle pédagogique, progression, permission ou donnée
  privée n'a régressé pendant la refonte.
- Produire un rapport GO/NO-GO, les procédures de rollback et la baseline que
  V4 devra consommer.

### Hors périmètre

- Commencer V4, ajouter pricing/paiement ou solder une dette sans rapport avec
  une régression V3.5.

### Critères d'acceptation

- Aucun P0/P1 ouvert ; les tests et contrôles V3.5-008 sont réussis.
- Les domaines, sessions, caches et lancements PWA respectent leurs frontières.
- Les parcours pédagogiques conservent leurs actions, statuts et autorités
  serveur.
- La release n'est clôturée qu'après verdict GO et validation humaine finale.

### Tests et risques

- Matrice mobile/desktop/WebKit, réseau lent, offline privé sûr et smoke public.
- Risque : déclarer la refonte terminée sur captures locales sans tester les
  domaines, sessions et contenus réels.

## Arbitrages et contradictions consignés

1. A4 intitule un indicateur `Adresses avec ce consentement` tout en montrant
   des statuts d'e-mail en attente. Contrat durci retenu pour V3.5-007 :
   l'indicateur lancement compte uniquement les consentements confirmés ; les
   inscriptions en attente restent visibles dans la liste ; l'indicateur early
   adopter compte les candidatures soumises indépendamment du consentement
   marketing. Toute autre règle exige une décision produit et un relabelling.
2. A2 autorise le laiton pour une attention secondaire, tandis que la direction
   validée interdit d'en faire un code principal d'état. V3.5-001/002 retiennent
   donc au maximum un repère laiton rare par zone, toujours doublé par texte et
   forme, jamais pour succès, CTA, prix ou solde.
3. A5 montre une correction assistée alors que cette fonctionnalité est livrée
   en V4. En V3.5, Programme et Leçon sont des preuves réelles ; Correction
   reste absente ou clairement `à venir`. V4-016A ne la transforme en preuve
   disponible qu'après V4-010 et rollout effectif. Aucun faux feedback n'est
   publié pour contourner cette dépendance.

## Points à finaliser avant V3.5-002

1. Validation des treize tokens A2 après mesure WCAG et de tout ajustement
   strictement nécessaire.
2. Frontière exacte entre régime sombre applicatif et contextes papier clairs.
3. Licences, performance, fallbacks et sous-ensembles de Manrope et Source
   Serif 4.
4. Fréquence maximale du laiton et de la signature cartographique par gabarit.
5. Domaine public, sous-domaine applicatif et stratégie de déploiement.
6. Fournisseur et textes de consentement pour la liste d'attente.
7. Promesse finale, publics prioritaires et critères early adopter.
