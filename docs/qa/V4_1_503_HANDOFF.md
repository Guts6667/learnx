# Preuve V4.1-503 — handoff et fermeture de dette

## Verdict

**PASS_DOCUMENTATION_AND_DEBT.** Les documents canoniques requis existent,
les sources obsolètes restent préservées mais ne sont plus routées comme état
courant, et la dette `V4.1-404-R1` est fermée sans retuning scientifique.

## Documents livrés

- `docs/HANDOFF.md` : reprise en moins de 15 minutes, statut, exploitation,
  dette et rollback ;
- `docs/ARCHITECTURE.md` : architecture, dépendances et cycle de correction ;
- `docs/DOMAIN_MODEL.md` : autorités et objets métier ;
- `docs/ENGINEERING_CONVENTIONS.md` : frontières, React/shadcn, anti-monolithes
  et workflow ;
- `docs/TESTING_AND_RELEASE.md` : gates, CI, recette et rollback ;
- `docs/DOCUMENT_MANIFEST.yaml` et `docs/INDEX.md` : routage canonique.

Les six diagrammes Mermaid exigés sont présents : système, dépendances de
domaines, correction/réservation, progression/évaluations, CI/release et
gouvernance Git/Airtable.

## Fermeture de V4.1-404-R1

Le fichier historique d'agrégation de 1 021 lignes a été séparé en modules
cohérents :

| Module | Responsabilité |
| --- | --- |
| `ai-correction-benchmark-summary.ts` | validation, orchestration et API publique |
| `…-support.ts` | fonctions pures et regroupement des runs |
| `…-decision.ts` | décisions, familles, ordinals et calibration |
| `…-observations.ts` | transport, preuves, injection, stabilité et unsure |
| `…-analysis.ts` | composition des sous-agrégats |
| `…-model.ts` | coûts, gates, signaux et résumé final |

`ai-correction-benchmark-summary-split.test.ts` gèle les sous-agrégats de
décision, famille, transport, preuves, injection, stabilité et taux unsure.
Les 36 tests ciblés sont verts. Aucun corpus, gold, seuil, coût, prompt ou
verdict historique n'a été modifié.

La gate complète `quality:v4.1:final` est également verte : 1 371 tests,
88,97 % statements, 80,46 % branches, 90,23 % functions et 90,16 % lines.
Les quatre domaines critiques dépassent 90 % lines, les budgets JS/CSS sont
respectés, et aucun import Preact, cycle, code mort ou vulnérabilité de
production haute/critique n'est détecté.

## Dette résiduelle

Aucune dette P0/P1 connue. Les quatre gates manuels P2 de preview sont décrits
avec owner, impact, dépendance et date de revue dans `docs/HANDOFF.md`. Ils
appartiennent à V4.1-504 et ne sont pas présentés comme acquis.

## Prochaine action

V4.1-504 : créer la preview au SHA candidat exact, exécuter la recette
authentifiée et manuelle, prouver le rollback vers `a02ecc3f…`, puis demander
le GO explicite de Rayan. Aucun push `main` ou déploiement production n'est
autorisé par ce document.
