# Rapport de release V3.5

**Statut : NO-GO temporaire**

**Branche auditée : `dev`**

**Baseline avant corrections : `a60ba17f7dad76c894bcade6cfd77e4ee6fd73f5`**

**Date : 2026-08-10**

## Synthèse

La revue d'écart contre `BACKLOG_V3_5.md` 0.7.1 est terminée pour
V3.5-001 à V3.5-008. Les écarts automatisables constatés ont été corrigés sans
réimplémenter les éléments déjà conformes. La suite locale est verte : lint,
typecheck, 564 tests Vitest, build, 62 scénarios E2E exécutés sur Chromium et
WebKit, contrôle i18n, validation Prisma et audit des dépendances de production.

La clôture reste en **NO-GO temporaire** tant que les preuves externes et
humaines suivantes ne sont pas obtenues : répétition de la nouvelle migration
Contacts sur un clone Neon, déploiement représentatif, smoke tests sur les
domaines réels et revue humaine VoiceOver/zoom/design. Aucun P0/P1 applicatif
confirmé n'est actuellement connu ; ces contrôles manquants constituent une
porte de release, pas une réussite simulée.

## État des tickets

| Ticket | État | Preuve principale |
| --- | --- | --- |
| V3.5-001 | Conforme après correction | Tokens Atlas A2 exacts, fontes locales, absence de vert/cyan, contrastes et règle du laiton testés. |
| V3.5-002 | Conforme après correction | Primitives, rayons, poids et états sémantiques alignés sur Atlas. |
| V3.5-003 | Conforme après correction | Shell public sans navigation privée ; rail desktop Atlas ; tests de routes publiques. |
| V3.5-004 | Conforme après revue d'écart | Surfaces apprenant nettoyées sans modifier le moteur pédagogique. |
| V3.5-005 | Conforme après revue d'écart | Surfaces admin et états sémantiques harmonisés. |
| V3.5-006 | Conforme après revue d'écart | Landing/PWA/i18n alignés ; messages de succès distincts. |
| V3.5-006A | Conforme localement | Routes d'auth publiques en NetworkFirst, fallback SPA exclu, anciens caches supprimés ; smoke domaine restant. |
| V3.5-007 | Conforme localement | Identité Contact dédupliquée, API admin paginée/filtrée, métriques exactes, UI et tests ; migration clone restant. |
| V3.5-008 | Conforme automatiquement, revue humaine restante | Matrice 320/390/tablette/desktop, WebKit, zoom simulé, reduced-motion et axe. |
| V3.5-009 | NO-GO temporaire | Les portes externes et humaines ci-dessous ne sont pas encore validées. |

## Commandes et résultats

- `pnpm lint` : réussi.
- `pnpm typecheck` : réussi.
- `pnpm test` : réussi, 105 fichiers et 564 tests.
- `pnpm build` : réussi.
- `pnpm test:e2e` : réussi, 62 tests exécutés et 6 tests volontairement
  ignorés selon la matrice de projets.
- Matrice ciblée admin/accueil : 33/33 réussis.
- `pnpm i18n:check` : réussi, 701 clés FR/EN cohérentes.
- `pnpm prisma:generate` : réussi.
- validation du schéma Prisma : réussie.
- `pnpm audit --prod` : aucune vulnérabilité connue.
- `git diff --check` : réussi.

Les avertissements `NO_COLOR` de Playwright n'affectent pas les résultats.

## Sécurité et confidentialité

- La navigation privée n'est plus rendue sur les routes publiques d'authentification.
- Les routes publiques ne sont plus servies par un fallback PWA potentiellement
  obsolète ; leur cache NetworkFirst dispose d'un fallback hors ligne borné.
- Les métriques de contacts distinguent consentement de lancement confirmé et
  candidature early adopter.
- L'API Contacts exige une session administrateur et normalise recherche,
  pagination et filtres.
- La suppression d'un contact respecte les autres finalités encore actives.
- Aucun secret nouveau n'est suivi dans les changements inspectés.
- L'audit des dépendances de production ne remonte aucune vulnérabilité connue.

## Migration et rollback

La migration `20260810160000_add_public_contact_identity` crée l'identité
`PublicContact`, rattache les finalités existantes, puis remplace l'unicité par
`(contactId, purpose)`. Elle est additive au début mais modifie ensuite la clé
étrangère de `PublicLead`.

Avant promotion :

1. créer une branche/clone Neon à partir de la cible ;
2. relever les comptes de contacts, finalités et doublons par e-mail normalisé ;
3. appliquer les migrations et exécuter les tests d'intégration ;
4. vérifier qu'un même e-mail portant deux finalités produit un Contact et deux
   PublicLead, sans perte de dates, statuts ni consentements ;
5. sauvegarder la base de production avant déploiement ;
6. privilégier un roll-forward en cas d'incident ; restaurer le point Neon
   pré-déploiement avec l'ancien code si un rollback complet est nécessaire.

La migration n'a pas encore été appliquée à une base partagée dans cette passe.

## Contrôles restant à effectuer

- Déployer le commit candidat dans un environnement dont la base est un clone
  Neon isolé, jamais la production par défaut.
- Vérifier `https://learn-x.app` et les liens e-mail en navigation normale et
  privée : landing, demande d'accès, vérification, activation et connexion.
- Vérifier installation puis réouverture PWA, mise à jour d'un ancien service
  worker, logout et absence de données privées en cache.
- Faire une revue humaine à 320 px, 390 px, desktop, zoom/texte 200 %, VoiceOver,
  clavier seul, contraste et cohérence Atlas.
- Vérifier en session réelle les parcours apprenant, admin Contacts, programme,
  leçon, évaluations, notes et reprise.

## Procédure de promotion recommandée

1. Isoler et committer uniquement les fichiers V3.5 ; exclure les brouillons
   pédagogiques et les modifications documentaires parallèles.
2. Pousser `dev` et obtenir CI + intégration Neon vertes.
3. Déployer une Preview reliée au clone Neon et exécuter les smoke tests.
4. Obtenir la validation humaine finale et passer ce rapport à GO.
5. Sauvegarder Neon Production, promouvoir le code, appliquer les migrations,
   puis exécuter immédiatement les smoke tests sur `learn-x.app`.
6. Surveiller erreurs HTTP, authentification, e-mails et création de contacts.
7. En incident de schéma, roll-forward prioritaire ; sinon restauration Neon au
   point sauvegardé et redéploiement du code compatible.

## Fichiers locaux volontairement exclus

Les brouillons utilisateur et travaux parallèles visibles dans le worktree ne
font pas partie de la V3.5. Ils doivent rester hors de tout staging sélectif,
notamment les documents Officine, audits, recommandations, V4 et modifications
V3 parallèles.
