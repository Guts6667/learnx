# Résultat du smoke Gemini chercheur de preuves 1.2.0

Statut au 14 août 2026 : `NO_GO_TECHNICAL_SPAN_VALIDATION`.

Ce résultat ne constitue pas un verdict pédagogique sur Gemini et n'autorise
ni le panel 10×2, ni le falsificateur, ni le holdout, ni une activation produit.

## Exécution autorisée

- campagne SHA-256 :
  `50fa8ea185d09f0d5361362f8479fc3514034d8e426a7c69024436734ce5e34f` ;
- modèle : `google/gemini-3.6-flash` ;
- route épinglée : `google-vertex/global` ;
- profil : `evidence-researcher-1.1.0`, `reasoning=minimal` ;
- trois appels maximum, aucun retry, plafond 0,055 USD, arrêt au premier
  défaut.

Le runner a envoyé une seule tentative sur `writing-fr-base-mastered`, puis
s'est arrêté. Aucun deuxième ou troisième appel n'a été envoyé.

## Résultat observé

- statut : `INVALID` ;
- code : `EVIDENCE_RESEARCHER_SPAN_MISMATCH` ;
- coût réel réconcilié : 0,00489225 USD ;
- solde de l'enveloppe non consommé : 0,05010775 USD ;
- latence : 1 309 ms ;
- tokens : 2 068 entrée, 0 raisonnement, 891 sortie visible ;
- identifiant fournisseur : `gen-1786716259-YBj9jxfN4pap4TgepaNT`.

Le profil corrigé a donc bien supprimé la consommation de raisonnement qui
avait tronqué le smoke 1.1.0. Le nouveau rejet intervient plus loin : le
validateur déterministe a prouvé qu'au moins un triplet `start/end/text`
proposé ne correspondait pas exactement à `responseText`.

## Limite de diagnostic

La sortie structurée rejetée n'a pas été persistée par le runner. Il est donc
impossible de déterminer honnêtement si Gemini a utilisé des offsets en octets,
en points de code, en unités UTF-16, ou s'il a simplement proposé une mauvaise
borne. Aucune de ces causes ne doit être affirmée sans la sortie brute.

Le prochain travail est strictement hors ligne : conserver de façon bornée la
sortie structurée reçue avant validation sémantique, puis revoir si les offsets
doivent rester produits par le modèle ou être dérivés côté serveur depuis une
citation unique. Toute modification du contrat, du prompt ou du profil crée une
nouvelle identité et requiert une nouvelle autorisation avant appel.

## Preuves scellées

- state SHA-256 :
  `7c3f409a7da009c16e887fed82d8553ebb01ffd4b08019428a3f475a4f420f1b` ;
- ledger SHA-256 :
  `09134e73b3c36ea67d4e369eda456913a139298025f4ad0c424ec604cedcfa1e` ;
- dernier record hash :
  `c3f4a87993b356893e52dbed916bce62bbce149930b1de7352d463548f931727`.

Le résumé machine suivi est
`benchmarks/ai-correction/executable-rubric/gemini-evidence-researcher-smoke.v1.2.result.json`.
