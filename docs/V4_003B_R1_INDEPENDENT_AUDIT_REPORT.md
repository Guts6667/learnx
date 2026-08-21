# V4-003B-R1 — Audit indépendant de l'oracle mécanique v2.1

- **Verdict** : `READY_TO_FREEZE`
- **Date** : 21 août 2026
- **Baseline auditée** : `b91cb68bfd15fd7c6b83911450a87466974f2c2f`
- **Commit du paquet v2.1** : `0f650d4`
- **Empreinte canonique v2.1** :
  `2c35125ea438cf1686ae88b01ecdb28bc304a3c9b9af6d45cff81f37306af3c2`
- **Audit** : read-only, sans retuning, réseau, modèle, holdout ou modification

## Verdict

L'audit indépendant ne relève aucun finding P0 ou P1. Les cinq findings P1 de
V4-003B sont fermés par le paquet v2.1. V4-003C peut préparer hors ligne le gel
d'une nouvelle identité expérimentale. Ce verdict n'autorise ni appel modèle,
ni budget, ni publication, ni activation.

## Fermeture des findings bloquants

| Finding historique | Preuve auditée | Verdict |
| --- | --- | --- |
| Injection/canari non discriminants | Le cas part d'une réponse partielle, demande une inflation et conserve le résultat attendu ; segments `INJECTION` et `CANARY` obligatoires et interdits comme preuves. | Fermé |
| Deux passes non exercées | Vecteurs researcher/falsifier séparés ; accord, désaccord matériel et désaccord non matériel recalculés. | Fermé |
| Conditions PECO/PCC insuffisantes | Six cas retirent une condition à la fois et localisent la lacune à `choice-rationale`. | Fermé |
| Asymétrie du projet B | Absence, refus explicite, contradiction, ambiguïté et mapping rejeté sont exercés sur B. | Fermé |
| Harness insuffisamment fail-closed | Empreinte épinglée, comparaison canonique, overrides étrangers rejetés et sept opérateurs exacts imposés. | Fermé |

Le corpus maintient `candidateMaySetScore=false` et
`candidateMaySetProgression=false`. Le brief, le contrat, la rubrique compilée,
l'absence de compensation entre scénarios et les autorités score/progression
restent cohérents.

## P2 non bloquant

Les invariants de localité comparent principalement les statuts atomiques et
les niveaux, pas encore une projection complète des spans, claims, bindings,
conditions et conflits du certificat. Cette limite est déclarée, ne contredit
aucun gate actuel et doit être conservée comme amélioration future.

## Reproductibilité

- 50/50 tests moteur v2, oracle v2 et oracle v2.1 verts ;
- paquet v2.1 byte-identique entre `0f650d4` et la baseline auditée ;
- trois artefacts v2 historiques byte-identiques à la baseline du premier audit
  et conformes aux SHA-256 publiés ;
- `git diff --check` vert ;
- worktree propre après audit ;
- aucun réseau, modèle, holdout, retuning ou fichier modifié.

## Gate suivant

Le seul ticket ouvrable devient `V4-003C`. Il doit figer et empreinter hors
ligne le dossier expérimental exact : modèle, route, profil, corpus, mapping,
runner, télémétrie et stop-policy. Rayan C doit ensuite valider ce dossier.
V4-003D, tout appel modèle et le holdout restent fermés.
