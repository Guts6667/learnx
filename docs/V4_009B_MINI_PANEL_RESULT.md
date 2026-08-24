# V4-009B — Résultat du mini-panel composite

Date : 2026-08-13

Identité : `learnx-fr-text-mistral-sonnet-targeted-v1@1.0.0`

Verdict : **NO-GO mini-panel**

Ce verdict interdit le `24×3`, le holdout, la promotion et toute activation
publique sous cette identité. Aucun seuil, gold, prompt, modèle ou profil n'a
été modifié après lecture des résultats.

## Exécution

- 12 workflows préenregistrés : six cas × deux répétitions.
- 20 tentatives fournisseur : 12 PRIMARY Mistral et 8 vérifications Sonnet.
- 20 `VALID`, zéro retry, `INVALID`, `ERROR` ou coût manquant.
- Résultats : 10 `COMPLETED`, 2 `UNCERTAIN`, zéro inutilisable.
- Déclenchements : 4 `DECISION_SENSITIVE`, 2 `SECURITY_REVIEW` et 2
  `CONTROL_SAMPLE`.
- Routes réellement observées : Mistral et Anthropic, conformes au manifeste.

## Finance

- Coût `usage.cost` total : **0,2018835 USD**.
- Plafond : `0,75 USD`, soit 26,92 % consommés.
- Attente sans retry `<= 0,35 USD` respectée.
- Coût par workflow : moyenne `0,016823625 USD`, P50 `0,020757 USD`, P75
  `0,0237225 USD`, P90 `0,0242925 USD`, maximum `0,02487 USD`.
- Taux de vérification : 8/12, soit 66,67 %.
- 20 clés d'idempotence et 20 identifiants fournisseur uniques ; ledger et état
  entièrement réconciliés.

Verdict Finance : **GO limité à la clôture du mini-panel**, sans autorisation
du full, du holdout ou d'une activation tarifaire.

## Revue pédagogique réellement aveugle

La phase 1 a été figée avant ouverture du mapping et du gold. La phase 2 a
ensuite mesuré :

- accord critériel primaire : **32/36 = 88,89 %** ;
- accord de toutes les observations : **55/60 = 91,67 %** ;
- accord de décision primaire : **10/12**, sous le gate `>= 11/12` ;
- faux PASS : 0 ; faux FAIL primaires : 2 ;
- écarts d'au moins deux niveaux : 0 ;
- variabilité critérielle ou d'état entre répétitions : 0 ;
- sécurité injection : 2/2 workflows sûrs ;
- sécurité des preuves : 20/20 sorties, zéro hallucination.

Les deux faux FAIL sont convertis prudemment en `UNCERTAIN`, sans score exact.
Le consolidateur empêche donc une conclusion erronée, mais ne compense pas les
deux défauts pédagogiques systématiques :

1. `project-partial.plan-coherence` est abaissé à cause de l'absence de cible
   de l'indicateur, double pénalisation non écrite avec `success-indicator` ;
2. `reflection-partial.learning-insight` sous-évalue l'apprentissage personnel
   explicite d'une réponse concise en ajoutant une exigence implicite de détail.

Un output sûr mentionne inutilement une « instruction cachée ». Il ne suit ni
ne reproduit l'attaque, mais cette mention méta reste un défaut UX.

Verdict Produit/pédagogie : **NO-GO**, car l'accord décisionnel échoue et les
écarts de fidélité/indépendance sont répétés sur les deux répétitions.

## Empreintes des preuves locales

- état : `4e4586b7376f2c48a44fdadd7d7ced158feb3f2d06119d23fed57913ad9da58b` ;
- ledger : `0ed390765c282f64d20f4edc70a6b43f995be74bfdf0c9b4b730071ac22e1673` ;
- paquet aveugle phase 1 :
  `e929c03b8d78c0974dee511d317324d623d3fa83aeebb56be002fc4fceea978d` ;
- mapping scellé :
  `1913d68e43a791335641b1eb48de3efc8eb5e6681ed357b134ccf35b71bdc883`.

Les artefacts bruts restent hors Git dans
`benchmarks/ai-correction/results/composite/v4-009b-mini-panel-2026-08-13/`.

## Suite autorisée

Aucun appel supplémentaire. Toute modification du prompt, du modèle, de la
route, du trigger ou de la consolidation crée une nouvelle identité et exige
un nouveau mini-panel préenregistré avec une nouvelle autorisation propriétaire.
V4-010 ne peut pas activer d'appel réel tant que V4-009B n'a pas reçu un GO.
