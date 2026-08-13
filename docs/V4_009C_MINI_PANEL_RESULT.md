# V4-009C — Résultat du mini-panel Gemini

Date : 2026-08-13

Verdict : `NO-GO_TECHNICAL / PANEL_INCOMPLETE`

## Arrêt préenregistré

La campagne s'est arrêtée après 10 tentatives et 9 workflows utilisables sur
20. La cellule `benchmark-reflection-partial:2` a produit une erreur sans
`providerRequestId`, usage ni `usage.cost`. Conformément à Finance, le runner a
classé l'opération `COST_RECONCILIATION_REQUIRED`, n'a pas traité le coût comme
zéro et n'a lancé aucun retry ni appel suivant.

- sorties valides : 9 ;
- sortie `ERROR` : 1 ;
- retries fournisseur : 0 ;
- coût réel réconcilié connu : `0,03392775 USD` ;
- exposition conservatrice incluant la réserve de l'incident :
  `0,05528175 USD` ;
- plafond autorisé : `0,50 USD` ;
- workflow finalement inutilisable : 1, alors que le gate exigeait 0 ;
- injections non atteintes : aucune conclusion de sécurité globale possible.

Le panel est incomplet et ne peut donc produire ni comparaison pédagogique
globale, ni GO `24×3`, ni ouverture du holdout.

## Incident d'attestation initial

Le premier appel a utilisé la route exacte Google AI Studio, mais OpenRouter a
retourné `google/gemini-3.6-flash` dans le champ modèle plutôt que le nom interne
daté `google/gemini-3.6-flash-20260721`. Le premier runner a rejeté cette
représentation après réception d'une sortie valide.

Le contrôle a été corrigé hors ligne pour accepter uniquement le slug canonique
gelé ou le snapshot daté attesté. La tentative existante a été revalidée puis
réconciliée par un événement append-only `CALL_RECONCILED`; elle n'a jamais été
rejouée et son coût `0,0031335 USD` est inclus dans le total.

## Empreintes

- manifeste :
  `4c6d1e320210828f2c3ed6038ff4e7cd9c0e9e07a0cb7f53439c10d41b25010d` ;
- fingerprint :
  `92fb511f25428b5e886f6194d4953701f8933170261d8404d04b95b0b0ea9912` ;
- state final :
  `4e102cbdf43263419b5e4a8d01000d4f1f45fb5335e709b28a5b3f8608dbd29d` ;
- ledger final :
  `f84d184e9fa3fcd6d46ffe817da2e5843581445d5e3b6a1b1f2b766a687d5900` ;
- paquet aveugle partiel :
  `7139d3a9483f4a1b42af0a12c4ee22ad3732c2fa6aa12d1395717d12b40e4f04` ;
- mapping partiel scellé :
  `f9ef09e1aa42cb49ed5aa9b6925c04b8980f345eacb0a2a20b527558e34cb43a`.

Le coût de la dernière tentative demeure orphelin : il n'est jamais présenté
comme nul. La projection `state` classe la première tentative réconciliée
`VALID`, tandis que le ledger conserve son ancien `OUTCOME ERROR` et le nouvel
événement `CALL_RECONCILED` pour préserver l'historique complet.

Les artefacts bruts restent hors Git. Leurs empreintes et le verdict sont
persistés ici sans modifier le corpus, les golds, le prompt, les gates ou les
campagnes historiques.
