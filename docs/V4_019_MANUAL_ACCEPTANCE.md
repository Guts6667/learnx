# V4-019 — Recette manuelle du candidat pré-merge

## Identité de la recette

- **Candidat figé** : `v4a-premerge-2026-08-26-r5`
- **Candidats remplacés** : `v4a-premerge-2026-08-25` et
  les révisions `r1` à `r3`, conservés pour tracer les écarts corrigés pendant
  la recette : carte L-P01, actualisation PWA, fond de la carte Aujourd'hui et
  position de défilement conservée à tort vers Crédits
- **Baseline d'implémentation auditée** : commit pointé par le tag candidat ;
  il prolonge la baseline `f49a4d6f419337df4ebd34d2bf906c470c2df9de`
- **Branche distante** : `origin/dev`
- **Preview** :
  `https://learnx-git-dev-guts6667s-projects.vercel.app/?qa=v4a-r5`
- **Périmètre** : correction formative fr-FR des familles `writing`,
  `reflection`, `practice` et `project`, crédits offerts ; preuve scientifique
  toujours limitée à Writing
- **État attendu de l'IA** : kill switch fermé ; aucun appel modèle n'est requis
  par cette recette
- **Interdit par cette recette** : achat public, ouverture production, appel
  fournisseur, modification de `main`

Cette recette complète les preuves automatisées de
`docs/V4_019_RELEASE_REPORT.md`. Elle recueille le jugement d'usage du
Propriétaire ; elle ne transforme pas le verdict scientifique Writing
`NO-GO` en promotion.

## Parcours public

1. Ouvrir la landing en français, puis en anglais.
2. Vérifier la hiérarchie du hero, l'unique CTA rempli, l'aperçu de programme,
   les trois principes expliqués, la roadmap sombre et les deux formulaires
   distincts.
3. Ouvrir le journal de recherche depuis la landing.
4. Filtrer les publications, ouvrir la dernière publication, utiliser le
   sommaire et vérifier que le partage reste une action secondaire.
5. Vérifier que les articles sont classés du plus récent au plus ancien et que
   les publications historiques restent accessibles.
6. Refaire les points essentiels à largeur téléphone ou depuis un téléphone :
   aucun débordement, menu et actions utilisables, texte non tronqué.

## Parcours authentifié

1. Se connecter puis vérifier Aujourd'hui, Mes parcours et la reprise d'un
   programme en cours.
2. Ouvrir une leçon SourceLab : paragraphes, listes, commandes, sorties et
   blocs de code doivent rester lisibles sans perte de mise en forme.
3. Ouvrir Réviser et vérifier les états vide, disponible et erreur lorsqu'ils
   sont présents dans le compte.
4. Ouvrir Mes crédits : allocation offerte, crédits achetés, disponible total
   secondaire et crédits réservés doivent rester distincts.
5. Si le compte est administrateur, ouvrir Crédits admin et vérifier : état de
   préflight fermé, coûts/incidents visibles, aucune clé fournisseur exposée.
6. Ouvrir une soumission réelle pour chaque famille active disponible. Vérifier
   que le champ annonce la borne de 1 500 caractères et qu'une réponse plus
   longue est refusée avant devis. Consigner honnêtement `reflection` comme non
   testable si aucun exercice actif n'existe encore.
7. Ouvrir une correction primaire déjà réglée. Saisir un argument d'au moins
   20 caractères, vérifier le devis distinct de réexamen et son consentement,
   puis confirmer uniquement si le budget et le kill switch de la recette
   l'autorisent. Après résultat, vérifier que les deux versions restent
   consultables, comparables et qu'un second réexamen n'est plus proposé.
8. Vérifier sur tous ces écrans la distinction entre feedback formatif et
   progression, ainsi que l'absence de tokens et de coût fournisseur.

## Décision de recette

La recette est acceptée si :

- aucun blocage empêche navigation, connexion, apprentissage ou consultation
  des crédits ;
- aucun défaut visuel empêche la lecture ou l'action principale sur téléphone
  et desktop ;
- la recherche, les limites de l'IA et les soldes restent compréhensibles ;
- aucun achat ni appel modèle n'est déclenché à l'insu de l'utilisateur.

Un défaut cosmétique localisé peut être consigné pour V4.1. Un défaut de
consentement, débit, progression, identité modèle, périmètre fr-FR autorisé,
sécurité, unicité du réexamen, accessibilité bloquante ou navigation est
éliminatoire pour V4-019.

## Formulation du prochain GO

Après une recette acceptée, l'autorisation attendue doit nommer le candidat et
rester bornée. Exemple :

> J'accepte la recette manuelle du candidat figé
> `v4a-premerge-2026-08-26-r5`. J'autorise sa promotion unique vers `main` et la
> configuration de production avec le kill switch fermé. Aucun appel modèle
> ni ouverture du pilote n'est autorisé par ce GO.

L'ouverture du kill switch et le smoke production font ensuite l'objet d'un
second GO explicite avec un plafond fournisseur. Cette séparation permet de
déployer le code sans confondre promotion Git et dépense externe.
