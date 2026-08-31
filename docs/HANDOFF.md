# Handoff LearnX V4.1

## Reprise en moins de 15 minutes

1. Lire `AGENTS.md`, puis `docs/INDEX.md`.
2. Lire `V4_1_BACKLOG.md` : le seul ticket restant est V4.1-504.
3. Lire `docs/ARCHITECTURE.md` et `docs/DOMAIN_MODEL.md` avant de modifier un
   contrat ou une frontière de domaine.
4. Lire `docs/ENGINEERING_CONVENTIONS.md` avant tout code, puis
   `docs/TESTING_AND_RELEASE.md` avant une preview ou une promotion.
5. Pour la correction assistée, lire ensuite
   `docs/AI_CORRECTION_RESEARCH_DIGEST.md` : les preuves historiques sont
   conservées, mais ne constituent jamais une autorisation d'exécution.

## État au 28 août 2026

- Baseline V4 en production :
  `a02ecc3f307af36656fa5cb8a7b62954fdec73e9`.
- Candidat d'intégration V4.1 avant le handoff : `1af93516` sur
  `origin/codex/v4-1-foundation`.
- React 19 est l'unique runtime UI ; Preact a été retiré.
- React Router, React Query, Tailwind 4 et les primitives shadcn Maia possédées
  par LearnX sont en place.
- Le schéma Prisma est multi-file, sans migration SQL produite par ce
  découpage.
- Les routes et contrats V4 restent compatibles.
- V4.1-501 et V4.1-502 sont terminés ; V4.1-503 clôt la documentation et la
  dette ; V4.1-504 reste le gate propriétaire de preview, rollback et release.

## Qualité automatisée acquise

La dernière preuve complète est `docs/qa/V4_1_502_QA.md` :

- 1 371 tests Vitest verts ;
- couverture globale : 88,97 % statements, 80,46 % branches, 90,23 %
  functions et 90,16 % lines ;
- quatre domaines critiques au-dessus de 90 % lines ;
- 0 import Preact, 0 cycle, 0 dépendance ou export mort non justifié ;
- 0 vulnérabilité de production haute ou critique ;
- budgets respectés : 110 811 octets JS gzip initial sur 125 000 et 18 553
  octets CSS gzip sur 25 000 ;
- 72 tests du bundle de production réussis, 24 répétitions intentionnellement
  ignorées ;
- 11 tests d'intégration réussis sur une branche Neon jetable ensuite
  supprimée.

Commande de reproduction :

```bash
pnpm install --offline --frozen-lockfile
NODE_DISABLE_COMPILE_CACHE=1 \
NODE_OPTIONS=--no-experimental-webstorage \
pnpm quality:v4.1:final
pnpm test:e2e:production
```

`pnpm prisma:generate` est requis avant le typecheck dans un worktree neuf.

## Dette résiduelle et risques nommés

Aucune dette P0/P1 connue n'est ouverte. Les éléments suivants sont des gates
de release P2, pas des validations déjà acquises :

| Élément | Owner | Impact si omis | Dépendance | Revue |
| --- | --- | --- | --- | --- |
| Recette authentifiée correction, pricing, ledger et permissions sur la preview | QA/Release | Régression d'assemblage possible malgré les tests isolés | Preview V4.1-504 et base non-production | Avant GO V4.1-504 |
| Installation PWA, offline/update et rollback réel vers V4 | QA/Release | Mise à jour ou retour arrière non prouvé sur appareil | Preview finale et appareil réel | Avant GO V4.1-504 |
| Clavier, zoom navigateur 200 % et lecteur d'écran natif | QA/Release | Défaut d'accessibilité non détecté par Axe | Preview finale | Avant GO V4.1-504 |
| Protection de `dev` exigeant `Quality / V4.1 final (required)` | QA/Release | Un futur push pourrait contourner la chaîne locale | Réglage de branche externe | Avant GO V4.1-504 |

La dette `V4.1-404-R1` est fermée dans V4.1-503 : le noyau d'agrégation du
benchmark a été séparé en modules cohérents et un test golden fixe les
sous-agrégats scientifiques. Cette fermeture ne change aucun résultat de
recherche, seuil, corpus ou verdict historique.

