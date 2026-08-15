# Résultat du smoke Gemini chercheur de preuves 1.3.0

Statut au 14 août 2026 : `APPROVED_POSITIVE_SMOKE_ONLY`.

Ce résultat prouve le fonctionnement du contrat de citations exactes sur un cas
positif évident. Il ne constitue ni une promotion de Gemini, ni une preuve de
discrimination négative ou de sécurité injection. Il n'autorise aucun nouvel
appel, panel 10×2, holdout ou activation produit.

## Exécution

- campagne SHA-256 :
  `8694b09458a572687c9846292424bfa694b790a94076271739036553fc370087` ;
- cas : `writing-fr-base-mastered` ;
- modèle demandé : `google/gemini-3.6-flash-20260721` ;
- route unique : `google-vertex/global` ;
- profil : `evidence-researcher-1.1.0`, raisonnement `minimal` ;
- une tentative, aucun retry ni fallback ;
- borne pessimiste : 0,0172545 USD ; plafond dur : 0,0200000 USD.

L'unique tentative est `VALID`, avec `stoppedReason=null`. Le fournisseur a
retourné l'alias autorisé `google/gemini-3.6-flash` sur le provider `Google`.

## Résultat

- 9 éléments de rubrique présents exactement une fois ;
- 6 statuts `SUPPORTED`, 3 `NOT_DEMONSTRATED` ;
- 7 certificats de preuve reconstruits depuis des citations exactes uniques ;
- aucune citation du contexte présentée comme réponse apprenant ;
- raw reçu et persisté avant validation, non tronqué ;
- tokens : 2 020 entrée, 0 raisonnement, 690 sortie visible ;
- latence : 1 239 ms ;
- coût réel réconcilié : 0,0041025 USD ;
- budget non consommé et non transférable : 0,0158975 USD.

Produit/pédagogie confirme la fidélité des neuf statuts et l'indépendance des
éléments. Finance clôture l'enveloppe `RECONCILED / CLOSED`, sans coût orphelin.

## Preuves scellées

- state SHA-256 :
  `eb43f6c380942f603cd0b8da98bb9528bef3ef0a6d55ab7a13542e4cad9ad17d` ;
- ledger SHA-256 :
  `501969a4f1b9475e464a3ae1375e233bac5824dfe65dc3e73e7aee848c34f0c2` ;
- dernier record hash :
  `a8e8b73befe30c4edb997953b807ec64b619ecc1389c60e86daa651cc55c2ca3` ;
- reçu raw SHA-256 :
  `842f30b6f25db76d2723e6b7399155afd7c26e5e0b4d7fb786f7ffbc69b2359e` ;
- contenu raw SHA-256 :
  `2ccfa8505d0fb653a12ec5bebf6e4d531e936be0efbc5673cb753e7dccc5f565`.

Le résumé machine suivi est
`benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.3.result.json`.

## Suite autorisable, mais non autorisée ici

Seule la préparation d'une campagne distincte « maîtrisé + négatif + injection »
est permise. Elle doit conserver modèle, route, profil, prompt et rubrique,
préenregistrer ses cas et recevoir une nouvelle enveloppe Finance puis un GO
propriétaire écrit. Le présent appel ne peut pas être réutilisé silencieusement
comme cellule de ce nouveau gate.
