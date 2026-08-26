# V4-010-R4 — historique et comparaison des corrections

## Verdict

**GATE AUTOMATIQUE PASSÉ — HISTORIQUE COMPARABLE SANS NOUVEL APPEL MODÈLE**

LearnX expose désormais toutes les corrections réglées d'une même soumission,
dans leur ordre chronologique. L'apprenant peut consulter chaque version et,
à partir de la deuxième, voir les changements de niveau critériel par rapport
à la correction précédente.

## Contrat vérifié

- seules les corrections dont la réservation est définitivement `SETTLED`
  sont restituées ;
- le montant réglé du ledger doit correspondre au règlement enregistré dans le
  résultat structuré ;
- une correction en cours de réconciliation reste invisible ;
- l'API apprenant n'expose ni modèle, ni fournisseur, ni tokens, ni coût
  fournisseur, ni signaux internes de monitoring ;
- l'historique est ordonné du plus ancien au plus récent et ouvre par défaut la
  dernière correction ;
- choisir une correction antérieure ne déclenche ni devis, ni appel modèle, ni
  débit ;
- la comparaison porte sur les niveaux des mêmes critères et n'invente ni
  score composite, ni verdict académique ;
- une actualisation recharge l'historique réglé sans rejouer une correction ;
- juste après une exécution, le résultat courant reste visible même si la
  lecture répliquée de l'historique n'est pas encore à jour.

## Preuves automatisées

- `src/server/corrections/prisma-correction-orchestration-store.test.ts` :
  filtrage financier et ordre chronologique ;
- `api/corrections/app.test.ts` : contrat HTTP et absence de métriques
  fournisseur ;
- `src/features/exercises/AiCorrectionPanel.test.tsx` : restauration,
  navigation entre deux corrections et comparaison de niveaux ;
- `api/free-text-correction.acceptance.test.ts` : compatibilité avec le cycle
  authentifié des quatre familles.

Validation ciblée : 5 fichiers, 33 tests verts.

## Limite assumée

Ce ticket rend plusieurs corrections existantes lisibles mais ne crée pas à
lui seul le droit d'en commander une nouvelle. La contestation argumentée et
sa nouvelle action facturable relèvent de V4-010-R3 ; sa limite et son catalogue
doivent être arbitrés avant implémentation.
