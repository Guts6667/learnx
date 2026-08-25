# Roadmap V4 — correction formative pilote

## Statut au 25 août 2026

La V4 n'est plus bloquée par le choix d'un modèle. Rayan a autorisé une
livraison produit bornée avec la technologie actuelle : **Sonnet 4.6,
writing/fr-FR, crédits offerts, feedback formatif sans effet sur la
progression**. Cette décision produit ne transforme pas le dernier examen
scientifique en GO : son verdict reste `NO-GO`.

L'ancienne roadmap du 22 août est conservée dans
`docs/archive/v4/V4_ROADMAP_2026-08-22.md`. Elle documente l'ancien chemin
Gemini et le hard-off ; elle n'est plus une instruction d'exécution.

## Ce qui est décidé

- identité runtime : `learnx-french-text-correction-v3-1`, Claude Sonnet 4.6,
  route Anthropic via OpenRouter, prompt `2.2.0`, protocole `3.0.1` ;
- scope vendu et exécuté : `activityType=writing`, `fr-FR`, preuve texte ;
- aucun retry ni fallback ; seconde passe du même modèle uniquement dans la
  bande inclusive de ±5 points autour du seuil ;
- livraison par critère : les critères fiables sont restitués, les autres
  reviennent « à retravailler » et suppriment le score exact global ;
- correction strictement formative, sans écriture dans la progression ;
- pilote financé par crédits offerts uniquement ; aucun achat de correction
  IA en V4 ;
- prix du devis accepté maintenu même en livraison partielle, conformément au
  consentement explicite préalable ;
- aucun nouvel examen, appel modèle, changement de prompt, de gold ou de seuil
  pour cette release.

## Ce qui est réellement implémenté sur la branche de livraison

| Bloc | État | Preuve principale |
| --- | --- | --- |
| Filtre exercice writing/fr-FR avant devis et exécution | Implémenté et testé | `src/server/pricing/ai-pricing.ts`, `src/server/corrections/correction-orchestration.ts` |
| Identité runtime épinglée | Implémenté | `src/server/corrections/promoted-identity.ts` |
| Réservation sur lots offerts uniquement | Implémenté et testé | `src/server/api/corrections/app.ts`, `src/server/credits/prisma-credit-ledger.ts` |
| Route réelle `/api/ai-corrections` | Implémentée et testée | `src/server/api/corrections/app.ts` |
| Seconde passe et livraison partielle | Implémentées et testées | `src/server/corrections/correction-orchestration.ts` |
| UI devis, consentement, preuves et règlement | Implémentée et testée | `src/features/exercises/AiCorrectionPanel.tsx` |
| Accès UI réservé aux exercices éligibles | Implémenté et testé | `src/server/api/exercises/app.ts`, `src/features/exercises/ExerciseCard.tsx` |
| Allocations offertes admin | Implémentées | `src/pages/AdminCreditsPage.tsx`, API crédits |
| Coûts/incidents et deux signaux connus | Implémentés et visibles dans Crédits admin | `src/server/corrections/correction-monitoring.ts`, `src/pages/AdminCreditsPage.tsx` |
| Totem mobile et desktop | Implémentés, QA locale verte | `docs/V4_TOTEM_IMPLEMENTATION_MAP.md` |

## État de release réel

1. **Contrat et catalogue déployés** : l'exercice « Choisir sans forcer un
   cadre », son contrat `PUBLISHED` et le catalogue immuable `4.0.0` sont
   présents dans la base preview. Le pilote reste limité aux crédits offerts.
2. **Configuration preview validée** : l'identité Sonnet/Anthropic est
   épinglée, le préflight a confirmé `CONFIGURED_CLOSED`, puis le kill switch a
   été ouvert uniquement pendant un smoke autorisé et refermé ensuite.
3. **Parcours bout en bout prouvé** : le second smoke a livré trois critères,
   réglé `3` crédits après une réserve de `6`, libéré `3` et réconcilié un coût
   fournisseur de `0,025938 USD` en un appel, sans effet sur la progression.
4. **QA et publication preview** : les surfaces privées, landing, marque et
   sept articles de recherche sont raccordés. La matrice finale couvre les
   largeurs, le texte à 200 %, le clavier, l'accessibilité et WebKit.
5. **Frontière restante** : aucune implémentation produit n'est bloquante pour
   le pilote V4A. Restent la configuration de production fermée, le budget et
   le canal d'alerte, le GO explicite de Rayan, puis un smoke production borné.
   `main` et la production ne sont pas modifiées avant ce GO.

## Chemin critique

| Ordre | Ticket de reprise | Responsable | Sortie |
| ---: | --- | --- | --- |
| 1 | V4-010-RUNTIME | Développement | terminé et prouvé en preview |
| 2 | V4-002-PUBLISH | Produit/pédagogie + Développement | terminé : contrat publié et seed preview validé |
| 3 | V4-007-PILOT | Finance + Propriétaire | terminé pour V4A : crédits offerts, aucune vente publique |
| 4 | V4-016-TOTEM | Développement | terminé et validé en preview |
| 5 | V4-012-MONITORING | Développement | terminé : coûts, incidents et préflight visibles en admin |
| 6 | V4-RESEARCH | Méthodologie + Développement | terminé : journal et articles publics chronologiques |
| 7 | V4-019-RELEASE | Développement + Propriétaire | en cours : preuves figées ; GO production puis smoke borné |

## Limites assumées de la V4

- le dernier examen scellé reste `NO-GO` : 7 faux PASS, 80,19 % d'accord
  critériel, un écart ordinal de deux niveaux ;
- le modèle peut mentionner une violation de contrainte dure sans abaisser le
  niveau correspondant ; le monitoring expose un signal heuristique ;
- une garde basée sur le score du modèle ne détecte pas toute sa clémence ;
- la V4 ne couvre ni `practice`, ni `reflection`, ni `project`, ni une autre
  langue ;
- aucun résultat IA ne valide une maîtrise ou une progression.

Ces limites sont reportées, pas cachées. Leur plan de traitement est
`V4_1_BACKLOG.md`.
