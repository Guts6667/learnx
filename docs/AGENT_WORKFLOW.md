# Workflow canonique des agents LearnX

## Autorité

- Version : 1.0.0
- Date : 26 août 2026
- Owner : Architecture/Produit
- Reviewer : Rayan

Ce workflow complète `AGENTS.md` sans le remplacer. `AGENTS.md`, le ticket
actif et les instructions explicites du Propriétaire prévalent. Il s'applique
aux lots parallèles, aux worktrees et aux handoffs ; il n'autorise pas à lancer
des agents ou à muter un système externe lorsque la tâche ne le demande pas.

Pour V4.1, `AGENTS.md` route vers `V4_1_BACKLOG.md` et impose React 19. Une
instruction plus ancienne mentionnant Preact ou un backlog V4 clôturé ne peut
donc pas être utilisée pour réintroduire ces choix dans V4.1.

## 0. États et limite d'encours

La machine d'état unique est :

```text
DRAFT → NEEDS_ARBITRATION → READY → IN_PROGRESS
→ REVIEW → QA → READY_FOR_OWNER_GO → DONE
```

Un retour vers `NEEDS_ARBITRATION`, `READY`, `IN_PROGRESS` ou `REVIEW` est
possible uniquement avec motif audité. Un agent n'a jamais plus d'un ticket
d'implémentation `IN_PROGRESS`. Une revue ou un diagnostic read-only peut être
mené en parallèle s'il ne modifie pas le même worktree.

## 0.1 Contrat Git ↔ Airtable

Les tickets sont liés par leur identifiant stable (`V4.1-…`). L'autorité est
répartie, jamais fusionnée implicitement :

| Donnée | Autorité | Écriture autorisée |
| --- | --- | --- |
| livrable, critères d'acceptation, dépendances, source canonique | Git (`V4_1_BACKLOG.md`) | revue Git puis synchronisation ciblée |
| release, epic, nature, risque, owner et reviewer | Git | synchronisation ciblée par identifiant |
| statut opérationnel et blocage courant | Airtable | mutation explicite du seul ticket concerné |
| branche, PR, SHA et preuves QA | preuve Git/CI, reflet Airtable | après vérification de l'objet référencé |
| arbitrage Rayan | Airtable et décision source liée | Rayan ou transmission explicitement autorisée |
| date de synchronisation | journal de synchro | uniquement après succès vérifié |

Une synchronisation suit obligatoirement ce protocole :

1. lecture du ticket Git et de l'enregistrement Airtable courant ;
2. production d'un dry-run champ par champ ;
3. allow-list limitée aux champs nommés ci-dessus ;
4. comparaison de la valeur Airtable relue avec la valeur attendue ;
5. si un statut, blocage ou arbitrage manuel diverge, aucune écriture et passage
   explicite à `NEEDS_ARBITRATION` après accord du propriétaire ;
6. mutation ciblée par record ID, jamais mise à jour de table en masse ;
7. relecture du record, puis journalisation de la date, du SHA et du diff dans
   `docs/AIRTABLE_SYNC_LOG.md`.

Il est interdit de créer un statut, renuméroter un ticket, écraser un blocage,
publier une interface Airtable ou supprimer/archiver un enregistrement sans
autorisation explicite. Git ne reçoit jamais automatiquement une valeur venue
d'Airtable : tout changement de définition repasse par une revue Git.

### Schéma opérationnel attendu

Chaque ticket V4.1 doit pouvoir exposer les champs suivants. Un champ absent de
la base est consigné comme écart de gouvernance ; il n'est jamais déclaré
disponible par simple convention documentaire.

- identifiant stable du ticket ;
- release, epic, nature et risque ;
- owner et reviewer distincts ;
- statut et blocage courant ;
- dépendances et critères d'acceptation ;
- source canonique ;
- branche, PR et SHA ;
- preuves QA ;
- arbitrage Rayan ;
- date de dernière synchronisation.

Les vues opérationnelles attendues sont : `V4.1 — Maintenant`, `Ready`,
`En cours par owner`, `Review`, `QA`, `Arbitrages Rayan`, `Gate de release`,
`V4.5 — Préparation`, `V5 — Candidats` et `Archive V4`. Une vue non publiée ou
non vérifiée reste un élément à configurer ; sa présence ne peut pas être
inférée depuis le seul schéma des tickets.

### Rôles stables

