# Plan d'implémentation design V4 — Totem modernisé

## Statut

- **Classe** : `ACTIVE_DESIGN_AUTHORITY`
- **Décision propriétaire** : `DESIGN_VALIDATED`
- **Implémentation applicative** : `V4_016C_QA_GREEN_READY_FOR_DEV`
- **Date** : 21 août 2026
- **Portée** : langage visuel, composants et découpage des surfaces LearnX

Ce document transforme la direction artistique validée par Rayan en tickets
implémentables. Il n'autorise aucun changement de code, aucune publication et
aucune activation de fonctionnalité. Chaque ticket exige un GO d'implémentation
distinct après réaudit du code et des contrats serveur concernés.

Les lots restent soumis à une autorisation explicite. Au 23 août 2026,
V4-016D/E, V4-016B et V4-016C ont reçu leur GO d'implémentation ; V4-016C a
également reçu l'autorisation propriétaire de commit et d'intégration sur
`origin/dev`.

## 0. État d'implémentation de V4-016D

Les fondations Totem sont préparées dans un worktree isolé, sans publication :

- palette sémantique Totem et régime clair exposés sous des tokens dédiés ;
- aliases Atlas applicatifs conservés pour permettre la migration écran par
  écran sans bascule visuelle globale ;
- DM Sans 400/500 livrée comme asset local avec sa licence ;
- monogramme inchangé géométriquement, variantes nuit/papier et exports PWA
  régénérés ;
- cache-buster des icônes passé de `atlas-1` à `totem-1` ;
- contrôles de contrastes, police, géométrie et manifests adaptés à Totem.

La police est volontairement embarquée sans modifier `package.json` ni
`pnpm-lock.yaml`. Ces deux fichiers appartiennent à une identité expérimentale
IA gelée ; les modifier aurait invalidé sa preuve. Le retrait ultérieur des
dépendances Atlas inutilisées est reporté au retrait final V4-016H, après
clôture de cette identité.

Preuves locales au 22 août 2026 : lint, typecheck, build, 1 204 tests unitaires
et les scénarios Playwright landing/primitives aux largeurs de référence sont
verts. Aucun contrat serveur, prix, score, progression ou donnée métier n'a été
modifié.

## 1. Direction validée

LearnX adopte la direction **Totem modernisé** : sérieuse, aérée et
identifiable.

| Fondation | Valeur validée |
| --- | --- |
| Typographie d'interface | DM Sans |
| Ardoise | `#17233B` |
| Cobalt | `#3B5BD6` |
| Brume | `#E7EDFF` |
| Corail rare | `#CC6B57` |
| Fond | `#F4F6FB` |
| Papier | `#FFFFFF` |

Sont exclus : vert, gradient associé à l'IA, esthétique fintech, gamification,
personnification de l'IA et couleur utilisée comme seul signal. L'IA reste une
**correction assistée**, jamais une identité ou une autorité académique.

## 2. Hiérarchie des autorités

1. Les contrats produit, pédagogiques, financiers, d'accessibilité et serveur
   actifs définissent les droits, états, calculs, montants et contenus.
2. `EMOTIONAL_DESIGN_CONTRACT.md` reste l'autorité comportementale : confiance
   calme, progression tangible, action sûre et absence de récompense
   artificielle.
3. Le présent document devient l'autorité du langage visuel Totem et de son
   découpage d'implémentation.
4. Les maquettes validées constituent le contrat visuel ferme de Totem :
   palette, typographie, composition, densité, hiérarchie, géométrie distinctive
   et usage des composants doivent être reproduits fidèlement. Une adaptation
   responsive ou technique est permise seulement si elle conserve ce langage
   et est documentée ; les données de démonstration ne deviennent jamais des
   données métier contractuelles.
5. Les références Atlas du 10 août 2026 deviennent des références historiques
   de comportement et de décisions produit. Elles ne dirigent plus les choix de
   police, de palette ou de composants pour un nouveau développement.

En cas de conflit, l'agent signale le conflit. Il ne modifie pas silencieusement
un contrat pour reproduire une maquette.

## 3. Références visuelles validées

