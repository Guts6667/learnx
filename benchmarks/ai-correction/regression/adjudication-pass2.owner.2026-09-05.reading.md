# Passe 2 du propriétaire — lecture, 5 septembre 2026

Fichier lu : `adjudication-pass2.owner.2026-09-05.json`, sha256 `9c899259…`,
forme canonique intacte, empreintes du paquet et des paires conformes, 45
décisions, une par paire, gauche/droite conformes au fichier des paires.
Relecteur unique. Seuils : ceux déclarés dans le journal avant la première
réponse.

## Résultat contre la clé

| 37 paires primaires | |
|---|---|
| original choisi | **30** |
| abîmé choisi | 3 |
| « les deux autant » | 2 |
| « aucune des deux » | 2 |

Paires tranchées : 33. Au hasard, obtenir 30 originaux ou plus sur 33 a
une probabilité inférieure à 1 sur 100 000. Le seuil déclaré (27 sur 37,
ou le test binomial unilatéral à 1 % recalculé sur les paires tranchées,
soit 24 sur 33) est dépassé largement. Non tranchées : 4 sur 37, sous la
limite de 12.

**Verdict : le paquet tient.** Les cartes abîmées sont bien abîmées pour ce
lecteur dès qu'il compare au lieu de juger dans l'absolu. Les 8 paires du
diagnostic de longueur, rapportées à part : 6 originaux, 2 « aucune des
deux ».

## Ce que ça fait de la passe 1

Sur les 22 paires où la passe 1 avait dit « oui » aux deux membres, la
passe 2 choisit l'original 18 fois, l'abîmé 2 fois, et laisse 2 non
tranchées. La lecture large de la passe 1 était une affaire de seuil
absolu, pas de discrimination : devant les deux copies, la différence est
vue.

## Les 7 paires primaires hors « original »

| paire | famille | choix | raison donnée |
|---|---|---|---|
| 254f951761b2a6c9 | cf.a1, une phrase + dossier | abîmé | « les deux sont conformes mais b est directement et explicitement conforme » |
| 307bf26ab7987a9c | pe.a1, une phrase + dossier | abîmé | — |
| 3be9a87e6c494fa8 | rr.a4, une phrase | abîmé | — |
| 22ec794dc9b36fe4 | rl.a1, une phrase + consigne | les deux autant | « l'un retire une pratique liée à une erreur, l'autre une décision après une erreur » |
| 28fea339dfeb6081 | rr.a2, copie | les deux autant | « une précaution est proposée dans les deux cas mais le risque subsiste aussi dans les deux cas » |
| 455d34eeddf02fc4 | cf.a3, copie + dossier | aucune des deux | « rien n'indique un horizon de 6 mois dans le dossier » |
| 664b5da19fa2b929 | rr.a5, copie | aucune des deux | « le risque n'est pas bien défini » |

Ces 7 paires vont à la troisième lecture avec la seconde personne, comme
déclaré. Elles ne sont pas retirées.

## Étiquette or, telle que déclarée

Pour les 30 paires primaires où l'original a été choisi : l'original
établit, l'abîmé n'établit pas. Pour les 6 paires du diagnostic où
l'original a été choisi : même étiquette, rapportée à part. Les 7 autres
paires primaires et les 2 du diagnostic restent sans étiquette or jusqu'à
la troisième lecture. Les 16 contrôles raccourcis gardent leur rôle de
diagnostic de longueur.

## Ce qui n'est pas fait ici

Aucune modification des réponses, aucune dépense, aucune conclusion sur
la seconde personne ni sur la stabilité du relecteur, qui restent à
mesurer.