Les champs `Owner` et `Reviewer` utilisent exclusivement les huit rôles
suivants pour V4.1 et les releases suivantes :

- `Architecture/Produit` : architecture, ADR, backlog et documentation ;
- `Frontend` : React, shadcn et surfaces applicatives ;
- `Backend/Data` : API, Prisma, crédits, finance technique et sécurité serveur ;
- `QA/Release` : tests, couverture, previews, rollback et release ;
- `IA/Recherche` : preuves expérimentales, correction assistée et V4.5 ;
- `Design` : validation visuelle sans mutation des contrats métier ;
- `Finance` : consultation économique V4.5 uniquement ;
- `Rayan` : arbitrages produit, dépenses et GO de production.

Chaque ticket possède exactement un owner et un reviewer distinct. Les
expertises supplémentaires requises sont inscrites dans les critères ou les
preuves QA, jamais concaténées dans ces deux champs.

Les valeurs historiques (`AGENT-*`, `Frontend platform`, `Release engineering`
et synonymes) restent lisibles sur les cartes archivées afin de préserver
l'audit. Elles sont retirées du workflow actif : aucun nouveau ticket ne peut
les utiliser et leur réactivation exige une décision explicite. Cette règle
archive les anciens agents au niveau opérationnel sans effacer leur historique
ni les décisions uniques déjà extraites dans les sources canoniques.

### Natures de tickets

La taxonomie active est bornée aux six valeurs suivantes :

- `Audit/Gouvernance` pour V4.1-001 à V4.1-007 ;
- `Migration frontend` pour V4.1-101 à V4.1-104 ;
- `Design system` pour V4.1-201 à V4.1-203 ;
- `Surface fonctionnelle` pour V4.1-301 à V4.1-305 ;
- `Refactor technique` pour V4.1-401 à V4.1-404 ;
- `Qualité/Release` pour V4.1-501 à V4.1-504.

Les anciennes valeurs de nature restent historiques et ne s'appliquent pas à
V4.1. Une valeur nouvelle exige une modification revue de ce contrat avant sa
création dans Airtable.

## 1. Contrat d'affectation

Une affectation exploitable contient :

- ticket et résultat attendu ;
- owner et reviewer distincts ;
- branche de base et SHA exact ;
- branche et worktree dédiés ;
- fichiers ou domaines autorisés ;
- dépendances et statut d'activation ;
- validations attendues ;
- mutations interdites et autorité de promotion.

Si une dépendance bloquante manque, l'agent produit uniquement les diagnostics
ou artefacts préparatoires explicitement autorisés. Il ne transforme pas un
statut `bloqué` en permission implicite.

## 2. Isolation Git

Avant toute édition :

1. vérifier le SHA de la base et l'état du worktree principal en lecture seule ;
2. créer ou rejoindre uniquement le worktree affecté ;
3. confirmer la branche courante et son upstream ;
4. relever les changements préexistants dans le worktree affecté ;
5. arrêter en cas de recouvrement non résoluble avec des changements utilisateur.

Un agent ne nettoie jamais un autre worktree. Il n'exécute pas `reset --hard`,
`checkout --`, `clean`, `worktree prune/remove`, suppression de branche,
force-push ou réécriture d'historique sans ordre explicite portant sur les
cibles exactes. Une entrée `prunable` reste préservée jusqu'à un ticket de
qualification revu.

### Ports Playwright : un serveur par checkout

Les suites Playwright dérivent leur port du répertoire de travail. Chaque
worktree écoute donc sur le sien, et un `pnpm dev` laissé tourner dans un autre
checkout ne peut plus capter la suite : c'est arrivé le 29 août 2026, et le
symptôme est le pire qui soit — un run vert ou rouge sur un build qui n'est pas
celui de la revue, sans rien dans le diff pour l'expliquer.

Trois bandes de ports, pour que les suites d'un même worktree ne se marchent
pas dessus non plus : `41xxx` pour `test:e2e`, `42xxx` pour `test:visual`,
`43xxx` pour `test:e2e:production`. La logique tient dans
`playwright.ports.ts`.

En CI rien ne change : un checkout par runner, port fixe, et la variable `CI`
court-circuite le calcul avant tout hachage. Pour forcer un port en local —
débogage d'un proxy, navigateur attaché — `LEARNX_PLAYWRIGHT_PORT` a la
priorité.

