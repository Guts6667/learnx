# V4-009C — Préparation du panel Gemini evidence researcher 10×2

- **Statut** : `OFFLINE_READY / FINANCE_NOT_ARBITRATED / OWNER_NOT_GRANTED`
- **Date** : 15 août 2026
- **Portée** : préenregistrement et validations hors ligne
- **Appels modèle** : aucun

## Résultat de la préparation

Le panel est défini sous une identité nouvelle et reste inexécutable. Il
conserve Gemini comme chercheur de preuves uniquement ; LearnX valide les
citations et calcule les niveaux, le score et le feedback authoré.

L'ambiguïté d'observabilité du gate v2 est corrigée pour les futurs artefacts :

- `requestedRoute` enregistre la route épinglée dans la requête
  (`google-vertex/global`) ;
- `observedProvider` enregistre l'étiquette renvoyée par OpenRouter (`Google`) ;
- `providerRoute` reste lisible uniquement pour la rétrocompatibilité des
  artefacts historiques et n'est plus utilisé comme preuve des deux notions.

La requête continue d'imposer une seule route et `fallback=false`. Cette
séparation améliore la preuve d'exécution mais ne prétend pas attester un
sous-endpoint que le fournisseur ne renvoie pas lui-même.

## Corpus v2 composé sans réécriture historique

Le panel contient dix cas, deux répétitions chacun. Son manifeste de sélection
référence deux sources immuables par SHA-256 :

- neuf cas stables du corpus sémantique v1 ;
- la fixture négative atomique `writing-fr-no-choice-negative` du corpus trois
  cas v2.

Le cas historique `writing-fr-decision-mutation`, jugé non discriminant, est
explicitement exclu. Aucun ancien corpus, gold ou résultat n'est modifié.

- manifeste de sélection :
  `writing-fr-semantic-development.v2.manifest.json` ;
- SHA-256 :
  `d8266d0387330aaa7da477d91b8af99bec24ca065c0c0ed4206d32bf157573dd` ;
- holdout : `PROHIBITED`.

## Identité du panel

- campagne : `learnx-writing-fr-gemini-evidence-researcher-panel-v2` ;
- manifeste : `gemini-evidence-researcher-panel.v1.3-v2.json` ;
- SHA-256 :
  `ef270fff14334badbd776e05d3a28f0c0af8e201fc7036fdaec2f77c8b019d15` ;
- modèle : `google/gemini-3.6-flash-20260721` ;
- route demandée : `google-vertex/global` ;
- fournisseur observé attendu : `Google` ;
- prompt/protocole : `1.3.0` ;
- profil : `evidence-researcher-1.1.0`, reasoning `MINIMAL`, température
  omise, 2 500 tokens totaux, 1 800 visibles, timeout 60 secondes ;
- fallback : interdit ;
- workflows : 10 cas × 2, zéro résultat historique réutilisé.

## Budget proposé et écart à arbitrer

Le ticket conserve la proposition historique : coût attendu `0,20 USD`, hard
cap `0,50 USD`, 30 tentatives maximum. Le préflight basé sur le plus grand
prompt réel calcule :

- borne pessimiste par tentative : `0,0172725 USD` ;
- 20 appels initiaux : `0,34545 USD`, sous le hard cap ;
- 30 tentatives : `0,518175 USD`, au-dessus du hard cap ;
- maximum admissible sous `0,50 USD` au pire cas : 28 tentatives.

Ce n'est pas une erreur masquée : les 20 cellules initiales sont finançables
sous la proposition, mais tous les retries théoriques ne le sont pas. Finance
doit arbitrer le couple plafond/nombre de tentatives avant tout GO. Le préflight
par appel et le premier plafond atteint restent bloquants.

## Gates et point d'arrêt

Le manifeste exige notamment 20/20 workflows utilisables, 95 % d'accord atomique,
100 % de citations exactes et de sécurité injection/canari, zéro faux
`SUPPORTED`, variabilité maximale de 10 %, zéro proposition de niveau/score et
réconciliation coût/dispatch/route à 100 %.

`feature.enabled=false`, `networkCallsAllowed=false`, Finance et autorisation
propriétaire restent `NOT_GRANTED`. Le runner `pnpm ai:evidence:panel:validate`
est validate-only et rejette explicitement `--execute`.

La préparation s'arrête ici. Aucun appel panel, holdout, falsificateur,
promotion, V4-002 ou intégration utilisateur n'est autorisé par ce document.
