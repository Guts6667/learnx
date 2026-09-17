# Test-retest du propriétaire — lecture, 7 septembre 2026

Fichier lu : `adjudication-retest.owner.2026-09-07.json`, sha256 `ceaf6cac…`,
forme canonique intacte, tranche R-01 (`sliceSourceHash` conforme au fichier
`adjudication-retest.v1.json`), 10 cartes, échauffement repris de la passe
principale (`warmupSource: main-pass`). Deux jours après la passe 1 (5
septembre), après la passe 2 en choix forcé, sans revoir les réponses.

| | passe 1 → relecture |
|---|---|
| verdict identique | **7 / 10** |
| phrases de preuve identiques | 8 / 10 |
| abstentions | 1 (passe 1 : 1 sur ces cartes aussi, pas la même) |
| durée médiane par carte | 204 s → 57 s |

Les trois changements, avec le membre que la clé donne à la carte :

| carte | atome | membre | passe 1 | relecture | sens |
|---|---|---|---|---|---|
| C-00b4a1c0a0 | rl.a2 | original | non | oui | vers la clé |
| C-ccc2405200 | cf.a2 | abîmée | oui | je ne peux pas dire (« que des déductions conditionnelles ») | vers la clé |
| C-d6444cb6e3 | pe.a3 | original | je ne peux pas dire | oui | vers la clé |

Lecture : la stabilité du relecteur est de 7 cartes sur 10, exactement la
valeur observée sur le seul modèle relancé deux fois (Luna 5.6, 3
changements sur 10). Les trois changements vont tous dans le sens de la
clé, sans qu'aucune de ces cartes ait été vue avec sa clé ; l'explication
la plus simple est l'effet de la passe 2, qui a entraîné le relecteur à la
comparaison, pas un hasard. Cet effet est une raison de plus de tenir
l'étiquette de paire, issue de la passe 2, pour le corrigé, et la passe 1
pour ce qu'elle est : un jugement absolu de première lecture.

Aucun seuil n'était déclaré ; rien n'est décidé ici. La seconde personne
reste nécessaire.
