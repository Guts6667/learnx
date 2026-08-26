# V4-010-R1 — Recette des quatre familles de productions textuelles

- Statut : `AUTOMATED_GATE_PASSED` / `DEV_RECIPE_OPEN`
- Date : 26 août 2026
- Périmètre : `writing`, `reflection`, `practice`, `project`
- Coût fournisseur : `0 USD` — transport simulé, aucun appel externe

## Résultat

La recette authentifiée hors ligne rejoue le même cycle pour chacune des quatre
familles :

1. lecture de l'exercice et contrôle de son éligibilité ;
2. création, sauvegarde et remise de la réponse ;
3. génération serveur d'un devis en crédits ;
4. réservation du plafond ;
5. correction structurée par le runtime avec transport simulé ;
6. règlement du devis et restitution de la différence ;
7. rechargement de la dernière correction sans nouvel appel ni nouveau débit.

Résultat : **4 familles sur 4 passent**. La correction ne produit aucune
écriture de progression supplémentaire et les réponses apprenant n'exposent ni
modèle, ni fournisseur, ni coût fournisseur, ni tokens.

Preuve automatisée :
`api/free-text-correction.acceptance.test.ts` — 4 tests verts.

## Ce que cette preuve ne démontre pas

- Elle ne constitue pas un benchmark pédagogique des quatre familles : seule
  `writing` dispose de la preuve expérimentale scellée.
- Elle ne teste pas un appel modèle réel ni la configuration secrète de `dev`.
- Elle ne couvre pas les réponses supérieures à 1 500 caractères, la
  contestation ou la comparaison de plusieurs corrections.

## Inventaire des contenus disponibles

Les bundles actifs contiennent actuellement :

| Famille | Exercices actifs trouvés | Situation pour la recette `dev` |
| --- | ---: | --- |
| `writing` | 63 | testable |
| `practice` | 118 | testable |
| `project` | 67 | testable |
| `reflection` | 0 | non testable sur un programme actif |

Un exercice `reflection` existe dans
`pilotage-projets-ia-iso-42001`, mais ce programme est encore `draft`. Il ne
doit pas être publié ou remplacé par une donnée artificielle pour fermer le
ticket sans décision pédagogique explicite.

## Gate restant

La preuve automatique autorise la recette propriétaire sur `dev`, sans la
remplacer. Cette recette doit encore confirmer une correction réelle, une
actualisation, un solde insuffisant et un incident sans résultat. Pour couvrir
`reflection`, il faut soit publier intentionnellement un exercice éligible,
soit autoriser une fixture de recette strictement limitée à l'environnement de
développement.
