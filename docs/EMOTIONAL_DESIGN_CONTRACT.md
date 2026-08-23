# LearnX — Contrat d’emotional design Atlas

**Statut : APPROUVÉ PAR LE PROPRIÉTAIRE**

**Date : 16 août 2026**

**Portée : produit apprenant, administration, V4 et préparation V5**

## 1. Objet et autorité

Ce contrat complète la direction Atlas en définissant la relation émotionnelle
que LearnX doit construire pendant l’usage. Il ne remplace ni les règles métier,
ni l’autorité serveur, ni les contrats pédagogiques ou financiers d’un ticket.
En cas d’écart, ces contrats priment.

Source approuvée :

`/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-design-contract.md`

Références raccordées dans le dépôt :

- `docs/V3_5_BRAND_DIRECTION.md` : niveau viscéral, palette, typographie et mouvement ;
- `docs/V3_5_UI_PRIMITIVES.md` : actions, feedback, états et surfaces ;
- `docs/V3_5_APP_SHELLS.md` : orientation et continuité de navigation ;
- `BACKLOG_V3_5.md` : V3.5-004, V3.5-005 et V3.5-008 ;
- `BACKLOG_V4.md` : V4-008, V4-010, V4-016C et V4-016G ;
- `docs/V4_AI_CORRECTION_COMPOSITE_SPEC.md` ;
- `ADR_003_AI_CORRECTION_FINANCING_TRUST_BOUNDARIES.md`.

## 2. Promesse émotionnelle

> LearnX me montre où j’en suis, protège mon travail, explique ce qui vient et
> rend mes progrès perceptibles sans me juger.

La direction émotionnelle est **la confiance calme et la progression tangible**.

Ton de référence :

- sérieux sans solennité ;
- calme sans froideur ;
- encourageant sans infantiliser ;
- personnel sans fausse empathie ;
- transparent sans devenir technique.

La reconnaissance repose sur un fait observable : activité terminée, notion
validée, réponse améliorée, note conservée ou nouvelle étape disponible. LearnX
ne félicite pas automatiquement l’utilisateur et ne prétend pas connaître son
état émotionnel.

## 3. Trois niveaux

### Viscéral — crédibilité immédiate

Atlas porte déjà ce niveau : encre, ardoise, bleu Atlas, laiton rare, titres
éditoriaux, surfaces sobres et mouvement réduit. La sensation cible est celle
d’un environnement d’apprentissage sérieux et personnel, jamais d’un chatbot
générique ni d’un LMS institutionnel lourd.

### Comportemental — contrôle pendant l’usage

L’utilisateur doit toujours savoir :

1. où il se trouve ;
2. quelle action domine ;
3. ce qui vient de se produire ;
4. ce qui a été conservé ;
5. comment reprendre ou récupérer.

### Réflexif — sens et attachement

LearnX doit rendre visibles les preuves de l’effort : position atteinte,
activités validées, notions à renforcer, notes liées, tentatives conservées et
suite rendue possible. La progression n’est pas une décoration et ne peut pas
être déduite d’une simple consultation.

## 4. Arc émotionnel cible

| Moment | Effet attendu |
| --- | --- |
| Arriver | Être orienté, pas accueilli par du vide |
| Choisir | Rester autonome et comprendre les conséquences |
| Apprendre | Se concentrer sur une activité à la fois |
| Soumettre | Savoir que le travail est conservé et ce qui va suivre |
| Recevoir un retour | Identifier un acquis et une amélioration prioritaire |
| Terminer | Éprouver une fierté sobre fondée sur une preuve |
| Rencontrer une erreur | Comprendre conservation, conséquence et action sûre |
| Revenir | Retrouver ses parcours et sa position sans reconstruction mentale |

## 5. Contrats par surface

### 5.1 Première arrivée sans parcours — P0

- État distinct d’un vide courant.
- Une phrase explique le modèle LearnX.
- Une action dominante : **Choisir mon premier parcours**.
- Aucun compteur à zéro, historique, recherche ou filtre.
- Après inscription, retour direct vers la première activité disponible.
- Ne pas définir « Découvrir » comme valeur par défaut universelle : le routage
  dépend de l’existence d’au moins une inscription.

### 5.2 Aujourd’hui multi-parcours — P0 / V4-016C

