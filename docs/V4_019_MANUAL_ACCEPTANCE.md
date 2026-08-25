# V4-019 — Recette manuelle du candidat pré-merge

## Identité de la recette

- **Candidat figé** : tag `v4a-premerge-2026-08-25-r1`
- **Candidat remplacé** : `v4a-premerge-2026-08-25`, conservé uniquement pour
  tracer le défaut de proportions de la carte L-P01
- **Baseline d'implémentation auditée** :
  `f49a4d6f419337df4ebd34d2bf906c470c2df9de`
- **Branche distante** : `origin/dev`
- **Preview** :
  `https://learnx-git-dev-guts6667s-projects.vercel.app/?qa=f49a4d6f`
- **Périmètre** : pilote Writing/fr-FR, crédits offerts, feedback formatif
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
6. Ouvrir l'exercice pilote « Choisir sans forcer un cadre ». Vérifier le
   devis, le consentement, la distinction entre correction formative et
   progression, sans confirmer une nouvelle correction pendant cette recette.

## Décision de recette

La recette est acceptée si :

- aucun blocage empêche navigation, connexion, apprentissage ou consultation
  des crédits ;
- aucun défaut visuel empêche la lecture ou l'action principale sur téléphone
  et desktop ;
- la recherche, les limites de l'IA et les soldes restent compréhensibles ;
- aucun achat ni appel modèle n'est déclenché à l'insu de l'utilisateur.

Un défaut cosmétique localisé peut être consigné pour V4.1. Un défaut de
consentement, débit, progression, identité modèle, périmètre Writing/fr-FR,
sécurité, accessibilité bloquante ou navigation est éliminatoire pour V4-019.

## Formulation du prochain GO

Après une recette acceptée, l'autorisation attendue doit nommer le candidat et
rester bornée. Exemple :

> J'accepte la recette manuelle du candidat figé
> `v4a-premerge-2026-08-25-r1`. J'autorise sa promotion unique vers `main` et la
> configuration de production avec le kill switch fermé. Aucun appel modèle
> ni ouverture du pilote n'est autorisé par ce GO.

L'ouverture du kill switch et le smoke production font ensuite l'objet d'un
second GO explicite avec un plafond fournisseur. Cette séparation permet de
déployer le code sans confondre promotion Git et dépense externe.
