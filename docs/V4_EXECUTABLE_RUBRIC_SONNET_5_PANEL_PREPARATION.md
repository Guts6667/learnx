# Préparation du panel Sonnet 5 — evidence researcher 1.3

Statut : `OFFLINE_READY / PRODUCT_NOT_ARBITRATED / FINANCE_NOT_ARBITRATED / OWNER_NOT_GRANTED`.

## But

Mesurer Sonnet 5 sur les mêmes dix cas synthétiques qui ont discriminé Gemini,
sans modifier la rubrique, le pseudo-oracle, le prompt ou le protocole de
citations exactes. Cette campagne est une identité nouvelle parce que le
screening a montré que l'omission du paramètre de raisonnement laisse Sonnet
utiliser un comportement fournisseur par défaut.

## Identité préenregistrée

- campagne : `learnx-writing-fr-sonnet-5-evidence-researcher-panel-v1` ;
- manifeste : `sonnet-5-evidence-researcher-panel.v1.json` ;
- SHA-256 :
  `6c1000523194bdacaa01ccb13f5445fa12fad782bf84f5d57fa6c5239c9966a9` ;
- modèle : `anthropic/claude-sonnet-5` ;
- snapshot attendu : `anthropic/claude-sonnet-5-20260630` ;
- route unique : `Anthropic`, sans fallback ;
- prompt et protocole : `1.3.0`, inchangés ;
- profil : `evidence-researcher-sonnet-5-2.0.0` ;
- raisonnement : `PROVIDER_DEFAULT/UNSPECIFIED`, sans paramètre explicite ;
- température omise, sortie totale bornée à 2 500 tokens, cible visible 1 800,
  timeout 60 secondes ;
- aucun retry et aucun résultat historique réutilisé.

## Matrice 10 × 2

Les dix cas sont exécutés dans l'ordre préenregistré, deux fois chacun :

1. base maîtrisée ;
2. paraphrase maîtrisée ;
3. réponse concise maîtrisée ;
4. typographie/Unicode maîtrisés ;
5. absence explicite de choix ;
6. mutation de preuve ;
7. mutation de raisonnement ;
8. contradiction ;
9. injection directe ;
10. injection Unicode.

Le runner s'arrête au premier défaut déterministe de structure, preuve,
sécurité, identité, transport, persistance ou coût. Un désaccord sémantique
`VALID` reste mesuré afin de calculer les gates préenregistrés ; il n'est jamais
retryé.

## Gates

- `20/20` workflows utilisables ;
- accord atomique au moins `95 %` sur `180` statuts ;
- citation exacte, clés connues, sécurité injection/canari et réconciliation à
  `100 %` ;
- zéro faux `SUPPORTED`, au plus deux faux `NOT_DEMONSTRATED` ;
- variabilité au plus `10 %` des dix cas ;
- aucune proposition de niveau, score, PASS/FAIL ou progression ;
- aucun retry, fallback, holdout ou retuning post-résultat.

## Enveloppe proposée

- coût R&D attendu : `0,50 USD` ;
- borne pessimiste par appel : `0,04606 USD` ;
- borne pessimiste pour 20 appels : `0,9212 USD` ;
- hard cap proposé : `0,95 USD` ;
- maximum : `20` appels.

Ces valeurs ne sont ni un prix ni une autorisation. Produit/pédagogie, Finance
et le propriétaire doivent arbitrer l'empreinte exacte avant tout appel.
L'exécution réseau, le holdout, la production, V4-010 et V4-002 restent fermés.

## Validation hors ligne

```bash
pnpm ai:evidence:sonnet:panel:validate
```

La commande valide les SHA, le corpus sélectionné, le payload OpenRouter sans
`reasoning` ni `temperature`, la route, les gates et la borne budgétaire. Elle
ne lance aucun appel sans `--execute` et le token propriétaire exact dérivé du
SHA de campagne.
