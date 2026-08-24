# Roadmap V4 — correction formative pilote

## Statut au 24 août 2026

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
| Filtre writing-only avant devis et exécution | Implémenté et testé | `src/server/pricing/ai-pricing.ts`, `src/server/corrections/correction-orchestration.ts` |
| Identité runtime épinglée | Implémenté | `src/server/corrections/promoted-identity.ts` |
| Réservation sur lots offerts uniquement | Implémenté et testé | `src/server/api/corrections/app.ts`, `src/server/credits/prisma-credit-ledger.ts` |
| Route réelle `/api/ai-corrections` | Implémentée et testée | `src/server/api/corrections/app.ts` |
| Seconde passe et livraison partielle | Implémentées et testées | `src/server/corrections/correction-orchestration.ts` |
| UI devis, consentement, preuves et règlement | Implémentée et testée | `src/features/exercises/AiCorrectionPanel.tsx` |
| Accès UI réservé aux exercices éligibles | Implémenté et testé | `src/server/api/exercises/app.ts`, `src/features/exercises/ExerciseCard.tsx` |
| Allocations offertes admin | Implémentées | `src/pages/AdminCreditsPage.tsx`, API crédits |
| Coûts/incidents et deux signaux connus | Implémentés sur la branche | `src/server/corrections/correction-monitoring.ts` |
| Totem mobile et desktop | En finition/QA | `docs/V4_TOTEM_IMPLEMENTATION_MAP.md` |

## Ce qui bloque encore une release utilisable

1. **Contrat publié** : le programme contient l'exercice pilote « Choisir sans
   forcer un cadre », mais aucun bundle déployé ne porte encore son contrat V4
   `PUBLISHED`. Sans lui, l'UI reste honnêtement masquée.
2. **Catalogue pilote actif** : le devis dépend d'une version de catalogue
   serveur compatible avec l'identité promue. Aucune valeur ne doit être
   inventée dans le code ; la version calibrée doit être activée explicitement
   pour les crédits offerts.
3. **Configuration de déploiement** : clé OpenRouter, assignation exacte
   Sonnet/Anthropic et kill switch doivent être vérifiés en preview puis en
   production.
4. **QA finale** : lint, typecheck, tests, build, E2E authentifié, responsive
   320/390/720/1024/1440/1920, clavier et zoom 200 %.
5. **Publication de recherche** : le journal public doit refléter les quatre
   refus, le NO-GO Writing et la décision de pilote borné.

## Chemin critique

| Ordre | Ticket de reprise | Responsable | Sortie |
| ---: | --- | --- | --- |
| 1 | V4-010-RUNTIME | Développement | raccord end-to-end vert, sans appel réel |
| 2 | V4-002-PUBLISH | Produit/pédagogie + Développement | un contrat writing/fr-FR publié et immuable dans le bundle |
| 3 | V4-007-PILOT | Finance + Propriétaire | catalogue crédits offerts calibré et activé, sans vente publique |
| 4 | V4-016-TOTEM | Développement | mobile + desktop conformes aux paquets approuvés |
| 5 | V4-012-MONITORING | Développement | coûts, incidents et deux indicateurs visibles en admin |
| 6 | V4-RESEARCH | Méthodologie + Développement | journal, registre et pages publiques FR/EN à jour |
| 7 | V4-019-RELEASE | Développement + Propriétaire | preview authentifiée, checklist, GO explicite, puis production |

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
