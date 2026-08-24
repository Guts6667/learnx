# V4 — Reste à faire avant la mise en production

État au 24 août 2026. Ce document fait autorité pour la reprise : chaque
ligne indique ce qui est fait, ce qui manque et le critère d'achèvement.
Sources : `BACKLOG_V4.md` (jalons A–E), journal
`docs/V4_AI_CORRECTION_EXPERIMENT_LOG.md` §6–8, code livré sur
`codex/v2-promotion-gates`.

## Modèle IA — où l'on en est

| Élément | État |
| --- | --- |
| Identité promue au **développement** | `learnx-french-text-correction-v3-1` (Sonnet 4.6, prompt 2.2.0, protocole 3.0.1, PARTIAL_CRITERION) : tous les gates automatiques passent (0 faux PASS, 0 écart de deux niveaux — remédiation efficace, 0 critère « à retravailler », 0 run inutilisable, injection 100 % sur sorties livrées) |
| Revue aveugle v3-1 | En cours (agent délégué) ; à lier par digest avant promotion dev formelle |
| Examen final n°3 (holdout) | **Corpus à rédiger** (l'agent d'auteur a atteint sa limite d'usage ; relancer la session suivante avec le même prompt, fichier `holdout.v3.json`), puis approbation indépendante, scellement SHA, exécution unique (~1,70 USD) |
| Variabilité surveillée | 20,8 % > cible 15 % (signal non bloquant, trade-off de l'instruction d'indépendance des critères) : à surveiller en pilote |

## Jalon B — Première correction utilisable (V4-009 + V4-010)

**Fait :**

- `src/server/corrections/promoted-identity.ts` : pin de l'identité promue
  (seul modèle callable par le runtime ; changer = nouvelle promotion).
- `runtime-correction-prompt.ts` : prompt 2.2.0 identique au préenregistré.
- `CorrectionOrchestrationService` : devis → réservation plafond → correction
  protocole 3 avec récupération partielle → **règlement intégral du devis
  (doctrine Propriétaire)** → libération de la différence ; échec total =
  état honnête « indisponible » débité au prix du devis ; rejeu idempotent
  par empreinte. 7 tests unitaires.
- `POST /api/ai-corrections` monté, capacité `ai.assessment.correct` aux
  apprenants, 5 tests de route.
- Ports Prisma d'orchestration (`PrismaCorrectionOrchestrationPorts`).

**Reste à faire (critère d'achèvement) :**

1. **Câblage défaut de l'orchestration** : composer au démarrage la route avec
   `PrismaCreditLedger` + `PrismaCorrectionOrchestrationPorts` +
   transport OpenRouter (`createRuntimeCorrectionTransport`, clé
   `OPENROUTER_API_KEY`, kill switch `LEARNX_AI_*`) — aujourd'hui la route
   répond 503 sans injection. Test d'intégration sur base de test.
2. **Vérifier le schéma du devis** côté ports : les champs Prisma réels
   (`AiPricingQuote.status/expiresAt/estimatedCredits/ceilingCredits`) et le
   cycle CONSUMED doivent matcher `loadAcceptedQuote`/`markConsumed`
   (assertion d'égalité en test d'intégration).
3. **UI apprenante V4-010 dans ExerciseCard** (contrat V4-016G + EMOTIONAL
   DESIGN §5.10) : étape devis (prix/plafond + mention explicite « des
   critères peuvent revenir à retravailler sans compensation » + consentement
   unique), état d'attente, restitution par critère (acquis → à renforcer →
   action ; « Extrait de votre réponse » ; critères « à retravailler » sans
   score exact global quand partiels ; étiquette « Correction assistée par
   IA » ; rappel sans effet sur la progression), récap plafond/débit/libéré.
   Tests de rendu (Preact Testing Library) + a11y.
4. **Requête de devis depuis l'exercice** : brancher `POST
   /api/ai-correction/quotes` depuis l'UI soumise (l'API existe déjà).

## Jalon A restant

- **V4-008** écrans admin allocations/limites/budgets (aucune surface
  aujourd'hui) : P1, bloquant pour le pilote piloté aux allocations offertes.
- **V4-017** contrôles de dépense (kill switch, plafond fournisseur) : le
  fournisseur les supporte (`LEARNX_AI_KILL_SWITCH`) ; il manque
  l'administration/les alertes.

## Jalons C–E (non commencés)

- **V4-011** évaluations d'étape textuelles + seconde correction IA
  (contestation) ; **V4-012** tableau de bord coûts/marge.
- **V4-013/014/015** Revolut sandbox, packs/checkout, remboursements — aucun
  code de paiement n'existe ; les valeurs commerciales restent gelées jusqu'à
  calibration (V4-018).
- **V4-016A/B/G** landing commerciale, desktop, grammaire visuelle complète
  des surfaces correction/crédits (les références Atlas existent, à appliquer).
- **V4-018/018A** pilote progressif et cohortes ; **V4-019** audit final GO.

## Dépendances critiques (ordre de déverrouillage)

1. Revue aveugle v3-1 liée → promotion **dev** formelle.
2. Corpus holdout n°3 rédigé + approuvé + scellé → exécution unique →
   verdict **production** (dernier examen bloquant pour activer la correction
   payante).
3. Câblage défaut + UI (Jalon B complet) → pilote allocations offertes
   (aucun achat requis) → V4-008/012 → puis seulement D (paiements) et E.

## Budget consommé (campagnes IA)

7,40 USD + 1,31 (v3-1) = **8,71 USD** au 24 août, intégralement tracés dans
les artefacts committés.