| Lot | Référence | Surfaces |
| --- | --- | --- |
| Produit | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-product-surfaces.html` | Aujourd'hui, Parcours, Programme, Recherche, Notes, Profil |
| Apprentissage | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-learning-flow.html` | Leçon, exercice, correction, révision |
| Entrée et admin | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-entry-admin-surfaces.html` | Entrée, contacts, programmes, administration |
| Évaluation et public | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-evaluation-public-surfaces.html` | Quiz, évaluations, ressources, programme public, recherche publique, graphiques |
| Surfaces V4/V5 | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-v4-final-surfaces.html` | Devis, analyse, résultat, historique, crédits, recharge, confirmation, annonce V5, allocations et coûts admin, états critiques |
| Landing et compte | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-totem-landing-account-components.html` | Landing responsive, création de compte, vérification e-mail, première direction, catalogue de composants |
| Marque | `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-current-logo-optical-revision.html` et `/Users/rayanchambet/.codex/visualizations/2026/08/21/01a02406-0bb7-7021-9d19-15a38fa46705/learnx-logo-totem/` | Logo et icône |

## 4. Registre des conflits résolus

| Conflit | Arbitrage canonique |
| --- | --- |
| Atlas utilisait Manrope, Source Serif 4, papier chaud et laiton | Totem les remplace visuellement par DM Sans et la palette de la section 1. Le contrat émotionnel Atlas reste valide. |
| Le backlog indiquait de ne pas reconstruire le design system en V4 | La décision propriétaire du 21 août autorise sa planification sous V4-016D/E/H. Aucun code n'est toutefois autorisé par cette seule décision. |
| Des maquettes montrent pourcentages, soldes, prix, volumes, preuves ou témoignages | Ce sont des exemples de mise en page. Les composants doivent lire les contrats serveur ou afficher un état neutre/indisponible ; aucune valeur fictive n'est publiable. |
| Des surfaces montrent une correction ou un score | Le runtime actif reste autoritaire : correction formative, score uniquement s'il est calculé par LearnX, aucun effet sur la progression et aucun PASS/FAIL académique. |
| Les surfaces V5 ressemblent à un produit disponible | En V4, elles restent une annonce sans contrôle actif, conformément à V4-016. |

## 5. File ordonnée d'implémentation

V4-016D et V4-016E sont implémentés et validés dans deux commits locaux
ordonnés, en attente d'intégration propriétaire. Une première tranche V4-016B
couvre aussi le shell et les routes admin déjà disponibles ; les surfaces
correction/paiement restent bloquées sur leurs contrats. V4-016C migre les
surfaces produit autorisées sans changer le runtime multi-programmes. Sa
composition de reprise est protégée par une assertion responsive : rail compact
à droite sur desktop, empilement après la priorité sur mobile. Les autres
lots restent `DESIGN_VALIDATED_IMPLEMENTATION_WAIT_GO`. Cette file est parallèle
au chemin critique IA et ne le remplace pas.

| Ordre | Ticket | Pilote | Dépendances | Livrable |
| --- | --- | --- | --- | --- |
| 1 | `V4-016D — Fondations Totem` | `AGENT-DA` | aucune côté design ; réaudit technique avant code | Tokens sémantiques, DM Sans, logo/icône, migration documentée sans valeurs métier |
| 2 | `V4-016E — Primitives Totem` | `AGENT-DA` | V4-016D | Catalogue accessible des composants et états partagés |
| 3 | `V4-016C — Produit principal Totem` | Produit & pédagogie | V4-016D/E | Aujourd'hui, Parcours, Programme, Recherche interne, Notes et Profil |
| 4 | `V4-016F — Apprentissage et évaluations Totem` | Produit & pédagogie | V4-016D/E ; contrats d'évaluation existants | Leçon, exercice, quiz, résultat, révision, ressources et correction formative |
| 5 | `V4-016A — Landing et compte Totem` | `AGENT-DA` | V4-016D/E ; promesses et consentements approuvés | Landing, création de compte, vérification e-mail et première direction |
| 6 | `V4-016I — Recherche et surfaces publiques Totem` | `AGENT-DA` | V4-016D/E ; contenu public réel | Index de recherche, article partageable, programme public, graphiques factuels, nav/footer |
| 7 | `V4-016B — Shell desktop et administration Totem` | `AGENT-DA` | V4-016D/E ; contrats admin disponibles | Shell desktop, tables et formulaires admin responsives |
| 8 | `V4-016G — Correction, crédits et paiement Totem` | `AGENT-DA` | V4-007/010/012/014 stabilisés ; V4-016D/E | Devis, analyse, résultat, historique, crédits, recharge et états critiques branchés aux contrats serveur |
| 9 | `V4-016 — Annonce création de formation V5` | Produit & pédagogie | V4-016D/E ; promesse V5 validée | Annonce V5 non interactive, sans fausse capacité |
| 10 | `V4-016H — QA, adoption et retrait visuel Atlas` | Développement | tous les lots activés | Matrice responsive/accessibilité, non-régression, rollout progressif et rollback |

