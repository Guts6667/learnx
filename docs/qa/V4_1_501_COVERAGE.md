# Preuve V4.1-501 — couverture 80/90

## Résultat

Mesure finale du 28 août 2026 sur la branche d'intégration V4.1 :

| Mesure | Résultat | Gate |
| --- | ---: | ---: |
| Statements globaux | 88,95 % (8 820 / 9 915) | ≥ 80 % |
| Branches globales | 80,46 % (5 947 / 7 391) | ≥ 80 % |
| Functions globales | 90,20 % (2 550 / 2 827) | ≥ 80 % |
| Lines globales | 90,11 % (8 398 / 9 319) | ≥ 80 % |
| Authentification et accès | 90,59 % (510 / 563) | ≥ 90 % lines |
| Correction, pricing, crédits et réconciliation | 90,22 % (1 697 / 1 881) | ≥ 90 % lines |
| Progression et évaluations | 92,23 % (1 294 / 1 403) | ≥ 90 % lines |
| Autorisations admin | 93,22 % (165 / 177) | ≥ 90 % lines |

La suite comprend 215 fichiers et 1 370 tests. Les tests ajoutés portent sur
les branches métier, les erreurs, l'idempotence, les frontières d'accès, les
états de correction et les agrégations expérimentales ; aucun test sans
assertion métier n'a été ajouté pour gonfler la mesure.

## Gates rejoués

```text
NODE_DISABLE_COMPILE_CACHE=1 NODE_OPTIONS=--no-experimental-webstorage pnpm quality:v4.1:final
NODE_DISABLE_COMPILE_CACHE=1 NODE_OPTIONS=--no-experimental-webstorage pnpm test:e2e:research
```

Résultats : lint, TypeScript strict, imports, absence de Preact, cycles,
frontières de domaines, couverture, `knip`, build, budgets bundle/PWA et audit
de sécurité sont verts. Les trois tests Playwright du journal Recherche sont
verts. L'audit de production ne retourne aucune vulnérabilité connue.

## Budgets observés

- JavaScript initial : 110 816 / 125 000 octets gzip ;
- CSS initial : 18 553 / 25 000 octets gzip ;
- plus gros chunk lazy : 12 205 / 13 460 octets gzip ;
- précache PWA : 134 / 140 entrées et 1 290 058 / 1 371 224 octets.

Le JavaScript total reste un diagnostic non bloquant déjà documenté ; il ne
remplace pas le budget contractuel de l'entrée initiale.
