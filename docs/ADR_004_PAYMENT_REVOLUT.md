# ADR_004 — Encaissement par checkout hébergé

**Statut** : accepté. Fournisseur **Stripe** depuis le 29 août 2026
(`owner-payment-provider-stripe-2026-08-29`). Le passage en production dépend
des décisions du Propriétaire listées au §8, qui ne sont pas supposées ici.

**Amendée plutôt que remplacée** (V4.5-184) : les décisions des §1 à §3 et §5
à §7bis ne dépendent pas du fournisseur — checkout hébergé, webhook seule
autorité, idempotence par identifiant d'événement, tolérance au désordre,
frontières de données. Seule la section fournisseur change. Les éclater en deux
documents obligerait le prochain lecteur à chercher laquelle fait foi.

## 0. Fournisseur

Revolut Merchant était le choix initial. Aucun compte Revolut Business n'a pu
être ouvert, et le mode test de Stripe ne demande ni compte vérifié ni pièce
d'identité : la recette bout en bout cesse donc d'être bloquée par une
démarche hors de notre contrôle.

L'adaptateur Revolut a été **supprimé**, pas conservé désactivé : un adaptateur
non sélectionné est un chemin que personne n'exécute, contre un fournisseur chez
qui nous n'avons pas de compte — précisément ce que le contrôle de code mort
existe pour attraper. L'historique le conserve :
`git log --diff-filter=D -- 'src/server/payments/revolut-*'`. Un SHA cité ici
serait périmé au premier rebase ; cette commande ne l'est jamais.

Ce que le changement a coûté est la mesure de la qualité de la couture : une
fonction de signature, une table de noms d'événements, un appel de création
d'ordre. Les propriétés testées — signature vérifiée avant lecture, unicité de
l'événement, monotonie des états, coupure — n'ont pas bougé d'une ligne, parce
qu'elles portent sur l'**absence** de garanties du fournisseur, que Stripe
partage.

### Signature Stripe

`Stripe-Signature` porte `t=<secondes>` puis un ou **plusieurs** `v1=<hex>`,
chacun un HMAC-SHA256 de `${t}.${charge utile brute}`. Pendant une rotation de
secret, Stripe signe avec l'ancien **et** le nouveau : un vérificateur qui ne
lirait que la première signature commencerait à rejeter des livraisons
authentiques le jour de la rotation. Toutes sont comparées, une correspondance
suffit, en temps constant.

### Événements

| Stripe | État (ADR_003 §6.3) |
| --- | --- |
| `checkout.session.completed` | `PAID` |
| `checkout.session.expired` | `EXPIRED` |
| `payment_intent.payment_failed` | `FAILED` |
| `charge.refunded` | `REFUNDED` |
| `charge.dispute.created` / `.closed` | `DISPUTED` |

Tout autre événement est conservé pour réconciliation et appliqué à rien : le
vocabulaire de Stripe grandira, et il doit laisser les commandes intactes
plutôt que les corrompre.

`checkout.session.completed` est le dernier mot de Stripe sur l'argent. Aucun
fournisseur n'émet d'événement d'attribution, parce qu'aucun ne sait si
l'apprenant a reçu ses crédits — c'est le même constat que V4.5-161 a corrigé
pour Revolut, et il ne dépend pas du fournisseur.

**Autorité supérieure** : `ADR_003` §6.3 (états de paiement) et §7.3
(frontières de données). Cette ADR ne les redéfinit pas ; elle décrit comment
Revolut s'y branche.

## 1. Décision

LearnX encaisse par **checkout hébergé**. L'apprenant est redirigé vers une
page de paiement opérée par le fournisseur, y saisit ses données de carte, et
revient sur LearnX.

Conséquence directe et non négociable : **aucune donnée de carte n'entre jamais
dans LearnX**, ni en base, ni en journal, ni en mémoire applicative. Le périmètre
PCI de LearnX se réduit à ne pas toucher la donnée, ce qui est le seul périmètre
qu'une exploitation solo peut tenir honnêtement.

## 2. Le webhook est la seule autorité d'attribution

Le retour de navigation après paiement **n'attribue jamais de crédits**. Il ne
prouve rien : un apprenant peut fermer l'onglet avant la redirection, la
rejouer, ou la fabriquer.

Les crédits sont attribués par le **webhook signé** de Revolut, et par lui seul.
Le retour de navigation sert uniquement à afficher un état d'attente, et cet
écart — payé mais pas encore crédité — doit être une chose que l'interface sait
dire, pas un cas qu'elle traite comme une erreur.

## 3. Idempotence et désordre

Revolut ne garantit ni l'unicité ni l'ordre de livraison des événements. Deux
propriétés sont donc exigées du récepteur, et testées :

- **Idempotence par identifiant d'événement.** `payment_event.provider_event_id`
  est unique. Un événement rejoué est enregistré une fois et n'attribue rien une
  seconde fois.
- **Tolérance au désordre.** Les transitions sont **monotones** : un `PAID`
  arrivant après un `FULFILLED` ne fait pas régresser la commande. L'état d'une
  commande est le plus avancé des états observés, jamais le dernier reçu.

