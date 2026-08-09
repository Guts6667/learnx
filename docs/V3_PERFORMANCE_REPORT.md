# Rapport performance et observabilité V3-031

## Périmètre et méthode

Les mesures sont exclusivement en lecture sur la branche Neon éphémère créée
par le workflow `Integration`. `pnpm performance:measure` refuse de démarrer si
`LEARNX_PERFORMANCE_DATABASE=isolated` n'est pas présent. Le rapport JSON est
conservé comme artefact CI ; aucun identifiant utilisateur ni contenu n'y est
écrit.

La baseline issue de V3-028 était structurelle : Notes, Révisions et historiques
de tentatives utilisaient des `findMany` sans `take`; le recalcul chargeait tous
les `LessonProgress`; une requête authentifiée produisait une écriture de
session. V3-031 ajoute une mesure reproductible sur les mêmes tables et sur la
requête exacte des leçons de la page Aujourd'hui.

## Baseline, objectif et résultat

| Cible | Baseline | Objectif | Résultat V3-031 |
| --- | --- | --- | --- |
| Notes | réponse non bornée | 20 éléments par défaut, maximum 50 | curseur opaque lié à l'utilisateur et aux filtres, requête `take = pageSize + 1` |
| Révisions | réponse non bornée | même budget | page stable `dueAt, id`, chargement progressif |
| Tentatives quiz/notion | historiques non bornés | même budget | pages stables `submittedAt, id`, historique chargeable sans perte |
| Sessions | 1 écriture par requête authentifiée | au plus 1 écriture par session et par tranche de 5 min | contrôle du compte à chaque requête, `touchSession` seulement après 5 min |
| Recalcul | jusqu'à N lignes en mémoire | lot borné et reprenable | 100 lignes par défaut, option `--batch-size` bornée à 1–1000 |
| Aujourd'hui | toutes les leçons accessibles | mesurer avant de modifier | mesure exacte ajoutée ; aucune limite arbitraire susceptible de changer la recommandation |

Les durées, volumes réels et tailles de payload du clone sont disponibles dans
l'artefact `database-performance-<run_id>`. L'absence de régression est bloquante
dans le workflow Integration ; les résultats ne sont jamais extrapolés à la
production sans mesure dédiée.

## Observabilité et alertes

Chaque réponse API reçoit `X-Request-Id` et `Server-Timing`. Un événement JSON
`api_request` contient uniquement méthode, chemin normalisé (UUID remplacés),
statut, durée, taille connue et identifiant généré côté serveur. Les paramètres
de recherche, corps, cookies, e-mails, jetons et identifiants métier ne sont pas
journalisés.

- statut 5xx : niveau `error`, alerte immédiate à configurer dans les logs Vercel ;
- statut 4xx ou durée ≥ 1 000 ms : niveau `warn`, revue si récurrent ;
- autres requêtes : niveau `info` pour établir p50/p95 et taux d'erreur ;
- désactivation de secours : `LEARNX_OBSERVABILITY_ENABLED=false`.

La rétention suit celle des logs Vercel du plan actif. Elle doit rester minimale
et être revue à chaque changement de plan ; aucun export longue durée n'est
autorisé par ce ticket. Le rapport de mesure CI est un artefact technique sans
donnée personnelle et peut suivre la rétention des artefacts GitHub Actions.

## Index, coûts et rollback

Les index existants couvrent déjà Notes (`userId, updatedAt`) et Révisions
(`userId, dueAt, status`). Aucun nouvel index n'est ajouté sans plan SQL
avant/après démontrant un gain : cela évite coût d'écriture et stockage
spéculatifs. Les mesures du clone servent de gate pour un éventuel ticket
d'index autonome.

Le rollback applicatif consiste à retirer pagination, middleware et batch tout
en conservant les contrats précédents. Aucun rollback de schéma n'est requis.
Les clients peuvent ignorer `nextCursor`; les champs historiques restent
inchangés. La désactivation de l'observabilité ne désactive ni authentification
ni contrôles d'accès.