- Une recommandation principale exacte.
- Les autres parcours actifs restent visibles dans une liste compacte.
- Chaque ligne indique dernière position, prochaine activité et progression
  serveur utile.
- Toute métrique sans action, notamment `0`, est masquée.
- Chaque parcours actif est reprenable en une interaction.

### 5.3 Mes parcours et Découvrir — P0

- **Mes parcours** sert à reprendre ; **Découvrir** sert à choisir.
- Recherche révélée à la demande, avec libellé accessible.
- Filtres après le contenu, seulement lorsqu’ils réduisent une collection réelle.
- Programmes en cours avant programmes quittés ou propriétés administratives.
- Lignes éditoriales compactes ; une carte seulement pour un bloc réellement
  autonome.

### 5.4 Programme, étape et module — P1

- Commencer par **Vous êtes ici** et la prochaine activité.
- Ouvrir uniquement l’étape pertinente.
- Préférer une liste séquentielle aux cartes imbriquées.
- Présenter les prérequis comme un chemin restant, pas comme une faute.
- Éloigner redémarrage et autres actions destructives du flux courant.

### 5.5 Leçon et clôture — P1

- Préserver une activité à la fois, les sources au point d’usage, la note
  contextuelle, le sommaire et Précédent/Continuer.
- À la fin, rappeler : notions travaillées, activités validées, notes prises,
  position atteinte et prochaine étape.
- Une clôture n’apparaît qu’à une frontière pédagogique réelle.

### 5.6 Exercice et évaluation — P0/P1

Avant l’effort : objectif, critères, conséquence, conservation et coût éventuel.
Pendant : progression locale et sauvegarde explicite. Après : réception,
consultation de la réponse et suite.

Un résultat présente dans cet ordre :

1. ce qui est acquis ;
2. ce qui reste à renforcer ;
3. la prochaine action ;
4. le score et le seuil comme informations secondaires ;
5. l’évolution entre tentatives si elle existe.

Le rouge ne qualifie jamais une difficulté normale. `PASS/FAIL` ne devient pas
un verrou UI si le contrat pédagogique ne le prévoit pas.

### 5.7 Révisions

- Parler de consolidation plutôt que de dette.
- Expliquer pourquoi la notion revient maintenant.
- Réserver « en retard » aux cas où le temps a une conséquence métier réelle.
- État vide factuel : **Rien à consolider aujourd’hui**.

### 5.8 Notes et profil

- Conserver le rattachement précis activité → leçon → programme et l’autosave.
- Rendre l’aide Markdown secondaire.
- Éloigner la suppression du travail courant.
- Organiser le profil par intention : compte, préférences, appareil,
  confidentialité et crédits.
- Aucun badge de niveau, classement, série quotidienne ou métrique décorative.

### 5.9 Erreur, hors-ligne et récupération — P0

Tout incident répond à quatre questions :

1. Que s’est-il passé ?
2. Qu’est-ce qui est conservé ?
3. Qu’est-ce qui n’a pas eu lieu ou n’a pas été débité ?
4. Quelle action est sûre maintenant ?

Le retour conserve la destination et évite toute mutation en double. Les
messages sont localisés dans la langue active.

### 5.10 Correction assistée, crédits et paiement — avant V4

- Toujours distinguer rubrique authorée, score calculé par LearnX, retour
  assisté, extraits de réponse et références.
- Présenter l’incertitude honnêtement et une amélioration prioritaire.
- Rappeler l’absence d’incidence sur la progression lorsqu’elle s’applique.
- Avant confirmation : action, unité, plafond et scénario d’échec.
- Après : montant réellement réglé ou libéré, origine offerte/achetée et
  historique.
- Retry technique invisible et sans coût ; aucun langage de token ; aucune
  personnification de l’IA.

## 6. Patterns obligatoires

1. **État conscient du contexte** : chaque vide explique sa signification et sa sortie.
2. **Contrat avant engagement** : effort, conséquence, conservation et coût connus.
3. **Feedback de mutation** : en cours, réussi, échoué et récupérable.
4. **Contrat de récupération** : conservation, non-effet et action sûre.
5. **Progression comme preuve** : acquis et position avant pourcentage.
6. **Clôture intentionnelle** : sens du travail accompli et prochaine direction.
7. **Reconnaissance factuelle** : aucune flatterie générique.
8. **Personnalisation factuelle** : programme, activité, tentative et note ; jamais
   de proximité simulée par prénom ou phrases empathiques automatiques.

