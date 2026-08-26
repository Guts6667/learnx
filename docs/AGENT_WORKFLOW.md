# Workflow canonique des agents LearnX

## Autorité

- Version : 1.0.0
- Date : 26 août 2026
- Owner : Release engineering
- Reviewer : Architecture / Produit

Ce workflow complète `AGENTS.md` sans le remplacer. `AGENTS.md`, le ticket
actif et les instructions explicites du Propriétaire prévalent. Il s'applique
aux lots parallèles, aux worktrees et aux handoffs ; il n'autorise pas à lancer
des agents ou à muter un système externe lorsque la tâche ne le demande pas.

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
Rollback ou revert:
Action attendue du reviewer:
```

## 8. Promotion et clôture

Seule la branche d'intégration désignée peut promouvoir un SHA revu. Une
branche locale, un worktree ou un commit livré n'est pas une preuve de
déploiement. Le statut `terminé` exige le verdict du reviewer et la preuve
promue requise par le ticket. Les releases V4.1, V4.5 et V5 exigent en plus leur
gate de séquence et le GO explicite du Propriétaire.
