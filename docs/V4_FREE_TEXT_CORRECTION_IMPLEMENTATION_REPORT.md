# V4 — Rapport d'implémentation de la correction des productions libres

- Statut : `CURRENT_STATUS`
- Date : 26 août 2026
- Branche : `codex/totem-three-authorities`
- Périmètre : runtime formatif fr-FR, sans effet sur la progression

## Résultat livré

La correction assistée n'est plus liée à un exercice pilote unique. Après une
soumission, LearnX la propose pour les quatre familles de productions textuelles
libres suivantes : `writing`, `reflection`, `practice` et `project`.

Le runtime résout désormais un contrat effectif de manière déterministe :

1. un contrat spécialisé publié et exactement lié à l'exercice est utilisé ;
2. un contrat explicite invalide, brouillon ou mal lié bloque la correction ;
3. en l'absence de contrat explicite, un archétype versionné est compilé depuis
   la consigne et le contexte de la leçon.

L'identité de cet archétype est adressée par son contenu : une modification de
consigne, de titre, d'objectifs ou de contexte invalide le devis antérieur.

Les quatre archétypes partagent deux critères de qualité — réponse à la consigne
et fidélité — puis ajoutent un critère propre à la famille. Les quiz et activités
non productives restent corrigés par leurs mécanismes déterministes.

## Parcours utilisateur couvert

- l'éligibilité est calculée sur chaque exercice concerné ;
- le devis utilise le même contrat que l'exécution ;
- le plafond est réservé avant l'appel ;
- le champ affiche un compteur et la limite tarifable de 1 500 caractères,
  également vérifiée par le serveur ;
- le résultat structuré et le règlement sont affichés après exécution ;
- une actualisation retrouve la dernière correction réglée sans nouvel appel ni
  nouveau débit ;
- les coûts fournisseur, tokens et signaux internes ne sont pas exposés à
  l'apprenant.

## Garde-fous conservés

- français et texte uniquement ;
- identité modèle/fournisseur/prompt épinglée ;
- citations issues de la réponse ;
- aucune écriture dans la progression ou la maîtrise ;
- aucun fallback silencieux de contrat ;
- aucun résultat livré avant règlement final ;
- aucune promotion scientifique revendiquée hors Writing.

## Validation exécutée

- `pnpm lint` : vert ;
- `pnpm typecheck` : vert ;
- recette authentifiée hors ligne des quatre familles : 4/4 vertes ;
- frontière de saisie V4 : 1 500 accepté, 1 501 refusé avant tout devis, sans
  troncature ni mutation du brouillon ;
- suite Vitest complète : 148 fichiers, 933 tests verts avec
  `NODE_OPTIONS=--no-experimental-webstorage` ;
- `pnpm build` : vert ;
- E2E existants : 66 verts, 33 ignorés et 9 échecs de navigation/UI déjà
  présents sur la branche (`Découvrir`, lien `Accueil`, retour à la leçon).

Les neuf échecs E2E ne traversent pas le chemin de correction et ne remettent
pas en cause les tests unitaires et d'intégration de ce lot. Ils restent néanmoins
un gate de release à résoudre dans le chantier UI avant `main`.

## Limites encore ouvertes

1. La V4 borne explicitement les réponses à 1 500 caractères. La frontière
   client/serveur est prouvée par `docs/V4_010_R2_INPUT_LIMIT.md`. Une classe
   tarifaire longue reste une extension future soumise à calibration.
2. Seule Writing dispose d'une preuve expérimentale scellée. Les trois autres
   familles sont un rollout produit surveillé décidé par le Propriétaire.
3. Le runtime restitue la dernière correction réglée ; la comparaison complète
   de plusieurs corrections et la contestation argumentée prévues par V4-010
   restent à implémenter.
4. Aucune activation de `main`, aucun prix public et aucun appel modèle ne sont
   réalisés par ce lot.
5. La recette `dev` ne peut pas encore couvrir un exercice `reflection` actif :
   l'unique occurrence inventoriée appartient à un programme encore `draft`.

## Prochain gate recommandé

Avant la release, effectuer sur `dev` la recette propriétaire réelle couvrant
une actualisation, un solde insuffisant et un incident sans résultat. Le gate
automatique des quatre familles est consigné dans
`docs/V4_010_R1_ACCEPTANCE.md`. La couverture réelle de `reflection` exige une
décision explicite sur un exercice actif ou une fixture de développement. Cette
recette ne doit pas être présentée comme un nouveau benchmark scientifique.
