# V4-003B — Audit autonome indépendant

- **Verdict** : `BLOCKED_WITH_FINDINGS`
- **Date** : 21 août 2026
- **Baseline auditée** : `cd78673b6fa0d52052ef76ac0dc685b961cdc7ed`
- **Paquet audité** : V4-003A, empreinte
  `7bbea4ae4d024eed8dc91f0847c8f2021b28fd35e40fe7933b02af4568cf1297`
- **Auditeurs** : `AGENT-METHODOLOGIE` indépendant et consultation
  `AGENT-DEV-LEARNX`
- **Appel modèle, réseau, holdout ou budget** : aucun
- **Retuning pendant l’audit** : aucun

## Conclusion

Le contrat pédagogique v2 reste valide et le corpus V4-003A courant se
reconstruit correctement. L’audit ne trouve aucun P0, mais plusieurs P1 rendent
la preuve insuffisante pour figer une identité expérimentale.

V4-003C reste donc fermé. Le paquet V4-003A demeure une preuve historique
immuable ; les corrections doivent créer une version successeur distincte,
puis subir un nouvel audit indépendant.

## Findings P1 bloquants

### 1. Injection et canari non discriminants

Le seul cas d’injection ajoute une demande de meilleur niveau à une réponse déjà
entièrement `mastered`. Un système compromis et un système sûr peuvent donc
produire le même résultat attendu. Le validateur interdit bien de citer les
segments `INJECTION` et `CANARY`, mais le cas ne détecte pas une inflation des
statuts ou niveaux.

La version corrective doit utiliser une base négative ou partielle dont
l’injection demande explicitement une inflation observable, et imposer la
présence effective des deux types de segments dans cette famille.

### 2. Désaccord entre passes jamais exercé

Les passes chercheur et falsificateur reçoivent exactement le même vecteur de
findings. Le chemin d’accord déterministe est testé, mais aucune divergence
contrôlée ne prouve la consolidation indépendante, l’ambiguïté issue d’un
désaccord ou l’abstention attendue.

La version corrective doit porter deux vecteurs construits séparément et
inclure au moins accord, désaccord matériel et désaccord non matériel.

### 3. Couverture sémantique et symétrie insuffisantes

PECO et PCC ne possèdent que des cas positifs complets. Aucune paire minimale ne
retire une condition séparée. Les absences, refus explicites, contradictions,
ambiguïtés et mappings rejetés sont concentrés sur le projet A ; le projet B
n’exerce pas les mêmes frontières.

La version corrective doit ajouter les conditions manquantes PECO/PCC une par
une et un ensemble négatif symétrique sur B, sans modifier le contrat.

### 4. Empreinte et verdict pas entièrement liés

L’empreinte canonique trie les clés, tandis que la comparaison des niveaux
attendus utilise un `JSON.stringify` sensible à leur ordre. Deux fichiers de
même sens et de même empreinte canonique peuvent donc recevoir deux verdicts
différents. De plus, le test vérifie seulement la forme SHA-256 de l’empreinte,
pas sa valeur gelée.

La version corrective doit comparer des projections canoniques et épingler
l’empreinte attendue dans un test fail-closed.

### 5. Faux positifs structurels possibles dans le harness

- une clé étrangère ou mal orthographiée dans `findingOverrides` est ignorée ;
- sept mutations peuvent réutiliser le même opérateur, car seule l’unicité des
  identifiants est imposée ;
- une famille nommée `INJECTION_INVARIANCE` n’est pas obligée de contenir un
  segment `INJECTION` et un segment `CANARY`.

Le validateur successeur doit refuser ces trois états et vérifier la couverture
exacte de chaque opérateur attendu.

## P2 non bloquant

Les invariants comparent principalement les statuts atomiques et niveaux. Une
dérive des spans, claims, bindings, conditions ou conflits peut rester invisible
si le statut final ne change pas. Une projection canonique du certificat doit
être comparée dans la version corrective lorsque l’invariant le requiert.

## Éléments conformes conservés

- empreintes recalculées et concordantes sur le paquet courant ;
- 19 cas et 7 opérateurs de mutation réellement distincts dans le corpus
  audité ;
- aucune clé étrangère présente dans les overrides actuels ;
- aucun segment injection/canari consommé comme preuve ;
- spans exacts vérifiés par offsets, slice et SHA-256 ;
- niveaux et état calculés par LearnX ;
- score `null` et progression `NONE` ;
- 16/16 contrôles ciblés relancés depuis le worktree d’audit.
- 1 107/1 107 tests globaux, lint, typecheck et build verts après intégration
  documentaire du verdict.

Ces conformités ne compensent pas les P1 : elles prouvent que le paquet actuel
est cohérent, pas que le harness détecterait toutes les régressions qu’il
revendique.

## Suite autorisée

1. `V4-003A-R1` produit un oracle mécanique successeur versionné et corrige
   uniquement les findings ci-dessus, sans modifier le contrat pédagogique.
2. `V4-003B-R1` audite ce nouveau paquet de manière indépendante.
3. `V4-003C` ne s’ouvre que si ce nouvel audit rend `READY_TO_FREEZE`.

Aucun modèle, budget, holdout, publication ou activation n’est autorisé par ce
rapport.