## Limites produit conservées

- V4.1 n'ajoute aucune fonctionnalité produit.
- Les nouvelles qualifications IA, les évaluations textuelles d'étape, les
  packs, paiements et remboursements appartiennent à V4.5.
- La création guidée et les analytics restent des candidats V5.
- Les résultats IA V4 ne prouvent pas une qualité scientifique générale ; le
  runtime borné et l'historique expérimental restent deux autorités distinctes.

## Exploitation et rollback

V4 reste disponible pendant toute la recette. V4.1 est promue en une seule
release après GO explicite de Rayan. Le rollback consiste à redéployer le
déploiement de production précédent ; aucune migration de données n'est
nécessaire pour annuler la seule migration UI ou le découpage Prisma
multi-file.

**La cible n'est plus écrite ici.** Elle périme à chaque promotion, et elle a
déjà pointé pendant des semaines sur une release dépassée. Elle vit désormais
dans `docs/RUNBOOK_RESTORE.md` §3, seul endroit à tenir à jour, avec la liste
de ce que le retour arrière annule.

En cas de coût de correction inconnu, de tentative orpheline ou de doute sur
un règlement, ne jamais traiter la valeur comme zéro : conserver la
réservation et passer en `RECONCILIATION_REQUIRED`.

## Surveillance et astreinte

`GET /api/health` répond publiquement, sans session, et dit trois choses : si
la base répond, le commit déployé, la région. **200** quand la base répond,
**503** quand elle est injoignable ou ne répond pas dans les deux secondes. Un
sondage qui pend ne rapporte rien, ce qui est pire que rapporter une panne.

```bash
curl -s https://learn-x.app/api/health | jq
```

La réponse ne nomme jamais l'hôte, le rôle ni le message du pilote : un
inconnu peut l'appeler, il n'y apprend rien d'exploitable. Le détail vit dans
le journal, corrélé par `X-Request-Id`.

Toute erreur inattendue écrit désormais une ligne JSON `api_unexpected_error`
avec son nom, son message, sa pile et l'identifiant de requête. Rien de la
requête n'y est joint — ni corps, ni en-têtes, ni session — et le chemin voit
ses identifiants d'enregistrement remplacés par `:id`, comme dans le journal de
requêtes. L'identifiant retourné au client dans `X-Request-Id` permet de passer
d'un « ça a échoué » à la panne exacte.

Lecture des journaux : tableau de bord Vercel → projet learnx → Observability →
Logs, filtre sur `api_unexpected_error` ou sur un `requestId`. **La rétention
du plan Hobby se compte en heures, pas en jours** : un incident vieux d'une
journée n'y est plus. C'est la raison d'être du suivi d'incidents ci-dessous.

### Astreinte, en solo

Il n'y a pas d'équipe d'astreinte. Ce qui remplace une rotation :

1. `pnpm deployment:check` après chaque promotion en production ;
2. le contrôle planifié de V4.5-173, qui appelle `/api/health` et alerte sans
   attendre qu'un utilisateur écrive ;
3. un outil de suivi d'incidents, **encore à choisir** — voir ci-dessous.

### Suivi d'incidents : décision ouverte

L'étape 3 de V4.5-172 demande de brancher un outil de suivi d'erreurs, DSN en
variable Vercel, désactivé hors production. Elle **n'est pas faite** : elle
suppose de choisir un fournisseur, d'ouvrir un compte et d'accepter une
dépendance de plus. Le point d'accroche existe — `reportUnexpectedError`
accepte une fonction d'écriture — donc brancher un outil se réduira à fournir
cette fonction, sans toucher au reste.

Tant que ce choix n'est pas fait, la seule mémoire des erreurs est le journal
Vercel, dont la rétention est de quelques heures.

## Handoff d'un futur ticket

Toujours transmettre : ticket, branche/worktree, base exacte, SHA, fichiers,
tests, validations non exécutées, limites, rollback et prochaine autorité.
Le workflow complet est dans `docs/AGENT_WORKFLOW.md`.
