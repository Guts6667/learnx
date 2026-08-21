# V4-009B — Gate de l’extension diagnostique

> **CLOSED_REQUEST — NE PAS EXÉCUTER.** La demande `OWNER_GO_REQUIRED` ci-dessous
> est annulée par l'abandon du pipeline composite. Elle n'attend plus aucune
> autorisation et ne doit pas être transmise au Propriétaire.

Date : 2026-08-13

Statut historique : `CANCELLED_SUPERSEDED_NO_EXECUTION`

Cette extension est diagnostique et non promotionnelle. Le `NO-GO` du
mini-panel `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0` reste immuable.
L’extension ne peut ni activer V4-010, ni ouvrir le holdout, ni requalifier le
mini-panel.

## Identité et sources inchangées

- corpus : `learnx-french-text-corpus-v1-3`, SHA-256
  `a78393edbeb6b350fcd8f1d5bb8931c9ddebd8e69cf15e852bc038129c9eb73c` ;
- configuration : SHA-256
  `4da7c60e6fe82702b84d6de4c6879a2243cfb1f436015b5c42fd5cbaae4e464d` ;
- prompt `2.0.0`, protocole `3.0.1`, trigger `1.0.0`, consolidation `1.0.0` ;
- PRIMARY : Mistral Medium 3.5, route Mistral, profil `2.0.0` ;
- vérificateur : Sonnet 4.6, route Anthropic, profil `2.0.0` ;
- aucun fallback, alias, retuning ou changement après résultat.

Le manifeste gelé est
`benchmarks/ai-correction/composite/v4-009b-diagnostic-extension.json` :

- SHA fichier :
  `70f962533ec92c3b0c3edfb007469f49dfb665290b25cb49b0e0f9abbdd1d2a7` ;
- fingerprint canonique :
  `95adbcfded29d1fc6ed9a98c5378d50a441b57a4412fc568e5d7b1322c19d616`.

## Réutilisation prouvée

La matrice contient 72 cellules uniques : 24 cas × 3 répétitions. Les 12
workflows du mini-panel sont déjà terminés et ne seront pas rappelés.

- état mini-panel SHA :
  `4e4586b7376f2c48a44fdadd7d7ced158feb3f2d06119d23fed57913ad9da58b` ;
- ledger mini-panel SHA :
  `0ed390765c282f64d20f4edc70a6b43f995be74bfdf0c9b4b730071ac22e1673` ;
- 12 cellules et 20 tentatives réutilisées ;
- 60 cellules PRIMARY manquantes ;
- le vérificateur reste appelé uniquement par la règle gelée.

Les tests rejettent une empreinte différente et prouvent qu’une reprise ne
réexécute aucun des 20 appels existants.

## Plafonds à autoriser

- coût déjà consommé : `0,2018835 USD` ;
- plafond agrégé : `2,00 USD` ;
- **budget restant exact : `1,7981165 USD`** ;
- tentatives déjà consommées : 20 ;
- maximum agrégé : 180 ;
- **maximum d’appels supplémentaires : 160** ;
- ces limites ne sont pas des quotas à consommer.

Avant chaque appel, le runner vérifie atomiquement le prochain pire coût contre
le plafond agrégé. Le ledger démarre avec les 20 écritures existantes, reste
append-only et chaque nouvel appel reçoit une clé d’idempotence liée au nouveau
fingerprint diagnostique. Une erreur déterministe, une fuite, un coût non
réconcilié ou le prochain appel non garanti sous plafond arrête la campagne.

## Autorisation finale requise

La précédente autorisation du mini-panel ne peut pas démarrer cette extension.
Le runner exige un jeton propriétaire distinct correspondant explicitement au
plafond de 2 USD. Aucun appel ne sera lancé avant réception de la phrase :

> J’autorise l’extension diagnostique V4-009B : 60 cellules PRIMARY restantes,
> 160 appels supplémentaires maximum et un budget restant de 1,7981165 USD sous
> le plafond agrégé de 2 USD.

Après la matrice : arrêt, génération du paquet aveugle diagnostique, revue de
tous les `UNCERTAIN`, faux PASS/FAIL, écarts importants et variations, plus un
échantillon préenregistré d’accords. Aucun holdout ni appel ultérieur sans nouvel
arbitrage.
