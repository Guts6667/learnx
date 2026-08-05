# Candidats LearnX V3

Ce fichier conserve les évolutions volontairement exclues du polish V2. Il ne
constitue pas un backlog détaillé et n’autorise aucune implémentation.

## Nouvelles capacités métier

- Validation scientifique persistée décrite dans
  `SCIENTIFIC_REVIEW_SPEC.md` : historique, empreinte, péremption, badge, détails
  du réviseur, agrégation module et éventuel portail externe.
- Ordre éditorial arbitraire entre blocs, ressources, tâches, exercices et
  évaluations, avec nouveau contrat de données ou migration si nécessaire.
- Cycle de vie avancé du compte : changement de mot de passe, révocation de
  sessions, export, suppression et politique d’inscription.
- Suppression/restauration de notes et workflows de validation humaine avancés.

## Plateforme et exploitation

- Instrumentation analytics complète du parcours, fournisseur, consentement,
  rétention et tableaux de bord.
- Téléchargement privé hors ligne par utilisateur, chiffrement local et file de
  mutations avec résolution de conflits.
- Versionnement optimiste généralisé pour notes, exercices et soumissions.
- Rate limit distribué, gestion avancée des sessions et durcissement HTTP au-delà
  des corrections P0.
- Pagination et observabilité avancées lorsque les volumes réels l’exigent.
- Portail de signature d’un réviseur scientifique externe.

## Conditions avant promotion

Une candidate devient un ticket futur seulement après :

- preuve d’un besoin utilisateur ou opérationnel ;
- décision produit explicite ;
- impact sécurité, données et coût documenté ;
- dépendances V2 achevées ;
- critères d’acceptation et plan de migration/rollback définis.