## 7. Interdits

- confettis, XP, streaks, classements et fausse rareté ;
- mascotte, robot, halo IA et réponse présentée comme une personne ;
- culpabilisation par la couleur ou le vocabulaire ;
- rouge pour une difficulté pédagogique normale ;
- animations décoratives ou boucles ;
- compteur à zéro sans conséquence ;
- prénom utilisé comme preuve artificielle de personnalisation ;
- cartes imbriquées ou métriques ajoutées pour remplir l’espace.

## 8. Critères mesurables

- La prochaine action est identifiable en cinq secondes.
- Une seule action remplie domine une zone.
- Un nouveau compte atteint le choix de son premier parcours sans traverser une
  page de statistiques ou de filtres vides.
- Depuis Aujourd’hui, chaque parcours actif est accessible en une interaction.
- Après soumission, conservation et suite sont explicites.
- Après évaluation, un acquis et une priorité sont identifiables sans lire tout
  le détail.
- Après erreur, conservation, conséquence et action sûre sont comprises.
- Les états essentiels sont rendus à 320/390 px, 1440/1920 px, zoom 200 %,
  clavier, lecteur d’écran, forced colors et reduced motion.
- Les transitions fonctionnelles utilisent 120, 180 ou 240 ms et disparaissent
  avec `prefers-reduced-motion`.

## 9. Matrice de traçabilité initiale

| Surface | Contrat | Raccord backlog | Preuve attendue |
| --- | --- | --- | --- |
| Première arrivée | État contextuel | V4-016C | choix du premier parcours sans faux vide |
| Aujourd’hui | Continuité multi-parcours | V4-016C | trois programmes visibles et reprenables |
| Mes parcours / Découvrir | Séparation des intentions | V3.5-004/005 et V4-016C | contenu avant outils, recherche progressive |
| Programme | Position et faisabilité | V3.5-004/005 | prochaine activité et étape courante identifiables |
| Résultat | Compétence avant verdict | V4-016G | acquis, priorité puis score secondaire |
| Fin de leçon | Clôture factuelle | V3.5-004/005 | travail accompli et suite compris |
| Erreur / hors-ligne | Récupération sûre | V3.5-002/003/004/005 et V4-016G | quatre réponses présentes |
| Correction / crédits | Confiance et consentement | V4-008/010/016G | autorité, coût et non-effet compris |

## 10. Maquettes de référence

Référence interactive approuvée :

`/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/learnx-atlas-emotional-flow.html`

Captures de validation 390 px et 1440 px :

`/Users/rayanchambet/.codex/visualizations/2026/08/10/019fea7c-39ea-7540-b74f-d7bbd2ccf22c/emotional-design-renders/`

États couverts :

1. première arrivée sans parcours ;
2. Aujourd’hui multi-parcours ;
3. Mes parcours avec recherche progressive ;
4. programme avec position actuelle ;
5. résultat centré sur la compétence ;
6. clôture de leçon ;
7. erreur avec contrat de récupération.

Ces maquettes fixent hiérarchie, densité, ton et ordre de l’information. Elles
ne fixent ni les calculs serveur, ni les seuils pédagogiques, ni un montant de
crédits, ni une structure de données. Elles ne constituent pas des écrans
pixel-perfect.

## 11. QA disponible et preuve attendue

La QA de référence a couvert sept écrans à quatre largeurs — 320, 390, 720
représentant le reflow à zoom 200 %, et 1440 — soit 28/28 contrôles sans
débordement, vue active multiple, contenu manquant, cible produit inférieure à
44 px ou erreur runtime.

Cette QA constitue une preuve technique de composition. Elle ne remplace pas la
preuve de compréhension définie dans `docs/V3_5_QA_MATRIX.md` et ne peut pas
être présentée comme un test utilisateur déjà réussi.

## 12. Fondements externes

- Don Norman, trois niveaux : <https://jnd.org/emotional-design-people-and-things/>.
- Niemiec & Ryan, autodétermination et éducation :
  <https://journals.sagepub.com/doi/10.1177/1477878509104318>.
- W3C, feedback après action :
  <https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p10-status-feedback/>.
- Méta-analyse sur l’emotional design en apprentissage :
  <https://www.sciencedirect.com/science/article/pii/S1747938X18302148>.