Les événements hors séquence sont conservés tels quels pour réconciliation
(ADR_003 §6.3), sans être appliqués.

## 4. États

Repris de `ADR_003` §6.3 sans modification :

```text
CREATED → PENDING → PAID → FULFILLED
              ├─ FAILED
              └─ EXPIRED

PAID | FULFILLED → REFUND_PENDING → REFUNDED
PAID | FULFILLED → DISPUTED → WON | LOST
```

## 5. Signature

Chaque webhook est vérifié avant toute lecture de son contenu :

- signature calculée en HMAC-SHA256 sur la charge utile brute, comparée en
  **temps constant** ;
- horodatage exigé dans une fenêtre de tolérance, pour qu'une capture ancienne
  ne soit pas rejouable indéfiniment ;
- secret lu depuis l'environnement, jamais versionné.

Une signature invalide, absente, ou hors fenêtre est refusée **sans que la
charge utile soit interprétée**. Un webhook non vérifié n'est pas une donnée.

## 6. Coupure

`LEARNX_PAYMENTS_ENABLED` vaut `false` par défaut. Désactivé, aucun ordre n'est
créé et aucun webhook n'est traité — le point d'entrée répond sans rien faire
plutôt que d'échouer, pour qu'un webhook émis pendant une coupure ne s'accumule
pas en erreurs chez le fournisseur.

La coupure est indépendante du coupe-circuit de correction (V4.5-140) : l'un
suspend une fonctionnalité qui coûte, l'autre suspend l'encaissement. Les
confondre reviendrait à rendre l'argent otage d'un incident de qualité, ou
l'inverse.

## 7. Ce que LearnX conserve

Référence d'ordre, montant, devise, pack acheté, identifiants d'événement,
horodatages, et le corps brut de l'événement **après vérification de signature**,
pour réconciliation. Jamais : numéro de carte, cryptogramme, nom du porteur,
empreinte de carte, ni aucune donnée transmise par Revolut qui les approcherait.

## 7bis. Remboursements et litiges (V4.5-162)

Le registre de crédits n'est **jamais réécrit** (ADR_003 §6). Un remboursement
ajoute une écriture `REFUND` ; il ne modifie pas l'attribution qu'il compense.
Ce qui s'est passé reste lisible, y compris quand ce qui s'est passé était une
erreur.

### Remboursement volontaire

Décision du Propriétaire du 29 août 2026 (`owner-refund-policy-2026-08-29`) :
seule la part non consommée est remboursée.

```text
montant = prix du pack × crédits non consommés ÷ crédits du pack
```

**Arrondi au centime, moitié vers le haut**, calculé en entiers sans flottant.
La règle est énoncée ici et implémentée une seule fois (`voluntaryRefundMinor`) :
une règle d'arrondi re-dérivée finit par différer entre deux endroits, et
l'écart ne se voit que sur les centimes, c'est-à-dire jamais avant qu'il ne
compte.

Sous cette politique, un remboursement volontaire ne peut pas produire de
perte : les crédits repris sont exactement les non consommés.

### Litige et rejet bancaire

Le montant est celui de la banque, pas le nôtre. LearnX reprend ce qui reste sur
le lot et **absorbe la part déjà consommée** : un apprenant remboursé ne doit
pas se retrouver débiteur de crédits.

Cette part absorbée est inscrite dans `payment_orders.written_off_credits`, et
non au registre. Le solde d'un compte est la somme des montants d'écritures :
une écriture de perte déplacerait le solde du montant même qu'on déclare
irrécupérable. C'est un fait d'argent, pas un fait de crédits.

### Ouverture de litige

Ne touche à rien. Seule l'issue agit : un litige gagné doit laisser les choses
exactement comme elles étaient.

## 8. Décisions du Propriétaire, non supposées ici

Ces points sont **ouverts**. Le code ne les tranche pas et n'en dépend pas.

1. **Statut d'exploitation et régime fiscal** — BIC ou BNC. Détermine la
   facturation, la comptabilité et le libellé des reçus.
2. **TVA** — assujettissement, taux applicable, mentions obligatoires, et
   traitement des ventes hors France. Un prix affiché sans savoir s'il est TTC
   est une décision, pas un détail d'affichage.
3. **Conditions générales de vente** — droit de rétractation sur un contenu
   numérique et sa renonciation expresse. La politique de remboursement est
   tranchée (§7bis) ; sa formulation contractuelle reste à écrire.
4. **Compte Stripe** — création et fourniture de `STRIPE_TEST_SECRET_KEY` et
   `STRIPE_TEST_WEBHOOK_SECRET`, en environnement d'aperçu uniquement. Le mode
   test ne demande pas de vérification d'identité. La passe réelle est la
   dernière étape (`docs/qa/V4_5_160_SANDBOX.md`).

Aucune de ces décisions n'est prise par défaut dans le code. Là où il faut une
valeur, elle est lue depuis la configuration et absente par défaut.
