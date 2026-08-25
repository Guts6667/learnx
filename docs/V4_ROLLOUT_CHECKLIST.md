# V4 — Checklist de déploiement du pilote Writing

> État au 25 août 2026. `docs/V4_ROADMAP.md` reste l'autorité sur le périmètre
> et l'ordre des tickets. Cette checklist décrit uniquement les preuves à
> réunir pour V4-019 ; elle ne rouvre ni le benchmark, ni les prix, ni les
> arbitrages produit.

## Périmètre autorisé

- correction `writing`, `fr-FR`, texte et faible risque uniquement ;
- identité `learnx-french-text-correction-v3-1`, Sonnet 4.6, route Anthropic ;
- crédits offerts uniquement, sans achat public de correction IA ;
- feedback formatif sans effet sur la progression ;
- seconde passe du même modèle uniquement dans la bande de ±5 points ;
- aucun retry, fallback ou élargissement silencieux.

Le dernier examen scientifique reste `NO-GO`. Le pilote est une décision
produit bornée ; il ne transforme pas ce verdict en promotion scientifique.

## Preuves locales acquises

- [x] contrat pilote `PUBLISHED` présent dans le bundle ;
- [x] filtre serveur `writing/fr-FR` avant devis et exécution ;
- [x] devis, réservation sur crédits offerts, règlement et libération testés ;
- [x] identité runtime et route fournisseur épinglées ;
- [x] livraison par critère, score indicatif et état partiel testés ;
- [x] UI de devis, consentement, résultat et règlement livrée ;
- [x] monitoring coûts/incidents visible en administration ;
- [x] état de préflight distant visible en administration sans exposer la clé ;
- [x] surfaces Totem, landing, marque et journal de recherche alignés ;
- [x] lint, typecheck, tests, build et matrice E2E locale verts.

## Préflight de configuration sans appel modèle

La vérification suivante ne révèle jamais la clé et n'envoie aucun appel :

```bash
pnpm ai:release:check -- --environment=preview --expect=CONFIGURED_CLOSED
```

États possibles :

| État | Signification | Suite autorisée |
| --- | --- | --- |
| `DISABLED` | fonctionnalité globalement désactivée | configurer la preview |
| `CONFIGURATION_BLOCKED` | clé absente ou identité non conforme | corriger la configuration, aucun appel |
| `CONFIGURED_CLOSED` | identité et clé valides, kill switch fermé | lancer la QA sans appel |
| `READY` | identité valide et kill switch ouvert | uniquement après GO propriétaire |

L'identité doit être validable alors que le kill switch reste fermé. La
configuration attendue est :

- `LEARNX_AI_CONFIG_ENVIRONMENT=preview` en preview ;
- allowlist limitée à `anthropic/claude-sonnet-4.6` et `Anthropic` ;
- primaire et seconde passe assignés à cette même paire ;
- `LEARNX_AI_ENABLED=true` ;
- `LEARNX_AI_KILL_SWITCH=true` jusqu'au GO d'ouverture ;
- `OPENROUTER_API_KEY` présente côté serveur uniquement.

## QA preview authentifiée — terminée

- [x] déployer les 41 migrations, y compris le correctif formatif, et le seed
  sur la base de preview ;
- [x] vérifier que l'exercice « Choisir sans forcer un cadre » est visible et
  porte le contrat publié attendu ;
- [x] vérifier les soldes offerts, le catalogue `4.0.0` et l'absence d'achat ;
- [x] exécuter `deployment:check` puis le parcours protégé avec le compte pilote ;
- [x] vérifier landing, journal FR/EN, canonicals, PWA et connexion ;
- [x] vérifier le préflight en état `CONFIGURED_CLOSED` ;
- [x] vérifier qu'une tentative de correction répond indisponible sans débit
  lorsque le kill switch est fermé ;
- [x] obtenir le GO explicite du Propriétaire pour ouvrir le kill switch ;
- [x] effectuer un smoke utilisateur borné, réconcilier coût, débit et
  libération, puis refermer immédiatement en cas d'écart ;
- [x] capturer les états 320/390/720/1440/1920, zoom 200 %, clavier et WebKit.

Le premier smoke autorisé a été refermé sur une erreur de persistance SQL et
un coût non réconciliable exactement. La réservation a été libérée et le
correctif SQL a été redéployé. Le durcissement d'idempotence et de rejeu
financier est livré par `d0e479cb` et contrôlé coupe-circuit fermé.
Le second smoke a livré une correction complète en un seul appel : coût
`0,025938 USD`, plafond `6`, règlement `3`, libération `3`, puis kill switch
refermé. Voir `docs/V4_019_RELEASE_REPORT.md` pour les identifiants et les
écritures du ledger. Cette preuve coche le smoke preview, sans promouvoir le
pipeline scientifiquement ni autoriser la production.

La matrice publique finale est automatisée dans
`tests/e2e/research-public.spec.ts` et `tests/e2e/landing.spec.ts`. Elle vérifie
les cinq largeurs, l'absence de débordement, la chronologie du journal, le
sommaire responsive, le partage, le focus clavier, les violations
d'accessibilité sérieuses, WebKit mobile et la taille de texte à 200 %. Les
surfaces applicatives et primitives partagées sont couvertes par
`tests/e2e/home.spec.ts`, `tests/e2e/ui-primitives.spec.ts` et les scénarios
administration. Les captures sont attachées aux résultats Playwright, sans
ajouter d'artefacts binaires au dépôt.

## Gate production

- [x] migration répétable en preview et rollback documenté ;
- [ ] recette manuelle propriétaire du candidat figé
  `v4a-premerge-2026-08-25-r2` selon
  `docs/V4_019_MANUAL_ACCEPTANCE.md` ;
- [ ] variables de production distinctes de la preview ;
- [ ] préflight `CONFIGURED_CLOSED` avant toute ouverture ;
- [ ] budget fournisseur et canal d'alerte confirmés ;
- [x] procédure de fermeture : `LEARNX_AI_KILL_SWITCH=true` ;
- [x] rapport V4-019 consignant versions, tests, incidents, coûts et limites ;
- [ ] GO explicite de Rayan pour promouvoir le candidat Git et configurer la
  production avec le kill switch fermé ;
- [ ] GO explicite distinct de Rayan pour ouvrir le kill switch et autoriser
  le smoke borné ;
- [ ] après ouverture seulement, préflight `READY` et smoke borné ;
- [ ] `main` modifiée uniquement par le commit de release autorisé.

## Arrêt immédiat

Fermer le kill switch et ne pas relancer automatiquement si l'identité,
l'activité, la langue, le coût, le règlement, la citation ou le statut du
contrat diffère de la configuration attendue. Une sortie inutilisable ou un
coût non réconcilié reste un incident visible ; il ne devient jamais un coût
nul silencieux.
