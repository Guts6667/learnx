# Résultat du gate Sonnet 5 à raisonnement borné

## Verdict

Le gate est clos en `NO_GO_TECHNICAL_REQUEST_PROFILE`. Il ne constitue pas un
verdict pédagogique négatif sur Sonnet 5 : la sortie n'a pas franchi le contrôle
d'usage et n'a donc pas été évaluée contre le pseudo-oracle.

La campagne `learnx-writing-fr-sonnet-5-bounded-evidence-researcher-four-case-v1`
est liée à l'empreinte
`a49120928481a6ff41c231af5c51f748e8ca9ea6065ea3f097407fb523dcf5c4`.
Elle utilisait le profil `evidence-researcher-sonnet-5-3.0.0`, avec un maximum
explicite de `1 024` tokens de raisonnement, une réserve de `1 800` tokens
visibles et une limite totale de `2 824` tokens.

## Exécution du 16 août 2026

Run : `2026-08-16T07-55-27-707Z`.

- `1/4` appel fournisseur envoyé ; `0/4` workflow terminé ;
- aucun retry, fallback ou second appel ;
- route demandée et fournisseur observé : Anthropic ;
- `3 852` tokens d'entrée, `1 082` tokens de raisonnement et `758` tokens
  visibles ;
- dépassement du maximum de raisonnement : `58` tokens, soit `5,66 %` ;
- sortie totale : `1 840`, sous la limite totale de `2 824` ;
- arrêt : `EVIDENCE_RESEARCHER_REASONING_BUDGET_EXCEEDED` ;
- coût fournisseur réel et réconcilié : `0,026104 USD` ;
- un `CALL_INTENT` et un `CALL_OUTCOME`, sans opération orpheline.

Le raw reçu est borné et non tronqué. Il reste conservé pour le diagnostic,
mais ses statuts et citations ne sont pas comptés comme une mesure de qualité,
car le profil a échoué avant la validation sémantique.

## Empreintes de preuve

- state : `d60d66b4c2dbf5cba95dba5be1d881c73ca3ba05ad4b8948788fa93fe7cc8b3c` ;
- ledger : `f8c7e46ba01a407edd0aa949e7cc4e838ab152601b62188158e0a6e085b328ac` ;
- dernier record du ledger :
  `0413106f95f7feef1149737d85a98208244e9fa1342cb95c1b2431ba458cc47b` ;
- raw : `3c0efd17d1173d41a7b7a703dfab84d9880a9d715075a10f93a92fb93ea3be31`.

Les artefacts canoniques se trouvent dans
`benchmarks/ai-correction/results/evidence-researcher-sonnet5-bounded-gate/2026-08-16T07-55-27-707Z/`.

## Conséquence

L'enveloppe financière est réconciliée et fermée. Son reliquat n'est pas
réutilisable. Aucune reprise, relaxation de la limite, nouvelle campagne,
extension 10×2 ou ouverture du holdout n'est autorisée.

Après deux échecs techniques de profils Sonnet 5, la suite n'est plus un
retuning de profil ni une recherche large de modèles. Elle requiert un
arbitrage explicite entre :

1. un MVP déterministe plus étroit, indépendant de ce chercheur de preuves ;
2. une révision d'architecture ou de route, sous une nouvelle identité et avec
   de nouvelles preuves de capacité avant toute dépense.

V4-010, le holdout et la promotion d'un pipeline restent fermés.
