# `benchmark.v3_2.json` — configuration de mesure de la consigne 2.3.0

Copie de `benchmark.v3_1.json` : mêmes candidats, même corpus, même protocole,
même identité primaire. **Une seule différence** — `controlPrompt.instructions`
reçoit les quatre lignes de suffisance de preuve du brouillon 2.3.0, et la
version passe de 2.2.0 à 2.3.0.

## Pourquoi cette configuration existe

Mesurer avant de promouvoir. La suite lit sa consigne dans la **configuration**,
pas dans le module runtime : on peut donc mesurer 2.3.0 sans rien câbler.
`selectPinnedCandidate` épingle le modèle et l'identité, pas la version de
consigne, ce qui rend la mesure possible sans affaiblir l'épinglage.

**Le runtime reste en 2.2.0** tant que cette mesure n'a pas été jugée. Si elle
convainc, la voie qui possède `src/server/corrections/` porte la consigne et
incrémente la version. Si elle ne convainc pas, rien n'a été promu sur une
intuition.

## Ce qu'elle doit faire bouger

- `mutation-direction-violations` : 7/47 = 14,89 % — c'est la cible.
- `eventual-unusable-runs` : 9/240 = 3,75 % — à surveiller, une consigne plus
  exigeante peut l'aggraver.
- `model-authored-agreement` : 84,25 % — une **baisse est attendue** et n'est pas
  une régression. L'étalon est écrit par un modèle, rapporté et jamais bloquant ;
  une règle de suffisance descend des niveaux, donc s'éloigne d'un étalon qui ne
  l'applique pas.