La réutilisation d'un serveur à l'intérieur d'un même worktree reste active :
c'est la boucle courte, et un serveur lancé depuis ce répertoire sert bien ce
répertoire. Si le build testé paraît périmé, tuer le serveur du worktree
courant suffit.

## 3. Périmètre et sources

- lire `AGENTS.md`, puis `docs/INDEX.md`, puis uniquement les documents routés
  par le ticket ;
- ne pas charger les archives comme instructions ;
- ne pas modifier un backlog antérieur pour faciliter le ticket courant ;
- préserver `Program > Stage > Module > Lesson` et les autres contraintes de
  domaine ;
- conserver secrets, données sensibles et payloads utilisateur hors des logs,
  prompts, fixtures et commits ;
- traiter les artefacts de recherche IA désignés par
  `docs/DOCUMENT_MANIFEST.yaml` comme append-only.

Une source de synthèse ou un digest facilite la navigation. La preuve brute, le
contrat promu et le code réellement exécuté gardent leur autorité propre.

## 4. Exécution d'un lot

L'owner :

1. annonce hypothèses et limites ;
2. inspecte avant de modifier ;
3. réalise le plus petit changement cohérent couvrant les critères ;
4. utilise des commits et artefacts traçables ;
5. exécute les validations proportionnées au risque ;
6. contrôle le diff et l'absence de fichiers hors périmètre ;
7. documente toute validation impossible sans la masquer ;
8. remet le SHA au reviewer sans pousser ni fusionner sauf autorisation.

Un agent parallèle ne cherry-pick pas la branche d'un autre agent pendant que
celle-ci évolue. Le handoff porte sur un SHA immuable. Toute résolution de
conflit appartient à la branche d'intégration et conserve les intentions des
deux lots.

## 5. Revue indépendante

Le reviewer vérifie les critères depuis le SHA remis. Il ne s'appuie pas sur le
seul résumé de l'owner. Son verdict est l'un des suivants :

- `accepté` avec preuves et limites résiduelles ;
- `changements demandés` avec critères non couverts ;
- `bloqué` avec dépendance externe précise.

Le reviewer ne corrige pas silencieusement le lot qu'il évalue. Une correction
matérielle retourne à l'owner ou devient un ticket/commit explicitement attribué.

## 6. Validations et Definition of Done

La grille par défaut est : format documentaire, lint, typecheck, tests ciblés,
suite complète, e2e et build. Un lot purement documentaire n'a pas à lancer des
services ou tests applicatifs sans rapport avec son risque, mais doit au
minimum :

- valider le format des fichiers modifiés ;
- vérifier liens, identifiants, statuts et structure machine-readable ;
- contrôler `git diff --check` ;
- relire le diff depuis la base ;
- signaler clairement les validations non exécutées.

Une commande rouge reste rouge dans le handoff. Il est interdit de supprimer
un test, ignorer une erreur ou modifier une baseline pour fabriquer un GO.

## 7. Commit et handoff

Un ticket correspond idéalement à un commit. Avant le commit, l'owner confirme
branche, statut et liste des fichiers. Aucun push, merge, déploiement,
publication, paiement, appel fournisseur payant ou modification de données
réelles n'est inclus sans autorisation explicite.

Le handoff minimal contient :

```text
Ticket(s):
Branche / worktree:
Base exacte:
Commit SHA:
Fichiers modifiés:
Résultat livré:
Validations passées:
Validations non exécutées:
Limites / dette:
Sorties et leur destination:
Rollback ou revert:
Action attendue du reviewer:
```

`Sorties et leur destination` (règle du 29 août 2026, après deux défauts
V4.5-116 et V4.5-119) : pour **chaque valeur que le composant calcule ou
mesure** (résultat, coût, latence, route, signal), nommer la ligne, le champ
ou l'appelant où elle atterrit — ou écrire « abandonnée volontairement ».
Un composant correct dont la sortie n'est lue par personne est un défaut ;
cette ligne est celle qui l'attrape avant la revue, pas pendant.

## 8. Promotion et clôture

Seule la branche d'intégration désignée peut promouvoir un SHA revu. Une
branche locale, un worktree ou un commit livré n'est pas une preuve de
déploiement. Le statut `terminé` exige le verdict du reviewer et la preuve
promue requise par le ticket. Les releases V4.1, V4.5 et V5 exigent en plus leur
gate de séquence et le GO explicite du Propriétaire.
