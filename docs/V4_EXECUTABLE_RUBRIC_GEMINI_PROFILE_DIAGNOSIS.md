# Diagnostic du profil Gemini chercheur de preuves

Statut au 14 août 2026 : `DIAGNOSED_OFFLINE / NEW_IDENTITY_DRAFT / NO_MODEL_CALL`.

Ce document explique le `NO_GO_TECHNICAL_PROFILE` du smoke 1.1.0. Il ne
requalifie ni la tentative exécutée, ni Gemini sur le plan pédagogique.

## Cause confirmée

Le profil `evidence-researcher-1.0.0` déclarait le raisonnement `OFF`, mais
l'adapter traduisait cet état par l'absence complète du champ `reasoning` dans
le payload OpenRouter.

Le catalogue public relu le 14 août indique pour
`google/gemini-3.6-flash` :

- `mandatory: true` ;
- `default_enabled: true` ;
- `default_effort: medium` ;
- efforts acceptés : `high`, `medium`, `low`, `minimal`.

La [documentation officielle OpenRouter](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
précise qu'un modèle obligatoire ne doit pas recevoir `effort: none` et que
l'absence de configuration conserve son comportement par défaut. Elle indique
aussi que, pour Gemini 3, Google détermine la consommation réelle associée à un
niveau d'effort.

La tentative observée est cohérente avec ce comportement par défaut : 1 725
tokens de raisonnement sur une limite totale de 1 800, puis seulement 59 tokens
visibles et `MODEL_OUTPUT_TRUNCATED`. L'omission du champ n'a donc jamais prouvé
la désactivation du raisonnement.

## Correctif minimal proposé

Une identité distincte `1.2.0-draft` est préparée sans modifier l'identité
historique exécutée :

- même modèle exact et même snapshot ;
- même route unique `google-vertex/global` ;
- même prompt `1.1.0`, même rubrique, même corpus et mêmes trois cas ;
- nouveau profil `evidence-researcher-1.1.0` ;
- `reasoning.effort=minimal` envoyé explicitement ;
- cible visible inchangée à 1 800 tokens ;
- limite totale portée à 2 500 tokens, soit une marge opérationnelle de 700
  tokens pour le raisonnement ;
- aucun retry, arrêt au premier défaut, température omise, aucun fallback.

La marge de 700 tokens est une hypothèse testée par le prochain smoke, pas une
garantie. Le total de 2 500 reste le plafond fournisseur dur par réponse : si
Gemini consomme encore trop de raisonnement, la campagne s'arrête sans relever
la limite.

Le calcul pessimiste, fondé sur les octets d'entrée et le tarif attesté, borne :

- une tentative à 0,0172545 USD ;
- trois tentatives à 0,0517635 USD ;
- le plafond proposé à 0,055 USD.

Ces montants sont une enveloppe R&D, pas un prix. Finance a arbitré le plafond
de 0,055 USD le 14 août 2026, uniquement pour ce smoke. L'autorisation de
dépense du Propriétaire reste une étape distincte et postérieure avant tout
appel.

## Durcissement d'observabilité

L'adapter persiste désormais le contenu visible partiel lorsqu'OpenRouter
retourne `finish_reason=length`. Une future troncature conservera donc la sortie
brute bornée, en plus de l'identité, de l'usage, du coût et du code stable. Ce
changement n'effectue aucune réparation et ne transforme pas une troncature en
sortie valide.

Le validateur accepte encore l'identité 1.1.0 pour relire l'historique, mais il
refuse de mélanger ses paramètres avec ceux de 1.2.0. Il exige également que
l'attestation 1.2 prouve le caractère obligatoire du raisonnement et le support
de l'effort minimal.

## Identité et commande bloquée

- campagne :
  `benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.2.json` ;
- empreinte SHA-256 :
  `50fa8ea185d09f0d5361362f8479fc3514034d8e426a7c69024436734ce5e34f` ;
- attestation catalogue :
  `benchmarks/ai-correction/executable-rubric/gemini-google-vertex-attestation-2026-08-14-reasoning.json` ;
- empreinte SHA-256 :
  `1ad69716c959493f6f7923b442cd044221c5fe78b6dd9beed4a23131f82f0114`.

La commande suivante est seulement l'identifiant exact du futur gate. Elle ne
doit pas être exécutée sans nouvelle autorisation propriétaire explicite :

```bash
pnpm ai:evidence:smoke -- --execute --owner-go=GO_EVIDENCE_RESEARCHER_SMOKE_50FA8EA185D09F0D
```

Le panel 10×2, le falsificateur, le holdout, V4-010 et toute activation publique
restent fermés.
