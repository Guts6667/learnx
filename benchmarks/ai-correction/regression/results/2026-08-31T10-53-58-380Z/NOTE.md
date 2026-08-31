# Pré-test 2.3.0 — interrompu par moi, récupéré, partiel

**27 cellules sur 37, 0,6194 USD dépensés, toutes VALID.** Le run n'est pas allé
au bout : je l'ai tué.

## Ce qui s'est passé

Pendant que ce run écrivait dans son répertoire, j'ai lancé `git stash -u` puis
`git checkout -B` dans le même worktree pour préparer une autre branche. Le
`-u` a emporté le répertoire de résultats — non suivi par git, donc traité comme
du bruit — et le `git stash drop` qui a suivi l'a jeté. Le processus a continué
d'écrire dans un chemin qui n'existait plus, et est mort sur `ENOENT` à la
28ᵉ cellule.

Récupéré depuis l'objet dangling `73e0ccfe` via `git fsck --unreachable`. Les
27 tentatives et le registre sont intacts ; les verdicts vérificateur et le
résumé n'ont jamais été écrits.

**La leçon est simple : ne jamais lancer d'opération git destructive sur un
worktree où tourne un run payant.** Les artefacts d'un run en cours ne sont pas
suivis par git, donc `-u` les emporte sans avertir.

## Ce que les 27 cellules disent quand même

Cinq des sept violations de direction du 30 août ont été rachetées sous 2.3.0 :

| Mutant | Critère | 2.2.0 | 2.3.0 |
| --- | --- | --- | --- |
| `writing-v1-decision-memo#FACT_INVERSION` | comparative-arithmetic | mastered | **limited** |
| `roof-tender#SENTENCE_DELETION` | residual-risk-coverage | mastered | **partial** |
| `explanatory-analysis#SENTENCE_DELETION` | source-fidelity | mastered | **partial** |
| `maintenance-contract#SENTENCE_DELETION` | residual-risk-surfacing | mastered | mastered |
| `explanatory-analysis#SENTENCE_DELETION@1` | mechanism-link | mastered | **anomalie** |
| deux autres | context-fidelity | mastered | non achetées |

**Le cas arithmétique a été corrigé.** J'avais prédit qu'il survivrait, parce que
la consigne D — la même instruction adressée au vérificateur — l'avait laissé
passer. La prédiction était fausse : adressée au primaire, l'instruction de
recalcul fonctionne là où elle échouait sur le vérificateur.

## L'anomalie, résolue — et c'est le vrai résultat du pré-test

Le mutant `#mechanism-link@1` a renvoyé **deux critères au lieu de trois**, en
omettant `mechanism-link` — le critère même que la mutation vise, celui dont
l'appui textuel a été supprimé.

Le même mutant, sous 2.2.0, avait renvoyé les trois : `source-fidelity`,
`mechanism-link`, `uncertainty-boundary`. Ce n'est donc pas une lecture fautive
du contrat de ma part.

Distribution sur les cellules rachetées : **20 attentes à 3 critères, 1 à 2**,
soit 1 sur 21. Rare, pas systématique, et réel.

**Le mécanisme est plausible et il est mauvais.** 2.3.0 dit de ne pas créditer ce
que le texte ne dit pas. Sur le critère dont la preuve a été retirée, le modèle
n'a pas baissé le niveau : il a **supprimé le critère**.

### Pourquoi c'est plus grave que le défaut qu'on corrige

`validateBenchmarkProtocol3ModelOutputWithEvidence`, le validateur du banc, ne
vérifie **pas** que chaque critère du contrat est traité. Le runtime, lui, le
vérifie : `validateCorrectionOutputForContract` lève « Correction output must
assess every criterion exactly once ».

Conséquence : une sortie que la production **rejetterait** est enregistrée
`VALID` par le banc. Et un critère omis disparaît du numérateur comme du
dénominateur de tous les gates. `mutation-direction-violations` compterait donc
**moins de violations parce que le modèle a cessé de répondre** — le gate
s'améliore quand le modèle se tait.

C'est exactement l'angle mort annoncé avant le pré-test : la suite sait détecter
un correcteur trop généreux, pas un correcteur qui se dérobe. Ici elle ferait
mieux que ça — elle compterait la dérobade comme un progrès.

### Ce qu'il faut avant la mesure complète

1. **Aligner le validateur du banc sur celui du runtime** : un critère manquant
   doit rendre la tentative invalide, comme en production. Sinon le banc mesure
   un système que la production refuserait.
2. **Un oracle de critères omis**, rapporté, pour que le cas se voie même quand
   il ne casse rien.
3. Seulement ensuite, la mesure complète de 2.3.0 — sinon 6 USD achètent un
   chiffre dont on sait déjà qu'il peut flatter.

Le pré-test a coûté **0,6194 USD** et a trouvé une façon dont 2.3.0 pouvait
paraître réussir tout en régressant. C'était le but.
