# V4-003E-Q1 — autorisation du gate réseau Gemini 3.6

Statut initial : `GRANTED_SINGLE_USE_UNCONSUMED`.

Rayan autorise le gate quatre cas de l'identité
`ef88a8e3b1bfd57ddc4afe787d8a920ea4b329e3d83b28b3fc4029487e88e9ed`
depuis la baseline
`f6607b9c086cffce1f81ac9a8c2fc36194fe5a25`.

La portée est strictement bornée :

- modèle `google/gemini-3.6-flash`, snapshot
  `google/gemini-3.6-flash-20260721` ;
- route `google-vertex/global`, provider attendu `Google` ;
- quatre appels séquentiels maximum ;
- aucun retry ou fallback ;
- arrêt au premier défaut ;
- plafond fournisseur total single-use `0,50 USD` ;
- aucun panel `10 × 2`, holdout ou lancement V4-010.

L'autorité machine additive est
`writing-framework-selection-gemini-3-6-network-authorization.v1.json`. Son
empreinte est
`a1450be22b255ad7c20d43a76aafc8ea05fa4f5b4af8183b25a1887245b7c906`.
Elle impose un identifiant et un répertoire de run uniques. Toute reprise doit
donc relire le ledger existant et ne peut créer une seconde campagne avec la
même autorisation.

L'autorisation ne modifie pas l'enveloppe Finance ni les dossiers historiques.
Le résultat et la consommation effective sont consignés séparément après
l'arrêt ou le succès du gate.

## Consommation

L'autorisation a été consommée le 22 août 2026 par un seul appel. Le gate s'est
arrêté sur `PROVIDER_HTTP_400 / RECONCILIATION_REQUIRED` et les trois appels
restants n'ont pas été envoyés. Elle n'est plus réutilisable. Voir
`V4_003E_Q1_GEMINI_3_6_NETWORK_GATE_RESULT.md`.
