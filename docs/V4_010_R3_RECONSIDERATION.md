# V4-010-R3 — Contestation argumentée et réexamen unique

- Statut : `IMPLEMENTED_PENDING_OWNER_RECIPE`
- Date : 26 août 2026
- Portée : productions libres fr-FR éligibles, crédits offerts uniquement

## Décision produit

Une correction réglée peut faire l'objet d'un unique réexamen argumenté. Ce
réexamen n'est ni un chat, ni un retry gratuit, ni une modification de la
réponse : il constitue une nouvelle action tarifée, précédée de son propre
devis et conservée dans l'historique.

Le contrat borné est le suivant :

- une contestation au maximum par correction primaire `STANDARD` ;
- argument obligatoire, trimé, de 20 à 500 caractères ;
- même utilisateur, même soumission immuable et même rubrique versionnée ;
- réévaluation indépendante de tous les critères ;
- la correction précédente et l'argument servent uniquement à identifier le
  point disputé et ne constituent jamais une preuve ;
- aucune information absente de la soumission originale ne peut être ajoutée
  par la contestation ;
- nouveau devis `RECONSIDERATION`, estimation pilote de `3` crédits et réserve
  maximale de `6`, prélevés uniquement sur l'allocation offerte ;
- la correction primaire et le réexamen restent tous deux consultables et
  comparables ; aucun résultat n'est écrasé.

## Autorité technique

La relation source→réexamen est persistée et protégée par une contrainte unique
en base. Le devis persiste séparément l'identifiant source et l'argument. Les
contraintes SQL refusent les couples incomplets, les arguments hors bornes et
un contexte de réexamen attaché à une autre action.

Le prompt primaire reste `2.2.0`. Le réexamen ajoute une extension explicitement
versionnée `1.0.0`, conservée dans le snapshot de prompt et dans l'identité du
catalogue. Cette extension rappelle que seule la production originale fait
autorité pour les preuves.

Un échec réseau peut rejouer idempotemment le même devis. Il ne crée ni une
seconde contestation, ni une nouvelle réservation. Un second réexamen ou un
réexamen d'un réexamen est refusé côté serveur.

## Validation automatique

- schéma de requête : bornes 20/500 et correspondance stricte action/contexte ;
- service de devis : incohérences refusées avant création ;
- base : source immuable, unicité et contraintes de cohérence ;
- prompt : argument et correction antérieure explicitement non probants ;
- interface : bouton inactif avant 20 caractères, devis distinct, consentement
  distinct, historique étiqueté et disparition de l'action après exécution ;
- aucune écriture dans la progression et aucune exposition des tokens, du coût
  fournisseur ou de l'identité du modèle.

## Limites assumées

Le tarif pilote du réexamen réutilise prudemment la calibration courte de la
correction primaire ; aucune calibration commerciale dédiée ni achat de crédit
n'est activé. Ce lot ne constitue pas un nouveau benchmark scientifique et
n'autorise aucun appel modèle. La recette propriétaire sur `dev` reste requise
avant la promotion vers `main`.
