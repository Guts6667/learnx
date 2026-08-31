# Passation — Head of UX/UI — 31 août 2026

## a. Tâche en cours : V4.5-213

Spécification validée, pas encore écrite. Cartes de paliers sur `/credits` et
dans la section tarifs de la landing, dans cet ordre : nom (petit) → crédits
(gros) → prix → « 110 crédits par euro » sur les trois → bonus s'il existe →
« environ 29 corrections » → condition avant l'achat → action.

- **Libellés** (en base, sur #175) : Premier pack / Pack standard / Grand pack —
  First pack / Standard pack / Large pack.
- **Trois boutons de même poids**, raison écrite dans le code : cette zone est
  un choix entre égaux, pas un entonnoir. Mettre en avant le plus gros palier
  pousserait vers la dépense la plus élevée, « le plus populaire » inventerait
  une popularité ; la marque interdit les deux. Écart assumé à « une action
  dominante par zone » — sans la raison écrite, on le « corrigera » plus tard
  sans savoir que c'était un choix.
- **Note partagée** sous la grille : « Une correction est devisée à 30 crédits
  et en réserve 45 ; ce qui n'est pas utilisé vous est rendu aussitôt. »
- **Landing sans bouton d'achat** : un visiteur anonyme ne peut pas acheter,
  l'action reste la demande d'accès.
- **Copies FR/EN** — avant l'achat : « Un seul achat par compte : à ce montant,
  les frais fixes du paiement absorbent une part disproportionnée. » ; une fois
  acheté : « Déjà acheté. Ce pack est limité à un achat par compte. Les autres
  paliers restent disponibles. » ; refus 409 : « Ce pack est limité à un achat
  par compte, et le vôtre a déjà été utilisé. Aucun montant n'a été prélevé. »

## b. Fusionné aujourd'hui

- **#150 (204)** — écran d'achat : paliers, paiement, retours, historique.
- **#153 (206)** — section tarifs publique + `GET /api/public/credit-packs`.
- **#155 (207)** — l'écran connaît la vente fermée avant le clic.

## c. Blocages

213 attend #175 : `labelEn`, `purchasable` par palier, et cinq chiffres dérivés
côté serveur (`creditsPerEuro`, `bonusCredits`, `approximateCorrections` par
palier ; `correctionQuoteCredits` et `correctionReservationCredits` une fois).
Sans eux, trois lignes sur huit exigeraient des constantes inventées.

## d. Erreurs et leçons

- **Le cache de 206 n'a jamais existé.** J'ai posé `Cache-Control: public,
  max-age=300` et testé l'application **isolée** ; le middleware `app.use('*')`
  de `src/server/api/app.ts` pose `private, no-store` **après** le handler et
  écrasait tout. La landing interrogeait la base à chaque visite. Corrigé par le
  Head of Development (`fix/v4-5-cache-header-overwrite`). Leçon : ce qu'un
  middleware peut défaire ne s'affirme que depuis l'application **assemblée**.
- **Refuser d'inventer une API paie** : sur 162 comme sur 213, un rapport de
  manque a donné de meilleurs contrats que deviner.

## e. Besoins

#175 fusionnée, et l'arbitrage de Rayan sur la phrase du remboursement (h).

## f. Prochaine étape

Écrire 213 dès #175 fusionnée : une PR, sans `[deploy]`. Environ une demi-heure
de code et de tests, plus un aller-retour CI pour les baselines visuelles.

## g. À savoir pour le successeur

- **Garde 162** : `src/pages/credits-surfaces.test.ts` interdit toute
  arithmétique sur `priceMinor` dans l'écran apprenant — d'où les chiffres
  **servis**, jamais calculés.
- **Route publique** `/api/public/credit-packs` : seule surface tarifaire
  lisible sans session, préfixe `public`, sans cookie, lue par la landing.
- **Baselines visuelles** : CI Linux uniquement (`visual.yml`, dispatch
  `update: true`), jamais localement sur Mac.
- **`route-guards.test.ts`** : liste **fermée** des routes publiques ; toute
  nouvelle s'y déclare avec sa raison, sinon la CI rougit.
- **`tests/e2e/credits.spec.ts` et `landing.spec.ts` ne tournent dans aucun job
  CI** (seul `test:e2e:research`). C'est V4.5-208, chez DevOps.

## h. Décisions orales de Rayan

- **Limite du pack à 3 €** : un seul achat par compte — retirée puis rétablie
  dans la minute le 31 août 2026.
- **En attente** : un remboursement ne restaure pas ce droit (contrôle
  `fulfilledAt IS NOT NULL`). Deux phrases prêtes, aucune publiée sans son mot.
