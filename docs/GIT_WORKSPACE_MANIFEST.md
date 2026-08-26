# Manifeste Git et worktrees V4.1

## Nature de l'inventaire

Instantané en lecture seule du 26 août 2026, préparé pour V4.1-001 depuis
`/private/tmp/learnx-v4-1-docs`. Il ne constitue ni une liste de suppression,
ni une preuve qu'une branche est fusionnée, ni une autorisation de nettoyage.

- dépôt : `/Users/rayanchambet/Desktop/Workflow/learnx`
- baseline demandée : `origin/dev`
- SHA de baseline : `a02ecc3f307af36656fa5cb8a7b62954fdec73e9`
- branche de livraison : `codex/v4-1-docs`
- upstream de livraison : `origin/dev`
- mutation de branche/worktree pendant l'audit : aucune, hors création du
  worktree et de la branche de livraison explicitement demandés
- suppression, prune, reset, checkout d'un autre worktree ou push : aucun

Le worktree principal était déjà sur `codex/v2-promotion-gates` avec des
changements non commités. Ils appartiennent à l'utilisateur et n'ont été ni
ouverts pour modification, ni déplacés, ni inclus dans ce lot.

## Résumé observé

| Objet | Nombre | Lecture |
| --- | ---: | --- |
| Branches locales | 93 | 62 avec upstream, 31 sans upstream |
| Branches `codex/*` | 83 | historique de lots multiples, statut non inféré |
| Branches `backup/*` | 2 | conservées |
| Branches d'intégration `dev/main/staging` | 3 | protégées |
| Branches `content/*` | 1 | conservée |
| Branches `feat/*` | 3 | conservées |
| Autre branche `agent/*` | 1 | conservée |
| Worktrees enregistrés | 82 | registre Git au moment de l'instantané |
| Worktrees signalés `prunable` par Git | 70 | conservés, aucun `prune` exécuté |
| Worktrees enregistrés non `prunable` | 12 | inventaire ci-dessous |

Les compteurs décrivent l'instantané ; ils peuvent évoluer avec les autres
agents. Un écart futur n'est pas une anomalie tant que le nouvel inventaire est
daté et ne réécrit pas celui-ci.

## Worktrees non `prunable` observés

| Chemin | Branche ou état | HEAD observé | Propriété présumée |
| --- | --- | --- | --- |
| `/Users/rayanchambet/Desktop/Workflow/learnx` | `codex/v2-promotion-gates` | `b16e972f` | utilisateur, changements présents |
| `/private/tmp/learnx-totem-three-authorities` | `codex/v4-critical-screens` | `a02ecc3f` | lot parallèle |
| `/private/tmp/learnx-v4-1` | `codex/v4-1-foundation` | `a02ecc3f` | lot V4.1 parallèle |
| `/private/tmp/learnx-v4-1-docs` | `codex/v4-1-docs` | `a02ecc3f` | ce lot |
| `/private/tmp/learnx-v4-1-qa` | `codex/v4-1-qa` | `a02ecc3f` | lot V4.1 parallèle |
| `/private/tmp/learnx-v4-1-react` | `codex/v4-1-react-foundation` | `a02ecc3f` | lot V4.1 parallèle |
| `/Users/rayanchambet/.codex/worktrees/1f22/learnx` | détaché | `221e34fc` | Codex |
| `/Users/rayanchambet/.codex/worktrees/a0c7/learnx` | détaché | `8d4ee13b` | Codex |
| `/Users/rayanchambet/.codex/worktrees/fc37/learnx` | détaché | `221e34fc` | Codex |
| `/Users/rayanchambet/Desktop/Workflow/learnx-temp-sourcelab` | détaché | `b5f50130` | utilisateur / SourceLab |
| `/Users/rayanchambet/Documents/Codex/2026-08-03/referenced-chatgpt-conversation-this-is-an/work/learnx-editorial` | `agent/editorial-governance` | `8cc1dcd6` | éditorial |
| `/Users/rayanchambet/Documents/Codex/learnx-v3-backlog-sync` | `codex/v3-backlog-sync` | `1002cff3` | historique V3 |

Les 70 entrées `prunable` restent dans le registre Git. Le signal `prunable`
indique seulement que Git ne retrouve plus leur fichier administratif ; il ne
prouve ni fusion, ni obsolescence, ni absence d'artefacts ailleurs. Leur
effacement est donc hors périmètre.

## Branches sensibles au séquençage

- `origin/dev` est la baseline demandée au SHA `a02ecc3f`.
- la branche locale `dev` observée pointe sur `5534bf97` et ne doit pas être
  déplacée implicitement pour rejoindre `origin/dev` ;
- `main` et `staging` observées pointent sur `221e34fc` et ont chacune un
  worktree enregistré ;
- les branches V4, recherche IA, SourceLab, contenu, backup et release restent
  des historiques à qualifier ticket par ticket ; leur préfixe ne vaut pas
  verdict ;
- les branches V4.1 parallèles partagent la baseline mais leurs changements ne
  doivent être intégrés que par SHA explicite après revue.

## Commandes de reproduction autorisées

Ces commandes sont en lecture seule :

```bash
git rev-parse origin/dev
git status --short --branch
git for-each-ref \
  --format='%(refname:short)|%(objectname:short)|%(upstream:short)|%(worktreepath)' \
  refs/heads
git worktree list --porcelain
git branch --contains <sha>
git diff --stat <base>...<head>
```

Commandes interdites dans un audit sans autorisation dédiée :
`git worktree prune`, `git worktree remove`, `git branch -d/-D`, `git reset`,
suppression de répertoire, force-push ou déplacement d'une branche partagée.

## Gate avant toute rationalisation future

Pour chaque branche ou worktree proposé au nettoyage, un ticket distinct doit
fournir : owner, reviewer, dernier SHA, upstream, worktree, état dirty, preuve
de fusion ou de sauvegarde, artefacts uniques, dépendants, rollback et accord
explicite du Propriétaire. Sans ces éléments, la décision canonique est
`préserver`.