Les ordres 3 à 7 peuvent être développés en lots distincts après V4-016D/E,
mais jamais simultanément dans les mêmes composants sans propriétaire de merge.
V4-016G reste contractuellement bloqué même si ses maquettes sont validées.

## 6. Catalogue de composants à formaliser

- shell desktop : sidebar, topbar, page-head, contenu et rail ;
- topbar et navigation basse mobile ;
- navigation et footer publics ;
- boutons primaire, secondaire et éditorial ;
- champs `default`, `focus` et `error` ;
- tags toujours libellés ;
- surface signature à angle corail ;
- nœuds et lignes de parcours ;
- progression ;
- cartes éditoriales ;
- retour par critère et preuves issues de la réponse ;
- notices d'attention ;
- tables admin responsives ;
- formulaires avec consentements distincts ;
- états vide, chargement, erreur et sûr.

Chaque primitive expose ses variantes, états, contenu autorisé, comportement au
clavier, focus visible, nom accessible et règle `reduced-motion`. Une variante
ne peut encoder son sens uniquement par une couleur.

## 7. Matrice de validation obligatoire

| Axe | Critère bloquant |
| --- | --- |
| Largeurs | Vérification à 320, 390, 720, 1440 et 1920 px |
| Zoom | Reflow utilisable à 200 %, sans perte d'information ou d'action |
| Clavier | Ordre logique, aucune trappe, action et fermeture accessibles |
| Focus | Indicateur visible sur tout contrôle interactif |
| Contraste | Texte, icônes, bordures utiles et états conformes aux exigences retenues par LearnX |
| Mouvement | Fonctionnement complet avec `prefers-reduced-motion` |
| Signaux | Libellé, icône ou structure en plus de la couleur |
| Responsive | Tables, rails et panneaux deviennent des surfaces mobiles compréhensibles sans scroll horizontal imposé |
| Contenu | FR/EN, textes longs, vide, erreur et données indisponibles testés |

## 8. Règles de données et de promesse

- Aucun prix, capacité, allocation, volume, score, taux, preuve ou témoignage
  n'est codé depuis une maquette.
- Une valeur absente du contrat serveur produit un placeholder neutre ou masque
  la zone selon le ticket ; elle ne déclenche aucune estimation locale.
- Le contenu de démonstration n'est jamais publié comme preuve réelle.
- Les crédits achetés, offerts et réservés restent distincts.
- Une erreur ou un résultat inutilisable ne devient ni réussite, ni correction
  complète, ni débit.
- La correction est décrite comme assistée et formative ; elle ne valide aucune
  maîtrise et ne modifie aucune progression.

## 9. Definition of Done commune

Un ticket Totem n'est terminé que si :

1. ses contrats serveur et de contenu sont identifiés ;
2. ses composants réutilisent V4-016D/E sans dérive locale ;
3. la matrice de la section 7 est couverte et consignée ;
4. les états chargement, vide, erreur, indisponible et sûr sont testés ;
5. aucune valeur de démonstration n'est devenue une règle produit ;
6. lint, typecheck, tests et build passent ;
7. le diff visuel et le rollback sont documentés ;
8. Direction artistique et propriétaire ont rendu les validations exigées par
   le ticket.

Une implémentation n'est pas conforme si elle remplace une primitive montrée
dans la référence par un variant générique de couleur proche. Par exemple, la
prochaine action d'Aujourd'hui utilise obligatoirement la surface signature
papier avec angle corail ; une carte cobalt pâle bordée de bleu n'est pas une
interprétation acceptable de cette primitive.
